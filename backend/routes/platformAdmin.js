const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requirePlatformAdmin } = require('../middleware/platformAdmin');
const ctrl = require('../controllers/platformAdminController');
const { getDiagnostics } = require('../controllers/diagnosticsController');

const wrap = require('../shared/middleware/asyncHandler');

// All routes require auth + platform admin
router.use(protect, requirePlatformAdmin);

// Tenant management
router.get('/tenants', wrap(ctrl.listTenants));
router.get('/tenants/:id', wrap(ctrl.getTenantDetail));
router.get('/tenants/:id/members', wrap(ctrl.getTenantMembers));
router.get('/tenants/:id/usage', wrap(ctrl.getTenantUsage));
router.get('/tenants/:id/audit', wrap(ctrl.getTenantAuditLog));
router.patch('/tenants/:id/suspend', wrap(ctrl.suspendTenant));
router.patch('/tenants/:id/reactivate', wrap(ctrl.reactivateTenant));
router.patch('/tenants/:id/plan', wrap(ctrl.changeTenantPlan));

// Impersonation
router.post('/impersonate/:tenantId', wrap(ctrl.impersonateTenant));

// Platform analytics
router.get('/analytics', wrap(ctrl.getPlatformAnalytics));
router.get('/analytics/detailed', wrap(ctrl.getDetailedAnalytics));

// Server diagnostics
router.get('/diagnostics', wrap(getDiagnostics));

module.exports = router;
