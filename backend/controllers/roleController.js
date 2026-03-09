const Role = require('../models/Role');
const { PERMISSIONS } = require('../config/permissions');

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private (users.read)
exports.getRoles = async (req, res) => {
    try {
        const roles = await Role.find({});
        res.json(roles);
    } catch (error) {
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
// @access  Private (roles.manage)
exports.createRole = async (req, res) => {
    try {
        const { name, description, permissions } = req.body;

        // Prevent creating roles with reserved names
        const exists = await Role.findOne({ name });
        if (exists) {
            return res.status(400).json({ message: 'A role with this name already exists' });
        }

        const role = await Role.create({
            name,
            description,
            permissions: permissions || [],
            isSystemRole: false,
            createdBy: req.user._id
        });

        res.status(201).json(role);
    } catch (error) {
        res.status(500).json({ message: 'Server Error creating role' });
    }
};

// @desc    Update a custom role
// @route   PUT /api/roles/:id
// @access  Private (roles.manage)
exports.updateRole = async (req, res) => {
    try {
        const { name, description, permissions } = req.body;
        const role = await Role.findById(req.params.id);

        if (!role) return res.status(404).json({ message: 'Role not found' });
        if (role.isSystemRole) {
            return res.status(403).json({ message: 'Cannot modify system defaults. Duplicate this role to customize it.' });
        }

        if (name) role.name = name;
        if (description) role.description = description;
        if (permissions) role.permissions = permissions;

        const updatedRole = await role.save();
        res.json(updatedRole);
    } catch (error) {
        res.status(500).json({ message: 'Server Error updating role' });
    }
};

// @desc    Delete a role
// @route   DELETE /api/roles/:id
// @access  Private (roles.manage)
exports.deleteRole = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) return res.status(404).json({ message: 'Role not found' });
        if (role.isSystemRole) {
            return res.status(403).json({ message: 'Cannot delete system roles.' });
        }

        // Check if users are still assigned to this role (handled in full production system)
        await role.deleteOne();
        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error deleting role' });
    }
};
