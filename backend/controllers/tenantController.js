const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const TenantMembership = require('../models/TenantMembership');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Courier = require('../models/Courier');
const ProductVariant = require('../models/ProductVariant');
const Role = require('../models/Role');
const cacheService = require('../services/cacheService');
const audit = require('../shared/utils/auditLog');
const logger = require('../shared/logger');

// ── Plan tier limits lookup ────────────────────────────────────────────────
const PLAN_LIMITS = {
    Free:       { maxUsers: 2,  maxOrdersPerMonth: 100,    maxProducts: 20,   maxCouriers: 1,  smsPerMonth: 0,   exportEnabled: false, apiEnabled: false },
    Basic:      { maxUsers: 5,  maxOrdersPerMonth: 2000,   maxProducts: 200,  maxCouriers: 3,  smsPerMonth: 50,  exportEnabled: true,  apiEnabled: false },
    Pro:        { maxUsers: 20, maxOrdersPerMonth: 20000,  maxProducts: 2000, maxCouriers: 10, smsPerMonth: 500, exportEnabled: true,  apiEnabled: true  },
    Enterprise: { maxUsers: 999999, maxOrdersPerMonth: 999999, maxProducts: 999999, maxCouriers: 999999, smsPerMonth: 999999, exportEnabled: true, apiEnabled: true },
};

// ─── GET /api/tenants/me ────────────────────────────────────────────────────
exports.getMyTenant = async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.user.tenant).lean();
        if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

        // Count team members
        const teamCount = await User.countDocuments({ tenant: tenant._id, isActive: true });

        res.json({ ...tenant, teamCount });
    } catch (err) {
        logger.error({ err }, 'tenantController.getMyTenant');
        res.status(500).json({ message: 'Failed to load workspace settings. Please try again.' });
    }
};

// ─── PATCH /api/tenants/me/settings ─────────────────────────────────────────
exports.updateSettings = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { name, settings } = req.body;

        const updateObj = {};

        // Allow updating tenant name
        if (name && typeof name === 'string' && name.trim().length > 0) {
            updateObj.name = name.trim();
        }

        // Whitelist allowed settings fields (never allow limits/subscription from client)
        if (settings && typeof settings === 'object') {
            const ALLOWED = [
                'currency', 'timezone', 'locale',
                'companyName', 'logo', 'brandColor',
                'businessPhone', 'businessAddress', 'businessHours',
                'codSettings', 'notifications'
            ];
            for (const key of ALLOWED) {
                if (settings[key] !== undefined) {
                    updateObj[`settings.${key}`] = settings[key];
                }
            }
        }

        if (Object.keys(updateObj).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        const tenant = await Tenant.findByIdAndUpdate(
            tenantId,
            { $set: updateObj },
            { returnDocument: 'after', runValidators: true }
        ).lean();

        // Invalidate tenant caches
        cacheService.del(`tenant:sub:${tenantId}`);

        audit({
            tenant: tenantId,
            actorUserId: req.user._id,
            action: 'UPDATE_TENANT_SETTINGS',
            module: 'tenant',
            metadata: { updatedFields: Object.keys(updateObj) }
        });

        res.json(tenant);
    } catch (err) {
        logger.error({ err }, 'tenantController.updateSettings');
        res.status(500).json({ message: 'Failed to update workspace settings. Please try again.' });
    }
};

