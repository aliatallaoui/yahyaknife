const Order = require('../models/Order');
const KPISnapshot = require('../models/KPISnapshot');
const Tenant = require('../models/Tenant');

const generateKPISnapshots = async () => {
    console.log("[JOB] Starting Operations KPI Snapshot Generation...");
    try {
        // Find all active tenants (or simply all tenants for now)
        // Note: For extreme scale, this would be chunked/paginated
        const tenants = await Tenant.find({ isActive: true }).select('_id');

        for (const tenant of tenants) {
            try {
                const tenantId = tenant._id;
                const today = new Date();
                today.setHours(0, 0, 0, 0);

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
                    Order.countDocuments({ tenant: tenantId, date: { $gte: today }, status: 'New' }),
                    Order.countDocuments({ tenant: tenantId, status: 'New' }),
                    Order.countDocuments({ tenant: tenantId, status: 'Confirmed' }),
                    Order.countDocuments({ tenant: tenantId, status: { $in: ['Preparing', 'Ready for Pickup'] } }),
                    Order.countDocuments({ tenant: tenantId, status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery'] } }),
                    Order.countDocuments({ tenant: tenantId, date: { $gte: today }, status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery'] } }),
                    Order.countDocuments({ tenant: tenantId, 'deliveryStatus.deliveredAt': { $gte: today }, status: { $in: ['Delivered', 'Paid'] } }),
                    Order.countDocuments({ tenant: tenantId, status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused'] } }),
                    Order.countDocuments({ tenant: tenantId, status: { $in: ['Returned', 'Refused'] } })
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
                    { upsert: true, new: true }
                );

            } catch (tenantErr) {
                console.error(`[JOB] Error generating KPI for tenant ${tenant._id}:`, tenantErr);
            }
        }
        console.log(`[JOB] Finished Operations KPI Snapshot Generation for ${tenants.length} tenants.`);
    } catch (err) {
        console.error("[JOB] Global error in KPI Generation:", err);
    }
};

module.exports = { generateKPISnapshots };
