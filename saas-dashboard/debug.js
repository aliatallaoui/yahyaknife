const mongoose = require('mongoose');
const Order = require('./backend/models/Order');
const ProductVariant = require('./backend/models/ProductVariant');

mongoose.connect('mongodb://127.0.0.1:27017/saas-dashboard')
    .then(async () => {
        const orders = await Order.find().sort({ createdAt: -1 }).limit(1).populate('products.variantId');
        console.log("LATEST ORDER:");
        console.log(JSON.stringify(orders, null, 2));

        const variants = await ProductVariant.find({ 'sku': { $regex: 'WJ-' } });
        console.log("\nVARIANTS:");
        console.log(JSON.stringify(variants, null, 2));

        process.exit(0);
    });