// ─── GET /api/tenants/me/usage ──────────────────────────────────────────────
exports.getUsage = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const tenant = await Tenant.findById(tenantId).select('limits planTier').lean();
        if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

        // Current month start
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [activeUsers, ordersThisMonth, productCount, courierCount] = await Promise.all([
            User.countDocuments({ tenant: tenantId, isActive: true }),
            Order.countDocuments({ tenant: tenantId, deletedAt: null, createdAt: { $gte: startOfMonth } }),
            ProductVariant.countDocuments({ tenant: tenantId, status: 'Active' }),
            Courier.countDocuments({ tenant: tenantId }),
        ]);

        const limits = tenant.limits || PLAN_LIMITS[tenant.planTier] || PLAN_LIMITS.Free;

        res.json({
            planTier: tenant.planTier,
            usage: {
                users:          { current: activeUsers,      limit: limits.maxUsers },
                ordersPerMonth: { current: ordersThisMonth,  limit: limits.maxOrdersPerMonth },
                products:       { current: productCount,     limit: limits.maxProducts },
                couriers:       { current: courierCount,     limit: limits.maxCouriers },
            },
            features: {
                exportEnabled: limits.exportEnabled,
                apiEnabled:    limits.apiEnabled,
                smsPerMonth:   limits.smsPerMonth,
            },
        });
    } catch (err) {
        logger.error({ err }, 'tenantController.getUsage');
        res.status(500).json({ message: 'Failed to load team members. Please try again.' });
    }
};

// ─── GET /api/tenants/me/team ───────────────────────────────────────────────
exports.getTeam = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const users = await User.find({ tenant: tenantId })
            .select('name email phone jobTitle isActive role createdAt')
            .populate('role', 'name')
            .sort({ createdAt: 1 })
            .lean();

        res.json(users);
    } catch (err) {
        logger.error({ err }, 'tenantController.getTeam');
        res.status(500).json({ message: 'Failed to invite team member. Please try again.' });
    }
};

// ─── POST /api/tenants/me/invite ────────────────────────────────────────────
const INVITE_EXPIRY_DAYS = 7;

exports.inviteUser = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { email, roleId } = req.body;

        if (!email) return res.status(400).json({ message: 'Email is required' });

        // Check plan limit
        const tenant = await Tenant.findById(tenantId).select('limits planTier name').lean();
        const limits = tenant.limits || PLAN_LIMITS[tenant.planTier] || PLAN_LIMITS.Free;
        const activeUsers = await User.countDocuments({ tenant: tenantId, isActive: true });
        if (activeUsers >= limits.maxUsers) {
            return res.status(403).json({
                message: `User limit reached (${limits.maxUsers}). Upgrade your plan.`,
                code: 'PLAN_LIMIT_USERS',
            });
        }

        // Validate email isn't already in this tenant
        const existing = await User.findOne({ email, tenant: tenantId }).lean();
        if (existing) {
            return res.status(409).json({ message: 'User with this email already exists in your team' });
        }

        // Validate role if provided
        if (roleId) {
            const role = await Role.findOne({ _id: roleId, $or: [{ tenant: tenantId }, { isSystemRole: true }] }).lean();
            if (!role) return res.status(400).json({ message: 'Invalid role' });
        }

        // Generate signed invite token (JWT)
        const inviteToken = jwt.sign(
            { email, tenant: tenantId.toString(), role: roleId || null, type: 'invite' },
            process.env.JWT_SECRET,
            { expiresIn: `${INVITE_EXPIRY_DAYS}d` }
        );

        audit({
            tenant: tenantId,
            actorUserId: req.user._id,
            action: 'INVITE_SENT',
            module: 'tenant',
            metadata: { email, roleId }
        });

        logger.info({ tenant: tenantId, email }, 'Invite token generated');

        // In production, send this via email. For now, return the token + link.
        res.status(201).json({
            message: 'Invitation created',
            inviteToken,
            inviteLink: `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/register?invite=${inviteToken}`,
            expiresIn: `${INVITE_EXPIRY_DAYS} days`,
        });
    } catch (err) {
        logger.error({ err }, 'tenantController.inviteUser');
        res.status(500).json({ message: 'Failed to update team member. Please try again.' });
    }
};

