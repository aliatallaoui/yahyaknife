const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
const { ecotrackRequest } = require('../utils/ecotrackRequest');

/**
 * Maps our internal Order/Shipment data to ECOTRACK's API requirements.
 */
const mapToEcotrackPayload = (shipment) => {
    return {
        reference: shipment.internalOrderId, // Internal ID sent
        nom_client: shipment.customerName,
        telephone: shipment.phone1,
        telephone_2: shipment.phone2 || '',
        adresse: shipment.address,
        code_postal: shipment.postalCode || '',
        commune: shipment.commune,
        code_wilaya: shipment.wilayaCode,
        montant: shipment.codAmount,
        remarque: shipment.remark || '',
        produit: shipment.productName,
        quantite: shipment.quantity || 1,
        type: shipment.operationType || 1, // 1 = delivery
        stop_desk: shipment.deliveryType === 1 ? 1 : 0,
        poids: shipment.weight || 1, // Ecotrack might use "poids" or "weight", typically "poids" for Algerian APIs
        fragile: shipment.fragileFlag ? 1 : 0,
        gps_link: shipment.gpsLink || '',
        boutique: shipment.boutique || 'My Store'
    };
};

// ----------------------------------------------------
// CREATE SHIPMENT (Single)
// ----------------------------------------------------
exports.createShipment = async (req, res) => {
    try {
        const { orderId, isCustomOrder, ...shipmentData } = req.body;

        let internalOrder;
        if (isCustomOrder) {
            internalOrder = await CustomOrder.findById(orderId);
        } else {
            internalOrder = await Order.findById(orderId);
        }

        if (!internalOrder) {
            return res.status(404).json({ message: 'Internal order not found' });
        }

        // Prep new shipment
        const newShipment = new Shipment({
            ...shipmentData,
            internalOrder: orderId,
            internalOrderId: isCustomOrder ? internalOrder.customOrderId : internalOrder.orderId,
            shipmentStatus: 'Created in Courier',
            activityHistory: [{
                status: 'Created in system, pending dispatch to ECOTRACK',
                remarks: 'Initial creation'
            }]
        });

        // 1. Send to EcoTrack
        const ecotrackPayload = mapToEcotrackPayload(newShipment);

        try {
            // Note: Replace '/api/v1/create/order' with actual Ecotrack creation endpoint
            const courierResponse = await ecotrackRequest('POST', '/api/v1/create/order', ecotrackPayload);

            // Assuming the API returns a tracking ID
            if (courierResponse.tracking_id || courierResponse.tracking) {
                newShipment.externalTrackingId = courierResponse.tracking_id || courierResponse.tracking;
                newShipment.courierStatus = 'Created';
            } else {
                throw new Error('Courier API did not return a tracking ID');
            }
        } catch (apiError) {
            console.error("Failed to create shipment in Courier API:", apiError.message);
            return res.status(502).json({
                message: 'Courier Integration Error: ' + (apiError.response?.data?.message || apiError.message)
            });
        }

        // 2. Save Shipment locally
        const savedShipment = await newShipment.save();

        // 3. Mark the internal order as Dispatched (or equivalent status)
        internalOrder.status = 'Dispatched';
        await internalOrder.save();

        res.status(201).json(savedShipment);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------
// QUICK DISPATCH (One-click from Sales panel)
// ----------------------------------------------------
exports.quickDispatch = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId).populate('customer', 'name phone');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!order.shipping || !order.shipping.phone1 || !order.shipping.wilayaName || !order.shipping.commune) {
            return res.status(400).json({ message: 'Order is missing shipping details (phone, wilaya, commune). Please edit the order first.' });
        }

        if (order.status === 'Dispatched') {
            return res.status(400).json({ message: 'Order has already been dispatched.' });
        }

        // Build shipment from order data
        const newShipment = new Shipment({
            internalOrder: order._id,
            internalOrderId: order.orderId,
            customerName: order.shipping.recipientName || order.customer?.name || 'Unknown',
            phone1: order.shipping.phone1,
            phone2: order.shipping.phone2 || '',
            wilayaCode: order.shipping.wilayaCode,
            wilayaName: order.shipping.wilayaName,
            commune: order.shipping.commune,
            address: order.shipping.address || '',
            productName: order.products?.map(p => p.name).join(', ') || 'Mixed Items',
            quantity: order.products?.reduce((sum, p) => sum + (p.quantity || 1), 0) || 1,
            weight: order.shipping.weight || 1,
            codAmount: order.totalAmount,
            deliveryType: order.shipping.deliveryType || 0,
            fragileFlag: order.shipping.fragile || false,
            operationType: 1,
            shipmentStatus: 'Created in Courier',
            activityHistory: [{
                status: 'Quick Dispatched from Sales Panel',
                remarks: `Auto-created from order ${order.orderId}`
            }]
        });

        // Send to EcoTrack
        const ecotrackPayload = mapToEcotrackPayload(newShipment);

        try {
            const courierResponse = await ecotrackRequest('POST', '/api/v1/create/order', ecotrackPayload);

            if (courierResponse.tracking_id || courierResponse.tracking) {
                newShipment.externalTrackingId = courierResponse.tracking_id || courierResponse.tracking;
                newShipment.courierStatus = 'Created';
            } else {
                throw new Error('Courier API did not return a tracking ID');
            }
        } catch (apiError) {
            console.error("Quick dispatch courier error:", apiError.message);
            return res.status(502).json({
                message: 'Courier Integration Error: ' + (apiError.response?.data?.message || apiError.message)
            });
        }

        const savedShipment = await newShipment.save();

        // Update order status
        order.status = 'Dispatched';
        order.trackingInfo = {
            carrier: 'ECOTRACK',
            trackingNumber: savedShipment.externalTrackingId
        };
        await order.save();

        res.status(201).json(savedShipment);

    } catch (error) {
        console.error("Quick dispatch error:", error);
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------
// READ SHIPMENTS
// ----------------------------------------------------
exports.getAllShipments = async (req, res) => {
    try {
        const shipments = await Shipment.find().sort({ createdAt: -1 });
        res.json(shipments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getShipmentById = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
        res.json(shipment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------
// EXPORT SHIPMENTS
// ----------------------------------------------------
exports.exportShipments = async (req, res) => {
    try {
        const shipments = await Shipment.find().sort({ createdAt: -1 });
        const fields = ['externalTrackingId', 'internalOrderId', 'customerName', 'phone1', 'wilayaName', 'commune', 'shipmentStatus', 'paymentStatus', 'codAmount', 'createdAt'];

        let csv = fields.join(',') + '\n';

        shipments.forEach(s => {
            const row = fields.map(field => {
                let val = s[field] || '';
                // Escape quotes
                val = val.toString().replace(/"/g, '""');
                return `"${val}"`;
            });
            csv += row.join(',') + '\n';
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('shipments_export.csv');
        return res.send(csv);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------
// UPDATE SHIPMENT (Pre-Validation only)
// ----------------------------------------------------
exports.updateShipment = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

        // Business Rule: Cannot edit if already validated/dispatched to courier
        if (['Validated', 'In Transit', 'Out for Delivery', 'Delivered'].includes(shipment.shipmentStatus)) {
            return res.status(403).json({ message: `Cannot edit a shipment that is already ${shipment.shipmentStatus}` });
        }

        // Apply edits (e.g. phone, address, COD)
        Object.assign(shipment, req.body);
        shipment.activityHistory.push({
            status: 'Shipment Updated',
            remarks: 'User edited shipment details before courier validation'
        });

        const updatedShipment = await shipment.save();
        res.json(updatedShipment);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// ----------------------------------------------------
// DELETE SHIPMENT (Cancel from courier + delete locally)
// ----------------------------------------------------
exports.deleteShipment = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

        // Only block deletion for truly final statuses
        if (['Delivered'].includes(shipment.shipmentStatus)) {
            return res.status(403).json({ message: `Cannot delete a shipment that is already ${shipment.shipmentStatus}` });
        }

        // Cancel with ECOTRACK if an external tracking ID exists
        let courierCancelled = false;
        if (shipment.externalTrackingId) {
            try {
                // Try DELETE endpoint
                await ecotrackRequest('DELETE', `/api/v1/delete/${shipment.externalTrackingId}`);
                courierCancelled = true;
                console.log(`ECOTRACK: Cancelled shipment ${shipment.externalTrackingId}`);
            } catch (err1) {
                // Fallback: try POST cancel endpoint
                try {
                    await ecotrackRequest('POST', `/api/v1/cancel`, { tracking: shipment.externalTrackingId });
                    courierCancelled = true;
                    console.log(`ECOTRACK: Cancelled shipment ${shipment.externalTrackingId} via POST`);
                } catch (err2) {
                    console.warn("Failed to cancel from ECOTRACK (deleting locally anyway):", err2.message);
                }
            }
        }

        // Revert Internal Order status
        let internalOrder;
        if (shipment.internalOrderId && shipment.internalOrderId.startsWith('CUST-')) {
            internalOrder = await CustomOrder.findById(shipment.internalOrder);
        } else {
            internalOrder = await Order.findById(shipment.internalOrder);
        }

        if (internalOrder) {
            internalOrder.status = 'Confirmed';
            await internalOrder.save();
        }

        await Shipment.findByIdAndDelete(req.params.id);
        res.json({
            message: 'Shipment successfully deleted',
            courierCancelled,
            revertedStatus: 'Confirmed'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------
// VALIDATE & DISPATCH (Locks edits, requests pickup)
// ----------------------------------------------------
exports.validateShipment = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

        if (!['Created in Courier', 'Draft'].includes(shipment.shipmentStatus)) {
            return res.status(400).json({ message: 'Only newly created shipments can be validated.' });
        }

        const { ask_collection = 1 } = req.body;

        if (shipment.externalTrackingId) {
            try {
                // Adjust Validation Endpoint based on ECOTRACK API
                await ecotrackRequest('POST', '/api/v1/validate', {
                    tracking: shipment.externalTrackingId,
                    ask_collection: ask_collection
                });
            } catch (err) {
                console.warn("Failed to validate with Ecotrack:", err.message);
                return res.status(502).json({ message: 'Failed to validate shipment on courier gateway.' });
            }
        }

        shipment.shipmentStatus = 'Validated';
        shipment.activityHistory.push({
            status: 'Validated & Dispatched',
            remarks: `Shipment confirmed with courier. Pickup requested: ${ask_collection === 1 ? 'Yes' : 'No'}`
        });

        const validatedShipment = await shipment.save();
        res.json(validatedShipment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------
// GET SHIPPING LABEL
// ----------------------------------------------------
exports.getShipmentLabel = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

        if (!shipment.externalTrackingId) {
            return res.status(400).json({ message: 'No external tracking ID found to generate label.' });
        }

        // Example: ECOTRACK might provide a base URL or an endpoints that streams the PDF
        // Adjust depending on actual API specs.
        const labelUrl = await ecotrackRequest('GET', `/api/v1/label/${shipment.externalTrackingId}`);

        if (labelUrl && labelUrl.url) {
            shipment.labelUrl = labelUrl.url;
            await shipment.save();
            return res.json({ url: labelUrl.url });
        } else {
            // Backup mechanism
            return res.json({ url: `https://api.ecotrack.dz/v1/print/label/${shipment.externalTrackingId}` });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ----------------------------------------------------
// REQUEST RETURN
// ----------------------------------------------------
exports.requestReturn = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

        if (!['In Transit', 'Out for Delivery', 'Failed Attempt'].includes(shipment.shipmentStatus)) {
            return res.status(400).json({ message: 'Returns can only be requested for active shipments not yet delivered.' });
        }

        if (shipment.externalTrackingId) {
            try {
                // Adjust Return Request Endpoint based on ECOTRACK API
                await ecotrackRequest('POST', `/api/v1/return/${shipment.externalTrackingId}`);
            } catch (err) {
                console.warn("Failed to request return via Ecotrack directly:", err.message);
                // We still proceed to flag it internally
            }
        }

        shipment.returnRequestedAt = new Date();
        shipment.shipmentStatus = 'Return Initiated';
        shipment.activityHistory.push({
            status: 'Return Requested',
            remarks: 'Admin manually requested package return from ECOTRACK.'
        });

        const updatedShipment = await shipment.save();

        // Push status back up to Internal Order
        let internalOrder;
        if (shipment.internalOrderId.startsWith('CUST-')) {
            internalOrder = await CustomOrder.findById(shipment.internalOrder);
        } else {
            internalOrder = await Order.findById(shipment.internalOrder);
        }

        if (internalOrder) {
            internalOrder.status = 'Cancelled';
            await internalOrder.save();
        }

        res.json(updatedShipment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
