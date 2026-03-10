const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Customer = require('./models/Customer');
const Order = require('./models/Order');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const WILAYAS = [
    { code: '16', name: 'Alger', communes: ['Bab El Oued', 'Hussein Dey', 'El Harrach', 'Sidi M\'hamed', 'Kouba'] },
    { code: '31', name: 'Oran', communes: ['Oran Centre', 'Bir El Djir', 'Es Senia', 'Ain Turk'] },
    { code: '25', name: 'Constantine', communes: ['Constantine Centre', 'El Khroub', 'Ain Abid', 'Didouche Mourad'] },
    { code: '9', name: 'Blida', communes: ['Blida Centre', 'Boufarik', 'Beni Mered', 'Ouled Yaich'] },
    { code: '6', name: 'Béjaïa', communes: ['Béjaïa Centre', 'Akbou', 'El Kseur', 'Amizour'] },
    { code: '15', name: 'Tizi Ouzou', communes: ['Tizi Ouzou Centre', 'Azazga', 'Draa Ben Khedda'] },
    { code: '19', name: 'Sétif', communes: ['Sétif Centre', 'El Eulma', 'Ain Arnat', 'Ain Oulmene'] },
];

const CUSTOMER_DATA = [
    { name: 'يحيى بن علي', phone: '0770123456' },
    { name: 'أحمد بوزيد', phone: '0661234567' },
    { name: 'فاطمة الزهراء', phone: '0550987654' },
    { name: 'كريم حمادي', phone: '0790654321' },
    { name: 'سارة بلقاسم', phone: '0551223344' },
    { name: 'ليلى بن حميدة', phone: '0662556677' },
];

const PRODUCT_NAMES = [
    'سكين الشيف الدمشقي',
    'سكين الطاهي الإحترافي',
    'سكين فيليه سمك',
    'طقم سكاكين ٣ قطع',
    'سكين خبز مسنن',
];

const ADDRESSES = [
    'حي 500 مسكن، عمارة 12، شقة 4',
    'شارع العربي بن مهيدي رقم 45',
    'حي المستقبل، فيلا رقم 8',
    'زنقة الأمير عبدالقادر، 22',
];

const STATUSES = ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');

    console.log('👥 Fetching or creating customers...');
    let customers = await Customer.find({});

    if (customers.length === 0) {
        for (const cd of CUSTOMER_DATA) {
            const c = await Customer.create({
                name: cd.name,
                phone: cd.phone,
                acquisitionChannel: rand(['Direct Traffic', 'Social Media', 'Paid Ads']),
                status: 'Active',
                joinDate: new Date(2025, randInt(0, 11), randInt(1, 28)),
            });
            customers.push(c);
        }
    }

    console.log('📝 Generating 1000 orders...');
    let startIdx = 1000;

    // Find the absolute highest orderId currently in existance (sorting by orderId string descending)
    let lastOrderWithMaxId = await Order.findOne().sort({ orderId: -1 });
    if (lastOrderWithMaxId && lastOrderWithMaxId.orderId) {
        const match = lastOrderWithMaxId.orderId.match(/\d+$/);
        if (match) {
            const maxIdNum = parseInt(match[0], 10);
            if (maxIdNum >= startIdx) {
                startIdx = maxIdNum + 1;
            }
        }
    }
    console.log(`Starting generation at order index: ${startIdx}`);

    const newOrders = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < 1000; i++) {
        const customer = rand(customers);
        const wilaya = rand(WILAYAS);
        const commune = rand(wilaya.communes);
        const address = rand(ADDRESSES);
        const status = rand(STATUSES);

        const numProducts = randInt(1, 4);
        const orderProducts = [];
        let totalAmount = 0;

        for (let p = 0; p < numProducts; p++) {
            const pName = rand(PRODUCT_NAMES);
            const qty = randInt(1, 3);
            const price = randInt(2000, 15000);
            orderProducts.push({
                name: pName,
                quantity: qty,
                unitPrice: price,
            });
            totalAmount += price * qty;
        }

        const daysAgo = randInt(0, 30);
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - daysAgo);
        orderDate.setHours(randInt(8, 20), randInt(0, 59), 0);

        const courierFee = randInt(300, 800);

        newOrders.push({
            orderId: `ORD-${String(startIdx).padStart(5, '0')}`,
            date: orderDate,
            customer: customer._id,
            products: orderProducts,
            totalAmount,
            channel: rand(['Website', 'Amazon', 'Direct']),
            status: status,
            wilaya: wilaya.name,
            commune: commune,
            verificationStatus: ['New'].includes(status) ? 'Pending' : 'Phone Confirmed',
            paymentStatus: ['Paid'].includes(status) ? 'Paid' : ['Delivered'].includes(status) ? 'Pending' : 'Unpaid',
            fulfillmentStatus: ['Delivered', 'Paid'].includes(status) ? 'Fulfilled' : 'Unfulfilled',
            fulfillmentPipeline: ['Delivered', 'Paid'].includes(status) ? 'Delivered' : ['Dispatched', 'Shipped', 'Out for Delivery'].includes(status) ? 'Shipped' : 'Pending',
            financials: {
                codAmount: totalAmount,
                courierFee,
                cogs: Math.round(totalAmount * 0.35),
                shippingCosts: courierFee,
            },
            shipping: {
                recipientName: customer.name,
                phone1: customer.phone,
                wilayaCode: wilaya.code,
                wilayaName: wilaya.name,
                commune,
                address,
                weight: randInt(1, 5),
            }
        });

        startIdx++; // Increment the global counter immediately after use

        if (newOrders.length === BATCH_SIZE || i === 999) {
            await Order.insertMany(newOrders);
            console.log(`   Inserted ${i + 1}/1000`);
            newOrders.length = 0; // Clear array
        }
    }

    console.log('\n✅ Successfully added 1000 orders! Refresh the dashboard.');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed error:', err);
    process.exit(1);
});
