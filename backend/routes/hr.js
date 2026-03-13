const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const paginate = require('../shared/middleware/paginate');

router.use(protect);

// /api/hr/metrics
router.get('/metrics', requirePermission(PERMS.HR_EMPLOYEES_VIEW), hrController.getHRMetrics);

// /api/hr/employees
router.get('/employees', requirePermission(PERMS.HR_EMPLOYEES_VIEW), paginate, hrController.getEmployees);
router.post('/employees', requirePermission(PERMS.HR_EMPLOYEES_EDIT), hrController.createEmployee);
router.get('/employees/:id', requirePermission(PERMS.HR_EMPLOYEES_VIEW), hrController.getEmployeeById);
router.put('/employees/:id', requirePermission(PERMS.HR_EMPLOYEES_EDIT), hrController.updateEmployee);
router.delete('/employees/:id', requirePermission(PERMS.HR_EMPLOYEES_EDIT), hrController.deleteEmployee);

router.get('/employees/:id/attendance', requirePermission(PERMS.HR_EMPLOYEES_VIEW), require('../controllers/attendanceController').getEmployeeAttendance);

// /api/hr/leaves
router.get('/leaves', requirePermission(PERMS.HR_EMPLOYEES_VIEW), hrController.getLeaveRequests);
router.post('/leaves', requirePermission(PERMS.HR_EMPLOYEES_VIEW), hrController.createLeaveRequest);
router.put('/leaves/:id/status', requirePermission(PERMS.HR_EMPLOYEES_EDIT), hrController.updateLeaveRequestStatus);

const attendanceController = require('../controllers/attendanceController');
const payrollController = require('../controllers/payrollController');

// /api/hr/attendance
router.post('/attendance/record', requirePermission(PERMS.HR_EMPLOYEES_VIEW), attendanceController.recordPointage);
router.get('/attendance', requirePermission(PERMS.HR_EMPLOYEES_VIEW), attendanceController.getDailyAttendance);
router.put('/attendance/:id', requirePermission(PERMS.HR_EMPLOYEES_EDIT), attendanceController.updateAttendanceRecord);

// /api/hr/payroll
router.post('/payroll/generate', requirePermission(PERMS.HR_PAYROLL_RUN), payrollController.generateMonthlyPayroll);
router.get('/payroll', requirePermission(PERMS.HR_PAYROLL_VIEW), payrollController.getPayrollRecords);
router.put('/payroll/:id/approve', requirePermission(PERMS.HR_PAYROLL_APPROVE), payrollController.approvePayroll);
router.put('/payroll/:id/pay', requirePermission(PERMS.HR_PAYROLL_APPROVE), payrollController.recordPayment);

const hrReportsController = require('../controllers/hrReportsController');

// /api/hr/reports
router.get('/reports/daily', requirePermission(PERMS.HR_EMPLOYEES_VIEW), hrReportsController.getDailyReport);
router.get('/reports/monthly', requirePermission(PERMS.HR_EMPLOYEES_VIEW), hrReportsController.getMonthlyReport);
router.get('/reports/payroll', requirePermission(PERMS.HR_PAYROLL_VIEW), hrReportsController.getPayrollReport);
router.get('/reports/overtime', requirePermission(PERMS.HR_EMPLOYEES_VIEW), hrReportsController.getOvertimeReport);
router.get('/reports/deductions', requirePermission(PERMS.HR_PAYROLL_VIEW), hrReportsController.getDeductionsReport);

const hrProductivityController = require('../controllers/hrProductivityController');

// /api/hr/productivity
router.get('/productivity', requirePermission(PERMS.HR_EMPLOYEES_VIEW), hrProductivityController.getProductivity);
router.post('/productivity', requirePermission(PERMS.HR_EMPLOYEES_EDIT), hrProductivityController.logProductivity);

// /api/hr/rewards
router.get('/rewards', requirePermission(PERMS.HR_EMPLOYEES_VIEW), hrProductivityController.getRewards);
router.post('/rewards', requirePermission(PERMS.HR_EMPLOYEES_EDIT), hrProductivityController.grantReward);

module.exports = router;
