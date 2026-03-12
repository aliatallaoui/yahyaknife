const mongoose = require('mongoose');
const CustomOrder = require('../models/CustomOrder');
const KnifeCard = require('../models/KnifeCard');
const { ok, created, message, paginated } = require('../shared/utils/ApiResponse');

exports.getCustomOrders = async (req, res) => {
    try {
        const [orders, total] = await Promise.all([
            CustomOrder.find().populate('customer').populate('generatedKnifeCard').sort({ date: -1 }).skip(req.skip).limit(req.limit),
            CustomOrder.countDocuments()
        ]);
        res.json(paginated(orders, { total, hasNextPage: req.skip + orders.length < total }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createCustomOrder = async (req, res) => {
    try {
        const orderId = `CO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        // Strip server-controlled fields before saving
        const { orderId: _oid, generatedKnifeCard: _gkc, ...safeBody } = req.body;
        const newOrder = await CustomOrder.create({ ...safeBody, orderId });

        // Auto-generate KnifeCard if Confirmed or In Production
        if (['Confirmed', 'In Production'].includes(newOrder.status) && !newOrder.generatedKnifeCard) {
            const knife = await KnifeCard.create({
                knifeId: `K-${Date.now().toString().slice(-6)}`,
                name: `Custom ${newOrder.requestedType || 'Knife'} - ${req.body.customerName || 'Client'}`,
                type: newOrder.requestedType || 'Custom',
                status: 'Design',
                customOrderRef: newOrder._id,
                steelType: newOrder.requestedSteel,
                handleMaterial: newOrder.requestedHandle,
                bladeLength: newOrder.measurements?.bladeLength,
                totalLength: newOrder.measurements?.totalLength,
                sheathRequired: newOrder.sheathRequired,
                suggestedPrice: newOrder.finalPrice
            });
            newOrder.generatedKnifeCard = knife._id;
            await newOrder.save();
        }

        const populated = await CustomOrder.findById(newOrder._id).populate('customer').populate('generatedKnifeCard');
        res.status(201).json(created(populated));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateCustomOrder = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const { orderId: _oid, generatedKnifeCard: _gkc, ...safeBody } = req.body;
        const order = await CustomOrder.findByIdAndUpdate(req.params.id, safeBody, { new: true }).populate('customer').populate('generatedKnifeCard');
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(ok(order));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteCustomOrder = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const order = await CustomOrder.findByIdAndDelete(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(message('Deleted successfully'));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
