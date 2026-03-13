const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Role = require('../models/Role');
const audit = require('../shared/utils/auditLog');
const logger = require('../shared/logger');
const { LEGACY_PERMISSION_MAP } = require('../config/permissions');

const TRIAL_DAYS = 14;

// Generate short-lived access token (1 day)
const generateAccessToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1d',
    });
};

// Generate opaque refresh token (stored in DB, 30-day lifetime)
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

async function issueRefreshToken(userId) {
    const raw = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await User.findByIdAndUpdate(userId, {
        refreshToken: raw,
        refreshTokenExpiresAt: expiresAt,
    });
    return raw;
}

// Backward-compat alias used by existing callers
const generateToken = generateAccessToken;

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, tenantId, businessName } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please add all required fields' });
        }

        if (!tenantId && !businessName) {
            return res.status(400).json({ message: 'Provide either tenantId (join existing) or businessName (create new workspace).' });
        }

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Resolve tenant
        let tenant;
        let isNewTenant = false;
        if (tenantId) {
            tenant = await Tenant.findById(tenantId);
            if (!tenant || !tenant.isActive) {
                return res.status(404).json({ message: 'Tenant not found or inactive.' });
            }
        } else {
            // Create a new tenant (new business signup) with 14-day trial
            const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
            tenant = await Tenant.create({
                name: businessName,
                subscription: {
                    status: 'trialing',
                    trialEndsAt: trialEnd,
                },
            });
            isNewTenant = true;
        }

        // For new tenants, assign Owner/Founder role (full admin access during trial)
        let assignedRole = null;
        if (isNewTenant) {
            assignedRole = await Role.findOne({ name: 'Owner/Founder', isSystemRole: true });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: assignedRole ? assignedRole._id : null,
            tenant: tenant._id
        });

        if (user) {
            const refreshToken = await issueRefreshToken(user._id);
            res.status(201).json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                roleObject: assignedRole ? { _id: assignedRole._id, name: assignedRole.name } : null,
                permissions: assignedRole ? assignedRole.permissions : [],
                isActive: user.isActive,
                preferences: user.preferences,
                tenant: tenant._id,
                subscription: tenant.subscription || null,
                token: generateAccessToken(user._id),
                refreshToken,
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        logger.error({ err: error }, 'Auth error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user email, importantly select password back so we can verify it
        const user = await User.findOne({ email }).select('+password').populate('role');

        if (user && (await user.matchPassword(password))) {
            if (!user.isActive) {
                return res.status(401).json({ message: 'Account disabled. Contact Administrator.' });
            }

            // Compute effective permissions for the frontend
            let effectivePermissions = new Set(user.role ? user.role.permissions : []);
            if (user.permissionOverrides && user.permissionOverrides.length > 0) {
                user.permissionOverrides.forEach(override => {
                    if (override.effect === 'allow') {
                        effectivePermissions.add(override.permission);
                    } else if (override.effect === 'deny') {
                        effectivePermissions.delete(override.permission);
                    }
                });
            }
            // Normalise legacy permission strings → new PERMS constants
            for (const p of [...effectivePermissions]) {
                const mapped = LEGACY_PERMISSION_MAP[p];
                if (mapped) effectivePermissions.add(mapped);
            }

            audit({ tenant: user.tenant, actorUserId: user._id, action: 'LOGIN_SUCCESS', module: 'auth', metadata: { email, role: user.role?.name } });

            // Fetch tenant subscription info
            const tenantDoc = await Tenant.findById(user.tenant).select('subscription').lean();

            const refreshToken = await issueRefreshToken(user._id);
            res.json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role ? user.role.name : 'user', // Backward compatible string
                roleObject: user.role, // Full role object
                permissions: Array.from(effectivePermissions), // Computed permissions list
                permissionOverrides: user.permissionOverrides,
                isActive: user.isActive,
                preferences: user.preferences,
                tenant: user.tenant,
                subscription: tenantDoc?.subscription || null,
                token: generateAccessToken(user._id),
                refreshToken,
            });
        } else {
            // Log failed attempts with tenant if user exists (wrong password)
            if (user) {
                audit({ tenant: user.tenant, actorUserId: user._id, action: 'LOGIN_FAILED', module: 'auth', metadata: { email, reason: 'wrong_password' } });
            }
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        logger.error({ err: error }, 'Auth error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('role').lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let effectivePermissions = new Set(user.role ? user.role.permissions : []);
        if (user.permissionOverrides && user.permissionOverrides.length > 0) {
            user.permissionOverrides.forEach(override => {
                if (override.effect === 'allow') {
                    effectivePermissions.add(override.permission);
                } else if (override.effect === 'deny') {
                    effectivePermissions.delete(override.permission);
                }
            });
        }
        // Normalise legacy permission strings → new PERMS constants
        for (const p of [...effectivePermissions]) {
            const mapped = LEGACY_PERMISSION_MAP[p];
            if (mapped) effectivePermissions.add(mapped);
        }

        // Fetch tenant subscription info
        const tenantDoc = await Tenant.findById(user.tenant).select('subscription').lean();

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role ? user.role.name : 'user',
            roleObject: user.role,
            permissions: Array.from(effectivePermissions),
            permissionOverrides: user.permissionOverrides,
            isActive: user.isActive,
            preferences: user.preferences || {},
            tenant: user.tenant,
            subscription: tenantDoc?.subscription || null,
        });
    } catch (error) {
        logger.error({ err: error }, 'Auth error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({ message: 'If an account with that email exists, a reset link has been generated.' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        await User.findByIdAndUpdate(user._id, {
            resetPasswordToken: hashedToken,
            resetPasswordExpire: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        });

        logger.info({ userId: user._id, email }, 'Password reset token generated');

        // In production, send the token via email.
        // For now, return the token in the response for self-hosted / admin use.
        res.json({
            message: 'If an account with that email exists, a reset link has been generated.',
            // Remove resetToken from response once email service is configured
            resetToken,
        });
    } catch (error) {
        logger.error({ err: error }, 'Forgot password error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Reset password using token
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 12) {
            return res.status(400).json({ message: 'Password must be at least 12 characters' });
        }

        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: new Date() },
        }).select('+resetPasswordToken +resetPasswordExpire');

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Update password and clear reset fields
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        // Invalidate refresh token so old sessions are logged out
        user.refreshToken = undefined;
        user.refreshTokenExpiresAt = undefined;
        await user.save(); // triggers pre-save bcrypt hook

        audit({ tenant: user.tenant, actorUserId: user._id, action: 'PASSWORD_RESET', module: 'auth', metadata: { email: user.email } });
        logger.info({ userId: user._id }, 'Password reset successful');

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (error) {
        logger.error({ err: error }, 'Reset password error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Refresh access token using refresh token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: 'Refresh token is required' });
        }

        const user = await User.findOne({
            refreshToken,
            refreshTokenExpiresAt: { $gt: new Date() },
        }).select('+refreshToken +refreshTokenExpiresAt');

        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        // Rotate: issue new pair
        const newAccessToken = generateAccessToken(user._id);
        const newRefreshToken = await issueRefreshToken(user._id);

        res.json({ token: newAccessToken, refreshToken: newRefreshToken });
    } catch (error) {
        logger.error({ err: error }, 'Auth error');
        res.status(500).json({ message: 'Server Error' });
    }
};
