const logger = require('../shared/logger');
const mongoose = require('mongoose');
const ProductVariant = require('../models/ProductVariant');
const StockMovementLedger = require('../models/StockMovementLedger');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const { fireAndRetry } = require('../shared/utils/retryAsync');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Courier = require('../models/Courier');
const moment = require('moment');
const cacheService = require('../services/cacheService');

exports.getSkuIntelligence = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

        // Single aggregation: sold-last-30-days grouped by variantId (replaces N individual aggregations)
        const [variants, salesByVariant] = await Promise.all([
            ProductVariant.find({ tenant: tenantId, status: { $ne: 'Archived' } }).populate('productId', 'name brand category').lean(),
            StockMovementLedger.aggregate([
                { $match: { type: 'DEDUCTION', createdAt: { $gte: thirtyDaysAgo } } },
                { $group: { _id: '$variantId', totalSold: { $sum: { $abs: '$quantity' } } } }
            ])
        ]);

        // Build lookup map: variantId → totalSold
        const salesMap = {};
        salesByVariant.forEach(s => { salesMap[s._id.toString()] = s.totalSold; });

        // Build insights + collect bulk updates
        const bulkOps = [];
        const insights = variants.map(v => {
            const soldIn30Days = salesMap[v._id.toString()] || 0;
            const turnoverRate = v.totalStock > 0 ? parseFloat((soldIn30Days / v.totalStock).toFixed(2)) : 0;
            const isDeadStock = v.totalStock > 0 && soldIn30Days === 0;
            const isLowStock = v.totalStock <= v.reorderLevel;

            let suggestedLifecycle = 'Stable';
            if (isDeadStock && v.totalStock > 100) suggestedLifecycle = 'Dead Stock';
            else if (turnoverRate > 0.5) suggestedLifecycle = 'Fast Moving';
            else if (isDeadStock) suggestedLifecycle = 'Slow Moving';

            const margin = v.price > 0 ? parseFloat((((v.price - v.cost) / v.price) * 100).toFixed(1)) : 0;

            bulkOps.push({
                updateOne: {
                    filter: { _id: v._id },
                    update: {
                        'analytics.turnoverRate': turnoverRate,
                        'analytics.averageMargin': margin,
                        lifecycleStatus: (v.lifecycleStatus === 'New' && !isDeadStock) ? v.lifecycleStatus : (isDeadStock ? 'Dead Stock' : 'Stable')
                    }
                }
            });

            return {
                variantId: v._id,
                sku: v.sku,
                productName: v.productId ? v.productId.name : 'Unknown Product',
                stock: v.totalStock,
                soldLast30Days: soldIn30Days,
                turnoverRate,
                profitMargin: margin,
                status: v.status,
                lifecycleStatus: v.lifecycleStatus,
                isDeadStock,
                isLowStock,
                suggestedLifecycle
            };
        });

        // Single bulkWrite replaces N individual findByIdAndUpdate calls
        if (bulkOps.length > 0) {
            fireAndRetry('analytics:skuBulkWrite', () => ProductVariant.bulkWrite(bulkOps));
        }

        res.json({
            totalSKUs: variants.length,
            deadStockCount: insights.filter(i => i.isDeadStock).length,
            lowStockCount: insights.filter(i => i.isLowStock).length,
            insights
        });
    } catch (error) {
        logger.error({ err: error }, 'Error generating SKU intelligence');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getSupplierIntelligence = async (req, res) => {
    try {
        // Single aggregation replaces N per-supplier PurchaseOrder.find calls
        const tenantId = req.user.tenant;
        const [suppliers, poStats] = await Promise.all([
            Supplier.find({ tenant: tenantId, status: 'Active' }).lean(),
            PurchaseOrder.aggregate([
                { $match: { tenant: tenantId, status: { $ne: 'Draft' } } },
                {
                    $group: {
                        _id: '$supplier',
                        totalPOs: { $sum: 1 },
                        fulfilledPOs: { $sum: { $cond: [{ $eq: ['$status', 'Received'] }, 1, 0] } },
                        totalSpend: { $sum: { $ifNull: ['$totalAmount', 0] } },
                        leadTimeDays: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ['$status', 'Received'] }, { $ne: ['$actualDeliveryDate', null] }] },
                                    { $max: [0, { $divide: [{ $subtract: ['$actualDeliveryDate', '$createdAt'] }, 86400000] }] },
                                    0
                                ]
                            }
                        },
                        validLeadTimeCount: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ['$status', 'Received'] }, { $ne: ['$actualDeliveryDate', null] }] },
                                    1, 0
                                ]
                            }
                        },
                        onTimeCount: {
                            $sum: {
                                $cond: [
                                    { $and: [
                                        { $eq: ['$status', 'Received'] },
                                        { $ne: ['$actualDeliveryDate', null] },
                                        { $ne: ['$expectedDeliveryDate', null] },
                                        { $lte: ['$actualDeliveryDate', '$expectedDeliveryDate'] }
                                    ] },
                                    1, 0
                                ]
                            }
                        }
                    }
                }
            ])
        ]);

        // Build lookup map: supplierId → stats
        const statsMap = {};
        poStats.forEach(s => { statsMap[s._id.toString()] = s; });

        const bulkOps = [];
        const insights = suppliers.map(supplier => {
            const s = statsMap[supplier._id.toString()] || { totalPOs: 0, fulfilledPOs: 0, totalSpend: 0, leadTimeDays: 0, validLeadTimeCount: 0, onTimeCount: 0 };

            const averageLeadTime = s.validLeadTimeCount > 0 ? parseFloat((s.leadTimeDays / s.validLeadTimeCount).toFixed(1)) : 0;
            const reliabilityScore = s.fulfilledPOs > 0 ? parseInt(((s.onTimeCount / s.fulfilledPOs) * 100).toFixed(0), 10) : 0;

            bulkOps.push({
                updateOne: {
                    filter: { _id: supplier._id },
                    update: {
                        'performanceMetrics.reliabilityScore': reliabilityScore,
                        'performanceMetrics.averageLeadTimeDays': averageLeadTime
                    }
                }
            });

            return {
                supplierId: supplier._id,
                name: supplier.name,
                totalPOs: s.totalPOs,
                fulfilledPOs: s.fulfilledPOs,
                averageLeadTime,
                reliabilityScore,
                totalSpend: s.totalSpend
            };
        });

        // Single bulkWrite replaces N individual updates
        if (bulkOps.length > 0) {
            fireAndRetry('analytics:supplierBulkWrite', () => Supplier.bulkWrite(bulkOps));
        }

        res.json({
            totalSuppliers: suppliers.length,
            insights
        });
    } catch (error) {
        logger.error({ err: error }, 'Error generating Supplier intelligence');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.getEcommerceAnalytics = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { range, startDate: customStart, endDate: customEnd } = req.query;
        let startDate = moment().subtract(7, 'days').startOf('day');
        let endDate = moment().endOf('day');

        if (customStart && customEnd) {
            // Custom date range: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
            startDate = moment(customStart).startOf('day');
            endDate = moment(customEnd).endOf('day');
            // Cap at 366 days
            if (endDate.diff(startDate, 'days') > 366) {
                return res.status(400).json({ error: 'Date range cannot exceed 366 days' });
            }
        } else if (range === 'today') {
            startDate = moment().startOf('day');
        } else if (range === 'yesterday') {
            startDate = moment().subtract(1, 'days').startOf('day');
            endDate = moment().subtract(1, 'days').endOf('day');
        } else if (range === '30d') {
            startDate = moment().subtract(30, 'days').startOf('day');
        } else if (range === '90d') {
            startDate = moment().subtract(90, 'days').startOf('day');
        } else if (range === 'ytd') {
            startDate = moment().startOf('year');
        }

        const dateQuery = { tenant: tenantId, deletedAt: null, createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() } };

        // Previous period for comparison (same duration, shifted back)
        const periodMs = endDate.toDate().getTime() - startDate.toDate().getTime();
        const prevStart = new Date(startDate.toDate().getTime() - periodMs);
        const prevEnd = new Date(startDate.toDate().getTime() - 1); // 1ms before current period
        const prevDateQuery = { tenant: tenantId, deletedAt: null, createdAt: { $gte: prevStart, $lte: prevEnd } };

        // Determine Cache TTL based on requested range
        let ttl = 3600; // default 1 hour for larger historical ranges
        if (range === 'today') ttl = 300; // 5 mins for real-time today viewing

        const rangeKey = (customStart && customEnd) ? `${customStart}_${customEnd}` : (range || '7d');
        const cacheKey = `tenant:${tenantId}:analytics:ecommerce:${rangeKey}`;

        const analyticsData = await cacheService.getOrSet(cacheKey, async () => {
            // 1. Overall KPIs & Funnel — current + previous period in parallel
            const [orderAgg, prevOrderAgg] = await Promise.all([
                Order.aggregate([
                    { $match: dateQuery },
                    {
                        $group: {
                            _id: "$status",
                            count:      { $sum: 1 },
                            revenue:    { $sum: "$totalAmount" },
                            cogs:       { $sum: "$financials.cogs" },
                            courierFee: { $sum: "$financials.courierFee" },
                            fees:       { $sum: { $add: ["$financials.gatewayFees", "$financials.marketplaceFees"] } }
                        }
                    }
                ]),
                Order.aggregate([
                    { $match: prevDateQuery },
                    {
                        $group: {
                            _id: null,
                            totalOrders: { $sum: 1 },
                            revenue:     { $sum: { $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, "$totalAmount", 0] } },
                            profit:      { $sum: { $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, { $subtract: [{ $subtract: [{ $subtract: ["$totalAmount", "$financials.cogs"] }, "$financials.courierFee"] }, { $add: ["$financials.gatewayFees", "$financials.marketplaceFees"] }] }, 0] } },
                            confirmed:   { $sum: { $cond: [{ $in: ["$status", ['Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused']] }, 1, 0] } }
                        }
                    }
                ])
            ]);

            let totalOrders = 0;
            let totalRevenue = 0;
            let netProfit = 0;
            let pending = 0, confirmed = 0, shipped = 0, delivered = 0, returned = 0;
            let totalConfirmed = 0; // all orders that passed confirmation (not just in Confirmed status now)

            orderAgg.forEach(status => {
                totalOrders += status.count;
                if (['Delivered', 'Paid'].includes(status._id)) {
                    totalRevenue += status.revenue;
                    netProfit += status.revenue - (status.cogs ?? 0) - (status.courierFee ?? 0) - (status.fees ?? 0);
                }

                if (status._id === 'New') pending += status.count;
                if (['Confirmed', 'Preparing', 'Ready for Pickup'].includes(status._id)) confirmed += status.count;
                if (['Shipped', 'Out for Delivery', 'Dispatched'].includes(status._id)) shipped += status.count;
                if (['Delivered', 'Paid'].includes(status._id)) delivered += status.count;
                if (['Returned', 'Refused'].includes(status._id)) returned += status.count;
                // Everything past "New" call statuses counts as confirmed
                if (['Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned', 'Refused'].includes(status._id)) {
                    totalConfirmed += status.count;
                }
            });

            const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
            const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
            const confirmationRate = totalOrders > 0 ? ((totalConfirmed / totalOrders) * 100).toFixed(1) : 0;

            // Period-over-period comparison
            const prev = prevOrderAgg[0] || { totalOrders: 0, revenue: 0, profit: 0, confirmed: 0 };
            const pctChange = (curr, prevVal) => prevVal > 0 ? parseFloat((((curr - prevVal) / prevVal) * 100).toFixed(1)) : (curr > 0 ? 100 : 0);
            const trendObj = (pct) => ({ direction: pct >= 0 ? 'up' : 'down', pct, label: `${pct >= 0 ? '+' : ''}${pct}%` });
            const confRateDelta = prev.totalOrders > 0
                ? parseFloat((((totalConfirmed / totalOrders) - (prev.confirmed / prev.totalOrders)) * 100).toFixed(1))
                : 0;
            const trends = {
                revenue: trendObj(pctChange(totalRevenue, prev.revenue)),
                orders: trendObj(pctChange(totalOrders, prev.totalOrders)),
                profit: trendObj(pctChange(netProfit, prev.profit)),
                confirmationRate: trendObj(confRateDelta)
            };

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
                { $match: { ...dateQuery, deletedAt: null } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        revenue: {
                            $sum: {
                                $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, "$totalAmount", 0]
                            }
                        },
                        orders: { $sum: 1 },
                        cogs:       { $sum: { $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, "$financials.cogs", 0] } },
                        courierFee: { $sum: { $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, "$financials.courierFee", 0] } },
                        fees:       { $sum: { $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, { $add: ["$financials.gatewayFees", "$financials.marketplaceFees"] }, 0] } }
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
                    profit: data ? data.revenue - (data.cogs ?? 0) - (data.courierFee ?? 0) - (data.fees ?? 0) : 0
                });
            }

            // 3. Category Distribution — real aggregation via Order→ProductVariant→Product→Category
            const Product = require('../models/Product');
            const Category = require('../models/Category');
            const categoryAgg = await Order.aggregate([
                { $match: dateQuery },
                { $unwind: '$products' },
                { $match: { 'products.variantId': { $ne: null } } },
                { $lookup: { from: 'productvariants', localField: 'products.variantId', foreignField: '_id', as: 'variant' } },
                { $unwind: '$variant' },
                { $lookup: { from: 'products', localField: 'variant.productId', foreignField: '_id', as: 'product' } },
                { $unwind: '$product' },
                { $lookup: { from: 'categories', localField: 'product.category', foreignField: '_id', as: 'cat' } },
                { $unwind: '$cat' },
                {
                    $group: {
                        _id: '$cat.name',
                        value: { $sum: { $multiply: ['$products.unitPrice', '$products.quantity'] } }
                    }
                },
                { $sort: { value: -1 } },
                { $limit: 8 }
            ]);
            const categoryData = categoryAgg.length > 0
                ? categoryAgg.map(c => ({ name: c._id || 'Uncategorized', value: c.value }))
                : [{ name: 'General', value: totalRevenue > 0 ? totalRevenue : 1 }];

            // 3b. Wilaya/Region breakdown — top 10 wilayas by order count + revenue
            const wilayaAgg = await Order.aggregate([
                { $match: dateQuery },
                {
                    $group: {
                        _id: '$wilaya',
                        orders: { $sum: 1 },
                        revenue: { $sum: { $cond: [{ $in: ['$status', ['Delivered', 'Paid']] }, '$totalAmount', 0] } },
                        delivered: { $sum: { $cond: [{ $in: ['$status', ['Delivered', 'Paid']] }, 1, 0] } },
                        returned: { $sum: { $cond: [{ $in: ['$status', ['Returned', 'Refused']] }, 1, 0] } }
                    }
                },
                { $sort: { orders: -1 } },
                { $limit: 10 }
            ]);
            const wilayaData = wilayaAgg.map(w => ({
                name: w._id || 'Unknown',
                orders: w.orders,
                revenue: w.revenue,
                delivered: w.delivered,
                returned: w.returned,
                successRate: (w.delivered + w.returned) > 0 ? parseFloat(((w.delivered / (w.delivered + w.returned)) * 100).toFixed(1)) : 0
            }));

            // 3c. Channel breakdown — orders by acquisition channel
            const channelAgg = await Order.aggregate([
                { $match: dateQuery },
                {
                    $group: {
                        _id: '$channel',
                        count: { $sum: 1 },
                        revenue: { $sum: { $cond: [{ $in: ['$status', ['Delivered', 'Paid']] }, '$totalAmount', 0] } }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 50 }
            ]);
            const channelData = channelAgg.map(c => ({
                name: c._id || 'Other',
                orders: c.count,
                revenue: c.revenue
            }));

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

            // 5. Courier Analytics
            const couriers = await Courier.find({ tenant: tenantId, deletedAt: null }).select('_id name').lean();
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
            const topCustomersAgg = await Customer.find({ tenant: tenantId, deletedAt: null })
                .sort({ lifetimeValue: -1 })
                .limit(10)
                .select('name totalOrders lifetimeValue averageOrderValue')
                .lean();

            const customerData = topCustomersAgg.map(c => ({
                id: c._id, name: c.name || 'Unknown',
                orders: c.totalOrders ?? 0,
                revenue: c.lifetimeValue ?? 0,
                aov: c.averageOrderValue ?? 0
            }));

            // 7. Stock Health
            const stockHealthAgg = await ProductVariant.aggregate([
                { $match: { tenant: new mongoose.Types.ObjectId(tenantId), status: 'Active' } },
                {
                    $group: {
                        _id: null,
                        healthy: { $sum: { $cond: [{ $gt: ['$totalStock', '$reorderLevel'] }, 1, 0] } },
                        low:     { $sum: { $cond: [{ $and: [{ $gt: ['$totalStock', 0] }, { $lte: ['$totalStock', '$reorderLevel'] }] }, 1, 0] } },
                        out:     { $sum: { $cond: [{ $lte: ['$totalStock', 0] }, 1, 0] } }
                    }
                }
            ]);
            const sh = stockHealthAgg[0] || { healthy: 0, low: 0, out: 0 };
            const stockHealthData = [
                { name: 'Healthy', value: sh.healthy || 1, color: '#10b981' },
                { name: 'Low Stock', value: sh.low, color: '#f59e0b' },
                { name: 'Out of Stock', value: sh.out, color: '#ef4444' }
            ];

            return {
                kpis: {
                    revenue: totalRevenue,
                    orders: totalOrders,
                    aov,
                    profit: netProfit,
                    margin: profitMargin,
                    confirmationRate: parseFloat(confirmationRate)
                },
                trends,
                salesData,
                orderStatusData,
                categoryData,
                wilayaData,
                channelData,
                courierData,
                customerData,
                stockHealthData,
                topProductsData
            };
        }, ttl);

        res.json(analyticsData);
    } catch (error) {
        logger.error({ err: error }, 'Error generating Ecommerce Analytics');
        res.status(500).json({ error: 'Server Error' });
    }
};
