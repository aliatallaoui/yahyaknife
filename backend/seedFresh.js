/**
 * Fresh Database Seed — New Architecture
 * Wipes: Orders, Customers, Shipments, CustomOrders
 * Generates: Customers with phones → Orders with shipping details → Some dispatched shipments
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Shipment = require('./models/Shipment');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

// --- Algerian sample data ---
const WILAYAS = [
    { code: '16', name: 'Alger', communes: ['Bab El Oued', 'Hussein Dey', 'El Harrach', 'Sidi M\'hamed', 'Kouba'] },
    { code: '31', name: 'Oran', communes: ['Oran Centre', 'Bir El Djir', 'Es Senia', 'Ain Turk'] },
    { code: '25', name: 'Constantine', communes: ['Constantine Centre', 'El Khroub', 'Ain Abid', 'Didouche Mourad'] },
    { code: '9', name: 'Blida', communes: ['Blida Centre', 'Boufarik', 'Beni Mered', 'Ouled Yaich'] },
    { code: '6', name: 'Béjaïa', communes: ['Béjaïa Centre', 'Akbou', 'El Kseur', 'Amizour'] },
    { code: '15', name: 'Tizi Ouzou', communes: ['Tizi Ouzou Centre', 'Azazga', 'Draa Ben Khedda'] },
    { code: '19', name: 'Sétif', communes: ['Sétif Centre', 'El Eulma', 'Ain Arnat', 'Ain Oulmene'] },
    { code: '5', name: 'Batna', communes: ['Batna Centre', 'Barika', 'Ain Touta'] },
    { code: '23', name: 'Annaba', communes: ['Annaba Centre', 'El Bouni', 'Berrahal'] },
    { code: '2', name: 'Chlef', communes: ['Chlef Centre', 'Ténès', 'El Karimia'] },
];

const CUSTOMER_DATA = [
    { name: 'يحيى بن علي', phone: '0770123456' },
    { name: 'أحمد بوزيد', phone: '0661234567' },
    { name: 'فاطمة الزهراء', phone: '0550987654' },
    { name: 'كريم حمادي', phone: '0790654321' },
    { name: 'نورالدين مسعودي', phone: '0670112233' },
    { name: 'سارة بلقاسم', phone: '0551223344' },
    { name: 'عبدالرحمن خالدي', phone: '0771445566' },
    { name: 'ليلى بن حميدة', phone: '0662556677' },
    { name: 'محمد أمين دريسي', phone: '0553667788' },
    { name: 'هند بوعلام', phone: '0794778899' },
    { name: 'رضا بن يوسف', phone: '0671889900' },
    { name: 'أمينة بن عيسى', phone: '0552990011' },
    { name: 'ياسين بلعربي', phone: '0773001122' },
    { name: 'مريم بوشناق', phone: '0664112233' },
    { name: 'عمر بن سعيد', phone: '0555223344' },
];

const PRODUCT_NAMES = [
    'سكين الشيف الدمشقي',
    'سكين الطاهي الإحترافي',
    'سكين فيليه سمك',
    'سكين المطبخ العربي',
    'سكين الجيب الصغير',
    'سكين الصيد البري',
    'سكين الذبح التقليدي',
    'طقم سكاكين ٣ قطع',
    'سكين خبز مسنن',
    'مبراة سكاكين يدوية',
];

const ADDRESSES = [
    'حي 500 مسكن، عمارة 12، شقة 4',
    'شارع العربي بن مهيدي رقم 45',
    'حي المستقبل، فيلا رقم 8',
    'زنقة الأمير عبدالقادر، 22',
    'حي النصر، بناية B3',
    'شارع 1 نوفمبر',
    'حي 200 مسكن، عمارة 7',
    'المنطقة الصناعية، مخزن 11',
    'حي الزيتون، رقم 36',
    'بلوك C، الطابق 3، شقة 9',
];

const STATUSES = ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');

    // ---- Resolve tenant ----
    const Tenant = require('./models/Tenant');
    let tenant = await Tenant.findOne({ isActive: true });
    if (!tenant) { console.error('No active tenant found. Run setupLocal.js first.'); process.exit(1); }
    console.log('Using tenant:', tenant.name, tenant._id);

    // ---- WIPE ----
    console.log('🗑️  Wiping Orders, Customers, Shipments...');
    await Order.deleteMany({ tenant: tenant._id });
    await Customer.deleteMany({ tenant: tenant._id });
    await Shipment.deleteMany({ tenant: tenant._id });
    console.log('   Done.');

    // ---- Skip product linking, use product names directly ----
    console.log('📦 Using knife product names for orders');

    // ---- CREATE CUSTOMERS ----
    console.log('👥 Creating customers...');
    const customers = [];
    for (const cd of CUSTOMER_DATA) {
        const c = await Customer.create({
            name: cd.name,
            phone: cd.phone,
            acquisitionChannel: rand(['Direct Traffic', 'Social Media', 'Paid Ads', 'Referral']),
            status: 'Active',
            joinDate: new Date(2025, randInt(0, 11), randInt(1, 28)),
            tenant: tenant._id,
        });
        customers.push(c);
    }
    console.log(`   Created ${customers.length} customers`);

    // ---- CREATE ORDERS ----
    console.log('📝 Creating orders...');
    const orders = [];

    // Distribution: more recent orders, variety of statuses
    const statusWeights = [
        { status: 'New', count: 5 },
        { status: 'Confirmed', count: 8 },
        { status: 'Preparing', count: 4 },
        { status: 'Ready for Pickup', count: 3 },
        { status: 'Dispatched', count: 6 },
        { status: 'Out for Delivery', count: 3 },
        { status: 'Delivered', count: 12 },
        { status: 'Paid', count: 5 },
        { status: 'Refused', count: 3 },
        { status: 'Returned', count: 2 },
        { status: 'Cancelled', count: 1 },
    ];

    let orderNum = 1;
    for (const sw of statusWeights) {
        for (let i = 0; i < sw.count; i++) {
            const customer = rand(customers);
            const wilaya = rand(WILAYAS);
            const commune = rand(wilaya.communes);
            const address = rand(ADDRESSES);

            // Pick 1-3 products
            const numProducts = randInt(1, 3);
            const orderProducts = [];
            let totalAmount = 0;

            for (let p = 0; p < numProducts; p++) {
                const pName = rand(PRODUCT_NAMES);
                const qty = randInt(1, 3);
                const price = randInt(1500, 15000);
                orderProducts.push({
                    name: pName,
                    quantity: qty,
                    unitPrice: price,
                });
                totalAmount += price * qty;
            }

            const daysAgo = randInt(0, 60);
            const orderDate = new Date();
            orderDate.setDate(orderDate.getDate() - daysAgo);

            const courierFee = randInt(300, 800);
            const codAmount = totalAmount;

            const order = await Order.create({
                orderId: `ORD-${String(orderNum).padStart(5, '0')}`,
                tenant: tenant._id,
                date: orderDate,
                customer: customer._id,
                products: orderProducts,
                totalAmount,
                wilaya: wilaya.name,
                commune,
                channel: 'Website',
                status: sw.status,
                verificationStatus: ['New'].includes(sw.status) ? 'Pending' : 'Phone Confirmed',
                paymentStatus: ['Paid'].includes(sw.status) ? 'Paid' : ['Delivered'].includes(sw.status) ? 'Pending' : 'Unpaid',
                fulfillmentStatus: ['Delivered', 'Paid'].includes(sw.status) ? 'Fulfilled' : 'Unfulfilled',
                fulfillmentPipeline: ['Delivered', 'Paid'].includes(sw.status) ? 'Delivered' : ['Dispatched', 'Shipped', 'Out for Delivery'].includes(sw.status) ? 'Shipped' : 'Pending',
                financials: {
                    codAmount,
                    courierFee,
                    cogs: Math.round(totalAmount * 0.35),
                    shippingCosts: courierFee,
                },
                shipping: {
                    recipientName: customer.name,
                    phone1: customer.phone,
                    phone2: '',
                    wilayaCode: wilaya.code,
                    wilayaName: wilaya.name,
                    commune,
                    address,
                    weight: randInt(1, 5),
                    fragile: Math.random() > 0.7,
                    deliveryType: Math.random() > 0.8 ? 1 : 0,
                },
                notes: '',
            });

            orders.push(order);
            orderNum++;

            // Update customer stats
            customer.totalOrders += 1;
            customer.lifetimeValue += totalAmount;
            if (['Delivered', 'Paid'].includes(sw.status)) customer.deliveredOrders += 1;
            if (['Refused'].includes(sw.status)) customer.totalRefusals += 1;
            customer.lastOrderDate = orderDate;
        }
    }

    // Save customer stats
    for (const c of customers) {
        c.averageOrderValue = c.totalOrders > 0 ? Math.round(c.lifetimeValue / c.totalOrders) : 0;
        c.deliverySuccessRate = c.totalOrders > 0 ? Math.round((c.deliveredOrders / c.totalOrders) * 100) : 0;
        c.refusalRate = c.totalOrders > 0 ? Math.round((c.totalRefusals / c.totalOrders) * 100) : 0;
        c.isReturning = c.totalOrders > 1;
        c.segment = c.lifetimeValue > 50000 ? 'Whale' : c.lifetimeValue > 20000 ? 'VIP' : c.totalOrders > 1 ? 'Repeat Buyer' : 'One-Time Buyer';
        await c.save();
    }

    console.log(`   Created ${orders.length} orders`);

    // ---- SUMMARY ----
    const statusCounts = {};
    for (const o of orders) {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    console.log('\n📊 Seed Summary:');
    console.log(`   Customers: ${customers.length}`);
    console.log(`   Orders: ${orders.length}`);
    console.log('   Status distribution:');
    for (const [s, c] of Object.entries(statusCounts)) {
        console.log(`     ${s}: ${c}`);
    }

    console.log('\n✅ Seeding complete! Refresh the dashboard.');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed error:', err);
    process.exit(1);
});
