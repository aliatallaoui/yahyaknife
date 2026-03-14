const logger = require('../shared/logger');
const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const ShipmentService = require('../domains/dispatch/shipment.service');

const validId = id => mongoose.Types.ObjectId.isValid(id);

// ─── CREATE ───────────────────────────────────────────────────────────────────

exports.createShipment = async (req, res) => {
    try {
        const { orderId, ...shipmentData } = req.body;
        const shipment = await ShipmentService.createShipment({ orderId, shipmentData, tenantId: req.user.tenant });
        res.status(201).json(shipment);
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        logger.error({ err: error }, 'createShipment error');
        res.status(502).json({ message: 'Courier Integration Error. Please check courier API credentials and try again.' });
    }
};

exports.quickDispatch = async (req, res) => {
    try {
        const shipment = await ShipmentService.quickDispatch(req.params.orderId, req.user.tenant);
        res.status(201).json(shipment);
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        logger.error({ err: error }, 'quickDispatch error');
        res.status(502).json({ message: 'Courier Integration Error. Please check courier API credentials and try again.' });
    }
};

// ─── BULK DISPATCH ───────────────────────────────────────────────────────────

exports.bulkQuickDispatch = async (req, res) => {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: 'orderIds array is required' });
    }
    if (orderIds.length > 50) {
        return res.status(400).json({ message: 'Maximum 50 orders per bulk dispatch' });
    }
    if (!orderIds.every(id => validId(id))) {
        return res.status(400).json({ message: 'One or more invalid order IDs' });
    }

    const tenantId = req.user.tenant;
    const results = { dispatched: [], failed: [] };

    // Process sequentially to respect courier rate limits
    for (const orderId of orderIds) {
        try {
            const shipment = await ShipmentService.quickDispatch(orderId, tenantId);
            results.dispatched.push({
                orderId,
                trackingId: shipment.externalTrackingId,
                shipmentStatus: shipment.shipmentStatus,
            });
        } catch (err) {
            results.failed.push({
                orderId,
                error: err.isOperational ? err.message : 'Courier Integration Error',
            });
        }
    }

    const status = results.dispatched.length > 0 ? 200 : 422;
    res.status(status).json({
        message: `${results.dispatched.length} dispatched, ${results.failed.length} failed`,
        ...results,
    });
};

// ─── READ ─────────────────────────────────────────────────────────────────────

exports.getAllShipments = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(403).json({ error: 'Tenant context required' });

        const STATUS_MAP = {
            'Dispatched':       'Created in Courier',
            'Shipped':          'In Transit',
            'Out for Delivery': 'Out for Delivery',
            'Delivered':        'Delivered',
            'Paid':             'Delivered',
            'Refused':          'Return Initiated',
            'Returned':         'Returned',
        };

        const [dispatchedOrders, courierShipments] = await Promise.all([
            Order.find({
                tenant: tenantId,
                status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned'] },
                deletedAt: null
            }).populate('customer', 'name phone').sort({ updatedAt: -1 }).limit(2000).lean(),

            Shipment.find({ tenant: tenantId }).sort({ createdAt: -1 }).limit(2000).lean()
        ]);

        const mappedOrders = dispatchedOrders.map(o => ({
            _id:               o._id,
            internalOrder:     o._id,
            internalOrderId:   o.orderId || o._id.toString(),
            externalTrackingId: o.trackingInfo?.trackingNumber || null,
            courierProvider:   o.trackingInfo?.carrier || 'ECOTRACK',
            customerName:      o.shipping?.recipientName || o.customer?.name || 'Unknown',
            phone1:            o.shipping?.phone1 || o.customer?.phone || '',
            wilayaName:        o.shipping?.wilayaName || '',
            commune:           o.shipping?.commune || '',
            codAmount:         o.totalAmount ?? 0,
            paymentStatus:     o.status === 'Paid' ? 'Paid' : 'Pending',
            shipmentStatus:    STATUS_MAP[o.status] || o.status,
            createdAt:         o.createdAt,
            updatedAt:         o.updatedAt,
            _source:           'order'
        }));

        // Deduplicate: Shipment records take precedence over order-derived rows
        const orderIdsSeen = new Set(mappedOrders.map(s => s.internalOrderId));
        const filteredShipments = courierShipments.filter(s => !orderIdsSeen.has(s.internalOrderId));

        const combined = [...mappedOrders, ...filteredShipments]
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

        res.json(combined);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching all shipments');
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getShipmentById = async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid shipment ID' });
        const shipment = await Shipment.findOne({ _id: req.params.id, tenant: req.user.tenant }).lean();
        if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
        res.json(shipment);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching shipment by ID');
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── EXPORT ───────────────────────────────────────────────────────────────────

exports.exportShipments = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(401).json({ message: 'Not authorized' });

        const shipments = await Shipment.find({ tenant: tenantId }).sort({ createdAt: -1 }).lean();
        const fields = ['externalTrackingId', 'internalOrderId', 'courierProvider', 'customerName', 'phone1', 'wilayaName', 'commune', 'shipmentStatus', 'paymentStatus', 'codAmount', 'createdAt'];

        let csv = fields.join(',') + '\n';
        shipments.forEach(s => {
            const row = fields.map(field => `"${(s[field] || '').toString().replace(/"/g, '""')}"`);
            csv += row.join(',') + '\n';
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('shipments_export.csv');
        return res.send(csv);
    } catch (error) {
        logger.error({ err: error }, 'Error exporting shipments');
        res.status(500).json({ message: 'Server error' });
    }
};

