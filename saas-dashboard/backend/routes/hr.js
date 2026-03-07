const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');

// /api/hr/metrics
router.get('/metrics', hrController.getHRMetrics);

// /api/hr/employees
router.get('/employees', hrController.getEmployees);
router.post('/employees', hrController.createEmployee);
router.get('/employees/:id', hrController.getEmployeeById);
router.put('/employees/:id', hrController.updateEmployee);
router.delete('/employees/:id', hrController.deleteEmployee);

router.get('/employees/:id/attendance', require('../controllers/attendanceController').getEmployeeAttendance);

// /api/hr/leaves
router.get('/leaves', hrController.getLeaveRequests);
router.post('/leaves', hrController.createLeaveRequest);
router.put('/leaves/:id/status', hrController.updateLeaveRequestStatus);

const attendanceController = require('../controllers/attendanceController');
const payrollController = require('../controllers/payrollController');

// /api/hr/attendance
router.post('/attendance/record', attendanceController.recordPointage);
router.get('/attendance', attendanceController.getDailyAttendance);
router.put('/attendance/:id', attendanceController.updateAttendanceRecord);

// /api/hr/payroll
router.post('/payroll/generate', payrollController.generateMonthlyPayroll);
router.get('/payroll', payrollController.getPayrollRecords);
router.put('/payroll/:id/approve', payrollController.approvePayroll);

const hrReportsController = require('../controllers/hrReportsController');

// /api/hr/reports
router.get('/reports/daily', hrReportsController.getDailyReport);
router.get('/reports/monthly', hrReportsController.getMonthlyReport);
router.get('/reports/payroll', hrReportsController.getPayrollReport);
router.get('/reports/overtime', hrReportsController.getOvertimeReport);
router.get('/reports/deductions', hrReportsController.getDeductionsReport);

module.exports = router;
