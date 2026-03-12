const mongoose = require('mongoose');
const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Expense = require('../models/Expense');
const moment = require('moment');

exports.generateMonthlyPayroll = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { period } = req.body; // e.g., "03-2026"
        if (!period) return res.status(400).json({ error: 'Period is required (MM-YYYY)' });
        if (!/^\d{2}-\d{4}$/.test(period)) return res.status(400).json({ error: 'Period must be in MM-YYYY format' });

        const [month, year] = period.split('-');

        const employees = await Employee.find({ tenant, status: 'Active' });
        const payrollResults = [];

        // Pre-fetch already-locked payroll records for this period (Approved/Partially Paid/Paid)
        const lockedPayrolls = new Set(
            (await Payroll.find({ tenant, period, status: { $in: ['Approved', 'Partially Paid', 'Paid'] } }).select('employeeId').lean())
                .map(p => p.employeeId.toString())
        );

        for (const emp of employees) {
            // Skip employees whose payroll for this period is already approved or paid
            if (lockedPayrolls.has(emp._id.toString())) continue;

            const settings = emp.contractSettings || {};
            const baseSalary = settings.monthlySalary || emp.salary || 0;

            const paddedMonth = month.padStart(2, '0');
            const nextMonthNum = Number(month) === 12 ? 1 : Number(month) + 1;
            const nextYear = Number(month) === 12 ? String(Number(year) + 1) : year;
            const periodStart = `${year}-${paddedMonth}-01`;
            const periodEnd   = `${nextYear}-${String(nextMonthNum).padStart(2, '0')}-01`;
            const records = await Attendance.find({
                tenant,
                employeeId: emp._id,
                date: { $gte: periodStart, $lt: periodEnd }
            });

            let totalWorked = 0, totalRequired = 0, totalLate = 0;
            let totalMissing = 0, totalOvertime = 0, daysAbsent = 0;

            for (const rec of records) {
                totalWorked   += rec.workedMinutes;
                totalRequired += rec.requiredMinutes;
                totalLate     += rec.lateMinutes;
                totalMissing  += rec.missingMinutes;
                totalOvertime += rec.overtimeMinutes;
                if (rec.status === 'Absent') daysAbsent++;
            }

            const standardMonthlyMinutes = 22 * (settings.dailyRequiredMinutes || 480);
            const ratePerMinute = baseSalary / standardMonthlyMinutes;

            let missingTimeDeductions = 0, overtimeAdditions = 0, absenceDeductions = 0;

            if (settings.deductionRules?.missedMinutes) {
                missingTimeDeductions = Math.round(totalMissing * ratePerMinute);
            }
            if (settings.overtimeEnabled) {
                const multiplier = settings.overtimeRateMultiplier || 1.5;
                overtimeAdditions = Math.round(totalOvertime * ratePerMinute * multiplier);
            }

            const dailyRate = baseSalary / 22;
            absenceDeductions = Math.round(daysAbsent * dailyRate);

            const finalPayableSalary = Math.round(baseSalary + overtimeAdditions - missingTimeDeductions - absenceDeductions);

            const payrollData = {
                tenant,
                employeeId: emp._id,
                period,
                baseSalary,
                metricsTotal: {
                    totalWorkedMinutes: totalWorked,
                    totalRequiredMinutes: totalRequired,
                    totalLateMinutes: totalLate,
                    totalMissingMinutes: totalMissing,
                    totalOvertimeMinutes: totalOvertime
                },
                overtimeAdditions,
                missingTimeDeductions,
                absenceDeductions,
                finalPayableSalary: Math.max(0, finalPayableSalary),
                status: 'Pending Approval'
            };

            await Payroll.findOneAndUpdate(
                { tenant, employeeId: emp._id, period },
                { $set: payrollData },
                { new: true, upsert: true }
            );

            const verifiedDoc = await Payroll.findOne({ tenant, employeeId: emp._id, period });
            if (verifiedDoc) payrollResults.push(verifiedDoc);
        }

        res.json({ message: `Successfully generated payroll for ${period}`, count: payrollResults.length, data: payrollResults });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPayrollRecords = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { period, employeeId } = req.query;
        if (period && !/^\d{2}-\d{4}$/.test(period))
            return res.status(400).json({ error: 'Period must be in MM-YYYY format' });
        const query = { tenant };
        if (period) query.period = period;
        if (employeeId) {
            if (!mongoose.Types.ObjectId.isValid(employeeId))
                return res.status(400).json({ error: 'Invalid employeeId' });
            query.employeeId = employeeId;
        }

        const records = await Payroll.find(query)
            .populate('employeeId', 'name department role email')
            .sort({ createdAt: -1 });
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Approve payroll (Pending Approval → Approved): manager sign-off before payment
exports.approvePayroll = async (req, res) => {
    try {
        const { id } = req.params;
        const payroll = await Payroll.findOne({ _id: id, tenant: req.user.tenant });
        if (!payroll) return res.status(404).json({ error: 'Payroll record not found' });

        if (payroll.status !== 'Pending Approval') {
            return res.status(400).json({ error: `Cannot approve payroll in '${payroll.status}' status. Only 'Pending Approval' records can be approved.` });
        }

        payroll.status = 'Approved';
        payroll.approvedBy = req.user._id;
        payroll.approvedAt = new Date();
        await payroll.save();

        res.json(payroll);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Record payment (Approved → Partially Paid / Paid): finance team records disbursement
exports.recordPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;

        const payroll = await Payroll.findOne({ _id: id, tenant: req.user.tenant });
        if (!payroll) return res.status(404).json({ error: 'Payroll record not found' });

        if (!['Approved', 'Partially Paid'].includes(payroll.status)) {
            return res.status(400).json({ error: `Payroll must be 'Approved' before payment can be recorded. Current status: '${payroll.status}'.` });
        }

        let paymentAmount = amount ? Number(amount) : (payroll.finalPayableSalary - payroll.amountPaid);
        if (paymentAmount <= 0) {
            return res.status(400).json({ error: 'Invalid payment amount.' });
        }

        const newAmountPaid = payroll.amountPaid + paymentAmount;
        if (newAmountPaid > payroll.finalPayableSalary) {
            return res.status(400).json({ error: `Cannot overpay. Maximum remaining balance is ${payroll.finalPayableSalary - payroll.amountPaid} DZD` });
        }

        const newStatus = (newAmountPaid >= payroll.finalPayableSalary) ? 'Paid' : 'Partially Paid';
        payroll.amountPaid = newAmountPaid;
        payroll.status = newStatus;
        await payroll.save();

        // Sync payment to financial ledger
        try {
            const employee = await Employee.findById(payroll.employeeId);
            const empName = employee?.name || 'Unknown Employee';
            await Expense.create({
                tenant: req.user.tenant,
                amount: paymentAmount,
                date: new Date(),
                description: `Salary payment — ${empName} (${payroll.period})${newStatus === 'Partially Paid' ? ' [Partial]' : ''}`,
                category: 'Human Resources',
                source: 'payroll_sync',
                linkedPayrollId: payroll._id
            });
        } catch (syncErr) {
            console.warn('Failed to sync payroll to Financial ledger:', syncErr.message);
        }

        res.json(payroll);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
