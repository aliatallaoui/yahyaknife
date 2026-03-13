const logger = require('../shared/logger');
const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');
const cacheService = require('../services/cacheService');
const { ALL_PERMISSIONS_FLAT } = require('../config/permissions');

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper: validate that a role belongs to the tenant or is a system role
const validateRoleForTenant = async (roleId, tenantId) => {
    if (!roleId || !validId(roleId)) return null;
    const roleDoc = await Role.findOne({
        _id: roleId,
        $or: [{ tenant: tenantId }, { isSystemRole: true }]
    });
    return roleDoc;
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private (system.users)
const getUsers = async (req, res) => {
    try {
        const users = await User.find({ tenant: req.user.tenant }).select('-password').populate('role').lean();
        res.json(users);
    } catch (error) {
        logger.error({ err: error }, 'User list fetch error');
        res.status(500).json({ message: 'Server Error fetching users' });
    }
};

// @desc    Create a new user (admin invites a team member)
// @route   POST /api/users
// @access  Private (system.users)
const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Name is required' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'Email is required' });
        }
        if (!password || password.length < 12) {
            return res.status(400).json({ message: 'Password must be at least 12 characters' });
        }

        // Check duplicate email
        const exists = await User.findOne({ email: email.trim().toLowerCase() });
        if (exists) {
            return res.status(400).json({ message: 'A user with this email already exists' });
        }

        // Validate role
        let roleId = null;
        if (role) {
            const roleDoc = await validateRoleForTenant(role, req.user.tenant);
            if (!roleDoc) {
                return res.status(400).json({ message: 'Invalid role' });
            }
            roleId = roleDoc._id;
        }

        const user = await User.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            role: roleId,
            tenant: req.user.tenant,
            isActive: true
        });

        await user.populate('role');

        await AuditLog.create({
            tenant: req.user.tenant,
            actorUserId: req.user._id,
            targetUserId: user._id,
            action: 'CREATE_USER',
            module: 'users',
            metadata: { email: user.email, role: roleId }
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt
        });
    } catch (error) {
        logger.error({ err: error }, 'User creation error');
        if (error.name === 'ValidationError') {
            const msg = Object.values(error.errors).map(e => e.message).join(', ');
            return res.status(400).json({ message: msg });
        }
        res.status(500).json({ message: 'Server Error creating user' });
    }
};

// @desc    Update user role & access
// @route   PUT /api/users/:id
// @access  Private (system.users)
const updateUserAccess = async (req, res) => {
    try {
        const { role, isActive, permissionOverrides } = req.body;

        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID' });

        // Prevent modifying oneself
        if (req.user._id.toString() === req.params.id) {
            return res.status(400).json({ message: "Cannot modify your own access level" });
        }

        const user = await User.findOne({ _id: req.params.id, tenant: req.user.tenant });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Validate role belongs to tenant or is system role
        if (role !== undefined) {
            if (role) {
                const roleDoc = await validateRoleForTenant(role, req.user.tenant);
                if (!roleDoc) {
                    return res.status(400).json({ message: 'Invalid role' });
                }
                user.role = roleDoc._id;
            } else {
                user.role = null;
            }
        }

        if (isActive !== undefined) user.isActive = isActive;

        // Validate permissionOverrides
        if (permissionOverrides !== undefined) {
            if (!Array.isArray(permissionOverrides)) {
                return res.status(400).json({ message: 'permissionOverrides must be an array' });
            }
            user.permissionOverrides = permissionOverrides.filter(o =>
                o && typeof o.permission === 'string' &&
                ALL_PERMISSIONS_FLAT.includes(o.permission) &&
                ['allow', 'deny'].includes(o.effect)
            );
        }

        const updatedUser = await user.save();
        await updatedUser.populate('role');

        await AuditLog.create({
            tenant: req.user.tenant,
            actorUserId: req.user._id,
            targetUserId: updatedUser._id,
            action: 'UPDATE_ACCESS',
            module: 'users',
            metadata: {
                newRole: role,
                isActive: isActive,
                permissionOverrides: permissionOverrides !== undefined
            }
        });

        // Invalidate cached auth for this user
        cacheService.del(`auth:user:${updatedUser._id}`);

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            isActive: updatedUser.isActive,
            permissionOverrides: updatedUser.permissionOverrides
        });
    } catch (error) {
        logger.error({ err: error }, 'User access update error');
        res.status(500).json({ message: 'Server Error updating user' });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/SuperAdmin
const deleteUser = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID' });

        // Prevent deleting oneself
        if (req.user._id.toString() === req.params.id) {
            return res.status(400).json({ message: "Cannot delete yourself" });
        }

        const user = await User.findOne({ _id: req.params.id, tenant: req.user.tenant });

        if (user) {
            cacheService.del(`auth:user:${user._id}`);
            await user.deleteOne();

            // Log the deletion
            await AuditLog.create({
                tenant: req.user.tenant,
                actorUserId: req.user._id,
                targetUserId: req.params.id,
                action: 'DELETE_USER',
                module: 'users',
                metadata: { email: user.email }
            });

            res.json({ message: 'User removed' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        logger.error({ err: error }, 'User deletion error');
        res.status(500).json({ message: 'Server Error deleting user' });
    }
};

// @desc    Update My Preferences
// @route   PUT /api/users/preferences
// @access  Private
const updateMyPreferences = async (req, res) => {
    try {
        const { language, timezone, dateFormat, currency, theme } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Merge existing preferences with incoming fields
        user.preferences = {
            ...user.preferences,
            ...(language && { language }),
            ...(timezone && { timezone }),
            ...(dateFormat && { dateFormat }),
            ...(currency && { currency }),
            ...(theme && { theme }),
        };

        // Explicitly tell Mongoose that the nested object has changed
        user.markModified('preferences');

        const updatedUser = await user.save();

        res.json({
            message: 'Preferences updated successfully',
            preferences: updatedUser.preferences
        });
    } catch (error) {
        logger.error({ err: error }, 'User preferences update error');
        res.status(500).json({ message: 'Server Error updating preferences' });
    }
};

module.exports = {
    getUsers,
    createUser,
    updateUserAccess,
    deleteUser,
    updateMyPreferences
};
