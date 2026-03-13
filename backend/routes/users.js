const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUserAccess, deleteUser, updateMyPreferences } = require('../controllers/userController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

// User preferences route (any authenticated user)
router.put('/preferences', protect, updateMyPreferences);

// All other user management routes require Super Admin privileges
router.use(protect);

router.route('/')
    .get(requirePermission(PERMS.SYSTEM_USERS), getUsers)
    .post(requirePermission(PERMS.SYSTEM_USERS), createUser);

router.route('/:id')
    .put(requirePermission(PERMS.SYSTEM_USERS), updateUserAccess)
    .delete(requirePermission(PERMS.SYSTEM_USERS), deleteUser);

module.exports = router;