// ─── POST /api/tenants/accept-invite ────────────────────────────────────────
exports.acceptInvite = async (req, res) => {
    try {
        const { inviteToken, name, password } = req.body;

        if (!inviteToken || !name || !password) {
            return res.status(400).json({ message: 'inviteToken, name, and password are required' });
        }

        if (password.length < 12) {
            return res.status(400).json({ message: 'Password must be at least 12 characters' });
        }

        // Verify invite JWT
        let decoded;
        try {
            decoded = jwt.verify(inviteToken, process.env.JWT_SECRET);
        } catch {
            return res.status(400).json({ message: 'Invalid or expired invite link' });
        }

        if (decoded.type !== 'invite') {
            return res.status(400).json({ message: 'Invalid token type' });
        }

        const { email, tenant: tenantId, role: roleId } = decoded;

        // Verify tenant is still active
        const tenant = await Tenant.findById(tenantId).lean();
        if (!tenant || !tenant.isActive) {
            return res.status(400).json({ message: 'This workspace is no longer active' });
        }

        // Re-check plan limit at accept time
        const limits = tenant.limits || PLAN_LIMITS[tenant.planTier] || PLAN_LIMITS.Free;
        const activeMembers = await TenantMembership.countDocuments({ tenant: tenantId, status: 'active' });
        if (activeMembers >= limits.maxUsers) {
            return res.status(403).json({
                message: 'This workspace has reached its user limit. Ask the owner to upgrade.',
                code: 'PLAN_LIMIT_USERS',
            });
        }

        // Check if user already exists with this email
        const existingUser = await User.findOne({ email });
        let user;

        if (existingUser) {
            // Check if already a member of this tenant
            const existingMembership = await TenantMembership.findOne({
                user: existingUser._id,
                tenant: tenantId,
            });
            if (existingMembership) {
                return res.status(409).json({ message: 'You already have access to this workspace' });
            }

            // Existing user joining a new tenant — create membership
            await TenantMembership.create({
                user: existingUser._id,
                tenant: tenantId,
                role: roleId || null,
                status: 'active',
                invitedAt: new Date(),
                joinedAt: new Date(),
            });

            // Switch user's active tenant to the new one
            await User.findByIdAndUpdate(existingUser._id, {
                tenant: tenantId,
                role: roleId || null,
            });

            // Invalidate auth cache
            cacheService.del(`auth:user:${existingUser._id}`);
            user = existingUser;
        } else {
            // Create new user
            user = await User.create({
                name,
                email,
                password,
                tenant: tenantId,
                role: roleId || null,
            });

            // Create membership
            await TenantMembership.create({
                user: user._id,
                tenant: tenantId,
                role: roleId || null,
                status: 'active',
                invitedAt: new Date(),
                joinedAt: new Date(),
            });
        }

        // Issue tokens
        const accessToken = jwt.sign(
            { id: user._id.toString(), tenant: tenantId },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Issue refresh token
        const refreshRaw = crypto.randomBytes(40).toString('hex');
        const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await User.findByIdAndUpdate(user._id, {
            refreshToken: refreshRaw,
            refreshTokenExpiresAt: refreshExpiry,
        });

        audit({
            tenant: tenantId,
            actorUserId: user._id,
            action: 'INVITE_ACCEPTED',
            module: 'tenant',
            metadata: { email, roleId, existingUser: !!existingUser }
        });

        const populatedRole = roleId ? await Role.findOne({ _id: roleId, $or: [{ tenant: tenantId }, { isSystemRole: true }] }).lean() : null;

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: populatedRole ? populatedRole.name : 'user',
            roleObject: populatedRole,
            permissions: populatedRole ? populatedRole.permissions : [],
            isActive: true,
            preferences: user.preferences,
            tenant: tenantId,
            subscription: tenant.subscription || null,
            token: accessToken,
            refreshToken: refreshRaw,
        });
    } catch (err) {
        logger.error({ err }, 'tenantController.acceptInvite');
        res.status(500).json({ message: 'Failed to generate API key. Please try again.' });
    }
};

