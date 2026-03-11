const ProductVariant = require('../models/ProductVariant');
const InventoryLedger = require('../models/InventoryLedger');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Courier = require('../models/Courier');
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

exports.getEcommerceAnalytics = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { range } = req.query; // e.g., 'today', 'yesterday', '7d', '30d'
        let startDate = moment().subtract(7, 'days').startOf('day');
        let endDate = moment().endOf('day');

        if (range === 'today') {
            startDate = moment().startOf('day');
        } else if (range === 'yesterday') {
            startDate = moment().subtract(1, 'days').startOf('day');
            endDate = moment().subtract(1, 'days').endOf('day');
        } else if (range === '30d') {
            startDate = moment().subtract(30, 'days').startOf('day');
        }

        const dateQuery = { tenant: tenantId, createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() } };

        // 1. Overall KPIs & Funnel (from Orders)
        const orderAgg = await Order.aggregate([
            { $match: dateQuery },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    revenue: { $sum: "$totalAmount" },
                    profit: { $sum: "$financials.netProfit" }
                }
            }
        ]);

        let totalOrders = 0;
        let totalRevenue = 0;
        let netProfit = 0;
        let pending = 0, confirmed = 0, shipped = 0, delivered = 0, returned = 0;

        orderAgg.forEach(status => {
            totalOrders += status.count;
            if (['Delivered', 'Paid'].includes(status._id)) {
                totalRevenue += status.revenue;
                netProfit += status.profit;
            }

            if (status._id === 'New') pending += status.count;
            if (['Confirmed', 'Preparing', 'Ready for Pickup'].includes(status._id)) confirmed += status.count;
            if (['Shipped', 'Out for Delivery', 'Dispatched'].includes(status._id)) shipped += status.count;
            if (['Delivered', 'Paid'].includes(status._id)) delivered += status.count;
            if (['Returned', 'Refused'].includes(status._id)) returned += status.count;
        });

        const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
        const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

        const orderStatusData = [
            { status: 'Pending', count: pending, color: '#f59e0b' },
            { status: 'Confirmed', count: confirmed, color: '#3b82f6' },
            { status: 'Shipped', count: shipped, color: '#8b5cf6' },
            { status: 'Delivered', count: delivered, color: '#10b981' },
            { status: 'Returned', count: returned, color: '#ef4444' }
        ];

        // 2. Sales Trend (Time Series based on range days)
        const diffDays = Math.max(1, endDate.diff(startDate, 'days'));
        const trendPipeline = [
            { $match: dateQuery },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: {
                        $sum: {
                            $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, "$totalAmount", 0]
                        }
                    },
                    orders: { $sum: 1 },
                    profit: {
                        $sum: {
                            $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, "$financials.netProfit", 0]
                        }
                    }
                }
            },
            { $sort: { "_id": 1 } }
        ];
        const trendDataRaw = await Order.aggregate(trendPipeline);
        const trendMap = {};
        trendDataRaw.forEach(t => trendMap[t._id] = t);

        const salesData = [];
        for (let i = 0; i <= diffDays; i++) {
            const d = moment(startDate).add(i, 'days').format('YYYY-MM-DD');
            const data = trendMap[d];
            salesData.push({
                date: moment(d).format('DD/MM'),
                revenue: data ? data.revenue : 0,
                orders: data ? data.orders : 0,
                profit: data ? data.profit : 0
            });
        }

        // 3. Category Distribution (Mocking category grouping from variants linked to orders for now)
        // Since deep population in aggregations is heavy, we'll run a basic stat.
        const categoryData = [
            { name: 'General', value: totalRevenue > 0 ? totalRevenue : 1 }
        ];

        // 4. Products Table (Top by sales volume logic)
        const topProductsAgg = await Order.aggregate([
            { $match: dateQuery },
            { $unwind: "$products" },
            {
                $group: {
                    _id: "$products.name",
                    units: { $sum: "$products.quantity" },
                    revenue: {
                        $sum: {
                            $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, { $multiply: ["$products.unitPrice", "$products.quantity"] }, 0]
                        }
                    }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 }
        ]);

        const topProductsData = topProductsAgg.map((p, idx) => ({
            id: p._id || idx,
            name: p._id || 'Unknown Custom Item',
            units: p.units,
            revenue: p.revenue,
            conv: totalOrders > 0 ? ((p.units / totalOrders) * 100).toFixed(1) : 0 // Rough conversion substitute
        }));

        // 5. Courier Analytics (single aggregation instead of N+1 per courier)
        const couriers = await Courier.find({ tenant: tenantId });
        const courierIds = couriers.map(c => c._id);
        const courierAgg = await Order.aggregate([
            { $match: { ...dateQuery, courier: { $in: courierIds } } },
            {
                $group: {
                    _id: '$courier',
                    dispatched: { $sum: { $cond: [{ $in: ['$status', ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused']] }, 1, 0] } },
                    delivered: { $sum: { $cond: [{ $in: ['$status', ['Delivered', 'Paid']] }, 1, 0] } },
                    returned: { $sum: { $cond: [{ $in: ['$status', ['Returned', 'Refused']] }, 1, 0] } }
                }
            }
        ]);
        const courierStatsMap = {};
        courierAgg.forEach(r => { courierStatsMap[r._id.toString()] = r; });
        const courierData = couriers.map(c => {
            const s = courierStatsMap[c._id.toString()] || { dispatched: 0, delivered: 0, returned: 0 };
            const succ = s.dispatched > 0 ? ((s.delivered / s.dispatched) * 100).toFixed(1) : 0;
            return { id: c._id, name: c.name, orders: s.dispatched, delivered: s.delivered, returned: s.returned, success: parseFloat(succ) };
        });

        // 6. Top Customers
        const topCustomersAgg = await Customer.find({ tenant: tenantId })
            .sort({ lifetimeValue: -1 })
            .limit(10);

        const customerData = topCustomersAgg.map(c => ({
            id: c._id, name: c.name || 'Unknown',
            orders: c.totalOrders || 0,
            revenue: c.lifetimeValue || 0,
            aov: c.averageOrderValue || 0
        }));

        // 7. Stock Health
        const variants = await ProductVariant.find({ status: 'Active' });
        let healthy = 0, low = 0, out = 0;
        variants.forEach(v => {
            if (v.totalStock <= 0) out++;
            else if (v.totalStock <= v.reorderLevel) low++;
            else healthy++;
        });
        const stockHealthData = [
            { name: 'Healthy', value: healthy || 1, color: '#10b981' },
            { name: 'Low Stock', value: low, color: '#f59e0b' },
            { name: 'Out of Stock', value: out, color: '#ef4444' }
        ];

        res.json({
            kpis: {
                revenue: totalRevenue,
                orders: totalOrders,
                aov,
                profit: netProfit,
                margin: profitMargin
            },
            salesData,
            orderStatusData,
            categoryData,
            courierData,
            customerData,
            stockHealthData,
            topProductsData
        });
    } catch (error) {
        console.error("Error generating Ecommerce Analytics:", error);
        res.status(500).json({ error: error.message });
    }
};
