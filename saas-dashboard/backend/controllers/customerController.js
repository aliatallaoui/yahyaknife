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

        // Calculate acquisition breakdown
        const customers = await Customer.find({});
        const acquisitionDistribution = {};
        customers.forEach(c => {
            if (!acquisitionDistribution[c.acquisitionChannel]) {
                acquisitionDistribution[c.acquisitionChannel] = 0;
            }
            acquisitionDistribution[c.acquisitionChannel]++;
        });

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
            acquisitionDistribution
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
        let attemptedDeliveries = 0; // count both fulfilled and refused/returned for rate calc

        orders.forEach(o => {
            if (['Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(o.status)) {
                fulfilledCount++;
                ltv += (o.totalAmount || 0);
                netProfit += (o.financials?.netProfit || 0);
                attemptedDeliveries++;
            } else if (['Refused', 'Returned'].includes(o.status)) {
                attemptedDeliveries++;
                if (o.status === 'Refused') refusals++;
            }
        });

        customer.totalOrders = orders.length;
        customer.lifetimeValue = ltv;
        customer.averageOrderValue = fulfilledCount > 0 ? ltv / fulfilledCount : 0;
        customer.netProfitGenerated = netProfit;

        // Risk and Fraud Calculations
        customer.totalRefusals = refusals;
        customer.refusalRate = attemptedDeliveries > 0 ? (refusals / attemptedDeliveries) * 100 : 0;
        customer.trustScore = Math.max(0, 100 - (customer.refusalRate || 0));
        customer.isSuspicious = customer.refusalRate > 30; // Threshold logic

        if (orders.length > 0) {
            // Find most recent
            orders.sort((a, b) => b.createdAt - a.createdAt);
            customer.lastOrderDate = orders[0].createdAt;
            customer.isReturning = orders.length > 1;

            // Simple Churn Risk Logic
            const daysSinceLastOrder = (Date.now() - customer.lastOrderDate.getTime()) / (1000 * 3600 * 24);
            if (daysSinceLastOrder > 90) customer.status = 'Churned';
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
