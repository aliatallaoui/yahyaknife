const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const TenantMembership = require('../models/TenantMembership');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');
const cacheService = require('../services/cacheService');
const audit = require('../shared/utils/auditLog');
const logger = require('../shared/logger');

const { PLAN_LIMITS } = require('./tenantController');
const usageTracker = require('../services/usageTracker');

// ─── GET /api/platform/tenants ──────────────────────────────────────────────
// List all tenants with basic health info
exports.listTenants = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 25,
            search,
            planTier,
            status,        // 'active' | 'inactive' | 'deleted'
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = req.query;

        const filter = {};

        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.name = { $regex: escaped, $options: 'i' };
        }
        if (planTier) {
            filter.planTier = planTier;
        }
        if (status === 'active') {
            filter.isActive = true;
            filter.deletedAt = null;
        } else if (status === 'inactive') {
            filter.isActive = false;
            filter.deletedAt = null;
        } else if (status === 'deleted') {
            filter.deletedAt = { $ne: null };
        }

        const skip = (Math.max(1, +page) - 1) * Math.min(100, Math.max(1, +limit));
        const lim = Math.min(100, Math.max(1, +limit));
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const [tenants, total] = await Promise.all([
            Tenant.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(lim)
                .populate('owner', 'name email')
                .lean(),
            Tenant.countDocuments(filter),
        ]);

        // Enrich with member count per tenant
        const tenantIds = tenants.map(t => t._id);
        const memberCounts = await TenantMembership.aggregate([
            { $match: { tenant: { $in: tenantIds }, status: 'active' } },
            { $group: { _id: '$tenant', count: { $sum: 1 } } },
        ]);
        const memberMap = Object.fromEntries(memberCounts.map(m => [m._id.toString(), m.count]));

        const enriched = tenants.map(t => ({
            ...t,
            memberCount: memberMap[t._id.toString()] || 0,
        }));

        res.json({
            data: enriched,
            total,
            page: +page,
            pages: Math.ceil(total / lim),
        });
    } catch (err) {
        logger.error({ err }, 'platformAdmin.listTenants');
        res.status(500).json({ message: 'Failed to load tenants. Please try again.' });
    }
};

// ─── GET /api/platform/tenants/:id ──────────────────────────────────────────
// Detailed tenant view with health metrics
exports.getTenantDetail = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid tenant ID' });
        }

        const tenant = await Tenant.findById(id).populate('owner', 'name email').lean();
        if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

        // Current month start
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [memberCount, orderCountMonth, customerCount, recentOrders] = await Promise.all([
            TenantMembership.countDocuments({ tenant: id, status: 'active' }),
            Order.countDocuments({ tenant: id, deletedAt: null, createdAt: { $gte: startOfMonth } }),
            Customer.countDocuments({ tenant: id }),
            Order.find({ tenant: id, deletedAt: null })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('status financials.total createdAt')
                .lean(),
        ]);

        res.json({
            ...tenant,
            health: {
                memberCount,
                orderCountMonth,
                customerCount,
                recentOrders,
            },
        });
    } catch (err) {
        logger.error({ err }, 'platformAdmin.getTenantDetail');
        res.status(500).json({ message: 'Failed to load tenant details. Please try again.' });
    }
};

// ─── PATCH /api/platform/tenants/:id/suspend ────────────────────────────────
exports.suspendTenant = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid tenant ID' });
        }

        const tenant = await Tenant.findById(id);
        if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
        if (!tenant.isActive) return res.status(400).json({ message: 'Tenant is already inactive' });

        tenant.isActive = false;
        await tenant.save();

        // Invalidate subscription cache so authMiddleware blocks requests immediately
        cacheService.del(`tenant:sub:${id}`);

        audit({
            tenant: id,
            actorUserId: req.user._id,
            action: 'PLATFORM_SUSPEND_TENANT',
            module: 'platform',
            metadata: { tenantName: tenant.name },
        });

        logger.info({ tenantId: id, adminId: req.user._id }, 'Tenant suspended by platform admin');

        res.json({ message: `Tenant "${tenant.name}" suspended` });
    } catch (err) {
        logger.error({ err }, 'platformAdmin.suspendTenant');
        res.status(500).json({ message: 'Failed to suspend tenant. Please try again.' });
    }
};

// ─── PATCH /api/platform/tenants/:id/reactivate ────────────────────────────
exports.reactivateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid tenant ID' });
        }

        const tenant = await Tenant.findById(id);
        if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
        if (tenant.isActive) return res.status(400).json({ message: 'Tenant is already active' });

        tenant.isActive = true;
        tenant.deletedAt = null; // clear soft-delete if any
        await tenant.save();

        cacheService.del(`tenant:sub:${id}`);

        audit({
            tenant: id,
            actorUserId: req.user._id,
            action: 'PLATFORM_REACTIVATE_TENANT',
            module: 'platform',
            metadata: { tenantName: tenant.name },
        });

        logger.info({ tenantId: id, adminId: req.user._id }, 'Tenant reactivated by platform admin');

        res.json({ message: `Tenant "${tenant.name}" reactivated` });
    } catch (err) {
        logger.error({ err }, 'platformAdmin.reactivateTenant');
        res.status(500).json({ message: 'Failed to reactivate tenant. Please try again.' });
    }
};

