const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from the token but exclude the password, populate role
            req.user = await User.findById(decoded.id).select('-password').populate('role');

            if (!req.user || !req.user.isActive) {
                return res.status(401).json({ message: 'Not authorized, user inactive or not found' });
            }

            // Compute effective permissions
            let effectivePermissions = new Set(req.user.role ? req.user.role.permissions : []);

            // Apply granular user overrides
            if (req.user.permissionOverrides && req.user.permissionOverrides.length > 0) {
                req.user.permissionOverrides.forEach(override => {
                    if (override.effect === 'allow') {
                        effectivePermissions.add(override.permission);
                    } else if (override.effect === 'deny') {
                        effectivePermissions.delete(override.permission);
                    }
                });
            }

            req.user.computedPermissions = Array.from(effectivePermissions);

            next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Legacy check for string role fallback
        if (req.user.role === 'Super Admin' || (req.user.role && req.user.role.name === 'Super Admin')) {
            return next();
        }

        const userRoleName = req.user.role ? req.user.role.name : null;

        if (!roles.includes(userRoleName)) {
            return res.status(403).json({
                message: `User role ${userRoleName} is not authorized to access this route`
            });
        }
        next();
    };
};

/**
 * Modern RBAC permission guard.
 * @param {string} permission - The module.action to require (e.g. 'financial.read')
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Check computed permissions
        if (req.user.computedPermissions && req.user.computedPermissions.includes(permission)) {
            return next();
        }

        // Fallback for ultimate super admins who might not have permissions populated properly
        if (req.user.role && req.user.role.name === 'Super Admin') {
            return next();
        }

        return res.status(403).json({
            message: `Forbidden: Missing required permission '${permission}'`
        });
    };
};

module.exports = { protect, authorizeRoles, requirePermission };
