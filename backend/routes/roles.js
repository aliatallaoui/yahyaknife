const express = require('express');
const router = express.Router();
const { getRoles, getPermissionCatalog, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const { PERMS } = require('../shared/constants/permissions');
const wrap = require('../shared/middleware/asyncHandler');

router.use(protect); // Protect all routes

router.route('/')
    .get(requirePermission(PERMS.SYSTEM_ROLES), wrap(getRoles))
    .post(requirePermission(PERMS.SYSTEM_ROLES), wrap(createRole));

router.get('/catalog', requirePermission(PERMS.SYSTEM_ROLES), wrap(getPermissionCatalog));

router.route('/:id')
    .put(requirePermission(PERMS.SYSTEM_ROLES), wrap(updateRole))
    .delete(requirePermission(PERMS.SYSTEM_ROLES), wrap(deleteRole));

module.exports = router;
