/**
 * checkPlanLimit — middleware that enforces plan-tier usage limits.
 *
 * Usage:
 *   router.post('/orders', protect, requirePermission(PERMS.ORDERS_CREATE), checkPlanLimit('orders'), createOrder);
 *
 * Supported resources: 'users', 'orders', 'products', 'couriers'
 */

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const TenantMembership = require('../models/TenantMembership');
const Order = require('../models/Order');
const ProductVariant = require('../models/ProductVariant');
const Courier = require('../models/Courier');
const cacheService = require('../services/cacheService');
const logger = require('../shared/logger');

const { PLAN_LIMITS } = require('../controllers/tenantController');

const CACHE_TTL = 60; // 1 min cache for limits lookup

const checkPlanLimit = (resource) => async (req, res, next) => {
    try {
        const tenantId = req.user.tenant;

        // Cache tenant limits to avoid DB hit on every request
        const cacheKey = `tenant:limits:${tenantId}`;
        const tenant = await cacheService.getOrSet(cacheKey, async () => {
            return Tenant.findById(tenantId).select('limits planTier').lean();
        }, CACHE_TTL);

        if (!tenant) {
            return res.status(400).json({ message: 'Tenant not found', code: 'NO_TENANT' });
        }

        const limits = tenant.limits || PLAN_LIMITS[tenant.planTier] || PLAN_LIMITS.Free;
        let current, max, code;

        switch (resource) {
            case 'users': {
                max = limits.maxUsers;
                current = await TenantMembership.countDocuments({ tenant: tenantId, status: 'active' });
                code = 'PLAN_LIMIT_USERS';
                break;
            }
            case 'orders': {
                max = limits.maxOrdersPerMonth;
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);
                current = await Order.countDocuments({
                    tenant: tenantId,
                    deletedAt: null,
                    createdAt: { $gte: startOfMonth },
                });
                code = 'PLAN_LIMIT_ORDERS';
                break;
            }
            case 'products': {
                max = limits.maxProducts;
                current = await ProductVariant.countDocuments({ tenant: tenantId, status: 'Active' });
                code = 'PLAN_LIMIT_PRODUCTS';
                break;
            }
            case 'couriers': {
                max = limits.maxCouriers;
                current = await Courier.countDocuments({ tenant: tenantId });
                code = 'PLAN_LIMIT_COURIERS';
                break;
            }
            default:
                logger.warn({ resource }, 'checkPlanLimit: unknown resource type');
                return next();
        }

        if (current >= max) {
            logger.info({ tenant: tenantId, resource, current, max }, 'Plan limit reached');
            return res.status(403).json({
                message: `${resource.charAt(0).toUpperCase() + resource.slice(1)} limit reached (${max}). Upgrade your plan.`,
                code,
                current,
                limit: max,
                planTier: tenant.planTier,
            });
        }

        next();
    } catch (err) {
        logger.error({ err, resource }, 'checkPlanLimit error');
        // Fail open — don't block the request if limit check fails
        next();
    }
};

module.exports = { checkPlanLimit };
