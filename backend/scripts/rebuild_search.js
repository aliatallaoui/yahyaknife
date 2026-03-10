const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

async function rebuildIndexes() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        console.log('Dropping old standard text indexes if they exist...');
        try { await Order.collection.dropIndex('orderId_1'); } catch (e) { console.log('orderId_1 not found'); }
        try { await Order.collection.dropIndex('trackingInfo.trackingNumber_1'); } catch (e) { console.log('trackingNumber_1 not found'); }
        
        try { await Order.collection.dropIndex('order_text_idx'); } catch(e) { console.log('Old order text index not found'); }
        try { await Customer.collection.dropIndex('customer_text_idx'); } catch(e) { console.log('Old customer text index not found'); }

        console.log('Synchronizing new Mongoose Text Indexes...');
        await Order.syncIndexes();
        await Customer.syncIndexes();
        
        console.log('Indexes rebuilt successfully.');
        
        const orderIndexes = await Order.collection.indexes();
        console.log('Active Order Indexes:', orderIndexes.map(i => i.name));

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

rebuildIndexes();
