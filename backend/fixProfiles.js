const mongoose = require('mongoose');
require('dotenv').config();
const { updateCustomerMetrics } = require('./controllers/customerController');
const Customer = require('./models/Customer');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const run = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        const customers = await Customer.find({});
        console.log(`Calculating Intelligence footprints for ${customers.length} users...`);

        let processed = 0;
        for (const c of customers) {
            await updateCustomerMetrics(c._id);
            processed++;
            if (processed % 10 === 0) console.log(`Processed ${processed}/${customers.length}...`);
        }

        console.log("All Customer Profiles Updated.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
