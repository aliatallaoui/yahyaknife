const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const ShipmentService = require('../domains/dispatch/shipment.service');

const validId = id => mongoose.Types.ObjectId.isValid(id);

// ─── CREATE ───────────────────────────────────────────────────────────────────

exports.createShipment = async (req, res) => {
    try {
        const { orderId, isCustomOrder, ...shipmentData } = req.body;
        const shipment = await ShipmentService.createShipment({ orderId, isCustomOrder, shipmentData, tenantId: req.user.tenant });
        res.status(201).json(shipment);
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        console.error('createShipment error:', error);
        res.status(502).json({ message: 'Courier Integration Error: ' + (error.response?.data?.message || error.message) });
    }
};

exports.quickDispatch = async (req, res) => {
    try {
        const shipment = await ShipmentService.quickDispatch(req.params.orderId, req.user.tenant);
        res.status(201).json(shipment);
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        console.error('quickDispatch error:', error);
        res.status(502).json({ message: 'Courier Integration Error: ' + (error.response?.data?.message || error.message) });
    }
};

// ─── READ ─────────────────────────────────────────────────────────────────────

exports.getAllShipments = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(401).json({ error: 'Tenant context required' });

        const STATUS_MAP = {
            'Dispatched':       'Created in Courier',
            'Shipped':          'In Transit',
            'Out for Delivery': 'Out for Delivery',
            'Delivered':        'Delivered',
            'Paid':             'Delivered',
            'Refused':          'Return Initiated',
            'Returned':         'Returned',
        };

        const [dispatchedOrders, ecotrackShipments] = await Promise.all([
            Order.find({
                tenant: tenantId,
                status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned'] },
                deletedAt: null
            }).populate('customer', 'name phone').sort({ updatedAt: -1 }).lean(),

            Shipment.find({ tenant: tenantId }).sort({ createdAt: -1 }).lean()
        ]);

        const mappedOrders = dispatchedOrders.map(o => ({
            _id:               o._id,
            internalOrder:     o._id,
            internalOrderId:   o.orderId || o._id.toString(),
            externalTrackingId: o.trackingInfo?.trackingNumber || null,
            customerName:      o.shipping?.recipientName || o.customer?.name || 'Unknown',
            phone1:            o.shipping?.phone1 || o.customer?.phone || '',
            wilayaName:        o.shipping?.wilayaName || '',
            commune:           o.shipping?.commune || '',
            codAmount:         o.totalAmount || 0,
            paymentStatus:     o.status === 'Paid' ? 'Paid' : 'Pending',
            shipmentStatus:    STATUS_MAP[o.status] || o.status,
            createdAt:         o.createdAt,
            updatedAt:         o.updatedAt,
            _source:           'order'
        }));

        // Deduplicate: Shipment records take precedence over order-derived rows
        const orderIdsSeen = new Set(mappedOrders.map(s => s.internalOrderId));
        const filteredEcotrack = ecotrackShipments.filter(s => !orderIdsSeen.has(s.internalOrderId));

        const combined = [...mappedOrders, ...filteredEcotrack]
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

        res.json(combined);
    } catch (error) {
        console.error('getAllShipments error:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getShipmentById = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid shipment ID' });
        const shipment = await Shipment.findOne({ _id: req.params.id, tenant: req.user.tenant });
        if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
        res.json(shipment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── EXPORT ───────────────────────────────────────────────────────────────────

exports.exportShipments = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(401).json({ message: 'Not authorized' });

        const shipments = await Shipment.find({ tenant: tenantId }).sort({ createdAt: -1 });
        const fields = ['externalTrackingId', 'internalOrderId', 'customerName', 'phone1', 'wilayaName', 'commune', 'shipmentStatus', 'paymentStatus', 'codAmount', 'createdAt'];

        let csv = fields.join(',') + '\n';
        shipments.forEach(s => {
            const row = fields.map(field => `"${(s[field] || '').toString().replace(/"/g, '""')}"`);
            csv += row.join(',') + '\n';
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('shipments_export.csv');
        return res.send(csv);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

exports.updateShipment = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid shipment ID' });
        const shipment = await Shipment.findOne({ _id: req.params.id, tenant: req.user.tenant });
        if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

        if (['Validated', 'In Transit', 'Out for Delivery', 'Delivered'].includes(shipment.shipmentStatus)) {
            return res.status(403).json({ message: `Cannot edit a shipment that is already ${shipment.shipmentStatus}` });
        }

        const { tenant: _t, activityHistory: _h, shipmentStatus: _ss, ...safeBody } = req.body;
        Object.assign(shipment, safeBody);
        shipment.activityHistory.push({ status: 'Shipment Updated', remarks: 'User edited shipment details before courier validation', changedBy: req.user._id });

        const updated = await shipment.save();
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

exports.deleteShipment = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid shipment ID' });
        const result = await ShipmentService.deleteShipment(req.params.id, req.user.tenant);
        res.json({ message: 'Shipment successfully deleted', ...result });
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        res.status(500).json({ message: error.message });
    }
};

// ─── VALIDATE ─────────────────────────────────────────────────────────────────

exports.validateShipment = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid shipment ID' });
        const { ask_collection = 1 } = req.body;
        const shipment = await ShipmentService.validateShipment(req.params.id, req.user.tenant, { askCollection: ask_collection, userId: req.user._id });
        res.json(shipment);
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        console.error('validateShipment error:', error);
        res.status(502).json({ message: 'Failed to validate shipment on courier gateway.' });
    }
};

// ─── LABEL ────────────────────────────────────────────────────────────────────

exports.getShipmentLabel = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid shipment ID' });
        const url = await ShipmentService.getShipmentLabel(req.params.id, req.user.tenant);
        res.json({ url });
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        res.status(500).json({ message: error.message });
    }
};

// ─── RETURN ───────────────────────────────────────────────────────────────────

exports.requestReturn = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid shipment ID' });
        const shipment = await ShipmentService.requestReturn(req.params.id, req.user.tenant, req.user._id);
        res.json(shipment);
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        res.status(500).json({ message: error.message });
    }
};
