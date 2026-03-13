const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUserAccess, deleteUser, updateMyPreferences, updateMyProfile, changePassword } = require('../controllers/userController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const { checkPlanLimit } = require('../middleware/planLimits');
const wrap = require('../shared/middleware/asyncHandler');

// Self-service routes (any authenticated user)
router.put('/preferences', protect, wrap(updateMyPreferences));
router.put('/profile', protect, wrap(updateMyProfile));
router.put('/change-password', protect, wrap(changePassword));

// All other user management routes require Super Admin privileges
router.use(protect);

router.route('/')
    .get(requirePermission(PERMS.SYSTEM_USERS), wrap(getUsers))
    .post(requirePermission(PERMS.SYSTEM_USERS), checkPlanLimit('users'), wrap(createUser));

router.route('/:id')
    .put(requirePermission(PERMS.SYSTEM_USERS), wrap(updateUserAccess))
    .delete(requirePermission(PERMS.SYSTEM_USERS), wrap(deleteUser));

module.exports = router;
