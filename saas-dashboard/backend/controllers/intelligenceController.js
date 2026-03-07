const Order = require('../models/Order');
const ProductVariant = require('../models/ProductVariant');
const Customer = require('../models/Customer');
const Courier = require('../models/Courier');
const moment = require('moment');

// --- Heuristic AI Intelligence Methods ---

// 1. Stockout Prediction Algorithm
// Calculates daily sales velocity over the last 30 days and projects when stock will hit 0.
exports.getStockoutPredictions = async (req, res) => {
    try {
        const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

        // Find all active variants
        const variants = await ProductVariant.find({ status: 'Active' });

        const predictions = await Promise.all(variants.map(async (v) => {
            // Count total units sold for this variant in the last 30 days
            const recentOrders = await Order.find({
                'products.variantId': v._id,
                createdAt: { $gte: thirtyDaysAgo },
                status: { $nin: ['Cancelled', 'Refused', 'Returned'] }
            });

            let unitsSold30Days = 0;
            recentOrders.forEach(order => {
                const product = order.products.find(p => p.variantId.toString() === v._id.toString());
                if (product) unitsSold30Days += product.quantity;
            });

            const dailyVelocity = unitsSold30Days / 30;
            const availableStock = v.totalStock - v.reservedStock;

            let daysUntilStockout = null;
            let riskLevel = 'Low';

            if (dailyVelocity > 0) {
                daysUntilStockout = Math.floor(availableStock / dailyVelocity);
                if (daysUntilStockout <= v.reorderLevel) {
                    riskLevel = 'Critical';
                } else if (daysUntilStockout <= v.reorderLevel * 2) {
                    riskLevel = 'Moderate';
                }
            } else if (availableStock === 0) {
                daysUntilStockout = 0;
                riskLevel = 'Stockout';
            }

            return {
                variantId: v._id,
                sku: v.sku,
                stock: availableStock,
                velocity: dailyVelocity.toFixed(2),
                daysUntilStockout,
                riskLevel
            };
        }));

        res.json(predictions.filter(p => ['Critical', 'Moderate', 'Stockout'].includes(p.riskLevel)));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Fraud & Refusal Risk Detection
// Analyzes a pending order's customer history and patterns to predict refusal probability.
exports.evaluateOrderRisk = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId).populate('customer');
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const customer = order.customer;

        let riskScore = 0;
        let flags = [];

        // Historical Refusal Check
        if (customer.totalRefusals > 0) {
            riskScore += (customer.refusalRate * 0.8); // heavy penalty for past refusals
            flags.push(`Customer has ${customer.totalRefusals} previous refusals (${Math.round(customer.refusalRate)}% rate).`);
        }

        // Fresh Customer Check (No successful history)
        if (customer.totalOrders === 0 || (customer.totalOrders > 0 && customer.lifetimeValue === 0)) {
            riskScore += 20;
            flags.push('New customer with no historically paid orders.');
        }

        // High Value COD Check
        if (order.totalAmount > 20000) { // arbitrary high threshold for generic logic (e.g. 20,000 DZD)
            riskScore += 15;
            flags.push(`Unusually high COD value: ${order.totalAmount}`);
        }

        // Cap score at 100
        riskScore = Math.min(Math.round(riskScore), 100);

        let recommendation = 'Auto-Verify';
        if (riskScore >= 70) recommendation = 'Block/Review';
        else if (riskScore > 35) recommendation = 'Phone Confirm required';

        // Optionally save the score back to the order 
        if (order.fraudRiskScore === 0 && riskScore > 0) {
            order.fraudRiskScore = riskScore;
            await order.save();
        }

        res.json({
            orderId: order._id,
            riskScore,
            recommendation,
            flags,
            customerTrustScore: customer.trustScore
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Courier Performance Optimization
// Ranks couriers for a specific delivery region based on historical success rate.
exports.optimizeCourierSelection = async (req, res) => {
    try {
        const { region } = req.query; // e.g., 'Algiers'

        let query = { status: 'Active' };
        if (region) {
            query.coverageZones = { $in: [region] };
        }

        const couriers = await Courier.find(query);

        // Sort by reliability score (highest first), then by pending remittance (lowest first to spread cash load)
        const rankedCouriers = couriers.sort((a, b) => {
            if (b.reliabilityScore !== a.reliabilityScore) {
                return b.reliabilityScore - a.reliabilityScore;
            }
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

// 4. Global Intelligence Summary (for the main dashboard widget)
exports.getGlobalIntelligence = async (req, res) => {
    try {
        // Quick aggregated snapshot
        const [criticalStock, suspiciousCustomers] = await Promise.all([
            ProductVariant.countDocuments({ status: 'Active', $expr: { $lte: [{ $subtract: ["$totalStock", "$reservedStock"] }, "$reorderLevel"] } }),
            Customer.countDocuments({ isSuspicious: true })
        ]);

        res.json({
            alerts: [
                { type: 'Stock', message: `${criticalStock} variants are at or below reorder level.`, severity: criticalStock > 5 ? 'High' : 'Medium' },
                { type: 'Fraud', message: `${suspiciousCustomers} customers flagged as Suspicious based on refusal behavior.`, severity: 'High' }
            ],
            recommendations: [
                "Run stock movement analysis for top 5 selling SKUs.",
                "Enforce Phone Confirmation for orders originating from High-Risk zones."
            ]
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
