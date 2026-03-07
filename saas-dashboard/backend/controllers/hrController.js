const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');

exports.getHRMetrics = async (req, res) => {
    try {
        const employees = await Employee.find();

        const departmentDistribution = {};
        let activeEmployees = 0;

        employees.forEach(emp => {
            // Dept distribution
            if (!departmentDistribution[emp.department]) {
                departmentDistribution[emp.department] = 0;
            }
            departmentDistribution[emp.department]++;

            if (emp.status === 'Active') activeEmployees++;
        });

        res.json({
            totalEmployees: employees.length,
            activeEmployees,
            departmentDistribution
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

exports.getLeaveRequests = async (req, res) => {
    try {
        const requests = await LeaveRequest.find()
            .populate('employeeId', 'name department role')
            .sort({ requestDate: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
