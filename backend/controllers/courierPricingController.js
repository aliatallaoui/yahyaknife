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
        const rules = await CourierPricing.find({ courierId: id, tenant: req.user.tenant })
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

        // Validate numeric fields
        const priceNum = Number(price);
        if (!Number.isFinite(priceNum) || priceNum < 0) {
            return res.status(400).json({ message: 'Price must be a non-negative number' });
        }
        if (minWeight !== undefined && minWeight !== null && (!Number.isFinite(Number(minWeight)) || Number(minWeight) < 0)) {
            return res.status(400).json({ message: 'minWeight must be a non-negative number' });
        }
        if (maxWeight !== undefined && maxWeight !== null && (!Number.isFinite(Number(maxWeight)) || Number(maxWeight) < 0)) {
            return res.status(400).json({ message: 'maxWeight must be a non-negative number' });
        }
        if (deliveryType !== undefined && deliveryType !== null && ![0, 1].includes(Number(deliveryType))) {
            return res.status(400).json({ message: 'deliveryType must be 0 (Home) or 1 (Office)' });
        }

        const newRule = await CourierPricing.create({ ruleType, wilayaCode, commune, deliveryType, productIds, minWeight, maxWeight, price: priceNum, priority: Number(priority) || 0, courierId: id, tenant: req.user.tenant });
        
        res.status(201).json(newRule);
    } catch (error) {
        logger.error({ err: error }, 'Courier pricing error'); res.status(400).json({ error: 'Invalid pricing data' });
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

        const { ruleType, wilayaCode, commune, deliveryType, productIds, minWeight, maxWeight, price, priority } = req.body;

        // Validate numeric fields if provided
        if (price !== undefined) {
            const priceNum = Number(price);
            if (!Number.isFinite(priceNum) || priceNum < 0) {
                return res.status(400).json({ message: 'Price must be a non-negative number' });
            }
        }
        if (deliveryType !== undefined && deliveryType !== null && ![0, 1].includes(Number(deliveryType))) {
            return res.status(400).json({ message: 'deliveryType must be 0 (Home) or 1 (Office)' });
        }

        const updateFields = {};
        if (ruleType !== undefined) updateFields.ruleType = ruleType;
        if (wilayaCode !== undefined) updateFields.wilayaCode = wilayaCode;
        if (commune !== undefined) updateFields.commune = commune;
        if (deliveryType !== undefined) updateFields.deliveryType = deliveryType;
        if (productIds !== undefined) updateFields.productIds = productIds;
        if (minWeight !== undefined) updateFields.minWeight = minWeight;
        if (maxWeight !== undefined) updateFields.maxWeight = maxWeight;
        if (price !== undefined) updateFields.price = Number(price);
        if (priority !== undefined) updateFields.priority = Number(priority) || 0;

        const updatedRule = await CourierPricing.findOneAndUpdate(
            { _id: ruleId, courierId: id, tenant: req.user.tenant },
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!updatedRule) return res.status(404).json({ message: 'Pricing rule not found' });
        
        res.json(updatedRule);
    } catch (error) {
        logger.error({ err: error }, 'Courier pricing error'); res.status(400).json({ error: 'Invalid pricing data' });
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

        const deletedRule = await CourierPricing.findOneAndDelete({ _id: ruleId, courierId: id, tenant: req.user.tenant });
        if (!deletedRule) return res.status(404).json({ message: 'Pricing rule not found' });

        res.json({ message: 'Pricing rule deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Server error'); res.status(500).json({ error: 'Server error' });
    }
};
