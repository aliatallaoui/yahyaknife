const logger = require('../shared/logger');
const mongoose = require('mongoose');
const Courier = require('../models/Courier');
const Order = require('../models/Order');
const CourierSettlement = require('../models/CourierSettlement');
const audit = require('../shared/utils/auditLog');

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// Get all couriers with calculated KPIs
exports.getCouriers = async (req, res) => {
    try {
        const couriers = await Courier.find({ tenant: req.user.tenant, deletedAt: null }).select('-apiToken -apiId').sort({ name: 1 }).lean();
        res.json(couriers);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching couriers');
        res.status(500).json({ error: 'Server Error' });
    }
};

// Create a new courier
exports.createCourier = async (req, res) => {
    try {
        const {
            name, phone, logo, status, integrationType, apiProvider, apiBaseUrl,
            authType, apiId, apiToken, accountReference, notes, vehicleType,
            coverageZones, deliverySLAs
        } = req.body;
        if (!name) return res.status(400).json({ error: 'Courier name is required.' });
        const newCourier = await Courier.create({
            name, phone, logo, status, integrationType, apiProvider, apiBaseUrl,
            authType, apiId, apiToken, accountReference, notes, vehicleType,
            coverageZones, deliverySLAs,
            tenant: req.user.tenant
        });
        const response = newCourier.toObject();
        delete response.apiToken;
        res.status(201).json(response);
    } catch (error) {
        logger.error({ err: error }, 'Error creating courier');
        res.status(400).json({ error: 'Invalid courier data' });
    }
};

// Update courier details
exports.updateCourier = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });
        // Strip immutable / computed fields from the update payload
        const {
            tenant, cashCollected, cashSettled, pendingRemittance,
            totalDeliveries, successRate, averageDeliveryTimeMinutes, reliabilityScore,
            _id, __v, createdAt, updatedAt, testConnectionStatus, lastSyncAt,
            ...safe
        } = req.body;
        const updated = await Courier.findOneAndUpdate(
            { _id: id, tenant: req.user.tenant, deletedAt: null },
            { $set: safe },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'Courier not found' });
        const response = updated.toObject();
        delete response.apiToken;
        res.json(response);
    } catch (error) {
        logger.error({ err: error }, 'Error updating courier');
        res.status(400).json({ error: 'Invalid courier data' });
    }
};

// Soft-delete a courier
exports.deleteCourier = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });
        const tenantId = req.user.tenant;

        // Block deletion if courier has active (in-transit) shipments
        const activeShipments = await Order.countDocuments({
            courier: id,
            tenant: tenantId,
            status: { $in: ['Dispatched', 'Shipped', 'Out for Delivery', 'In Transit'] },
            deletedAt: null
        });
        if (activeShipments > 0) {
            return res.status(409).json({
                error: `Cannot delete courier with ${activeShipments} active shipment(s). Reassign or complete them first.`
            });
        }

        // Also check pre-dispatch orders assigned to this courier
        const preDispatchOrders = await Order.countDocuments({
            courier: id,
            tenant: tenantId,
            status: { $in: require('../shared/constants/orderStatuses').PRE_DISPATCH },
            deletedAt: null
        });

        const courier = await Courier.findOneAndUpdate(
            { _id: id, tenant: tenantId, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        );
        if (!courier) return res.status(404).json({ error: 'Courier not found' });

        // Unassign courier from any pre-dispatch orders to prevent ghost references
        if (preDispatchOrders > 0) {
            await Order.updateMany(
                { courier: id, tenant: tenantId, status: { $in: require('../shared/constants/orderStatuses').PRE_DISPATCH }, deletedAt: null },
                { $set: { courier: null } }
            );
        }

        audit({ tenant: tenantId, actorUserId: req.user._id, action: 'DELETE_COURIER', module: 'couriers', metadata: { courierId: id, courierName: courier.name, preDispatchUnassigned: preDispatchOrders } });

        res.json({ message: 'Courier deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting courier');
        res.status(500).json({ error: 'Server Error' });
    }
};

