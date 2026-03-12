const Customer = require('../models/Customer');
const Order = require('../models/Order');

// @desc    Get all customers (tenant-scoped)
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
    try {
        const customers = await Customer.find({ tenant: req.user.tenant }).sort({ createdAt: -1 });
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message });
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
            Customer.findOne({ phone, tenant: tenantId }),
            Order.find({
                tenant: tenantId,
                'shipping.phone1': phone,
                status: { $in: ['New', 'Calling', 'No Answer', 'Postponed', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery'] }
            }).select('orderId status products totalAmount createdAt')
        ]);

        const riskIndicator = activeOrders.length > 0 ? 'High' : (customer?.blacklisted ? 'High' : 'Low');
        const warning = activeOrders.length > 0
            ? 'Duplicate active orders found for this phone'
            : (customer?.blacklisted ? 'High return risk customer' : null);

        res.json({
            exists: !!customer,
            customer: customer || null,
            activeDuplicateOrders: activeOrders,
            riskIndicator,
            warning
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
    try {
        const customer = await Customer.create({ ...req.body, tenant: req.user.tenant });
        res.status(201).json(customer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
    try {
        const customer = await Customer.findOne({ _id: req.params.id, tenant: req.user.tenant });
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
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private
const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findOneAndDelete({ _id: req.params.id, tenant: req.user.tenant });
        if (!customer) return res.status(404).json({ message: 'Customer not found' });
        res.json({ message: 'Customer removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get customer order history
// @route   GET /api/customers/:id/orders
// @access  Private
const getCustomerOrders = async (req, res) => {
    try {
        const orders = await Order.find({ customer: req.params.id, tenant: req.user.tenant })
            .populate('products.variantId')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get customer segment/LTV metrics for the analytics panel
// @route   GET /api/customers/metrics
// @access  Private
const getCustomerMetrics = async (req, res) => {
    try {
        const tenantFilter = { tenant: req.user.tenant };

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
            Customer.find(tenantFilter, { acquisitionChannel: 1, lifetimeValue: 1, segment: 1 })
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
        res.status(500).json({ message: error.message });
    }
};

const getFeedback = async (_req, res) => {
    try {
        // Placeholder — no Feedback model yet
        res.json({
            averageRating: 4.8,
            totalReviews: 4,
            recentFeedback: [
                { _id: 1, customerId: { name: 'Alice Johnson' }, rating: 5, comment: 'Excellent service!', date: '2023-10-25' },
                { _id: 2, customerId: { name: 'Bob Smith' }, rating: 4, comment: 'Good, but room for improvement.', date: '2023-10-24' },
                { _id: 3, customerId: { name: 'Charlie Brown' }, rating: 5, comment: 'Love the new features.', date: '2023-10-23' },
                { _id: 4, customerId: { name: 'Diana Prince' }, rating: 3, comment: 'Average experience.', date: '2023-10-22' }
            ]
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Internal helper — recomputes CRM metrics for a single customer.
 * Called fire-and-forget after order mutations.
 * @param {ObjectId|string} customerId
 */
const updateCustomerMetrics = async (customerId) => {
    try {
        const customer = await Customer.findById(customerId);
        if (!customer) return;

        // Scope order query by both customer and tenant
        const orders = await Order.find({
            customer: customerId,
            tenant: customer.tenant,
            status: { $ne: 'Cancelled' }
        });

        let fulfilledCount = 0;
        let ltv = 0;
        let netProfit = 0;
        let refusals = 0;
        let attemptedDeliveries = 0;
        let deliveredCount = 0;

        orders.forEach(o => {
            if (['Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(o.status)) {
                fulfilledCount++;
                ltv += (o.totalAmount || 0);
                netProfit += (o.financials?.netProfit || 0);
                attemptedDeliveries++;
                if (['Delivered', 'Paid'].includes(o.status)) deliveredCount++;
            } else if (['Refused', 'Returned'].includes(o.status)) {
                attemptedDeliveries++;
                if (o.status === 'Refused') refusals++;
            }
        });

        customer.totalOrders = orders.length;
        customer.deliveredOrders = deliveredCount;
        customer.lifetimeValue = ltv;
        customer.averageOrderValue = fulfilledCount > 0 ? ltv / fulfilledCount : 0;
        customer.netProfitGenerated = netProfit;

        customer.totalRefusals = refusals;
        customer.refusalRate = attemptedDeliveries > 0 ? (refusals / attemptedDeliveries) * 100 : 0;
        customer.deliverySuccessRate = attemptedDeliveries > 0 ? (deliveredCount / attemptedDeliveries) * 100 : 0;

        customer.trustScore = Math.max(0, 100 - (customer.refusalRate || 0));
        customer.fraudProbability = Math.min(100, customer.refusalRate * 1.5);

        customer.repeatedRefusalFlag = customer.totalRefusals >= 2;
        customer.requiresDeliveryVerification = customer.refusalRate > 20 || customer.fraudProbability > 50;

        if (orders.length > 0) {
            orders.sort((a, b) => b.createdAt - a.createdAt);
            customer.lastOrderDate = orders[0].createdAt;
            customer.lastInteractionDate = orders[0].createdAt;
            customer.isReturning = orders.length > 1;

            const firstOrder = orders[orders.length - 1];
            customer.cohortMonth = new Date(firstOrder.createdAt).toISOString().slice(0, 7);

            if (customer.lifetimeValue > 100000) customer.segment = 'Whale';
            else if (customer.lifetimeValue > 50000 || customer.totalOrders > 5) customer.segment = 'VIP';
            else if (customer.totalOrders > 1) customer.segment = 'Repeat Buyer';
            else customer.segment = 'One-Time Buyer';

            const daysSinceLastOrder = (Date.now() - customer.lastOrderDate.getTime()) / (1000 * 3600 * 24);
            customer.churnRiskScore = Math.min(100, (daysSinceLastOrder / 90) * 100);

            if (daysSinceLastOrder > 120) { customer.status = 'Churned'; customer.segment = 'Dormant'; }
            else if (daysSinceLastOrder > 60) customer.status = 'At Risk';
            else customer.status = 'Active';
        } else {
            customer.status = 'Inactive';
        }

        await customer.save();
    } catch (error) {
        console.error('Failed to update customer metrics:', error);
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
