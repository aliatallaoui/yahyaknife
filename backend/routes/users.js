const express = require('express');
const router = express.Router();
const { getUsers, updateUserAccess, deleteUser, updateMyPreferences } = require('../controllers/userController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

// User preferences route (any authenticated user)
router.put('/preferences', protect, updateMyPreferences);

// All other user management routes require Super Admin privileges
router.use(protect);

router.route('/')
    .get(requirePermission('users.read'), getUsers);

router.route('/:id')
    .put(requirePermission('users.manage_permissions'), updateUserAccess)
    .delete(requirePermission('users.deactivate'), deleteUser);

module.exports = router;