// Settle Cash (Transfer Collected to Settled)
exports.settleCourierCash = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });
        const amount = Number(req.body.amountToSettle);
        const { notes } = req.body;
        const tenantId = req.user.tenant;

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ message: 'Settlement amount must be a positive number' });
        }
        const amountToSettle = amount;

        const courier = await Courier.findOne({ _id: id, tenant: tenantId, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        if (amountToSettle > courier.pendingRemittance) {
            return res.status(400).json({ message: 'Settlement amount exceeds pending remittance' });
        }

        const previousPendingRemittance = courier.pendingRemittance;
        courier.cashSettled += amountToSettle;
        await courier.save(); // pre-save hook updates pendingRemittance naturally

        // CRITICAL DATA COHERENCE: Map the bulk cash back to specific individual Orders
        // Otherwise, the Finance Hub has 'Delivered' orders that never flip to 'Paid' (Settled Revenue)
        // Determine which orders are fully covered by this settlement (oldest first)
        const unpaidOrders = await Order.find({
            tenant: tenantId,
            courier: id,
            status: 'Delivered',
            paymentStatus: { $ne: 'Paid' },
            deletedAt: null
        }, { _id: 1, financials: 1, totalAmount: 1 }).sort({ createdAt: 1 }).limit(5000).lean();

        let remainingToSettle = amountToSettle;
        const settledOrderIds = [];

        for (const order of unpaidOrders) {
            if (remainingToSettle <= 0) break;
            const orderAmount = order.financials?.codAmount ?? order.totalAmount ?? 0;
            if (remainingToSettle >= orderAmount) {
                settledOrderIds.push(order._id);
                remainingToSettle -= orderAmount;
            } else {
                break; // Partial — don't mark as paid
            }
        }

        // Route each order through OrderService for state machine, audit trail, and side effects
        // Lazy require to avoid circular dependency (order.service → courierController → order.service)
        if (settledOrderIds.length > 0) {
            const OrderService = require('../domains/orders/order.service');
            for (const settledOrderId of settledOrderIds) {
                await OrderService.updateOrder({
                    orderId: settledOrderId,
                    tenantId,
                    userId: req.user._id,
                    updateData: {
                        status: 'Paid',
                        paymentStatus: 'Paid',
                        statusNote: 'Settled via courier cash payment'
                    },
                    bypassStateMachine: true
                });
            }
        }

        // Persist the settlement event for audit trail + finance reporting
        const settlement = await CourierSettlement.create({
            tenant: tenantId,
            courier: id,
            settledBy: req.user._id,
            amountSettled: amountToSettle,
            ordersSettled: settledOrderIds,
            remainingAmount: remainingToSettle,
            previousPendingRemittance,
            notes: notes || ''
        });

        audit({ tenant: tenantId, actorUserId: req.user._id, action: 'SETTLE_COURIER_CASH', module: 'finance', metadata: { courierId: id, amountSettled: amountToSettle, ordersSettled: settledOrderIds.length, settlementId: settlement._id } });

        res.json({
            message: 'Cash settled successfully and pushed to Financial Ledger via Order Payment Status.',
            settlement,
            ordersSettled: settledOrderIds.length
        });
    } catch (error) {
        logger.error({ err: error }, 'Error settling courier cash');
        res.status(500).json({ error: 'Server Error' });
    }
};

// Settlement history for a courier
exports.getSettlementHistory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });
        const tenantId = req.user.tenant;

        const courier = await Courier.findOne({ _id: id, tenant: tenantId, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const settlements = await CourierSettlement.find({ courier: id, tenant: tenantId })
            .populate('settledBy', 'name email')
            .sort({ settledAt: -1 })
            .limit(500)
            .lean();

        const totalSettled = settlements.reduce((sum, s) => sum + s.amountSettled, 0);

        res.json({ courierId: id, totalSettled, settlements });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching settlement history');
        res.status(500).json({ error: 'Server Error' });
    }
};

