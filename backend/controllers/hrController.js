const logger = require('../shared/logger');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const moment = require('moment');
const { ok, created, message, paginated } = require('../shared/utils/ApiResponse');

exports.getHRMetrics = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const employees = await Employee.find({ tenant }).lean();

        const departmentDistribution = {};
        let activeEmployees = 0;
        let estimatedPayrollDZD = 0;

        employees.forEach(emp => {
            if (!departmentDistribution[emp.department]) departmentDistribution[emp.department] = 0;
            departmentDistribution[emp.department]++;
            if (emp.status === 'Active') {
                activeEmployees++;
                estimatedPayrollDZD += (emp.contractSettings?.monthlySalary || emp.salary || 0);
            }
        });

        const today = moment().format('YYYY-MM-DD');
        const todayAttendance = await Attendance.find({ tenant, date: today }).lean();

        let presentToday = 0;
        let lateToday = 0;
        todayAttendance.forEach(att => {
            if (['Present', 'Completed with Recovery', 'Overtime', 'Incomplete', 'Late'].includes(att.status) || (!att.status && att.morningIn)) presentToday++;
            if (att.lateMinutes > 0) lateToday++;
        });

        res.json(ok({
            totalEmployees: employees.length,
            activeEmployees,
            departmentDistribution,
            estimatedPayrollDZD,
            presentToday,
            lateToday,
            absentToday: Math.max(0, activeEmployees - presentToday)
        }));
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ error: 'Server error' });
    }
};

exports.getEmployees = async (req, res) => {
    try {
        const filter = { tenant: req.user.tenant };
        const [employees, total] = await Promise.all([
            Employee.find(filter).sort({ joinDate: -1 }).skip(req.skip).limit(req.limit).lean(),
            Employee.countDocuments(filter)
        ]);
        res.json(paginated(employees, { total, hasNextPage: req.skip + employees.length < total }));
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ error: 'Server error' });
    }
};

exports.getEmployeeById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const employee = await Employee.findOne({ _id: req.params.id, tenant: req.user.tenant });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        res.json(ok(employee));
    } catch (err) {
        logger.error({ err }, 'Error fetching employee by ID');
        logger.error({ err }, 'Server error'); res.status(500).json({ error: 'Server error' });
    }
};

exports.getLeaveRequests = async (req, res) => {
    try {
        const query = { tenant: req.user.tenant };
        if (req.query.employeeId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.employeeId))
                return res.status(400).json({ error: 'Invalid employeeId' });
            query.employeeId = req.query.employeeId;
        }
        const requests = await LeaveRequest.find(query)
            .populate('employeeId', 'name department role')
            .sort({ requestDate: -1 })
            .lean();
        res.json(ok(requests));
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ error: 'Server error' });
    }
};

exports.createEmployee = async (req, res) => {
    try {
        const {
            name, email, phone, role, department, salary, performanceScore, leaveBalance,
            joinDate, status, managerId, contractSettings
        } = req.body;
        const employee = new Employee({
            tenant: req.user.tenant,
            name, email, phone, role, department, salary, performanceScore, leaveBalance,
            joinDate, status, managerId, contractSettings
        });
        const saved = await employee.save();
        res.status(201).json(created(saved));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateEmployee = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const {
            name, email, phone, role, department, salary, performanceScore, leaveBalance,
            joinDate, status, managerId, contractSettings
        } = req.body;
        const updated = await Employee.findOneAndUpdate(
            { _id: req.params.id, tenant: req.user.tenant },
            { name, email, phone, role, department, salary, performanceScore, leaveBalance,
              joinDate, status, managerId, contractSettings },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'Employee not found' });
        res.json(ok(updated));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const deleted = await Employee.findOneAndDelete({ _id: req.params.id, tenant: req.user.tenant });
        if (!deleted) return res.status(404).json({ error: 'Employee not found' });
        res.json(message('Employee deleted'));
    } catch (err) {
        logger.error({ err }, 'Error deleting employee');
        logger.error({ err }, 'Server error'); res.status(500).json({ error: 'Server error' });
    }
};

exports.createLeaveRequest = async (req, res) => {
    try {
        const { employeeId, type, startDate, endDate, reason } = req.body;
        if (!employeeId || !startDate || !endDate) {
            return res.status(400).json({ error: 'employeeId, startDate, and endDate are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
            return res.status(400).json({ error: 'Invalid date range' });
        }

        // Check for overlapping approved or pending leaves for the same employee
        const overlap = await LeaveRequest.findOne({
            tenant: req.user.tenant,
            employeeId,
            status: { $in: ['Pending', 'Approved'] },
            startDate: { $lte: end },
            endDate:   { $gte: start }
        });
        if (overlap) {
            return res.status(409).json({ error: 'Leave request overlaps with an existing pending or approved leave' });
        }

        const reqData = new LeaveRequest({ tenant: req.user.tenant, employeeId, type, startDate: start, endDate: end, reason });
        const saved = await reqData.save();
        res.status(201).json(created(saved));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateLeaveRequestStatus = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const { status } = req.body;
        if (!status || !['Pending', 'Approved', 'Rejected'].includes(status))
            return res.status(400).json({ error: 'Status must be one of: Pending, Approved, Rejected' });
        const request = await LeaveRequest.findOne({ _id: req.params.id, tenant: req.user.tenant });
        if (!request) return res.status(404).json({ error: 'Leave Request not found' });

        if (status === 'Approved') {
            if (request.status === 'Approved') {
                return res.status(400).json({ error: 'Leave request is already approved' });
            }
            if (request.status === 'Rejected') {
                return res.status(400).json({ error: 'Cannot re-approve a rejected leave request. Create a new request instead.' });
            }
            // Only deduct from 'Pending' → 'Approved'
            const employee = await Employee.findOne({ _id: request.employeeId, tenant: req.user.tenant });
            if (employee) {
                const diffDays = Math.ceil(Math.abs(new Date(request.endDate) - new Date(request.startDate)) / (1000 * 60 * 60 * 24)) + 1;
                if (employee.leaveBalance >= diffDays || request.type === 'Unpaid') {
                    if (request.type !== 'Unpaid') {
                        employee.leaveBalance -= diffDays;
                        await employee.save();
                    }
                } else {
                    return res.status(400).json({ error: 'Insufficient leave balance' });
                }
            }
        }

        request.status = status;
        await request.save();
        res.json(ok(request));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
