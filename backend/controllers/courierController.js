const logger = require('../shared/logger');
const Courier = require('../models/Courier');
const Order = require('../models/Order');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const CourierSettlement = require('../models/CourierSettlement');
const audit = require('../shared/utils/auditLog');

// Get all couriers with calculated KPIs
exports.getCouriers = async (req, res) => {
    try {
        const couriers = await Courier.find({ tenant: req.user.tenant }).select('-apiToken -apiId').sort({ name: 1 }).lean();
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
        res.status(400).json({ error: error.message });
    }
};

// Update courier details
exports.updateCourier = async (req, res) => {
    try {
        const { id } = req.params;
        // Strip immutable / computed fields from the update payload
        const {
            tenant, cashCollected, cashSettled, pendingRemittance,
            totalDeliveries, successRate, averageDeliveryTimeMinutes, reliabilityScore,
            _id, __v, createdAt, updatedAt, testConnectionStatus, lastSyncAt,
            ...safe
        } = req.body;
        const updated = await Courier.findOneAndUpdate(
            { _id: id, tenant: req.user.tenant },
            { $set: safe },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'Courier not found' });
        const response = updated.toObject();
        delete response.apiToken;
        res.json(response);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Settle Cash (Transfer Collected to Settled)
exports.settleCourierCash = async (req, res) => {
    try {
        const { id } = req.params;
        const { amountToSettle, notes } = req.body;
        const tenantId = req.user.tenant;

        if (!amountToSettle || amountToSettle <= 0) {
            return res.status(400).json({ message: 'Settlement amount must be a positive number' });
        }

        const courier = await Courier.findOne({ _id: id, tenant: tenantId });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        if (amountToSettle > courier.pendingRemittance) {
            return res.status(400).json({ message: `Settlement amount (${amountToSettle}) exceeds pending remittance (${courier.pendingRemittance})` });
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
        }, { _id: 1, financials: 1, totalAmount: 1 }).sort({ createdAt: 1 }).lean();

        let remainingToSettle = amountToSettle;
        const settledOrderIds = [];

        for (const order of unpaidOrders) {
            if (remainingToSettle <= 0) break;
            const orderAmount = order.financials?.codAmount || order.totalAmount;
            if (remainingToSettle >= orderAmount) {
                settledOrderIds.push(order._id);
                remainingToSettle -= orderAmount;
            } else {
                break; // Partial — don't mark as paid
            }
        }

        // Single batch update instead of N saves
        if (settledOrderIds.length > 0) {
            await Order.updateMany(
                { _id: { $in: settledOrderIds }, tenant: tenantId },
                { $set: { paymentStatus: 'Paid', status: 'Paid' } }
            );

            // Audit trail: create an OrderStatusHistory record for each settled order
            const now = new Date();
            await OrderStatusHistory.insertMany(
                settledOrderIds.map(orderId => ({
                    tenant: tenantId,
                    orderId,
                    status: 'Paid',
                    previousStatus: 'Delivered',
                    changedBy: req.user._id,
                    changedAt: now,
                    note: 'Settled via courier cash payment'
                }))
            );
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
        const tenantId = req.user.tenant;

        const courier = await Courier.findOne({ _id: id, tenant: tenantId });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const settlements = await CourierSettlement.find({ courier: id, tenant: tenantId })
            .populate('settledBy', 'name email')
            .sort({ settledAt: -1 });

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
        const { orderIds } = req.body; // Array of Order ObjectIDs

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant });
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
        }).select('_id');

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
        const courier = await Courier.findById(courierId).select('_id tenant totalDeliveries successRate averageDeliveryTimeMinutes');
        if (!courier) return;

        const [kpiData] = await Order.aggregate([
            { $match: { courier: courier._id, tenant: courier.tenant } },
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
exports.syncCourierCash = async (courierId, amountDelta) => {
    try {
        if (!courierId || amountDelta === 0) return;

        const courier = await Courier.findById(courierId).select('_id cashCollected cashSettled pendingRemittance');
        if (!courier) return;

        // Use the pre-save hook to ensure pendingRemittance stays accurate
        courier.cashCollected += amountDelta;

        // Prevent negative collections artificially
        if (courier.cashCollected < 0) {
            courier.cashCollected = 0;
        }

        await courier.save();
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
        
        let errorMsg = error.message;
        if (error.response?.data) {
            if (error.response.data.error && typeof error.response.data.error === 'object') {
                errorMsg = error.response.data.error.message || JSON.stringify(error.response.data.error);
            } else if (error.response.data.message) {
                errorMsg = error.response.data.message;
            } else {
                errorMsg = JSON.stringify(error.response.data);
            }
        }
        
        res.status(400).json({ 
            success: false, 
            message: errorMsg || 'Connection failed' 
        });
    }
};
