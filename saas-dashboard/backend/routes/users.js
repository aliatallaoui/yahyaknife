const express = require('express');
const router = express.Router();
const { getUsers, updateUserAccess, deleteUser } = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// All user management routes require Super Admin privileges
router.use(protect);
router.use(authorizeRoles('Super Admin'));

router.route('/')
    .get(getUsers);

router.route('/:id')
    .put(updateUserAccess)
    .delete(deleteUser);

module.exports = router;
