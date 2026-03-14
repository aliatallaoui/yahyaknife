const logger = require('../shared/logger');
const Order = require('../models/Order');
const KPISnapshot = require('../models/KPISnapshot');
const Tenant = require('../models/Tenant');

const generateKPISnapshots = async () => {
    logger.info('[JOB] Starting Operations KPI Snapshot Generation');
    try {
        // Find all active tenants (or simply all tenants for now)
        // Note: For extreme scale, this would be chunked/paginated
        const tenants = await Tenant.find({ isActive: true }).select('_id');

        for (const tenant of tenants) {
            try {
                const tenantId = tenant._id;
                const now = new Date();
                const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

                // Run aggregations for this tenant
                const [
                    newOrdersToday,
                    pendingConfirmation,
                    confirmedOrders,
                    readyForDispatch,
                    sentToCourier,
                    shippedToday,
                    deliveredToday,
                    shippedEver,
                    returnedEver
                ] = await Promise.all([
                    Order.countDocuments({ tenant: tenantId, deletedAt: null, createdAt: { $gte: today }, status: 'New' }),
                    Order.countDocuments({ tenant: tenantId, deletedAt: null, status: 'New' }),
                    Order.countDocuments({ tenant: tenantId, deletedAt: null, status: 'Confirmed' }),
                    Order.countDocuments({ tenant: tenantId, deletedAt: null, status: { $in: ['Preparing', 'Ready for Pickup'] } }),
                    Order.countDocuments({ tenant: tenantId, deletedAt: null, status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery'] } }),
                    Order.countDocuments({ tenant: tenantId, deletedAt: null, createdAt: { $gte: today }, status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery'] } }),
                    Order.countDocuments({ tenant: tenantId, deletedAt: null, updatedAt: { $gte: today }, status: { $in: ['Delivered', 'Paid'] } }),
                    Order.countDocuments({ tenant: tenantId, deletedAt: null, status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused'] } }),
                    Order.countDocuments({ tenant: tenantId, deletedAt: null, status: { $in: ['Returned', 'Refused'] } })
                ]);

                const returnRate = shippedEver > 0 ? ((returnedEver / shippedEver) * 100).toFixed(1) : 0;

                const metrics = {
                    newOrdersToday,
                    pendingConfirmation,
                    confirmedOrders,
                    readyForDispatch,
                    sentToCourier,
                    shippedToday,
                    deliveredToday,
                    shippedEver,
                    returnedEver,
                    returnRate: parseFloat(returnRate)
                };

                // Upsert the snapshot for this tenant
                await KPISnapshot.findOneAndUpdate(
                    { tenant: tenantId, type: 'operations' },
                    { $set: { metrics, lastUpdated: new Date() } },
                    { upsert: true, returnDocument: 'after' }
                );

            } catch (tenantErr) {
                logger.error({ err: tenantErr, tenantId: tenant._id }, '[JOB] Error generating KPI for tenant');
            }
        }
        logger.info({ tenantCount: tenants.length }, '[JOB] Finished Operations KPI Snapshot Generation');
    } catch (err) {
        logger.error({ err }, '[JOB] Global error in KPI Generation');
    }
};

module.exports = { generateKPISnapshots };
