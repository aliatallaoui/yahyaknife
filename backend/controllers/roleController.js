const logger = require('../shared/logger');
const mongoose = require('mongoose');
const Role = require('../models/Role');
const User = require('../models/User');
const { PERMISSIONS, ALL_PERMISSIONS_FLAT } = require('../config/permissions');

// Helper: returns roles visible to the current tenant (system roles + tenant-owned)
const tenantRoleFilter = (req) => ({
    $or: [
        { isSystemRole: true },
        { tenant: req.user.tenant }
    ]
});

// Helper: check if the requesting user is Super Admin
const isSuperAdmin = (req) =>
    req.user.role === 'Super Admin' || (req.user.role && req.user.role.name === 'Super Admin');

// @desc    Get all roles (system + tenant-owned)
// @route   GET /api/roles
// @access  Private (system.roles)
exports.getRoles = async (req, res) => {
    try {
        const roles = await Role.find(tenantRoleFilter(req)).lean();
        res.json(roles);
    } catch (error) {
        logger.error({ err: error }, 'Role list fetch error');
        res.status(500).json({ message: 'Server Error fetching roles' });
    }
};

// @desc    Get the full permissions catalog
// @route   GET /api/roles/catalog
// @access  Private
exports.getPermissionCatalog = (req, res) => {
    res.json(PERMISSIONS);
};

// @desc    Create a new custom role
// @route   POST /api/roles
// @access  Private (system.roles)
exports.createRole = async (req, res) => {
    try {
        const { name, description, permissions } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Role name is required' });
        }
        if (!description || !description.trim()) {
            return res.status(400).json({ message: 'Role description is required' });
        }

        // Check uniqueness within tenant + system roles
        const exists = await Role.findOne({
            name: name.trim(),
            $or: [{ tenant: req.user.tenant }, { isSystemRole: true }]
        });
        if (exists) {
            return res.status(400).json({ message: 'A role with this name already exists' });
        }

        const sanitized = (permissions || []).filter(p => ALL_PERMISSIONS_FLAT.includes(p));

        const role = await Role.create({
            name: name.trim(),
            description: description.trim(),
            permissions: sanitized,
            isSystemRole: false,
            tenant: req.user.tenant,
            createdBy: req.user._id
        });

        res.status(201).json(role);
    } catch (error) {
        logger.error({ err: error }, 'Role creation error');
        res.status(500).json({ message: 'Server Error creating role' });
    }
};

// @desc    Update a custom role
// @route   PUT /api/roles/:id
// @access  Private (system.roles)
exports.updateRole = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid ID' });

        const { name, description, permissions } = req.body;

        // Super Admin can edit any role (including system roles); others can only edit tenant-owned
        const superAdmin = isSuperAdmin(req);
        const role = superAdmin
            ? await Role.findById(req.params.id)
            : await Role.findOne({ _id: req.params.id, tenant: req.user.tenant });
        if (!role) return res.status(404).json({ message: 'Role not found' });
        if (role.isSystemRole && !superAdmin) {
            return res.status(403).json({ message: 'Cannot modify system defaults. Duplicate this role to customize it.' });
        }

        if (name && name.trim()) role.name = name.trim();
        if (description !== undefined) role.description = (description || '').trim();
        if (permissions) role.permissions = permissions.filter(p => ALL_PERMISSIONS_FLAT.includes(p));

        const updatedRole = await role.save();
        res.json(updatedRole);
    } catch (error) {
        logger.error({ err: error }, 'Role update error');
        res.status(500).json({ message: 'Server Error updating role' });
    }
};

// @desc    Delete a role
// @route   DELETE /api/roles/:id
// @access  Private (system.roles)
exports.deleteRole = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid ID' });

        // Super Admin can delete any role; others can only delete tenant-owned
        const superAdmin = isSuperAdmin(req);
        const role = superAdmin
            ? await Role.findById(req.params.id)
            : await Role.findOne({ _id: req.params.id, tenant: req.user.tenant });
        if (!role) return res.status(404).json({ message: 'Role not found' });
        if (role.isSystemRole && !superAdmin) {
            return res.status(403).json({ message: 'Cannot delete system roles.' });
        }

        const assignedCount = await User.countDocuments({ role: role._id, tenant: req.user.tenant });
        if (assignedCount > 0) {
            return res.status(409).json({ message: `Cannot delete role — ${assignedCount} user(s) are still assigned to it.` });
        }

        await role.deleteOne();
        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Role deletion error');
        res.status(500).json({ message: 'Server Error deleting role' });
    }
};
