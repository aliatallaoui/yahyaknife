const Customer = require('../models/Customer');
const Order = require('../models/Order');

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
    try {
        const customers = await Customer.find({}).sort({ createdAt: -1 });
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
    try {
        const customer = new Customer(req.body);
        const createdCustomer = await customer.save();
        res.status(201).json(createdCustomer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (customer) {
            customer.name = req.body.name || customer.name;
            customer.email = req.body.email || customer.email;
            customer.phone = req.body.phone !== undefined ? req.body.phone : customer.phone;
            customer.address = req.body.address !== undefined ? req.body.address : customer.address;
            customer.acquisitionChannel = req.body.acquisitionChannel || customer.acquisitionChannel;
            customer.status = req.body.status || customer.status;

            const updatedCustomer = await customer.save();
            res.json(updatedCustomer);
        } else {
            res.status(404).json({ message: 'Customer not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private
const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (customer) {
            await customer.deleteOne();
            res.json({ message: 'Customer removed' });
        } else {
            res.status(404).json({ message: 'Customer not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get customer order history
// @route   GET /api/customers/:id/orders
// @access  Private
const getCustomerOrders = async (req, res) => {
    try {
        const orders = await Order.find({ customer: req.params.id })
            .populate('products.variantId')
            .sort({ date: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getCustomerMetrics = async (req, res) => {
    try {
        const totalCustomers = await Customer.countDocuments();

        const activeCustomers = await Customer.countDocuments({ status: 'Active' });
        const churnedCustomers = await Customer.countDocuments({ status: 'Churned' });

        const newCustomers = await Customer.countDocuments({ isReturning: false });
        const returningCustomers = await Customer.countDocuments({ isReturning: true });

        // Calculate acquisition breakdown & LTV per channel
        const customers = await Customer.find({});
        const acquisitionDistribution = {};
        const ltvDistribution = {
            whales: 0,
            vip: 0,
            regular: 0,
            lowValue: 0
        };

        const segmentDistribution = {
            'Whale': 0, 'VIP': 0, 'Repeat Buyer': 0, 'One-Time Buyer': 0, 'Dormant': 0
        };

        let totalLTV = 0;

        customers.forEach(c => {
            // Channel Distribution
            if (!acquisitionDistribution[c.acquisitionChannel]) {
                acquisitionDistribution[c.acquisitionChannel] = { count: 0, revenue: 0 };
            }
            acquisitionDistribution[c.acquisitionChannel].count++;
            acquisitionDistribution[c.acquisitionChannel].revenue += c.lifetimeValue;

            // Segment Distribution
            segmentDistribution[c.segment] = (segmentDistribution[c.segment] || 0) + 1;

            // LTV Distribution
            totalLTV += c.lifetimeValue;
            if (c.lifetimeValue > 50000) ltvDistribution.whales++;
            else if (c.lifetimeValue > 20000) ltvDistribution.vip++;
            else if (c.lifetimeValue > 5000) ltvDistribution.regular++;
            else if (c.lifetimeValue > 0) ltvDistribution.lowValue++;
        });

        // Filter high risk
        const highRiskCustomers = await Customer.countDocuments({ refusalRate: { $gte: 30 } });

        res.json({
            totalCustomers,
            retentionStatus: {
                active: activeCustomers,
                churned: churnedCustomers
            },
            newVsReturning: {
                new: newCustomers,
                returning: returningCustomers
            },
            acquisitionDistribution,
            ltvDistribution,
            segmentDistribution,
            highRiskCustomers,
            averageLTV: totalCustomers > 0 ? (totalLTV / totalCustomers) : 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getFeedback = async (req, res) => {
    try {
        // Mock feedback data for now (No Feedback model exists yet)
        res.json({
            averageRating: 4.8,
            totalReviews: 4,
            recentFeedback: [
                { _id: 1, customerId: { name: "Alice Johnson" }, rating: 5, comment: "Excellent service!", date: "2023-10-25" },
                { _id: 2, customerId: { name: "Bob Smith" }, rating: 4, comment: "Good, but room for improvement.", date: "2023-10-24" },
                { _id: 3, customerId: { name: "Charlie Brown" }, rating: 5, comment: "Love the new features.", date: "2023-10-23" },
                { _id: 4, customerId: { name: "Diana Prince" }, rating: 3, comment: "Average experience.", date: "2023-10-22" }
            ]
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateCustomerMetrics = async (customerId) => {
    try {
        const customer = await Customer.findById(customerId);
        if (!customer) return;

        const orders = await Order.find({ customer: customerId, status: { $ne: 'Cancelled' } });

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

        // Risk and Fraud Calculations
        customer.totalRefusals = refusals;
        customer.refusalRate = attemptedDeliveries > 0 ? (refusals / attemptedDeliveries) * 100 : 0;
        customer.deliverySuccessRate = attemptedDeliveries > 0 ? (deliveredCount / attemptedDeliveries) * 100 : 0;

        customer.trustScore = Math.max(0, 100 - (customer.refusalRate || 0));
        customer.fraudProbability = Math.min(100, customer.refusalRate * 1.5); // Derived heuristic

        customer.isSuspicious = customer.refusalRate > 30;
        customer.repeatedRefusalFlag = customer.totalRefusals >= 2;
        customer.requiresDeliveryVerification = customer.refusalRate > 20 || customer.fraudProbability > 50;

        if (orders.length > 0) {
            orders.sort((a, b) => b.createdAt - a.createdAt);
            customer.lastOrderDate = orders[0].createdAt;
            customer.lastInteractionDate = orders[0].createdAt;
            customer.isReturning = orders.length > 1;

            // Set Cohort Month (Month of first order)
            const firstOrder = orders[orders.length - 1];
            customer.cohortMonth = new Date(firstOrder.createdAt).toISOString().slice(0, 7); // e.g., "2024-03"

            // Segmentation Logic
            if (customer.lifetimeValue > 100000) customer.segment = 'Whale';
            else if (customer.lifetimeValue > 50000 || customer.totalOrders > 5) customer.segment = 'VIP';
            else if (customer.totalOrders > 1) customer.segment = 'Repeat Buyer';
            else customer.segment = 'One-Time Buyer';

            // Simple Churn Risk Logic
            const daysSinceLastOrder = (Date.now() - customer.lastOrderDate.getTime()) / (1000 * 3600 * 24);
            customer.churnRiskScore = Math.min(100, (daysSinceLastOrder / 90) * 100);

            if (daysSinceLastOrder > 120) {
                customer.status = 'Churned';
                customer.segment = 'Dormant';
            }
            else if (daysSinceLastOrder > 60) customer.status = 'At Risk';
            else customer.status = 'Active';

        } else {
            customer.status = 'Inactive';
        }

        await customer.save();
    } catch (error) {
        console.error("Failed to update customer metrics:", error);
    }
};

module.exports = {
    getCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerOrders,
    getCustomerMetrics,
    getFeedback,
    updateCustomerMetrics
};
