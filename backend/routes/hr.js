const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const paginate = require('../shared/middleware/paginate');
const wrap = require('../shared/middleware/asyncHandler');

router.use(protect);

// /api/hr/metrics
router.get('/metrics', requirePermission(PERMS.HR_EMPLOYEES_VIEW), wrap(hrController.getHRMetrics));

// /api/hr/employees
router.get('/employees', requirePermission(PERMS.HR_EMPLOYEES_VIEW), paginate, wrap(hrController.getEmployees));
router.post('/employees', requirePermission(PERMS.HR_EMPLOYEES_EDIT), wrap(hrController.createEmployee));
router.get('/employees/:id', requirePermission(PERMS.HR_EMPLOYEES_VIEW), wrap(hrController.getEmployeeById));
router.put('/employees/:id', requirePermission(PERMS.HR_EMPLOYEES_EDIT), wrap(hrController.updateEmployee));
router.delete('/employees/:id', requirePermission(PERMS.HR_EMPLOYEES_EDIT), wrap(hrController.deleteEmployee));

router.get('/employees/:id/attendance', requirePermission(PERMS.HR_EMPLOYEES_VIEW), wrap(require('../controllers/attendanceController').getEmployeeAttendance));

// /api/hr/leaves
router.get('/leaves', requirePermission(PERMS.HR_EMPLOYEES_VIEW), wrap(hrController.getLeaveRequests));
router.post('/leaves', requirePermission(PERMS.HR_EMPLOYEES_EDIT), wrap(hrController.createLeaveRequest));
router.put('/leaves/:id/status', requirePermission(PERMS.HR_EMPLOYEES_EDIT), wrap(hrController.updateLeaveRequestStatus));

const attendanceController = require('../controllers/attendanceController');
const payrollController = require('../controllers/payrollController');

// /api/hr/attendance
router.post('/attendance/record', requirePermission(PERMS.HR_EMPLOYEES_EDIT), wrap(attendanceController.recordPointage));
router.get('/attendance', requirePermission(PERMS.HR_EMPLOYEES_VIEW), wrap(attendanceController.getDailyAttendance));
router.put('/attendance/:id', requirePermission(PERMS.HR_EMPLOYEES_EDIT), wrap(attendanceController.updateAttendanceRecord));

// /api/hr/payroll
router.post('/payroll/generate', requirePermission(PERMS.HR_PAYROLL_RUN), wrap(payrollController.generateMonthlyPayroll));
router.get('/payroll', requirePermission(PERMS.HR_PAYROLL_VIEW), wrap(payrollController.getPayrollRecords));
router.put('/payroll/:id/approve', requirePermission(PERMS.HR_PAYROLL_APPROVE), wrap(payrollController.approvePayroll));
router.put('/payroll/:id/pay', requirePermission(PERMS.HR_PAYROLL_APPROVE), wrap(payrollController.recordPayment));

const hrReportsController = require('../controllers/hrReportsController');

// /api/hr/reports
router.get('/reports/daily', requirePermission(PERMS.HR_EMPLOYEES_VIEW), wrap(hrReportsController.getDailyReport));
router.get('/reports/monthly', requirePermission(PERMS.HR_EMPLOYEES_VIEW), wrap(hrReportsController.getMonthlyReport));
router.get('/reports/payroll', requirePermission(PERMS.HR_PAYROLL_VIEW), wrap(hrReportsController.getPayrollReport));
router.get('/reports/overtime', requirePermission(PERMS.HR_EMPLOYEES_VIEW), wrap(hrReportsController.getOvertimeReport));
router.get('/reports/deductions', requirePermission(PERMS.HR_PAYROLL_VIEW), wrap(hrReportsController.getDeductionsReport));

const hrProductivityController = require('../controllers/hrProductivityController');

// /api/hr/productivity
router.get('/productivity', requirePermission(PERMS.HR_EMPLOYEES_VIEW), wrap(hrProductivityController.getProductivity));
router.post('/productivity', requirePermission(PERMS.HR_EMPLOYEES_EDIT), wrap(hrProductivityController.logProductivity));

// /api/hr/rewards
router.get('/rewards', requirePermission(PERMS.HR_EMPLOYEES_VIEW), wrap(hrProductivityController.getRewards));
router.post('/rewards', requirePermission(PERMS.HR_EMPLOYEES_EDIT), wrap(hrProductivityController.grantReward));

module.exports = router;
