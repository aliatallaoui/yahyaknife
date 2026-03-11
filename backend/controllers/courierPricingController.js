const CourierPricing = require('../models/CourierPricing');
const Courier = require('../models/Courier');

// @desc    Get all pricing rules for a courier
// @route   GET /api/couriers/:id/pricing
// @access  Private
exports.getPricingRules = async (req, res) => {
    try {
        const { id } = req.params;
        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });
        const rules = await CourierPricing.find({ courierId: id })
            .populate('productIds', 'name sku')
            .sort({ priority: -1 });
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Add a new pricing rule
// @route   POST /api/couriers/:id/pricing
// @access  Private
exports.addPricingRule = async (req, res) => {
    try {
        const { id } = req.params;
        
        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const ruleData = { ...req.body, courierId: id };
        const newRule = await CourierPricing.create(ruleData);
        
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

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const updatedRule = await CourierPricing.findOneAndUpdate(
            { _id: ruleId, courierId: id },
            req.body,
            { new: true }
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

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const deletedRule = await CourierPricing.findOneAndDelete({ _id: ruleId, courierId: id });
        if (!deletedRule) return res.status(404).json({ message: 'Pricing rule not found' });

        res.json({ message: 'Pricing rule deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