// ─── DELETE /api/tenants/me (soft delete) ───────────────────────────────────
exports.requestDeletion = async (req, res) => {
    try {
        const tenantId = req.user.tenant;

        // Only tenant owner can delete
        const tenant = await Tenant.findById(tenantId).lean();
        if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

        if (tenant.owner && tenant.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the workspace owner can request deletion' });
        }

        // Soft delete
        await Tenant.findByIdAndUpdate(tenantId, {
            isActive: false,
            deletedAt: new Date(),
            'subscription.status': 'canceled',
        });

        // Deactivate all users
        await User.updateMany({ tenant: tenantId }, { isActive: false });

        // Invalidate caches
        cacheService.del(`tenant:sub:${tenantId}`);

        audit({
            tenant: tenantId,
            actorUserId: req.user._id,
            action: 'TENANT_DELETE_REQUESTED',
            module: 'tenant',
            metadata: {}
        });

        logger.info({ tenant: tenantId, userId: req.user._id }, 'Tenant soft-deleted');

        res.json({ message: 'Workspace scheduled for deletion. Data will be retained for 90 days.' });
    } catch (err) {
        logger.error({ err }, 'tenantController.requestDeletion');
        res.status(500).json({ message: 'Failed to update webhook. Please try again.' });
    }
};

// ─── PUT /api/tenants/me/plan ───────────────────────────────────────────────
// For now this is a direct plan switch (no payment).
// When Stripe/Chargily is integrated, payment verification happens before calling this.
exports.changePlan = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { planTier } = req.body;

        if (!planTier || !PLAN_LIMITS[planTier]) {
            return res.status(400).json({
                message: `Invalid plan. Choose one of: ${Object.keys(PLAN_LIMITS).join(', ')}`,
            });
        }

        // Only owner can change plan
        const tenant = await Tenant.findById(tenantId).lean();
        if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

        if (tenant.owner && tenant.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the workspace owner can change the plan' });
        }

        const newLimits = PLAN_LIMITS[planTier];
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const updated = await Tenant.findByIdAndUpdate(tenantId, {
            $set: {
                planTier,
                limits: newLimits,
                'subscription.status': 'active',
                'subscription.currentPeriodEnd': periodEnd,
            }
        }, { returnDocument: 'after' }).lean();

        // Flush all caches for this tenant
        cacheService.del(`tenant:sub:${tenantId}`);
        cacheService.del(`tenant:limits:${tenantId}`);

        audit({
            tenant: tenantId,
            actorUserId: req.user._id,
            action: 'PLAN_CHANGED',
            module: 'tenant',
            metadata: { from: tenant.planTier, to: planTier }
        });

        logger.info({ tenant: tenantId, from: tenant.planTier, to: planTier }, 'Plan changed');

        res.json({
            message: `Plan upgraded to ${planTier}`,
            planTier: updated.planTier,
            limits: updated.limits,
            subscription: updated.subscription,
        });
    } catch (err) {
        logger.error({ err }, 'tenantController.changePlan');
        res.status(500).json({ message: 'Failed to load webhook deliveries. Please try again.' });
    }
};

// ─── POST /api/tenants/me/export ────────────────────────────────────────────
// Tenant owner can request a full GDPR-style data export
const tenantDataExport = require('../services/tenantDataExport');

exports.requestDataExport = async (req, res) => {
    try {
        const tenantId = req.user.tenant;

        // Only owner can request export
        const tenant = await Tenant.findById(tenantId).lean();
        if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

        if (tenant.owner && tenant.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the workspace owner can request a data export' });
        }

        const jobId = await tenantDataExport.enqueue(tenantId);

        audit({
            tenant: tenantId,
            actorUserId: req.user._id,
            action: 'DATA_EXPORT_REQUESTED',
            module: 'tenant',
            metadata: { jobId }
        });

        res.status(202).json({
            message: 'Data export started. This may take a few minutes.',
            jobId,
        });
    } catch (err) {
        logger.error({ err }, 'tenantController.requestDataExport');
        res.status(500).json({ message: 'Failed to start export. Please try again.' });
    }
};

exports.getDataExportStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        const status = tenantDataExport.getStatus(jobId);
        if (!status) return res.status(404).json({ message: 'Export job not found or expired' });
        res.json(status);
    } catch (err) {
        logger.error({ err }, 'tenantController.getDataExportStatus');
        res.status(500).json({ message: 'Failed to download export. Please try again.' });
    }
};

module.exports.PLAN_LIMITS = PLAN_LIMITS;
