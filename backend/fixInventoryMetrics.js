const mongoose = require('mongoose');
const Order = require('./models/Order');
const ProductVariant = require('./models/ProductVariant');
require('./models/Product');

async function fixInventory() {
    await mongoose.connect('mongodb://127.0.0.1:27017/saas-dashboard');
    console.log("Connected to DB. Starting inventory sync fix...");

    try {
        // 1. Reset all reservedStock and totalSold to 0
        console.log("Resetting metrics to 0...");
        await ProductVariant.updateMany({}, { $set: { reservedStock: 0, totalSold: 0 } });

        // 2. Fetch all valid orders
        console.log("Calculating metrics from valid orders...");
        const orders = await Order.find();

        const variantUpdates = {}; // { variantId: { reserved: 0, sold: 0 } }

        for (const order of orders) {
            const isMainActive = !['Cancelled', 'Returned'].includes(order.status);
            const isFulfillActive = !['Cancelled', 'Returned'].includes(order.fulfillmentStatus);

            if (isMainActive && isFulfillActive) {
                const isFulfilled = order.fulfillmentStatus === 'Fulfilled';

                for (const item of order.products) {
                    if (!item.variantId) continue;
                    const vId = item.variantId.toString();

                    if (!variantUpdates[vId]) {
                        variantUpdates[vId] = { reserved: 0, sold: 0 };
                    }

                    const qty = Number(item.quantity) || 0;

                    if (isFulfilled) {
                        // If it's fulfilled, it was already deducted from totalStock. Just increment sold.
                        variantUpdates[vId].sold += qty;
                    } else {
                        // If pending, reserve it and count as sold (or impending sale)
                        variantUpdates[vId].reserved += qty;
                        variantUpdates[vId].sold += qty;
                    }
                }
            }
        }

        // 3. Apply the calculated metrics
        console.log("Applying correct metrics...");
        for (const [vId, metrics] of Object.entries(variantUpdates)) {
            const updated = await ProductVariant.findByIdAndUpdate(vId, {
                $set: {
                    reservedStock: metrics.reserved,
                    totalSold: metrics.sold
                }
            }, { new: true });

            if (updated) {
                console.log(`Variant ${updated.sku} -> Reserved: ${metrics.reserved}, Sold: ${metrics.sold}`);
            }
        }

        console.log("Inventory metrics fixed successfully!");

    } catch (error) {
        console.error("Error fixing inventory:", error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

fixInventory();
