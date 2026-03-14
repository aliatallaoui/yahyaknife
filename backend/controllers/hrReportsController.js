const logger = require('../shared/logger');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const moment = require('moment');
const { ok } = require('../shared/utils/ApiResponse');

// 1. Daily Attendance Report
exports.getDailyReport = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { date } = req.query;
        const targetDate = date || moment().format('YYYY-MM-DD');

        const records = await Attendance.find({ tenant, date: targetDate })
            .populate({ path: 'employeeId', match: { deletedAt: null }, select: 'name department role' })
            .lean()
            .then(recs => recs.filter(r => r.employeeId));

        const summary = {
            total: records.length,
            present: records.filter(r => ['Present', 'Overtime', 'Completed with Recovery'].includes(r.status)).length,
            late: records.filter(r => r.lateMinutes > 0).length,
            absent: records.filter(r => r.status === 'Absent').length,
            incomplete: records.filter(r => r.status === 'Incomplete').length,
            totalOvertimeMinutes: records.reduce((acc, curr) => acc + (curr.overtimeMinutes || 0), 0)
        };

        res.json(ok({ date: targetDate, summary, records }));
    } catch (err) {
        logger.error({ err }, 'Error fetching daily attendance report');
        res.status(500).json({ message: 'Failed to generate daily report. Please try again.' });
    }
};

// 2. Monthly Attendance Matrix (Employee x Days)
exports.getMonthlyReport = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { period } = req.query; // MM-YYYY
        if (!period) return res.status(400).json({ message: 'Period is required (MM-YYYY)' });
        if (!/^\d{2}-\d{4}$/.test(period)) return res.status(400).json({ message: 'Period must be in MM-YYYY format' });

        const [month, year] = period.split('-');
        const paddedMonth = month.padStart(2, '0');
        const nextMonthNum = Number(month) === 12 ? 1 : Number(month) + 1;
        const nextYear = Number(month) === 12 ? String(Number(year) + 1) : year;
        const periodStart = `${year}-${paddedMonth}-01`;
        const periodEnd   = `${nextYear}-${String(nextMonthNum).padStart(2, '0')}-01`;

        const records = await Attendance.find({ tenant, date: { $gte: periodStart, $lt: periodEnd } })
            .populate({ path: 'employeeId', match: { deletedAt: null }, select: 'name department role' })
            .sort({ date: 1 })
            .lean()
            .then(recs => recs.filter(r => r.employeeId));

        const matrix = {};
        records.forEach(rec => {
            if (!rec.employeeId) return;
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

        res.json(ok({ period, data: Object.values(matrix) }));
    } catch (err) {
        logger.error({ err }, 'Error fetching monthly attendance report');
        res.status(500).json({ message: 'Failed to generate monthly report. Please try again.' });
    }
};

// 3. Employee Payroll Report
exports.getPayrollReport = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { period } = req.query;
        const filter = { tenant, ...(period ? { period } : {}) };

        const payrolls = await Payroll.find(filter)
            .populate({ path: 'employeeId', match: { deletedAt: null }, select: 'name department role email' })
            .sort({ finalPayableSalary: -1 })
            .lean()
            .then(recs => recs.filter(r => r.employeeId));

        const summary = {
            totalLoad: payrolls.reduce((acc, curr) => acc + curr.finalPayableSalary, 0),
            totalDeductions: payrolls.reduce((acc, curr) => acc + curr.missingTimeDeductions + curr.absenceDeductions, 0),
            totalOvertimePaid: payrolls.reduce((acc, curr) => acc + curr.overtimeAdditions, 0)
        };

        res.json(ok({ period: period || 'All Time', summary, records: payrolls }));
    } catch (err) {
        logger.error({ err }, 'Error fetching payroll report');
        res.status(500).json({ message: 'Failed to generate payroll report. Please try again.' });
    }
};

// 4. Overtime Leaders Ranking
exports.getOvertimeReport = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { period } = req.query;
        if (!period) return res.status(400).json({ message: 'Period is required (MM-YYYY)' });
        if (!/^\d{2}-\d{4}$/.test(period)) return res.status(400).json({ message: 'Period must be in MM-YYYY format' });

        const [month, year] = period.split('-');
        const mm = month.padStart(2, '0');
        const periodStart = `${year}-${mm}-01`;
        const nextMonth = String(Number(mm) + 1).padStart(2, '0');
        const periodEnd = mm === '12' ? `${Number(year) + 1}-01-01` : `${year}-${nextMonth}-01`;

        const records = await Attendance.aggregate([
            { $match: { tenant, date: { $gte: periodStart, $lt: periodEnd }, overtimeMinutes: { $gt: 0 } } },
            { $group: { _id: '$employeeId', totalOvertimeMinutes: { $sum: '$overtimeMinutes' }, daysWithOvertime: { $sum: 1 } } },
            { $sort: { totalOvertimeMinutes: -1 } }
        ]);

        // Filter to active employees only
        const activeEmpIds = await Employee.find({ tenant, deletedAt: null }).select('_id').lean().then(docs => docs.map(d => d._id));
        const activeRecords = records.filter(r => activeEmpIds.some(id => id.equals(r._id)));
        const populated = await Employee.populate(activeRecords, { path: '_id', select: 'name department role' });
        const formatted = populated.map(p => ({
            employee: p._id,
            totalOvertimeMinutes: p.totalOvertimeMinutes,
            daysWithOvertime: p.daysWithOvertime
        }));

        res.json(ok({ period, leaders: formatted }));
    } catch (err) {
        logger.error({ err }, 'Error fetching overtime report');
        res.status(500).json({ message: 'Failed to generate overtime report. Please try again.' });
    }
};

// 5. Deductions Liability
exports.getDeductionsReport = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { period } = req.query;
        if (!period) return res.status(400).json({ message: 'Period is required (MM-YYYY)' });

        const payrolls = await Payroll.find({
            tenant,
            period,
            $or: [{ missingTimeDeductions: { $gt: 0 } }, { absenceDeductions: { $gt: 0 } }]
        }).populate({ path: 'employeeId', match: { deletedAt: null }, select: 'name department role' })
          .sort({ absenceDeductions: -1, missingTimeDeductions: -1 }).lean()
          .then(recs => recs.filter(r => r.employeeId));

        res.json(ok({ period, records: payrolls }));
    } catch (err) {
        logger.error({ err }, 'Error fetching deductions report');
        res.status(500).json({ message: 'Failed to generate deductions report. Please try again.' });
    }
};
