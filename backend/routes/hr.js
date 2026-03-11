const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use(protect);

// /api/hr/metrics
router.get('/metrics', requirePermission('hr.employees.view'), hrController.getHRMetrics);

// /api/hr/employees
router.get('/employees', requirePermission('hr.employees.view'), hrController.getEmployees);
router.post('/employees', requirePermission('hr.employees.edit'), hrController.createEmployee);
router.get('/employees/:id', requirePermission('hr.employees.view'), hrController.getEmployeeById);
router.put('/employees/:id', requirePermission('hr.employees.edit'), hrController.updateEmployee);
router.delete('/employees/:id', requirePermission('hr.employees.edit'), hrController.deleteEmployee);

router.get('/employees/:id/attendance', requirePermission('hr.employees.view'), require('../controllers/attendanceController').getEmployeeAttendance);

// /api/hr/leaves
router.get('/leaves', requirePermission('hr.employees.view'), hrController.getLeaveRequests);
router.post('/leaves', requirePermission('hr.employees.view'), hrController.createLeaveRequest);
router.put('/leaves/:id/status', requirePermission('hr.employees.edit'), hrController.updateLeaveRequestStatus);

const attendanceController = require('../controllers/attendanceController');
const payrollController = require('../controllers/payrollController');

// /api/hr/attendance
router.post('/attendance/record', requirePermission('hr.employees.view'), attendanceController.recordPointage);
router.get('/attendance', requirePermission('hr.employees.view'), attendanceController.getDailyAttendance);
router.put('/attendance/:id', requirePermission('hr.employees.edit'), attendanceController.updateAttendanceRecord);

// /api/hr/payroll
router.post('/payroll/generate', requirePermission('hr.payroll.run'), payrollController.generateMonthlyPayroll);
router.get('/payroll', requirePermission('hr.payroll.view'), payrollController.getPayrollRecords);
router.put('/payroll/:id/approve', requirePermission('hr.payroll.approve'), payrollController.approvePayroll);

const hrReportsController = require('../controllers/hrReportsController');

// /api/hr/reports
router.get('/reports/daily', requirePermission('hr.employees.view'), hrReportsController.getDailyReport);
router.get('/reports/monthly', requirePermission('hr.employees.view'), hrReportsController.getMonthlyReport);
router.get('/reports/payroll', requirePermission('hr.payroll.view'), hrReportsController.getPayrollReport);
router.get('/reports/overtime', requirePermission('hr.employees.view'), hrReportsController.getOvertimeReport);
router.get('/reports/deductions', requirePermission('hr.payroll.view'), hrReportsController.getDeductionsReport);

const hrProductivityController = require('../controllers/hrProductivityController');

// /api/hr/productivity
router.get('/productivity', requirePermission('hr.employees.view'), hrProductivityController.getProductivity);
router.post('/productivity', requirePermission('hr.employees.edit'), hrProductivityController.logProductivity);

// /api/hr/rewards
router.get('/rewards', requirePermission('hr.employees.view'), hrProductivityController.getRewards);
router.post('/rewards', requirePermission('hr.employees.edit'), hrProductivityController.grantReward);

module.exports = router;
