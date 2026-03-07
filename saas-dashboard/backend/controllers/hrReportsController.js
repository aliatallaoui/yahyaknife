const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const moment = require('moment');

// 1. Daily Attendance Report
exports.getDailyReport = async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || moment().format('YYYY-MM-DD');

        const records = await Attendance.find({ date: targetDate })
            .populate('employeeId', 'name department role')
            .lean();

        // Compute summary for the day
        const summary = {
            total: records.length,
            present: records.filter(r => r.status === 'Present' || r.status === 'Overtime' || r.status === 'Completed with Recovery').length,
            late: records.filter(r => r.lateMinutes > 0).length,
            absent: records.filter(r => r.status === 'Absent').length,
            incomplete: records.filter(r => r.status === 'Incomplete').length,
            totalOvertimeMinutes: records.reduce((acc, curr) => acc + (curr.overtimeMinutes || 0), 0)
        };

        res.json({ date: targetDate, summary, records });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 2. Monthly Attendance Matrix (Employee x Days)
exports.getMonthlyReport = async (req, res) => {
    try {
        const { period } = req.query; // MM-YYYY
        if (!period) return res.status(400).json({ error: 'period required (MM-YYYY)' });

        const [month, year] = period.split('-');
        const searchPrefix = `${year}-${month.padStart(2, '0')}`;

        const records = await Attendance.find({ date: { $regex: `^${searchPrefix}` } })
            .populate('employeeId', 'name department role')
            .sort({ date: 1 })
            .lean();

        // Group by employee
        const matrix = {};
        records.forEach(rec => {
            if (!rec.employeeId) return; // Skip ghost records of deleted employees

            const empId = rec.employeeId._id.toString();
            if (!matrix[empId]) {
                matrix[empId] = {
                    employee: rec.employeeId,
                    days: {},
                    monthSummary: { lateDays: 0, absentDays: 0, totalOvertimeMin: 0 }
                };
            }
            matrix[empId].days[rec.date] = {
                status: rec.status,
                lateMin: rec.lateMinutes,
                overtimeMin: rec.overtimeMinutes
            };

            if (rec.lateMinutes > 0) matrix[empId].monthSummary.lateDays++;
            if (rec.status === 'Absent') matrix[empId].monthSummary.absentDays++;
            matrix[empId].monthSummary.totalOvertimeMin += (rec.overtimeMinutes || 0);
        });

        res.json({ period, data: Object.values(matrix) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 3. Employee Payroll Report
exports.getPayrollReport = async (req, res) => {
    try {
        const { period } = req.query; // MM-YYYY
        const filter = period ? { period } : {};

        const payrolls = await Payroll.find(filter)
            .populate('employeeId', 'name department role email')
            .sort({ finalPayableSalary: -1 })
            .lean();

        // Enterprise metrics
        const summary = {
            totalLoad: payrolls.reduce((acc, curr) => acc + curr.finalPayableSalary, 0),
            totalDeductions: payrolls.reduce((acc, curr) => acc + curr.missingTimeDeductions + curr.absenceDeductions, 0),
            totalOvertimePaid: payrolls.reduce((acc, curr) => acc + curr.overtimeAdditions, 0)
        };

        res.json({ period: period || 'All Time', summary, records: payrolls });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 4. Overtime Leaders Ranking
exports.getOvertimeReport = async (req, res) => {
    try {
        const { period } = req.query; // MM-YYYY
        if (!period) return res.status(400).json({ error: 'period required (MM-YYYY)' });

        const [month, year] = period.split('-');
        const searchPrefix = `${year}-${month.padStart(2, '0')}`;

        const records = await Attendance.aggregate([
            { $match: { date: { $regex: `^${searchPrefix}` }, overtimeMinutes: { $gt: 0 } } },
            {
                $group: {
                    _id: "$employeeId",
                    totalOvertimeMinutes: { $sum: "$overtimeMinutes" },
                    daysWithOvertime: { $sum: 1 }
                }
            },
            { $sort: { totalOvertimeMinutes: -1 } }
        ]);

        const populated = await Employee.populate(records, { path: '_id', select: 'name department role' });

        const formatted = populated.map(p => ({
            employee: p._id,
            totalOvertimeMinutes: p.totalOvertimeMinutes,
            daysWithOvertime: p.daysWithOvertime
        }));

        res.json({ period, leaders: formatted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 5. Deductions Liability
exports.getDeductionsReport = async (req, res) => {
    try {
        const { period } = req.query; // MM-YYYY
        if (!period) return res.status(400).json({ error: 'period required (MM-YYYY)' });

        const payrolls = await Payroll.find({
            period,
            $or: [{ missingTimeDeductions: { $gt: 0 } }, { absenceDeductions: { $gt: 0 } }]
        }).populate('employeeId', 'name department role').sort({ absenceDeductions: -1, missingTimeDeductions: -1 }).lean();

        res.json({ period, records: payrolls });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
