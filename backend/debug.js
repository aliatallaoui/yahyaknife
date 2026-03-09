const mongoose = require('mongoose');
const ProductVariant = require('./models/ProductVariant');

mongoose.connect('mongodb://127.0.0.1:27017/saas-dashboard')
    .then(async () => {
        const variants = await ProductVariant.find({ reservedStock: { $lt: 0 } });
        for (const v of variants) {
            v.reservedStock = 0;
            await v.save();
            console.log(`Reset reservedStock for variant ${v.sku}`);
        }
        console.log("DB Cleanup Complete.");
        process.exit(0);
    });
