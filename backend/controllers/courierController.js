const Courier = require('../models/Courier');
const Order = require('../models/Order');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const CourierSettlement = require('../models/CourierSettlement');

// Get all couriers with calculated KPIs
exports.getCouriers = async (req, res) => {
    try {
        const couriers = await Courier.find({ tenant: req.user.tenant }).sort({ name: 1 });
        res.json(couriers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new courier
exports.createCourier = async (req, res) => {
    try {
        const newCourier = await Courier.create({ ...req.body, tenant: req.user.tenant });
        res.status(201).json(newCourier);
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
        res.json(updated);
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

        res.json({
            message: 'Cash settled successfully and pushed to Financial Ledger via Order Payment Status.',
            settlement,
            ordersSettled: settledOrderIds.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
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

        // Update orders: set courier flag, change status to 'Ready for Pickup' if 'Confirmed' or 'Preparing'
        const result = await Order.updateMany(
            { _id: { $in: orderIds }, tenant: req.user.tenant, status: { $in: ['New', 'Confirmed', 'Preparing'] } },
            { $set: { courier: id, status: 'Ready for Pickup' } }
        );

        res.json({ message: 'Orders batched and dispatched successfully.', matched: result.matchedCount, modified: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.recalculateCourierKPIs = async (courierId) => {
    try {
        const courier = await Courier.findById(courierId);
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
        console.error("Error recalculating courier KPIs:", error);
    }
};

// Helper: Synchronize Courier Cash Liability upon Order Delivery / Status Reversal
exports.syncCourierCash = async (courierId, amountDelta) => {
    try {
        if (!courierId || amountDelta === 0) return;

        const courier = await Courier.findById(courierId);
        if (!courier) return;

        // Use the pre-save hook to ensure pendingRemittance stays accurate
        courier.cashCollected += amountDelta;

        // Prevent negative collections artificially
        if (courier.cashCollected < 0) {
            courier.cashCollected = 0;
        }

        await courier.save();
    } catch (error) {
        console.error("Error syncing courier cash:", error);
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
        console.error('Test Connection Error:', error.response?.data || error.message);
        
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
