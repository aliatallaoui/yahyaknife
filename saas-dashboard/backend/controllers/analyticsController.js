const ProductVariant = require('../models/ProductVariant');
const InventoryLedger = require('../models/InventoryLedger');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const moment = require('moment');

exports.getSkuIntelligence = async (req, res) => {
    try {
        const variants = await ProductVariant.find({ status: { $ne: 'Archived' } }).populate('productId', 'name brand category');

        const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

        const insights = await Promise.all(variants.map(async (v) => {
            // Calculate turnover rate: (Sold in last 30 days) / Average Stock
            const recentSales = await InventoryLedger.aggregate([
                { $match: { variantId: v._id, type: 'Shipped', createdAt: { $gte: thirtyDaysAgo } } },
                { $group: { _id: null, totalSold: { $sum: { $abs: "$changeAmount" } } } }
            ]);

            const soldIn30Days = recentSales[0]?.totalSold || 0;
            const turnoverRate = v.totalStock > 0 ? (soldIn30Days / v.totalStock).toFixed(2) : 0;

            const isDeadStock = v.totalStock > 0 && soldIn30Days === 0;
            const isLowStock = v.totalStock <= v.reorderLevel;

            // Determine Suggested Lifecycle Status
            let suggestedLifecycle = 'Stable';
            if (isDeadStock && v.totalStock > 100) suggestedLifecycle = 'Dead Stock';
            else if (turnoverRate > 0.5) suggestedLifecycle = 'Fast Moving';
            else if (isDeadStock) suggestedLifecycle = 'Slow Moving';

            // Profit margin
            const margin = v.price > 0 ? (((v.price - v.cost) / v.price) * 100).toFixed(1) : 0;

            // Update the analytics buffer directly on the variant to keep it cached
            await ProductVariant.findByIdAndUpdate(v._id, {
                'analytics.turnoverRate': parseFloat(turnoverRate),
                'analytics.averageMargin': parseFloat(margin),
                lifecycleStatus: (v.lifecycleStatus === 'New' && !isDeadStock) ? v.lifecycleStatus : (isDeadStock ? 'Dead Stock' : 'Stable')
            });

            return {
                variantId: v._id,
                sku: v.sku,
                productName: v.productId ? v.productId.name : 'Unknown Product',
                stock: v.totalStock,
                soldLast30Days: soldIn30Days,
                turnoverRate: parseFloat(turnoverRate),
                profitMargin: parseFloat(margin),
                status: v.status,
                lifecycleStatus: v.lifecycleStatus,
                isDeadStock,
                isLowStock,
                suggestedLifecycle
            };
        }));

        res.json({
            totalSKUs: variants.length,
            deadStockCount: insights.filter(i => i.isDeadStock).length,
            lowStockCount: insights.filter(i => i.isLowStock).length,
            insights
        });
    } catch (error) {
        console.error("Error generating SKU intelligence:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getSupplierIntelligence = async (req, res) => {
    try {
        const suppliers = await Supplier.find({ active: true });

        const insights = await Promise.all(suppliers.map(async (supplier) => {
            // Find all POs for this supplier
            const pos = await PurchaseOrder.find({ supplier: supplier._id, status: { $ne: 'Draft' } });

            const totalPOs = pos.length;
            const fulfilledPOs = pos.filter(po => po.status === 'Received');

            let totalLeadTimeDays = 0;
            let validLeadTimeCount = 0;
            let onTimeCount = 0;

            fulfilledPOs.forEach(po => {
                if (po.actualDeliveryDate && po.createdAt) {
                    const leadTime = moment(po.actualDeliveryDate).diff(moment(po.createdAt), 'days');
                    totalLeadTimeDays += Math.max(0, leadTime); // ignore negative
                    validLeadTimeCount++;

                    if (po.expectedDeliveryDate && moment(po.actualDeliveryDate).isSameOrBefore(moment(po.expectedDeliveryDate), 'day')) {
                        onTimeCount++;
                    }
                }
            });

            const averageLeadTime = validLeadTimeCount > 0 ? (totalLeadTimeDays / validLeadTimeCount).toFixed(1) : 0;
            const reliabilityScore = fulfilledPOs.length > 0 ? ((onTimeCount / fulfilledPOs.length) * 100).toFixed(0) : 0;

            const totalSpend = pos.reduce((sum, po) => sum + (po.totalAmount || 0), 0);

            // Automatically update supplier reliability metrics
            await Supplier.findByIdAndUpdate(supplier._id, {
                reliabilityScore: parseInt(reliabilityScore) || 0,
                averageLeadTimeDays: parseFloat(averageLeadTime) || 0,
                totalSpend: parseFloat(totalSpend) || 0
            });

            return {
                supplierId: supplier._id,
                name: supplier.name,
                totalPOs,
                fulfilledPOs: fulfilledPOs.length,
                averageLeadTime: parseFloat(averageLeadTime),
                reliabilityScore: parseInt(reliabilityScore) || 0,
                totalSpend
            };
        }));

        res.json({
            totalSuppliers: suppliers.length,
            insights
        });
    } catch (error) {
        console.error("Error generating Supplier intelligence:", error);
        res.status(500).json({ error: error.message });
    }
};