// ─── PATCH /api/platform/tenants/:id/plan ───────────────────────────────────
// Platform admin can override a tenant's plan
exports.changeTenantPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { planTier } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid tenant ID' });
        }
        if (!planTier || !PLAN_LIMITS[planTier]) {
            return res.status(400).json({
                message: `Invalid plan. Choose one of: ${Object.keys(PLAN_LIMITS).join(', ')}`,
            });
        }

        const tenant = await Tenant.findById(id);
        if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

        const oldPlan = tenant.planTier;
        const newLimits = PLAN_LIMITS[planTier];
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        tenant.planTier = planTier;
        tenant.limits = newLimits;
        tenant.subscription.status = 'active';
        tenant.subscription.currentPeriodEnd = periodEnd;
        await tenant.save();

        cacheService.del(`tenant:sub:${id}`);
        cacheService.del(`tenant:limits:${id}`);

        audit({
            tenant: id,
            actorUserId: req.user._id,
            action: 'PLATFORM_CHANGE_PLAN',
            module: 'platform',
            metadata: { from: oldPlan, to: planTier },
        });

        logger.info({ tenantId: id, from: oldPlan, to: planTier, adminId: req.user._id }, 'Plan changed by platform admin');

        res.json({
            message: `Plan changed from ${oldPlan} to ${planTier}`,
            planTier: tenant.planTier,
            limits: tenant.limits,
        });
    } catch (err) {
        logger.error({ err }, 'platformAdmin.changeTenantPlan');
        res.status(500).json({ message: 'Failed to change tenant plan. Please try again.' });
    }
};

// ─── POST /api/platform/impersonate/:tenantId ───────────────────────────────
// Issues a short-lived impersonation JWT scoped to the target tenant.
// The platform admin's real identity is preserved in the token claims.
exports.impersonateTenant = async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(tenantId)) {
            return res.status(400).json({ message: 'Invalid tenant ID' });
        }

        const tenant = await Tenant.findById(tenantId).lean();
        if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

        // Issue a short-lived token (1 hour) with impersonation flag
        const impersonationToken = jwt.sign(
            {
                id: req.user._id.toString(),
                tenant: tenantId,
                impersonating: true,
                realTenant: req.user.tenant.toString(),
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        audit({
            tenant: tenantId,
            actorUserId: req.user._id,
            action: 'PLATFORM_IMPERSONATE',
            module: 'platform',
            metadata: { tenantName: tenant.name },
        });

        logger.warn(
            { tenantId, adminId: req.user._id, adminEmail: req.user.email },
            'Platform admin started impersonation session'
        );

        res.json({
            token: impersonationToken,
            tenantName: tenant.name,
            tenantId,
            expiresIn: '1 hour',
        });
    } catch (err) {
        logger.error({ err }, 'platformAdmin.impersonateTenant');
        res.status(500).json({ message: 'Failed to impersonate tenant. Please try again.' });
    }
};

