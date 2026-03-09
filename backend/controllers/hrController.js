const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const moment = require('moment');

exports.getHRMetrics = async (req, res) => {
    try {
        const employees = await Employee.find();

        const departmentDistribution = {};
        let activeEmployees = 0;
        let estimatedPayrollDZD = 0;

        employees.forEach(emp => {
            // Dept distribution
            if (!departmentDistribution[emp.department]) {
                departmentDistribution[emp.department] = 0;
            }
            departmentDistribution[emp.department]++;

            if (emp.status === 'Active') {
                activeEmployees++;
                estimatedPayrollDZD += (emp.contractSettings?.monthlySalary || emp.salary || 0);
            }
        });

        const today = moment().format('YYYY-MM-DD');
        const todayAttendance = await Attendance.find({ date: today }).lean();

        let presentToday = 0;
        let lateToday = 0;

        todayAttendance.forEach(att => {
            if (['Present', 'Completed with Recovery', 'Overtime', 'Incomplete', 'Late'].includes(att.status) || (!att.status && att.morningIn)) {
                presentToday++;
            }
            if (att.lateMinutes > 0) {
                lateToday++;
            }
        });

        const absentToday = Math.max(0, activeEmployees - presentToday);

        res.json({
            totalEmployees: employees.length,
            activeEmployees,
            departmentDistribution,
            estimatedPayrollDZD,
            presentToday,
            lateToday,
            absentToday
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getEmployees = async (req, res) => {
    try {
        const employees = await Employee.find().sort({ joinDate: -1 });
        res.json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getEmployeeById = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        res.json(employee);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getLeaveRequests = async (req, res) => {
    try {
        const query = req.query.employeeId ? { employeeId: req.query.employeeId } : {};
        const requests = await LeaveRequest.find(query)
            .populate('employeeId', 'name department role')
            .sort({ requestDate: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createEmployee = async (req, res) => {
    try {
        const employee = new Employee(req.body);
        const saved = await employee.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateEmployee = async (req, res) => {
    try {
        const updated = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: 'Employee not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        const deleted = await Employee.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Employee not found' });
        res.json({ message: 'Employee deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createLeaveRequest = async (req, res) => {
    try {
        const reqData = new LeaveRequest(req.body);
        const saved = await reqData.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateLeaveRequestStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const request = await LeaveRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Leave Request not found' });

        if (status === 'Approved' && request.status !== 'Approved') {
            const employee = await Employee.findById(request.employeeId);
            if (employee) {
                const start = new Date(request.startDate);
                const end = new Date(request.endDate);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

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
        res.json(request);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
