const mongoose = require('mongoose');
const Order = require('./models/Order');
const ProductVariant = require('./models/ProductVariant');
require('./models/Product'); // Needed for population in salesController
const salesController = require('./controllers/salesController');

async function checkStock(variantId) {
    const v = await ProductVariant.findById(variantId);
    return {
        total: v.totalStock,
        reserved: v.reservedStock,
        sold: v.totalSold,
        available: v.availableStock
    };
}

// Mock Res Object for Controller testing
class MockRes {
    status(code) { this.statusCode = code; return this; }
    json(data) { this.data = data; return this; }
}

async function runTest() {
    await mongoose.connect('mongodb://127.0.0.1:27017/saas-dashboard');
    console.log("Connected to DB.");

    try {
        const variant = await ProductVariant.findOne();
        if (!variant) throw new Error("No variants found.");

        console.log(`\n--- Test Variant: ${variant.sku} ---`);
        let stock = await checkStock(variant._id);
        console.log("INITIAL STATE:", stock);

        // --- Scenario 1: Create Pending Order ---
        console.log("\n-> ACTION: Create Pending Order (Qty: 10)");
        let req = {
            body: {
                orderId: `TEST-${Date.now()}`,
                customerName: "Test Suite",
                channel: "Website",
                products: [{ variantId: variant._id, quantity: 10, unitPrice: 100 }],
                status: 'Processing',
                fulfillmentStatus: 'Unfulfilled'
            }
        };
        let res = new MockRes();

        await salesController.createOrder(req, res);
        let orderId = res.data._id;
        stock = await checkStock(variant._id);
        console.log("RESULT AFTER CREATION:", stock);

        // --- Scenario 2: Edit Order (Change Qty to 5) ---
        console.log("\n-> ACTION: Edit Order (Change Qty from 10 to 5)");
        req = {
            params: { id: orderId },
            body: {
                products: [{ variantId: variant._id, quantity: 5, unitPrice: 100 }],
                status: 'Processing',
                fulfillmentStatus: 'Unfulfilled'
            }
        };
        res = new MockRes();
        await salesController.updateOrder(req, res);
        stock = await checkStock(variant._id);
        console.log("RESULT AFTER QTY UPDATE:", stock);

        // --- Scenario 3: Edit Order (Change to Fulfilled) ---
        console.log("\n-> ACTION: Fulfill Order");
        req = {
            params: { id: orderId },
            body: {
                products: [{ variantId: variant._id, quantity: 5, unitPrice: 100 }],
                status: 'Delivered',
                fulfillmentStatus: 'Fulfilled'
            }
        };
        res = new MockRes();
        await salesController.updateOrder(req, res);
        stock = await checkStock(variant._id);
        console.log("RESULT AFTER FULFILLMENT:", stock);

        // --- Scenario 4: Change from Fulfilled to Cancelled ---
        console.log("\n-> ACTION: Cancel Fulfilled Order (Returns stock to total, undoes sold)");
        req = {
            params: { id: orderId },
            body: {
                products: [{ variantId: variant._id, quantity: 5, unitPrice: 100 }],
                status: 'Cancelled',
                fulfillmentStatus: 'Unfulfilled'  // Fulfilment schema doesn't have Cancelled, only Unfulfilled or Returned. The main status Cancelled handles it.
            }
        };
        res = new MockRes();
        await salesController.updateOrder(req, res);
        stock = await checkStock(variant._id);
        console.log("RESULT AFTER CANCELLATION:", stock);

        // Cleanup
        await Order.findByIdAndDelete(orderId);

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

runTest();
