const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/SuperAdmin
const getUsers = async (req, res) => {
    try {
        const users = await User.find({ tenant: req.user.tenant }).select('-password').populate('role');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server Error fetching users' });
    }
};

// @desc    Update user role & access
// @route   PUT /api/users/:id
// @access  Private/SuperAdmin
const updateUserAccess = async (req, res) => {
    try {
        const { role, isActive, permissionOverrides } = req.body;

        // Prevent modifying oneself
        if (req.user._id.toString() === req.params.id) {
            return res.status(400).json({ message: "Cannot modify your own access level" });
        }

        const user = await User.findOne({ _id: req.params.id, tenant: req.user.tenant });

        if (user) {
            if (role !== undefined) user.role = role;
            if (isActive !== undefined) user.isActive = isActive;
            if (permissionOverrides !== undefined) user.permissionOverrides = permissionOverrides;

            const updatedUser = await user.save();
            await updatedUser.populate('role');

            // Log this security change
            await AuditLog.create({
                actorUserId: req.user._id,
                targetUserId: updatedUser._id,
                action: 'UPDATE_ACCESS',
                module: 'users',
                metadata: {
                    newRole: role,
                    isActive: isActive
                }
            });

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                isActive: updatedUser.isActive,
                permissionOverrides: updatedUser.permissionOverrides
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error updating user' });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/SuperAdmin
const deleteUser = async (req, res) => {
    try {
        // Prevent deleting oneself
        if (req.user._id.toString() === req.params.id) {
            return res.status(400).json({ message: "Cannot delete yourself" });
        }

        const user = await User.findOne({ _id: req.params.id, tenant: req.user.tenant });

        if (user) {
            await user.deleteOne();

            // Log the deletion
            await AuditLog.create({
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
        res.status(500).json({ message: 'Server Error updating preferences' });
    }
};

module.exports = {
    getUsers,
    updateUserAccess,
    deleteUser,
    updateMyPreferences
};
