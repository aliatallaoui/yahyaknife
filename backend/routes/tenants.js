const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const {
    getMyTenant,
    updateSettings,
    getUsage,
    getTeam,
    inviteUser,
    acceptInvite,
    changePlan,
    requestDeletion,
    requestDataExport,
    getDataExportStatus,
} = require('../controllers/tenantController');
const wrap = require('../shared/middleware/asyncHandler');

// ── Protected routes (require auth) ────────────────────────────────────────
router.get('/me',            protect, requirePermission(PERMS.TENANT_VIEW),     wrap(getMyTenant));
router.patch('/me/settings', protect, requirePermission(PERMS.TENANT_SETTINGS), wrap(updateSettings));
router.get('/me/usage',      protect, requirePermission(PERMS.TENANT_VIEW),     wrap(getUsage));
router.get('/me/team',       protect, requirePermission(PERMS.TENANT_VIEW),     wrap(getTeam));
router.post('/me/invite',    protect, requirePermission(PERMS.TENANT_INVITE),   wrap(inviteUser));
router.put('/me/plan',       protect, requirePermission(PERMS.TENANT_BILLING),  wrap(changePlan));
router.delete('/me',         protect, requirePermission(PERMS.TENANT_DELETE),   wrap(requestDeletion));
router.post('/me/export',            protect, requirePermission(PERMS.TENANT_BILLING),  wrap(requestDataExport));
router.get('/me/export/:jobId',      protect, requirePermission(PERMS.TENANT_VIEW),     wrap(getDataExportStatus));

// ── Public route (invite acceptance — user doesn't have a token yet) ────────
router.post('/accept-invite', wrap(acceptInvite));

module.exports = router;
