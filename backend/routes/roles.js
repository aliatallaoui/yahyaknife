const express = require('express');
const router = express.Router();
const { getRoles, getPermissionCatalog, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');

router.use(protect); // Protect all routes

router.route('/')
    .get(requirePermission(PERMS.SYSTEM_ROLES), getRoles)
    .post(requirePermission(PERMS.SYSTEM_ROLES), createRole);

router.get('/catalog', requirePermission(PERMS.SYSTEM_ROLES), getPermissionCatalog);

router.route('/:id')
    .put(requirePermission(PERMS.SYSTEM_ROLES), updateRole)
    .delete(requirePermission(PERMS.SYSTEM_ROLES), deleteRole);

module.exports = router;
