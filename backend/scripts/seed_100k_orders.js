const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config({ path: '../.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

// Import Models
const Order = require('../models/Order');
const Tenant = require('../models/Tenant');
const Customer = require('../models/Customer');

const BATCH_SIZE = 5000;
const TOTAL_ORDERS = 100000;

const WILAYAS = ['Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arreridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent', 'Ghardaïa', 'Relizane'];

const CHANNELS = ['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Direct', 'Manual', 'WhatsApp', 'Facebook', 'TikTok', 'Shopify', 'WooCommerce', 'Instagram', 'Marketplace', 'Other'];

const STATUSES = ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'];

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateOrderId = (index) => {
    return 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + index.toString().padStart(6, '0');
};

const runSeed = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log(`✅ Connected to Database: ${MONGO_URI}`);

        // 1. Get default tenant
        const tenant = await Tenant.findOne();
        if (!tenant) {
            console.error("❌ No tenant found in DB. Run tenant creation first.");
            process.exit(1);
        }
        console.log(`📌 Using Tenant: ${tenant.name} (${tenant._id})`);

        // 2. Get or create a default customer
        let customer = await Customer.findOne({ tenant: tenant._id });
        if (!customer) {
            customer = await Customer.create({
                tenant: tenant._id,
                name: 'Mass Test User',
                phone: '0000000000',
                totalOrders: 0,
                totalSpent: 0
            });
            console.log(`👤 Created fallback customer: ${customer._id}`);
        } else {
            console.log(`👤 Using existing customer: ${customer.name} (${customer._id})`);
        }

        console.log(`\n🚀 Starting mass generation of ${TOTAL_ORDERS.toLocaleString()} orders...`);
        console.time("SeedDuration");

        let insertedCount = 0;

        for (let i = 0; i < TOTAL_ORDERS; i += BATCH_SIZE) {
            const batch = [];
            const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_ORDERS - i);

            for (let j = 0; j < currentBatchSize; j++) {
                const globalIndex = i + j;
                const status = randomItem(STATUSES);
                const isPaid = status === 'Paid';
                const totalAmount = randomInt(1500, 25000);
                
                // Randomize date across the last 365 days
                const date = new Date();
                date.setDate(date.getDate() - randomInt(0, 365));

                batch.push({
                    tenant: tenant._id,
                    orderId: generateOrderId(globalIndex),
                    date: date,
                    customer: customer._id,
                    totalAmount: totalAmount,
                    subtotal: totalAmount,
                    wilaya: randomItem(WILAYAS),
                    commune: 'Mock Commune',
                    channel: randomItem(CHANNELS),
                    status: status,
                    paymentStatus: isPaid ? 'Paid' : 'Unpaid',
                    priority: randomItem(['Normal', 'Normal', 'Normal', 'High', 'Urgent']),
                    products: [{
                        name: 'Mock Generated Product',
                        quantity: randomInt(1, 4),
                        unitPrice: totalAmount
                    }],
                    shipping: {
                        recipientName: 'Test Recipient ' + globalIndex,
                        phone1: '055' + randomInt(1000000, 9999999).toString(),
                        address: 'Mock Street ' + randomInt(1, 999)
                    }
                });
            }

            await Order.insertMany(batch, { ordered: false });
            insertedCount += currentBatchSize;
            
            const progress = ((insertedCount / TOTAL_ORDERS) * 100).toFixed(1);
            console.log(`📦 Inserted ${insertedCount.toLocaleString()} / ${TOTAL_ORDERS.toLocaleString()} (${progress}%)`);
        }

        console.timeEnd("SeedDuration");
        console.log("\n🎉 Order Generation Complete!");
        process.exit(0);

    } catch (err) {
        console.error("❌ Fatal Error:", err);
        process.exit(1);
    }
};

runSeed();
