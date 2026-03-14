const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Role = require('../models/Role');
const TenantMembership = require('../models/TenantMembership');
const audit = require('../shared/utils/auditLog');
const logger = require('../shared/logger');
const cacheService = require('../services/cacheService');
const { LEGACY_PERMISSION_MAP } = require('../config/permissions');

const TRIAL_DAYS = 14;

// Generate short-lived access token (1 day) — includes tenant for middleware fast-path
const generateAccessToken = (id, tenant) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    const payload = { id };
    if (tenant) payload.tenant = tenant.toString();
    return jwt.sign(payload, process.env.JWT_SECRET, {
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

        // Coerce email to string to prevent NoSQL injection via operator objects
        if (typeof email !== 'string' || typeof name !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'Invalid field types' });
        }

        // Check if user exists
        const userExists = await User.findOne({ email: email.trim().toLowerCase() });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Resolve tenant — only via invite flow, direct tenantId join is disabled
        let tenant;
        let isNewTenant = false;
        if (tenantId) {
            return res.status(400).json({ message: 'Direct tenant join is not supported. Please use an invite link.' });
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
            assignedRole = await Role.findOne({ name: 'Owner / Founder', isSystemRole: true });
            if (!assignedRole) {
                // Fallback: try any system role with full permissions (Super Admin)
                assignedRole = await Role.findOne({ name: 'Super Admin', isSystemRole: true });
                if (!assignedRole) {
                    logger.warn('No system role found for new tenant owner — user will have no permissions. Run seedRoles script.');
                }
            }
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
            // Set the first user as tenant owner
            if (isNewTenant) {
                await Tenant.findByIdAndUpdate(tenant._id, { owner: user._id });
            }

            // Create TenantMembership record
            await TenantMembership.create({
                user: user._id,
                tenant: tenant._id,
                role: assignedRole ? assignedRole._id : null,
                status: 'active',
                joinedAt: new Date(),
            });

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
                onboardingCompleted: false,
                token: generateAccessToken(user._id, tenant._id),
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

        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check for user email, importantly select password back so we can verify it
        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password').populate('role', 'name permissions');

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

            // Fetch tenant subscription + onboarding info
            const tenantDoc = await Tenant.findById(user.tenant).select('subscription onboardingCompletedAt createdAt').lean();

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
                platformRole: user.platformRole || null,
                onboardingCompleted: tenantDoc?.onboardingCompletedAt
                    ? true
                    : tenantDoc?.createdAt && (Date.now() - new Date(tenantDoc.createdAt).getTime() > 3600000),
                token: generateAccessToken(user._id, user.tenant),
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
        const user = await User.findOne({ _id: req.user._id, tenant: req.user.tenant }).populate('role', 'name permissions').lean();

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

        // Fetch tenant subscription info + membership count in parallel
        const [tenantDoc, membershipCount] = await Promise.all([
            Tenant.findById(user.tenant).select('subscription name onboardingCompletedAt createdAt').lean(),
            TenantMembership.countDocuments({ user: user._id, status: 'active' }),
        ]);

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            jobTitle: user.jobTitle || '',
            role: user.role ? user.role.name : 'user',
            roleObject: user.role,
            permissions: Array.from(effectivePermissions),
            permissionOverrides: user.permissionOverrides,
            isActive: user.isActive,
            preferences: user.preferences || {},
            tenant: user.tenant,
            tenantName: tenantDoc?.name || null,
            subscription: tenantDoc?.subscription || null,
            hasMultipleTenants: membershipCount > 1,
            platformRole: user.platformRole || null,
            // Existing tenants (created before onboarding feature) are treated as onboarded
            onboardingCompleted: tenantDoc?.onboardingCompletedAt
                ? true
                : tenantDoc?.createdAt && (Date.now() - new Date(tenantDoc.createdAt).getTime() > 3600000),
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
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });

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
        // In dev, include the token in the response for local testing.
        const response = { message: 'If an account with that email exists, a reset link has been generated.' };
        if (process.env.NODE_ENV !== 'production') {
            response.resetToken = resetToken;
        }
        res.json(response);
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
        const newAccessToken = generateAccessToken(user._id, user.tenant);
        const newRefreshToken = await issueRefreshToken(user._id);

        res.json({ token: newAccessToken, refreshToken: newRefreshToken });
    } catch (error) {
        logger.error({ err: error }, 'Auth error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    List tenants the user has membership in
// @route   GET /api/auth/tenants
// @access  Private
exports.listUserTenants = async (req, res) => {
    try {
        const memberships = await TenantMembership.find({
            user: req.user._id,
            status: 'active',
        })
            .populate('tenant', 'name settings.companyName settings.logo planTier subscription')
            .populate('role', 'name')
            .lean();

        const tenants = memberships.map(m => ({
            _id: m.tenant._id,
            name: m.tenant.settings?.companyName || m.tenant.name,
            logo: m.tenant.settings?.logo || null,
            planTier: m.tenant.planTier,
            role: m.role?.name || null,
            isCurrent: m.tenant._id.toString() === req.user.tenant?.toString(),
            joinedAt: m.joinedAt,
        }));

        res.json(tenants);
    } catch (error) {
        logger.error({ err: error }, 'Auth error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Switch active tenant context
// @route   POST /api/auth/switch-tenant
// @access  Private
exports.switchTenant = async (req, res) => {
    try {
        const { tenantId } = req.body;
        if (!tenantId) {
            return res.status(400).json({ message: 'tenantId is required' });
        }

        // Verify membership
        const membership = await TenantMembership.findOne({
            user: req.user._id,
            tenant: tenantId,
            status: 'active',
        }).populate('role', 'name permissions');

        if (!membership) {
            return res.status(403).json({ message: 'You do not have access to this workspace.' });
        }

        // Verify tenant is active
        const tenant = await Tenant.findById(tenantId).select('isActive subscription name').lean();
        if (!tenant || !tenant.isActive) {
            return res.status(403).json({ message: 'Workspace is inactive.' });
        }

        // Update user's active tenant + role for the new tenant
        await User.findByIdAndUpdate(req.user._id, {
            tenant: tenantId,
            role: membership.role?._id || null,
        });

        // Invalidate auth cache so next request picks up new tenant/role
        cacheService.del(`auth:user:${req.user._id}`);

        // Issue new tokens with the new tenant context
        const newAccessToken = generateAccessToken(req.user._id, tenantId);
        const newRefreshToken = await issueRefreshToken(req.user._id);

        audit({
            tenant: tenantId,
            actorUserId: req.user._id,
            action: 'SWITCH_TENANT',
            module: 'auth',
            metadata: { fromTenant: req.user.tenant?.toString(), toTenant: tenantId },
        });

        // Compute effective permissions for the target tenant's role
        let effectivePermissions = new Set(membership.role ? membership.role.permissions : []);
        // Normalise legacy permission strings
        for (const p of [...effectivePermissions]) {
            const mapped = LEGACY_PERMISSION_MAP[p];
            if (mapped) effectivePermissions.add(mapped);
        }

        res.json({
            token: newAccessToken,
            refreshToken: newRefreshToken,
            tenant: tenantId,
            tenantName: tenant.name,
            role: membership.role?.name || 'user',
            roleObject: membership.role || null,
            permissions: Array.from(effectivePermissions),
            subscription: tenant.subscription || null,
        });
    } catch (error) {
        logger.error({ err: error }, 'Auth error');
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Complete onboarding + save initial settings
// @route   PATCH /api/auth/onboarding
// @access  Private
exports.completeOnboarding = async (req, res) => {
    try {
        const { companyName, businessPhone, businessAddress, currency, locale } = req.body;

        const update = { onboardingCompletedAt: new Date() };

        // Only set settings fields that were provided
        if (companyName) update['settings.companyName'] = companyName;
        if (businessPhone) update['settings.businessPhone'] = businessPhone;
        if (businessAddress) update['settings.businessAddress'] = businessAddress;
        if (currency) update['settings.currency'] = currency;
        if (locale) update['settings.locale'] = locale;

        await Tenant.findByIdAndUpdate(req.user.tenant, { $set: update });

        audit({
            tenant: req.user.tenant,
            actorUserId: req.user._id,
            action: 'ONBOARDING_COMPLETED',
            module: 'auth',
            metadata: { companyName },
        });

        res.json({ message: 'Onboarding completed' });
    } catch (error) {
        logger.error({ err: error }, 'Onboarding error');
        res.status(500).json({ message: 'Server Error' });
    }
};