// ─── GET /api/platform/analytics ────────────────────────────────────────────
// Platform-wide analytics summary
exports.getPlatformAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const [
            totalTenants,
            activeTenants,
            totalUsers,
            ordersThisMonth,
            ordersLastMonth,
            planDistribution,
            recentTenants,
        ] = await Promise.all([
            Tenant.countDocuments({}),
            Tenant.countDocuments({ isActive: true, deletedAt: null }),
            User.countDocuments({ isActive: true }),
            Order.countDocuments({ deletedAt: null, createdAt: { $gte: startOfMonth } }),
            Order.countDocuments({
                deletedAt: null,
                createdAt: { $gte: startOfLastMonth, $lt: startOfMonth },
            }),
            Tenant.aggregate([
                { $match: { deletedAt: null } },
                { $group: { _id: '$planTier', count: { $sum: 1 } } },
            ]),
            Tenant.find({ deletedAt: null })
                .sort({ createdAt: -1 })
                .limit(10)
                .select('name planTier isActive createdAt subscription.status')
                .populate('owner', 'name email')
                .lean(),
        ]);

        const planDist = Object.fromEntries(planDistribution.map(p => [p._id, p.count]));

        // Revenue approximation from orders this month
        const revenuePipeline = await Order.aggregate([
            { $match: { deletedAt: null, createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$financials.total' } } },
        ]);
        const revenueThisMonth = revenuePipeline[0]?.total || 0;

        res.json({
            tenants: {
                total: totalTenants,
                active: activeTenants,
                inactive: totalTenants - activeTenants,
            },
            users: {
                total: totalUsers,
            },
            orders: {
                thisMonth: ordersThisMonth,
                lastMonth: ordersLastMonth,
                growth: ordersLastMonth > 0
                    ? (((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100).toFixed(1)
                    : null,
            },
            revenueThisMonth,
            planDistribution: planDist,
            recentTenants,
        });
    } catch (err) {
        logger.error({ err }, 'platformAdmin.getPlatformAnalytics');
        res.status(500).json({ message: 'Failed to load platform analytics. Please try again.' });
    }
};

// ─── GET /api/platform/analytics/detailed ───────────────────────────────────
// Deep-dive platform metrics: revenue trends, top tenants, growth, churn
exports.getDetailedAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const months = Math.min(12, Math.max(1, +(req.query.months || 6)));

        // Build monthly date ranges
        const monthlyRanges = [];
        for (let i = months - 1; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            monthlyRanges.push({
                label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
                start,
                end,
            });
        }

        // Monthly revenue + order trends
        const revenueTrend = await Order.aggregate([
            {
                $match: {
                    deletedAt: null,
                    createdAt: { $gte: monthlyRanges[0].start },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                    },
                    revenue: { $sum: '$financials.total' },
                    orders: { $sum: 1 },
                    delivered: {
                        $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] },
                    },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        const revenueByMonth = revenueTrend.map(r => ({
            period: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
            revenue: r.revenue,
            orders: r.orders,
            delivered: r.delivered,
        }));

        // Tenant growth (new tenants per month)
        const tenantGrowth = await Tenant.aggregate([
            {
                $match: { createdAt: { $gte: monthlyRanges[0].start } },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        const growthByMonth = tenantGrowth.map(g => ({
            period: `${g._id.year}-${String(g._id.month).padStart(2, '0')}`,
            newTenants: g.count,
        }));

        // Churn — tenants that became inactive this period
        const churnedThisMonth = await Tenant.countDocuments({
            isActive: false,
            updatedAt: { $gte: monthlyRanges[monthlyRanges.length - 1].start },
        });

        // Top tenants by order volume (this month)
        const currentMonth = monthlyRanges[monthlyRanges.length - 1];
        const topTenants = await Order.aggregate([
            {
                $match: {
                    deletedAt: null,
                    createdAt: { $gte: currentMonth.start, $lt: currentMonth.end },
                },
            },
            {
                $group: {
                    _id: '$tenant',
                    orders: { $sum: 1 },
                    revenue: { $sum: '$financials.total' },
                },
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'tenants',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'tenant',
                },
            },
            { $unwind: '$tenant' },
            {
                $project: {
                    tenantId: '$_id',
                    name: '$tenant.name',
                    planTier: '$tenant.planTier',
                    orders: 1,
                    revenue: 1,
                },
            },
        ]);

        // Subscription status breakdown
        const subBreakdown = await Tenant.aggregate([
            { $match: { deletedAt: null } },
            { $group: { _id: '$subscription.status', count: { $sum: 1 } } },
        ]);
        const subscriptionStatus = Object.fromEntries(subBreakdown.map(s => [s._id || 'none', s.count]));

        res.json({
            revenueByMonth,
            growthByMonth,
            churnedThisMonth,
            topTenants,
            subscriptionStatus,
        });
    } catch (err) {
        logger.error({ err }, 'platformAdmin.getDetailedAnalytics');
        res.status(500).json({ message: 'Failed to load detailed analytics. Please try again.' });
    }
};

// ─── GET /api/platform/tenants/:id/members ──────────────────────────────────
exports.getTenantMembers = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid tenant ID' });
        }

        const members = await TenantMembership.find({ tenant: id })
            .populate('user', 'name email isActive platformRole')
            .populate('role', 'name')
            .sort({ joinedAt: -1 })
            .lean();

        res.json(members);
    } catch (err) {
        logger.error({ err }, 'platformAdmin.getTenantMembers');
        res.status(500).json({ message: 'Failed to load tenant members. Please try again.' });
    }
};

// ─── GET /api/platform/tenants/:id/usage ────────────────────────────────────
// View usage history for a specific tenant
exports.getTenantUsage = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid tenant ID' });
        }

        const months = Math.min(12, Math.max(1, +(req.query.months || 6)));
        const history = await usageTracker.getHistory(id, months);
        const current = await usageTracker.getUsage(id);

        res.json({ current, history });
    } catch (err) {
        logger.error({ err }, 'platformAdmin.getTenantUsage');
        res.status(500).json({ message: 'Failed to load tenant usage. Please try again.' });
    }
};

// ─── GET /api/platform/tenants/:id/audit ──────────────────────────────────
// Recent audit log entries for a tenant
exports.getTenantAuditLog = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid tenant ID' });
        }

        const limit = Math.min(100, Math.max(1, +(req.query.limit || 50)));

        const logs = await AuditLog.find({ tenant: id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('actorUserId', 'name email')
            .lean();

        res.json(logs);
    } catch (err) {
        logger.error({ err }, 'platformAdmin.getTenantAuditLog');
        res.status(500).json({ message: 'Failed to load audit log. Please try again.' });
    }
};
