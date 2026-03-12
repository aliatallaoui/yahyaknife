const Order = require('../models/Order');
const ProductVariant = require('../models/ProductVariant');
const Customer = require('../models/Customer');
const Courier = require('../models/Courier');
const moment = require('moment');

// 1. Stockout Prediction Algorithm
// Calculates daily sales velocity over the last 30 days and projects when stock will hit 0.
exports.getStockoutPredictions = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

        // Single aggregation instead of N+1 Order.find per variant
        const [variants, salesAgg] = await Promise.all([
            ProductVariant.find({ status: 'Active' }),
            Order.aggregate([
                {
                    $match: {
                        tenant: tenantId,
                        createdAt: { $gte: thirtyDaysAgo },
                        status: { $nin: ['Cancelled', 'Refused', 'Returned'] }
                    }
                },
                { $unwind: '$products' },
                { $group: { _id: '$products.variantId', unitsSold: { $sum: '$products.quantity' } } }
            ])
        ]);

        // Map variantId → unitsSold for O(1) lookup
        const salesMap = {};
        salesAgg.forEach(s => { salesMap[s._id.toString()] = s.unitsSold; });

        const predictions = variants.map(v => {
            const unitsSold30Days = salesMap[v._id.toString()] || 0;
            const dailyVelocity = unitsSold30Days / 30;
            const availableStock = v.totalStock - v.reservedStock;

            let daysUntilStockout = null;
            let riskLevel = 'Low';

            if (dailyVelocity > 0) {
                daysUntilStockout = Math.floor(availableStock / dailyVelocity);
                if (daysUntilStockout <= v.reorderLevel) riskLevel = 'Critical';
                else if (daysUntilStockout <= v.reorderLevel * 2) riskLevel = 'Moderate';
            } else if (availableStock === 0) {
                daysUntilStockout = 0;
                riskLevel = 'Stockout';
            }

            return { variantId: v._id, sku: v.sku, stock: availableStock, velocity: dailyVelocity.toFixed(2), daysUntilStockout, riskLevel };
        });

        res.json(predictions.filter(p => ['Critical', 'Moderate', 'Stockout'].includes(p.riskLevel)));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Fraud & Refusal Risk Detection
exports.evaluateOrderRisk = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findOne({ _id: orderId, tenant: req.user.tenant }).populate('customer');
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const customer = order.customer;
        let riskScore = 0;
        const flags = [];

        if (customer.totalRefusals > 0) {
            riskScore += customer.refusalRate * 0.8;
            flags.push(`Customer has ${customer.totalRefusals} previous refusals (${Math.round(customer.refusalRate)}% rate).`);
        }

        if (customer.totalOrders === 0 || (customer.totalOrders > 0 && customer.lifetimeValue === 0)) {
            riskScore += 20;
            flags.push('New customer with no historically paid orders.');
        }

        if (order.totalAmount > 20000) {
            riskScore += 15;
            flags.push(`Unusually high COD value: ${order.totalAmount}`);
        }

        riskScore = Math.min(Math.round(riskScore), 100);

        let recommendation = 'Auto-Verify';
        if (riskScore >= 70) recommendation = 'Block/Review';
        else if (riskScore > 35) recommendation = 'Phone Confirm required';

        if (order.fraudRiskScore === 0 && riskScore > 0) {
            order.fraudRiskScore = riskScore;
            await order.save();
        }

        res.json({ orderId: order._id, riskScore, recommendation, flags, customerTrustScore: customer.trustScore });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Courier Performance Optimization
exports.optimizeCourierSelection = async (req, res) => {
    try {
        const { region } = req.query;
        const query = { tenant: req.user.tenant, status: 'Active' };
        if (region) query.coverageZones = { $in: [region] };

        const couriers = await Courier.find(query);

        const rankedCouriers = couriers.sort((a, b) => {
            if (b.reliabilityScore !== a.reliabilityScore) return b.reliabilityScore - a.reliabilityScore;
            return a.pendingRemittance - b.pendingRemittance;
        });

        res.json(rankedCouriers.map(c => ({
            courierId: c._id,
            name: c.name,
            reliabilityScore: c.reliabilityScore,
            successRate: c.successRate,
            pendingRemittance: c.pendingRemittance,
            vehicle: c.vehicleType,
            zones: c.coverageZones
        })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. Global Intelligence Summary
exports.getGlobalIntelligence = async (req, res) => {
    try {
        const tenantId = req.user.tenant;

        const [criticalStock, suspiciousCustomers] = await Promise.all([
            ProductVariant.countDocuments({ status: 'Active', $expr: { $lte: [{ $subtract: ['$totalStock', '$reservedStock'] }, '$reorderLevel'] } }),
            Customer.countDocuments({ tenant: tenantId, blacklisted: true })
        ]);

        res.json({
            alerts: [
                { type: 'Stock', message: `${criticalStock} variants are at or below reorder level.`, severity: criticalStock > 5 ? 'High' : 'Medium' },
                { type: 'Fraud', message: `${suspiciousCustomers} customers blacklisted based on refusal behavior.`, severity: 'High' }
            ],
            recommendations: [
                'Run stock movement analysis for top 5 selling SKUs.',
                'Enforce Phone Confirmation for orders originating from High-Risk zones.'
            ]
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
