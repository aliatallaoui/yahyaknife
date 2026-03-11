const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Expense = require('../models/Expense');
const moment = require('moment');

exports.generateMonthlyPayroll = async (req, res) => {
    try {
        const { period } = req.body; // e.g., "03-2026"
        if (!period) return res.status(400).json({ error: 'Period is required (MM-YYYY)' });

        const [month, year] = period.split('-');

        // Find all employees
        const employees = await Employee.find({ status: 'Active' });
        const payrollResults = [];

        for (const emp of employees) {
            const settings = emp.contractSettings || {};
            const baseSalary = settings.monthlySalary || emp.salary || 0; // Fallback to emp.salary if settings misses it

            console.log(`\n⚙️ Calculating for ${emp.name} | Base: ${baseSalary} | Default Salary: ${emp.salary}`);

            // 1. Gather all attendance records for this month
            // We need dates matching 'YYYY-MM-DD' where YYYY-MM matches the period
            const searchPrefix = `${year}-${month.padStart(2, '0')}`;
            const records = await Attendance.find({
                employeeId: emp._id,
                date: { $regex: `^${searchPrefix}` }
            });

            // 2. Aggregate metrics
            let totalWorked = 0;
            let totalRequired = 0;
            let totalLate = 0;
            let totalMissing = 0;
            let totalOvertime = 0;
            let daysAbsent = 0;

            for (const rec of records) {
                totalWorked += rec.workedMinutes;
                totalRequired += rec.requiredMinutes;
                totalLate += rec.lateMinutes;
                totalMissing += rec.missingMinutes;
                totalOvertime += rec.overtimeMinutes;
                if (rec.status === 'Absent') daysAbsent++;
            }

            // Calculate hourly rate based on a standard assumption of 22 working days * 8 hours
            // Or better: Base Salary / (22 * dailyRequiredMinutes) gives minute rate
            const standardMonthlyMinutes = 22 * (settings.dailyRequiredMinutes || 480);
            const ratePerMinute = baseSalary / standardMonthlyMinutes;

            // 3. Financial Calculations
            let missingTimeDeductions = 0;
            let overtimeAdditions = 0;
            let absenceDeductions = 0;

            if (settings.deductionRules?.missedMinutes) {
                missingTimeDeductions = Math.round(totalMissing * ratePerMinute);
            }

            if (settings.overtimeEnabled) {
                const multiplier = settings.overtimeRateMultiplier || 1.5;
                overtimeAdditions = Math.round(totalOvertime * ratePerMinute * multiplier);
            }

            // Absence deduction: Full day salary deducted per absent day
            const dailyRate = baseSalary / 22;
            absenceDeductions = Math.round(daysAbsent * dailyRate);

            const finalPayableSalary = Math.round(baseSalary + overtimeAdditions - missingTimeDeductions - absenceDeductions);

            // 4. Save to DB
            const payrollData = {
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
                finalPayableSalary: Math.max(0, finalPayableSalary), // Prevent negative salaries
                status: 'Pending Approval'
            };

            // Upsert
            const payrollDoc = await Payroll.findOneAndUpdate(
                { employeeId: emp._id, period },
                { $set: payrollData },
                { new: true, upsert: true, returnDocument: 'after' }
            );

            // If findOneAndUpdate upserts, it might not return the fully hydrated doc if "new" fails on older mongo engines used in saas.
            // So let's fetch it directly.
            const verifiedDoc = await Payroll.findOne({ employeeId: emp._id, period });
            if (verifiedDoc) payrollResults.push(verifiedDoc);
        }

        res.json({ message: `Successfully generated payroll for ${period}`, count: payrollResults.length, data: payrollResults });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPayrollRecords = async (req, res) => {
    try {
        const { period, employeeId } = req.query; // MM-YYYY
        const query = {};
        if (period) query.period = period;
        if (employeeId) query.employeeId = employeeId;

        const records = await Payroll.find(query).populate('employeeId', 'name department role email').sort({ createdAt: -1 });
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.approvePayroll = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body; // New field from frontend for partial payments

        const payroll = await Payroll.findById(id);
        if (!payroll) return res.status(404).json({ error: 'Payroll record not found' });

        if (payroll.status === 'Paid') {
            return res.status(400).json({ error: 'Payroll is already fully paid.' });
        }

        // Determine how much is being paid right now
        // If amount isn't provided, assume they want to clear the entire remaining deficit
        let paymentAmount = amount ? Number(amount) : (payroll.finalPayableSalary - payroll.amountPaid);

        if (paymentAmount <= 0) {
            return res.status(400).json({ error: 'Invalid payment amount.' });
        }

        const newAmountPaid = payroll.amountPaid + paymentAmount;

        // Prevent overpaying an employee
        if (newAmountPaid > payroll.finalPayableSalary) {
            return res.status(400).json({ error: `Cannot overpay. Maximum remaining balance is ${payroll.finalPayableSalary - payroll.amountPaid} DZD` });
        }

        // Determine new status
        const newStatus = (newAmountPaid >= payroll.finalPayableSalary) ? 'Paid' : 'Partially Paid';

        payroll.amountPaid = newAmountPaid;
        payroll.status = newStatus;
        if (newStatus === 'Paid') {
            payroll.approvedAt = new Date();
            payroll.approvedBy = req.user._id;
        }

        await payroll.save();

        // Sync with Financial Module — create expense entry for this payment
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
