const Courier = require('../models/Courier');
const Order = require('../models/Order');

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

        res.json({ message: 'Cash settled successfully', courier });
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
