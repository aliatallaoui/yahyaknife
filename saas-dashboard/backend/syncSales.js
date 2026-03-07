const mongoose = require('mongoose');
const Order = require('./models/Order');
const ProductVariant = require('./models/ProductVariant');

mongoose.connect('mongodb://127.0.0.1:27017/saas-dashboard')
    .then(async () => {
        // 1. Reset all totalSold to 0 first
        await ProductVariant.updateMany({}, { totalSold: 0 });

        // 2. Aggregate all valid orders to find sales sums
        const validOrders = await Order.find({
            status: { $nin: ['Cancelled', 'Returned'] },
            fulfillmentStatus: { $nin: ['Cancelled', 'Returned'] }
        });

        const salesMap = {};
        for (const order of validOrders) {
            for (const item of order.products) {
                if (item.variantId) {
                    const vId = item.variantId.toString();
                    if (!salesMap[vId]) salesMap[vId] = 0;
                    salesMap[vId] += item.quantity;
                }
            }
        }

        // 3. Apply the summed sales back to the variants
        for (const [vId, sold] of Object.entries(salesMap)) {
            await ProductVariant.findByIdAndUpdate(vId, { totalSold: sold });
            console.log(`Variant ${vId} total sold: ${sold}`);
        }

        console.log("Historical Sales Synchronization Complete.");
        process.exit(0);
    });