// Batch Dispatch: Assign multiple orders to a single Courier
exports.assignOrdersToCourier = async (req, res) => {
    try {
        const { id } = req.params; // Courier ID
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });
        const { orderIds } = req.body; // Array of Order ObjectIDs

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: 'Provide an array of orderIds to dispatch.' });
        }

        // Filter to only eligible orders (pre-dispatch statuses)
        const tenantId = req.user.tenant;
        const eligibleOrders = await Order.find({
            _id: { $in: orderIds },
            tenant: tenantId,
            status: { $in: ['New', 'Confirmed', 'Preparing'] },
            deletedAt: null
        }).select('_id').lean();

        let modified = 0;
        const errors = [];

        // Lazy-require to break circular dependency (courierController ↔ order.service)
        const OrderService = require('../domains/orders/order.service');

        // Route each through OrderService for audit trail + inventory handling
        for (const order of eligibleOrders) {
            try {
                await OrderService.updateOrder({
                    orderId: order._id,
                    tenantId,
                    userId: req.user._id,
                    updateData: { courier: id, status: 'Ready for Pickup' },
                    bypassStateMachine: true
                });
                modified++;
            } catch (err) {
                errors.push({ orderId: order._id, error: err.message });
            }
        }

        res.json({
            message: 'Orders batched and dispatched successfully.',
            matched: eligibleOrders.length,
            modified,
            ...(errors.length > 0 && { errors })
        });
    } catch (error) {
        logger.error({ err: error }, 'Error assigning orders to courier');
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.recalculateCourierKPIs = async (courierId) => {
    try {
        const courier = await Courier.findOne({ _id: courierId, deletedAt: null }).select('_id tenant totalDeliveries successRate averageDeliveryTimeMinutes');
        if (!courier) return;

        const [kpiData] = await Order.aggregate([
            { $match: { courier: courier._id, tenant: courier.tenant, deletedAt: null } },
            {
                $group: {
                    _id: null,
                    successfulDeliveries: {
                        $sum: { $cond: [{ $in: ["$status", ['Delivered', 'Paid']] }, 1, 0] }
                    },
                    failedDeliveries: {
                         $sum: { $cond: [{ $in: ["$status", ['Refused', 'Returned']] }, 1, 0] }
                    },
                    totalDeliveryTimeMinutes: {
                        $sum: {
                             $cond: [
                                { $in: ["$status", ['Delivered', 'Paid']] },
                                { $ifNull: ["$deliveryStatus.deliveryTimeMinutes", 0] },
                                0
                             ]
                        }
                    },
                    deliveriesWithTime: {
                        $sum: {
                             $cond: [
                                { $and: [
                                    { $in: ["$status", ['Delivered', 'Paid']] },
                                    { $ne: [{ $type: "$deliveryStatus.deliveryTimeMinutes" }, "missing"] },
                                    { $ne: ["$deliveryStatus.deliveryTimeMinutes", null] }
                                ]}, 1, 0
                             ]
                        }
                    }
                }
            }
        ]);

        if (!kpiData) return; // No orders for this courier

        const totalDeliveries = kpiData.successfulDeliveries + kpiData.failedDeliveries;
        const successRate = totalDeliveries > 0 ? (kpiData.successfulDeliveries / totalDeliveries) * 100 : 0;
        const averageDeliveryTimeMinutes = kpiData.deliveriesWithTime > 0 
                                            ? kpiData.totalDeliveryTimeMinutes / kpiData.deliveriesWithTime 
                                            : 0;

        courier.totalDeliveries = totalDeliveries;
        courier.successRate = successRate;
        courier.averageDeliveryTimeMinutes = averageDeliveryTimeMinutes;
        await courier.save();

    } catch (error) {
        logger.error({ err: error }, 'Error recalculating courier KPIs');
    }
};

// Helper: Synchronize Courier Cash Liability upon Order Delivery / Status Reversal
exports.syncCourierCash = async (courierId, amountDelta, tenantId) => {
    try {
        if (!courierId || !tenantId || amountDelta === 0) return;

        // Atomic increment to prevent lost updates from concurrent delivery events.
        // Also recalculate pendingRemittance atomically (mirrors pre-save hook logic).
        const filter = { _id: courierId, tenant: tenantId, deletedAt: null };
        const updated = await Courier.findOneAndUpdate(
            filter,
            [
                { $set: { cashCollected: { $max: [0, { $add: ['$cashCollected', amountDelta] }] } } },
                { $set: { pendingRemittance: { $subtract: ['$cashCollected', '$cashSettled'] } } }
            ],
            { new: true }
        );
        if (!updated) return;
    } catch (error) {
        logger.error({ err: error }, 'Error syncing courier cash');
    }
};

// Test Courier API Connection
exports.testCourierConnection = async (req, res) => {
    try {
        const { apiProvider, apiBaseUrl, authType, apiToken, apiId } = req.body;
        const axios = require('axios');
        
        let provider = apiProvider || 'Ecotrack';

        if (provider === 'Yalidin') {
            if (!apiId || !apiToken) {
                return res.status(400).json({ message: 'API ID and API Token are required for Yalidin.' });
            }

            const baseUrl = 'https://api.yalidine.com/v1';
            
            // Yalidin test: fetch wilayas
            const wilayasRes = await axios.get(`${baseUrl}/wilayas`, {
                headers: {
                    'X-API-ID': apiId,
                    'X-API-TOKEN': apiToken,
                    'Accept': 'application/json'
                },
                timeout: 5000
            });

            if (wilayasRes.data && Array.isArray(wilayasRes.data.data)) {
                 return res.json({ success: true, message: 'Yalidin connection established successfully.' });
            } else {
                 return res.status(400).json({ success: false, message: 'Invalid response format from Yalidin API.' });
            }

        } else {
            // Ecotrack logic
            if (!apiBaseUrl || !apiToken) {
                return res.status(400).json({ message: 'Base URL and API Token are required for Ecotrack.' });
            }

            // SSRF guard: only allow HTTPS URLs pointing to public hosts
            let parsedUrl;
            try { parsedUrl = new URL(apiBaseUrl); } catch {
                return res.status(400).json({ message: 'Invalid API base URL.' });
            }
            if (parsedUrl.protocol !== 'https:') {
                return res.status(400).json({ message: 'API base URL must use HTTPS.' });
            }
            const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '::1'];
            if (blockedHosts.includes(parsedUrl.hostname) || parsedUrl.hostname.startsWith('10.') || parsedUrl.hostname.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(parsedUrl.hostname)) {
                return res.status(400).json({ message: 'API base URL must point to a public host.' });
            }

            const baseUrl = apiBaseUrl.replace(/\/$/, "");
            
            // Let's attempt to fetch wilayas as a way to test auth and connectivity
            const wilayasRes = await axios.get(`${baseUrl}/api/v1/get/wilayas`, {
                headers: {
                    ...(authType === 'Bearer Token' ? { Authorization: `Bearer ${apiToken}` } :
                       authType === 'API Key' ? { 'x-api-key': apiToken } : {})
                },
                timeout: 5000 // 5 seconds timeout
            });

            if (Array.isArray(wilayasRes.data)) {
                return res.json({ success: true, message: 'Ecotrack connection established successfully.' });
            } else {
                return res.status(400).json({ success: false, message: 'Invalid response format from API.' });
            }
        }
    } catch (error) {
        logger.error({ err: error, responseData: error.response?.data }, 'Test Connection Error');

        // Map HTTP status codes to user-friendly messages without leaking internal details
        const status = error.response?.status;
        let errorMsg = 'Connection failed. Please verify your API credentials and try again.';
        if (status === 401 || status === 403) {
            errorMsg = 'Authentication failed. Please check your API token/credentials.';
        } else if (status === 404) {
            errorMsg = 'API endpoint not found. Please verify the API URL.';
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            errorMsg = 'Could not reach the API server. Please check the URL.';
        } else if (error.code === 'ECONNABORTED') {
            errorMsg = 'Connection timed out. The API server may be unreachable.';
        }

        res.status(400).json({
            success: false,
            message: errorMsg
        });
    }
};