exports.generateManifest = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(401).send('Not authorized');

        const { ids } = req.query;
        if (!ids) return res.status(400).send('No shipment IDs provided');

        const idArray = ids.split(',').map(id => id.trim());
        if (!idArray.every(id => validId(id))) {
            return res.status(400).send('One or more invalid order IDs');
        }
        
        // Fetch original Orders which ALWAYS contain the product and customer details
        // even if they haven't been dispatched to a courier yet.
        const orders = await Order.find({ _id: { $in: idArray }, tenant: tenantId, deletedAt: null }).populate('customer', 'name phone email').lean();
        
        if (orders.length === 0) return res.status(404).send('Aucune commande trouvée.');

        const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
        
        // Generate a clean HTML table for printing
        let rowsHtml = orders.map((o, index) => {
            const tracking = o.trackingInfo?.trackingNumber || 'N/A';
            const customerName = o.customer?.name || o.shipping?.recipientName || 'Inconnu';
            const phone = o.customer?.phone || o.shipping?.phone1 || '';
            const codAmt = o.financials?.codAmount ?? o.finalTotal ?? o.totalAmount ?? 0;
            const productText = o.products ? o.products.map(p => `${p.name || 'Produit'} (x${p.quantity || 1})`).join('<br>') : 'N/A';

            return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${tracking}</strong><br><small>${o.orderId}</small></td>
                <td>${customerName}<br><small>${phone}</small></td>
                <td>${o.wilaya || ''} - ${o.commune || ''}<br><small>${o.shipping?.address || ''}</small></td>
                <td>${productText}</td>
                <td><strong>${codAmt} DZD</strong></td>
                <td></td>
            </tr>
            `;
        }).join('');

        const html = `
        <!DOCTYPE html>
        <html lang="fr" dir="ltr">
        <head>
            <meta charset="UTF-8">
            <title>Bordereau d'Envoi</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #333; }
                .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
                h1 { margin: 0; color: #1e40af; font-size: 24px; }
                .meta { text-align: right; color: #6b7280; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
                th, td { border: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; }
                th { background-color: #f3f4f6; font-weight: 600; color: #374151; }
                tr:nth-child(even) { background-color: #f9fafb; }
                .footer { margin-top: 40px; display: flex; justify-content: space-between; }
                .signature-box { border: 1px dashed #9ca3af; width: 250px; height: 100px; padding: 10px; color: #9ca3af; }
                @media print {
                    @page { size: A4 landscape; margin: 1cm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                <div>
                    <h1>Bordereau d'Envoi (Manifest)</h1>
                    <p style="margin: 5px 0 0 0; color: #4b5563;">Total Colis: <strong>${orders.length}</strong></p>
                </div>
                <div class="meta">
                    <p style="margin: 0;">Date d'impression: ${printDate}</p>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="15%">Tracking / Réf</th>
                        <th width="15%">Destinataire</th>
                        <th width="25%">Adresse (Wilaya/Commune)</th>
                        <th width="20%">Produit(s)</th>
                        <th width="10%">Montant COD</th>
                        <th width="10%">Signature Client</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="footer">
                <div class="signature-box">Signature Expéditeur (Vendeur)</div>
                <div class="signature-box">Signature Transporteur (Livreur)</div>
            </div>
        </body>
        </html>
        `;

        res.send(html);
    } catch (error) {
        logger.error({ err: error }, 'generateManifest critical error');
        res.status(500).send('Erreur lors de la génération du bordereau. Veuillez réessayer.');
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

        // Allowlist editable fields — prevent mass-assignment of system fields
        const allowed = ['recipientName', 'recipientPhone', 'address', 'wilaya', 'commune', 'notes', 'weight', 'dimensions', 'deliveryType', 'codAmount'];
        for (const field of allowed) {
            if (req.body[field] !== undefined) shipment[field] = req.body[field];
        }
        shipment.activityHistory.push({ status: 'Shipment Updated', remarks: 'User edited shipment details before courier validation', changedBy: req.user._id });

        const updated = await shipment.save();
        res.json(updated);
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        logger.error({ err: error }, 'Error updating shipment');
        res.status(400).json({ message: 'Failed to update shipment' });
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
        logger.error({ err: error }, 'Error deleting shipment');
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── RECALL BY ORDER ──────────────────────────────────────────────────────────

exports.recallByOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!validId(orderId)) return res.status(400).json({ message: 'Invalid order ID' });

        const shipment = await Shipment.findOne({ internalOrder: orderId, tenant: req.user.tenant });

        let courierCancelled = false;
        if (shipment) {
            if (shipment.shipmentStatus === 'Delivered') {
                return res.status(400).json({ message: 'Cannot recall a delivered shipment' });
            }
            const result = await ShipmentService.deleteShipment(shipment._id, req.user.tenant);
            courierCancelled = result.courierCancelled;
        } else {
            // No shipment — just revert order status directly
            const OrderService = require('../domains/orders/order.service');
            await OrderService.updateOrder({
                orderId,
                tenantId: req.user.tenant,
                updateData: { status: 'Confirmed', trackingInfo: {} },
                bypassStateMachine: true
            });
        }

        res.json({ message: 'Order recalled successfully', courierCancelled, revertedStatus: 'Confirmed' });
    } catch (error) {
        if (error.isOperational) return res.status(error.statusCode || 400).json({ message: error.message });
        logger.error({ err: error }, 'Error recalling order');
        res.status(500).json({ message: 'Server error' });
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
        logger.error({ err: error }, 'validateShipment error');
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
        logger.error({ err: error }, 'Error fetching shipment label');
        res.status(500).json({ message: 'Server error' });
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
        logger.error({ err: error }, 'Error requesting shipment return');
        res.status(500).json({ message: 'Server error' });
    }
};
