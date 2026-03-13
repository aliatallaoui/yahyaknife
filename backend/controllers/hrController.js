const logger = require('../shared/logger');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const moment = require('moment');
const { ok, created, message, paginated } = require('../shared/utils/ApiResponse');
const audit = require('../shared/utils/auditLog');

exports.getHRMetrics = async (req, res) => {
    try {
        const tenant = req.user.tenant;

        // Aggregate employee metrics in a single pipeline instead of full-scan
        const [empMetrics] = await Employee.aggregate([
            { $match: { tenant, deletedAt: null } },
            { $group: {
                _id: null,
                totalEmployees: { $sum: 1 },
                activeEmployees: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
                estimatedPayrollDZD: { $sum: { $cond: [
                    { $eq: ['$status', 'Active'] },
                    { $ifNull: [{ $ifNull: ['$contractSettings.monthlySalary', '$salary'] }, 0] },
                    0
                ] } },
                departments: { $push: '$department' }
            } }
        ]);

        const totalEmployees = empMetrics?.totalEmployees || 0;
        const activeEmployees = empMetrics?.activeEmployees || 0;
        const estimatedPayrollDZD = empMetrics?.estimatedPayrollDZD || 0;

        // Build department distribution from the array
        const departmentDistribution = {};
        if (empMetrics?.departments) {
            empMetrics.departments.forEach(dept => {
                if (!departmentDistribution[dept]) departmentDistribution[dept] = 0;
                departmentDistribution[dept]++;
            });
        }

        const today = moment().format('YYYY-MM-DD');

        // Get active employee IDs to filter attendance (exclude deleted employees)
        const activeEmpIds = await Employee.find({ tenant, deletedAt: null, status: 'Active' })
            .select('_id').lean().then(docs => docs.map(d => d._id));

        // Aggregate attendance counters — only for active employees
        const [attMetrics] = await Attendance.aggregate([
            { $match: { tenant, date: today, employeeId: { $in: activeEmpIds } } },
            { $group: {
                _id: null,
                presentToday: { $sum: { $cond: [
                    { $or: [
                        { $in: ['$status', ['Present', 'Completed with Recovery', 'Overtime', 'Incomplete', 'Late']] },
                        { $and: [{ $eq: ['$status', null] }, { $ne: ['$morningIn', null] }] }
                    ] }, 1, 0
                ] } },
                lateToday: { $sum: { $cond: [{ $gt: ['$lateMinutes', 0] }, 1, 0] } }
            } }
        ]);

        const presentToday = attMetrics?.presentToday || 0;
        const lateToday = attMetrics?.lateToday || 0;

        res.json(ok({
            totalEmployees,
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
        const filter = { tenant: req.user.tenant, deletedAt: null };
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
        const employee = await Employee.findOne({ _id: req.params.id, tenant: req.user.tenant, deletedAt: null }).lean();
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        res.json(ok(employee));
    } catch (err) {
        logger.error({ err }, 'Error fetching employee by ID');
        res.status(500).json({ error: 'Server error' });
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
            .populate({ path: 'employeeId', match: { deletedAt: null }, select: 'name department role' })
            .sort({ requestDate: -1 })
            .limit(500)
            .lean();
        res.json(ok(requests.filter(r => r.employeeId)));
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
        audit({ tenant: req.user.tenant, actorUserId: req.user._id, action: 'CREATE_EMPLOYEE', module: 'hr', metadata: { employeeId: saved._id, name } });
        res.status(201).json(created(saved));
    } catch (err) {
        logger.error({ err }, 'Error creating employee');
        res.status(400).json({ error: 'Invalid employee data' });
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
            { _id: req.params.id, tenant: req.user.tenant, deletedAt: null },
            { name, email, phone, role, department, salary, performanceScore, leaveBalance,
              joinDate, status, managerId, contractSettings },
            { new: true }
        ).lean();
        if (!updated) return res.status(404).json({ error: 'Employee not found' });
        audit({ tenant: req.user.tenant, actorUserId: req.user._id, action: 'UPDATE_EMPLOYEE', module: 'hr', metadata: { employeeId: req.params.id } });
        res.json(ok(updated));
    } catch (err) {
        logger.error({ err }, 'Error updating employee');
        res.status(400).json({ error: 'Invalid employee data' });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const deleted = await Employee.findOneAndUpdate(
            { _id: req.params.id, tenant: req.user.tenant, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        );
        if (!deleted) return res.status(404).json({ error: 'Employee not found' });
        audit({ tenant: req.user.tenant, actorUserId: req.user._id, action: 'DELETE_EMPLOYEE', module: 'hr', metadata: { employeeId: req.params.id, name: deleted.name } });
        res.json(message('Employee deleted'));
    } catch (err) {
        logger.error({ err }, 'Error deleting employee');
        res.status(500).json({ error: 'Server error' });
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
        audit({ tenant: req.user.tenant, actorUserId: req.user._id, action: 'CREATE_LEAVE_REQUEST', module: 'hr', metadata: { leaveId: saved._id, employeeId, type, startDate, endDate } });
        res.status(201).json(created(saved));
    } catch (err) {
        logger.error({ err }, 'Error creating leave request');
        res.status(400).json({ error: 'Invalid leave request data' });
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
            const employee = await Employee.findOne({ _id: request.employeeId, tenant: req.user.tenant, deletedAt: null });
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
        audit({ tenant: req.user.tenant, actorUserId: req.user._id, action: 'UPDATE_LEAVE_STATUS', module: 'hr', metadata: { leaveId: req.params.id, employeeId: request.employeeId, newStatus: status } });
        res.json(ok(request));
    } catch (err) {
        logger.error({ err }, 'Error updating leave request status');
        res.status(400).json({ error: 'Failed to update leave request' });
    }
};
