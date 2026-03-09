const express = require('express');
const router = express.Router();
const { getRoles, getPermissionCatalog, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use(protect); // Protect all routes

router.route('/')
    .get(requirePermission('users.read'), getRoles)
    .post(requirePermission('users.manage_permissions'), createRole);

router.get('/catalog', requirePermission('users.read'), getPermissionCatalog);

router.route('/:id')
    .put(requirePermission('users.manage_permissions'), updateRole)
    .delete(requirePermission('users.manage_permissions'), deleteRole);

module.exports = router;
