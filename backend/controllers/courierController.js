const Courier = require('../models/Courier');
const Order = require('../models/Order');
const Revenue = require('../models/Revenue');

// Get all couriers with calculated KPIs
exports.getCouriers = async (req, res) => {
    try {
        const couriers = await Courier.find().sort({ name: 1 });
        res.json(couriers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new courier
exports.createCourier = async (req, res) => {
    try {
        const newCourier = await Courier.create(req.body);
        res.status(201).json(newCourier);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update courier details
exports.updateCourier = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Courier.findByIdAndUpdate(id, req.body, { new: true });
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
        const { amountToSettle } = req.body;

        const courier = await Courier.findById(id);
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        if (amountToSettle > courier.pendingRemittance) {
            return res.status(400).json({ message: 'Settlement amount exceeds pending remittance' });
        }

        courier.cashSettled += amountToSettle;
        await courier.save(); // pre-save hook updates pendingRemittance naturally

        // CRITICAL DATA COHERENCE: Map the bulk cash back to specific individual Orders
        // Otherwise, the Finance Hub has 'Delivered' orders that never flip to 'Paid' (Settled Revenue)
        let remainingToSettle = amountToSettle;
        const unpaidOrders = await Order.find({
            courier: id,
            status: 'Delivered',
            paymentStatus: { $ne: 'Paid' }
        }).sort({ date: 1 }); // Oldest first

        const updatedOrders = [];

        for (const order of unpaidOrders) {
            if (remainingToSettle <= 0) break;

            // Assume the full COD amount is what we need to clear this order
            const orderAmount = order.financials?.codAmount || order.totalAmount;

            if (remainingToSettle >= orderAmount) {
                // Fully pay this order
                order.paymentStatus = 'Paid';
                order.status = 'Paid'; // Advance the ERP status as well
                remainingToSettle -= orderAmount;
                await order.save();
                updatedOrders.push(order._id);
            } else {
                // Partial payment edge cases (Rare, but possible if they settle a weird amount)
                // We'll leave it as unpaid but reduce the remaining pool to 0
                remainingToSettle = 0;
            }
        }

        res.json({
            message: 'Cash settled successfully and pushed to Financial Ledger via Order Payment Status.',
            courier,
            ordersSettled: updatedOrders.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Batch Dispatch: Assign multiple orders to a single Courier
exports.assignOrdersToCourier = async (req, res) => {
    try {
        const { id } = req.params; // Courier ID
        const { orderIds } = req.body; // Array of Order ObjectIDs

        const courier = await Courier.findById(id);
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: 'Provide an array of orderIds to dispatch.' });
        }

        // Update orders: set courier flag, change status to 'Ready for Pickup' if 'Confirmed' or 'Preparing'
        const result = await Order.updateMany(
            { _id: { $in: orderIds }, status: { $in: ['New', 'Confirmed', 'Preparing'] } },
            {
                $set: { courier: id, status: 'Ready for Pickup' }
            }
        );

        res.json({ message: 'Orders batched and dispatched successfully.', matched: result.matchedCount, modified: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Helper: Dynamically recalculate Courier KPIs based on entire Order history
exports.recalculateCourierKPIs = async (courierId) => {
    try {
        const courier = await Courier.findById(courierId);
        if (!courier) return;

        const allOrders = await Order.find({ courier: courierId });
        if (allOrders.length === 0) return;

        let totalDeliveries = 0;
        let successfulDeliveries = 0;
        let totalDeliveryTimeMinutes = 0;
        let deliveriesWithTime = 0;

        allOrders.forEach(o => {
            if (['Delivered', 'Paid'].includes(o.status)) {
                totalDeliveries++;
                successfulDeliveries++;
                if (o.deliveryStatus && o.deliveryStatus.deliveryTimeMinutes) {
                    totalDeliveryTimeMinutes += o.deliveryStatus.deliveryTimeMinutes;
                    deliveriesWithTime++;
                }
            } else if (['Refused', 'Returned'].includes(o.status)) {
                totalDeliveries++;
                // They attempted it, so it counts as a total attempted delivery, but not successful
            }
        });

        const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;
        const averageDeliveryTimeMinutes = deliveriesWithTime > 0 ? totalDeliveryTimeMinutes / deliveriesWithTime : 0;

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
