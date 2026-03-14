const logger = require('../shared/logger');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Get all customers (tenant-scoped)
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
    try {
        const filter = { tenant: req.user.tenant, deletedAt: null };
        const [customers, total] = await Promise.all([
            Customer.find(filter).sort({ createdAt: -1 }).skip(req.skip).limit(req.limit).lean(),
            Customer.countDocuments(filter)
        ]);
        res.json({ data: customers, pagination: req.paginationMeta(total) });
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Lookup customer by phone for intelligence panel
// @route   GET /api/customers/lookup
// @access  Private
const lookupCustomerByPhone = async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json({ message: 'Phone number is required' });

        const tenantId = req.user.tenant;

        const [customer, activeOrders] = await Promise.all([
            Customer.findOne({ phone, tenant: tenantId, deletedAt: null }).lean(),
            Order.find({
                tenant: tenantId,
                deletedAt: null,
                'shipping.phone1': phone,
                status: { $in: ['New', 'Calling', 'No Answer', 'Postponed', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery'] }
            }).select('orderId status products totalAmount createdAt').lean()
        ]);

        const riskIndicator = activeOrders.length > 0 ? 'High' : (customer?.blacklisted ? 'High' : 'Low');
        const warning = activeOrders.length > 0
            ? 'warning_duplicate_orders'
            : (customer?.blacklisted ? 'warning_high_risk' : null);

        res.json({
            exists: !!customer,
            customer: customer || null,
            activeDuplicateOrders: activeOrders,
            riskIndicator,
            warning
        });
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
    try {
        const { name, phone, email, acquisitionChannel, status } = req.body;
        const customer = await Customer.create({ name, phone, email, acquisitionChannel, status, tenant: req.user.tenant });
        res.status(201).json(customer);
    } catch (error) {
        logger.error({ err: error }, 'Error creating customer');
        res.status(400).json({ message: 'Invalid customer data' });
    }
};

// @desc    Update a customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid customer ID' });
        const customer = await Customer.findOne({ _id: req.params.id, tenant: req.user.tenant, deletedAt: null });
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        customer.name = req.body.name || customer.name;
        customer.email = req.body.email || customer.email;
        customer.phone = req.body.phone !== undefined ? req.body.phone : customer.phone;
        customer.address = req.body.address !== undefined ? req.body.address : customer.address;
        customer.acquisitionChannel = req.body.acquisitionChannel || customer.acquisitionChannel;
        customer.status = req.body.status || customer.status;

        const updatedCustomer = await customer.save();
        res.json(updatedCustomer);
    } catch (error) {
        logger.error({ err: error }, 'Error updating customer');
        res.status(400).json({ message: 'Invalid customer data' });
    }
};

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private
const deleteCustomer = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid customer ID' });
        const customer = await Customer.findOneAndUpdate(
            { _id: req.params.id, tenant: req.user.tenant, deletedAt: null },
            { deletedAt: new Date() },
            { returnDocument: 'after' }
        );
        if (!customer) return res.status(404).json({ message: 'Customer not found' });
        res.json({ message: 'Customer removed' });
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get customer order history
// @route   GET /api/customers/:id/orders
// @access  Private
const getCustomerOrders = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid customer ID' });
        const filter = { customer: req.params.id, tenant: req.user.tenant, deletedAt: null };
        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate('products.variantId', 'name sku price')
                .sort({ createdAt: -1 })
                .skip(req.skip).limit(req.limit).lean(),
            Order.countDocuments(filter)
        ]);
        res.json({ data: orders, pagination: req.paginationMeta(total) });
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get customer segment/LTV metrics for the analytics panel
// @route   GET /api/customers/metrics
// @access  Private
const getCustomerMetrics = async (req, res) => {
    try {
        const tenantFilter = { tenant: req.user.tenant, deletedAt: null };

        const [
            totalCustomers,
            activeCustomers,
            churnedCustomers,
            newCustomers,
            returningCustomers,
            highRiskCustomers,
            customers
        ] = await Promise.all([
            Customer.countDocuments(tenantFilter),
            Customer.countDocuments({ ...tenantFilter, status: 'Active' }),
            Customer.countDocuments({ ...tenantFilter, status: 'Churned' }),
            Customer.countDocuments({ ...tenantFilter, isReturning: false }),
            Customer.countDocuments({ ...tenantFilter, isReturning: true }),
            Customer.countDocuments({ ...tenantFilter, refusalRate: { $gte: 30 } }),
            Customer.find(tenantFilter, { acquisitionChannel: 1, lifetimeValue: 1, segment: 1 }).limit(50000).lean()
        ]);

        const acquisitionDistribution = {};
        const ltvDistribution = { whales: 0, vip: 0, regular: 0, lowValue: 0 };
        const segmentDistribution = { 'Whale': 0, 'VIP': 0, 'Repeat Buyer': 0, 'One-Time Buyer': 0, 'Dormant': 0 };
        let totalLTV = 0;

        customers.forEach(c => {
            if (!acquisitionDistribution[c.acquisitionChannel]) {
                acquisitionDistribution[c.acquisitionChannel] = { count: 0, revenue: 0 };
            }
            acquisitionDistribution[c.acquisitionChannel].count++;
            acquisitionDistribution[c.acquisitionChannel].revenue += c.lifetimeValue;

            segmentDistribution[c.segment] = (segmentDistribution[c.segment] || 0) + 1;

            totalLTV += c.lifetimeValue;
            if (c.lifetimeValue > 50000) ltvDistribution.whales++;
            else if (c.lifetimeValue > 20000) ltvDistribution.vip++;
            else if (c.lifetimeValue > 5000) ltvDistribution.regular++;
            else if (c.lifetimeValue > 0) ltvDistribution.lowValue++;
        });

        res.json({
            totalCustomers,
            retentionStatus: { active: activeCustomers, churned: churnedCustomers },
            newVsReturning: { new: newCustomers, returning: returningCustomers },
            acquisitionDistribution,
            ltvDistribution,
            segmentDistribution,
            highRiskCustomers,
            averageLTV: totalCustomers > 0 ? totalLTV / totalCustomers : 0
        });
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ message: 'Server error' });
    }
};

