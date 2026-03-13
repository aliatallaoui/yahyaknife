const logger = require('../shared/logger');
const mongoose = require('mongoose');
const CourierPricing = require('../models/CourierPricing');
const Courier = require('../models/Courier');

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Get all pricing rules for a courier
// @route   GET /api/couriers/:id/pricing
// @access  Private
exports.getPricingRules = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });
        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });
        const rules = await CourierPricing.find({ courierId: id })
            .populate('productIds', 'name sku')
            .sort({ priority: -1 })
            .lean();
        res.json(rules);
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ error: 'Server error' });
    }
};

// @desc    Add a new pricing rule
// @route   POST /api/couriers/:id/pricing
// @access  Private
exports.addPricingRule = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const { ruleType, wilayaCode, commune, deliveryType, productIds, minWeight, maxWeight, price, priority } = req.body;
        const newRule = await CourierPricing.create({ ruleType, wilayaCode, commune, deliveryType, productIds, minWeight, maxWeight, price, priority, courierId: id });
        
        res.status(201).json(newRule);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// @desc    Update a pricing rule
// @route   PUT /api/couriers/:id/pricing/:ruleId
// @access  Private
exports.updatePricingRule = async (req, res) => {
    try {
        const { id, ruleId } = req.params;
        if (!validId(id) || !validId(ruleId)) return res.status(400).json({ message: 'Invalid ID' });

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const { courierId: _c, _id: _i, __v, ...safe } = req.body;
        const updatedRule = await CourierPricing.findOneAndUpdate(
            { _id: ruleId, courierId: id },
            { $set: safe },
            { new: true, runValidators: true }
        );

        if (!updatedRule) return res.status(404).json({ message: 'Pricing rule not found' });
        
        res.json(updatedRule);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// @desc    Delete a pricing rule
// @route   DELETE /api/couriers/:id/pricing/:ruleId
// @access  Private
exports.deletePricingRule = async (req, res) => {
    try {
        const { id, ruleId } = req.params;
        if (!validId(id) || !validId(ruleId)) return res.status(400).json({ message: 'Invalid ID' });

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const deletedRule = await CourierPricing.findOneAndDelete({ _id: ruleId, courierId: id });
        if (!deletedRule) return res.status(404).json({ message: 'Pricing rule not found' });

        res.json({ message: 'Pricing rule deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ error: 'Server error' });
    }
};