const getFeedback = async (_req, res) => {
    // Feedback feature not yet implemented — return empty result
    res.json({ averageRating: 0, totalReviews: 0, recentFeedback: [] });
};

/**
 * Internal helper — recomputes CRM metrics for a single customer.
 * Called fire-and-forget after order mutations.
 * @param {ObjectId|string} customerId
 */
const updateCustomerMetrics = async (customerId) => {
    try {
        const customer = await Customer.findOne({ _id: customerId, deletedAt: null }).select('_id tenant').lean();
        if (!customer) return;

        // Single aggregation — computes all metrics from orders atomically (no read-then-write race)
        const fulfilledStatuses = ['Shipped', 'Out for Delivery', 'Delivered', 'Paid'];
        const deliveredStatuses = ['Delivered', 'Paid'];
        const [stats] = await Order.aggregate([
            { $match: { customer: customer._id, tenant: customer.tenant, deletedAt: null, status: { $ne: 'Cancelled' } } },
            { $sort: { createdAt: -1 } },
            { $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                fulfilledCount: { $sum: { $cond: [{ $in: ['$status', fulfilledStatuses] }, 1, 0] } },
                deliveredCount: { $sum: { $cond: [{ $in: ['$status', deliveredStatuses] }, 1, 0] } },
                ltv: { $sum: { $cond: [{ $in: ['$status', fulfilledStatuses] }, { $ifNull: ['$totalAmount', 0] }, 0] } },
                netProfit: { $sum: { $cond: [{ $in: ['$status', fulfilledStatuses] }, { $ifNull: ['$financials.netProfit', 0] }, 0] } },
                refusals: { $sum: { $cond: [{ $eq: ['$status', 'Refused'] }, 1, 0] } },
                attemptedDeliveries: { $sum: { $cond: [{ $in: ['$status', [...fulfilledStatuses, 'Refused', 'Returned']] }, 1, 0] } },
                lastOrderDate: { $first: '$createdAt' },
                firstOrderDate: { $last: '$createdAt' }
            }}
        ]);

        if (!stats) {
            // No orders — set inactive
            await Customer.updateOne({ _id: customerId }, { $set: { status: 'Inactive', totalOrders: 0, deliveredOrders: 0, lifetimeValue: 0 } });
            return;
        }

        const { totalOrders, fulfilledCount, deliveredCount, ltv, netProfit, refusals, attemptedDeliveries, lastOrderDate, firstOrderDate } = stats;
        const refusalRate = attemptedDeliveries > 0 ? (refusals / attemptedDeliveries) * 100 : 0;
        const deliverySuccessRate = attemptedDeliveries > 0 ? (deliveredCount / attemptedDeliveries) * 100 : 0;
        const trustScore = Math.max(0, 100 - refusalRate);
        const fraudProbability = Math.min(100, refusalRate * 1.5);
        const daysSinceLastOrder = (Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 3600 * 24);
        const churnRiskScore = Math.min(100, (daysSinceLastOrder / 90) * 100);

        let segment, status;
        if (daysSinceLastOrder > 120) { status = 'Churned'; segment = 'Dormant'; }
        else if (daysSinceLastOrder > 60) { status = 'At Risk'; segment = ltv > 100000 ? 'Whale' : ltv > 50000 || totalOrders > 5 ? 'VIP' : totalOrders > 1 ? 'Repeat Buyer' : 'One-Time Buyer'; }
        else { status = 'Active'; segment = ltv > 100000 ? 'Whale' : ltv > 50000 || totalOrders > 5 ? 'VIP' : totalOrders > 1 ? 'Repeat Buyer' : 'One-Time Buyer'; }

        // Single atomic write — no race window
        await Customer.updateOne({ _id: customerId, deletedAt: null }, { $set: {
            totalOrders, deliveredOrders: deliveredCount, lifetimeValue: ltv,
            averageOrderValue: fulfilledCount > 0 ? ltv / fulfilledCount : 0,
            netProfitGenerated: netProfit, totalRefusals: refusals,
            refusalRate, deliverySuccessRate, trustScore, fraudProbability,
            repeatedRefusalFlag: refusals >= 2,
            requiresDeliveryVerification: refusalRate > 20 || fraudProbability > 50,
            lastOrderDate, lastInteractionDate: lastOrderDate,
            isReturning: totalOrders > 1,
            cohortMonth: new Date(firstOrderDate).toISOString().slice(0, 7),
            segment, status, churnRiskScore
        }});
    } catch (error) {
        logger.error({ err: error }, 'Failed to update customer metrics');
    }
};

module.exports = {
    getCustomers,
    lookupCustomerByPhone,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerOrders,
    getCustomerMetrics,
    getFeedback,
    updateCustomerMetrics
};
