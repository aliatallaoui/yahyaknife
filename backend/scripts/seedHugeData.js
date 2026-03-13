const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { faker } = require('@faker-js/faker');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

// Import Models
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');
const Customer = require('../models/Customer');
const Courier = require('../models/Courier');
const Category = require('../models/Category');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const Revenue = require('../models/Revenue');
const Expense = require('../models/Expense');
const SupportTicket = require('../models/SupportTicket');
const Attendance = require('../models/Attendance');
const Supplier = require('../models/Supplier');
const Warehouse = require('../models/Warehouse');

// Constants for volume
const VOLUMES = {
    SUPPLIER: 15,
    WAREHOUSE: 5,
    CUSTOMER: 500,
    EMPLOYEE: 40,
    COURIER: 20,
    CATEGORY: 15,
    PRODUCT: 200,
    ORDER: 5000,
    REVENUE: 200,
    EXPENSE: 150,
    SUPPORT_TICKET: 80,
    ATTENDANCE_DAYS: 30
};

const BATCH_SIZE = 2000;

// Random Helpers
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (daysBack = 365) => {
    const d = new Date();
    d.setDate(d.getDate() - randomInt(0, daysBack));
    return d;
};
const formatDateStr = (d) => d.toISOString().slice(0, 10);

// Algerian Wilayas & Communes
const WILAYAS = [
    'Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna', 'Djelfa', 'Sétif',
    'Sidi Bel Abbès', 'Biskra', 'Tébessa', 'Tlemcen', 'Béjaïa', 'Tiaret', 'Tizi Ouzou',
    'Médéa', 'Mostaganem', "M'Sila", 'Mascara', 'Ouargla', 'Chlef', 'Saïda', 'Skikda',
    'Jijel', 'Guelma', 'Ghardaïa', 'Relizane', 'El Oued', 'Mila', 'Boumerdès'
];
const COMMUNES = [
    'Bab El Oued', 'Hussein Dey', 'Birkhadem', 'El Harrach', 'Dar El Beida',
    'Kouba', 'Dély Ibrahim', 'Chéraga', 'Aïn Benian', 'Saoula',
    'Bir Mourad Raïs', 'Hydra', 'Draria', 'Bouzaréah', 'Rouiba'
];

const seedHugeData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to Database');

        // 1. Get Super Admin and ensure Tenant exists
        const superAdmin = await User.findOne({ email: 'superadmin@company.com' });
        if (!superAdmin) {
            console.error("❌ Super Admin (superadmin@company.com) not found. Run createSuperAdmin script first.");
            process.exit(1);
        }

        let tenantId = superAdmin.tenant;
        if (!tenantId) {
            const tenant = await Tenant.create({
                name: 'Super Admin Tenant',
                planTier: 'Enterprise',
                settings: { currency: 'DZD', timezone: 'Africa/Algiers' }
            });
            superAdmin.tenant = tenant._id;
            await superAdmin.save();
            tenantId = tenant._id;
            console.log(`📌 Created Tenant: ${tenant._id}`);
        } else {
            console.log(`📌 Using existing Tenant: ${tenantId}`);
        }

        console.time("TotalSeedDuration");

        // ═══════════════════════════════════════════════════════════════
        // 2. SUPPLIERS (shared, no tenant)
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n⏳ Generating ${VOLUMES.SUPPLIER} Suppliers...`);
        const suppliers = Array.from({ length: VOLUMES.SUPPLIER }).map(() => ({
            name: faker.company.name() + ' Supply',
            contactPerson: {
                name: faker.person.fullName(),
                phone: '0' + randomInt(5, 7) + faker.string.numeric(8),
                email: faker.internet.email()
            },
            supplierCategory: randomItem(['General Hardware', 'Packaging', 'Other']),
            materialsSupplied: [faker.commerce.productMaterial(), faker.commerce.productMaterial()],
            address: {
                street: faker.location.streetAddress(),
                city: randomItem(WILAYAS),
                country: 'Algeria'
            },
            performanceMetrics: {
                averageLeadTimeDays: randomInt(3, 21),
                onTimeDeliveryRate: randomInt(70, 100),
                defectRate: randomInt(0, 10),
                reliabilityScore: randomInt(60, 100)
            },
            status: randomItem(['Active', 'Active', 'Active', 'Inactive'])
        }));
        const insertedSuppliers = await Supplier.insertMany(suppliers);
        const supplierIds = insertedSuppliers.map(s => s._id);
        console.log(`✅ ${VOLUMES.SUPPLIER} Suppliers created.`);

        // ═══════════════════════════════════════════════════════════════
        // 3. WAREHOUSES (shared, no tenant)
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n⏳ Generating ${VOLUMES.WAREHOUSE} Warehouses...`);
        const warehouseNames = ['Main Warehouse', 'South Hub', 'East Distribution', 'West Storage', 'North Depot'];
        const warehouses = warehouseNames.slice(0, VOLUMES.WAREHOUSE).map((name, i) => ({
            name,
            code: 'WH-' + (i + 1).toString().padStart(3, '0'),
            location: {
                address: faker.location.streetAddress(),
                city: WILAYAS[i],
                state: WILAYAS[i],
                country: 'Algeria'
            },
            manager: {
                name: faker.person.fullName(),
                phone: '0' + randomInt(5, 7) + faker.string.numeric(8),
                email: faker.internet.email()
            },
            capacity: randomInt(5000, 50000),
            status: 'Active'
        }));
        const insertedWarehouses = await Warehouse.insertMany(warehouses);
        const warehouseIds = insertedWarehouses.map(w => w._id);
        console.log(`✅ ${VOLUMES.WAREHOUSE} Warehouses created.`);

        // ═══════════════════════════════════════════════════════════════
        // 4. EMPLOYEES (tenant-scoped)
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n⏳ Generating ${VOLUMES.EMPLOYEE} Employees...`);
        const departments = ['Operations', 'Warehouse', 'Dispatch', 'Customer Support', 'Sales', 'HR', 'Finance', 'IT'];
        const employees = Array.from({ length: VOLUMES.EMPLOYEE }).map(() => ({
            tenant: tenantId,
            name: faker.person.fullName(),
            email: faker.internet.email().replace('@', `+${randomInt(1, 99999)}@`),
            phone: '0' + randomInt(5, 7) + faker.string.numeric(8),
            role: randomItem(['Support Agent', 'Warehouse Staff', 'Delivery Driver', 'Accountant', 'Manager', 'HR Officer']),
            department: randomItem(departments),
            salary: randomInt(30000, 120000),
            performanceScore: randomInt(50, 100),
            leaveBalance: randomInt(0, 30),
            joinDate: randomDate(730),
            status: randomItem(['Active', 'Active', 'Active', 'On Leave', 'Inactive'])
        }));
        const insertedEmployees = await Employee.insertMany(employees);
        const employeeIds = insertedEmployees.map(e => e._id);
        console.log(`✅ ${VOLUMES.EMPLOYEE} Employees created.`);

        // ═══════════════════════════════════════════════════════════════
        // 5. ATTENDANCE (tenant-scoped, date as String YYYY-MM-DD)
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n⏳ Generating Attendance for ${VOLUMES.ATTENDANCE_DAYS} days...`);
        const attendanceRecords = [];
        for (let day = 0; day < VOLUMES.ATTENDANCE_DAYS; day++) {
            const d = new Date();
            d.setDate(d.getDate() - day);
            const dateStr = formatDateStr(d);
            const dow = d.getDay();
            if (dow === 5 || dow === 6) continue; // Skip Fri/Sat (Algerian weekend)

            for (const empId of employeeIds) {
                if (Math.random() < 0.15) continue; // 15% absence rate
                const morningIn = `0${randomInt(7, 9)}:${randomInt(0, 59).toString().padStart(2, '0')}`;
                const morningOut = `1${randomInt(1, 2)}:${randomInt(0, 59).toString().padStart(2, '0')}`;
                const eveningIn = `1${randomInt(3, 4)}:${randomInt(0, 59).toString().padStart(2, '0')}`;
                const eveningOut = `1${randomInt(6, 8)}:${randomInt(0, 59).toString().padStart(2, '0')}`;
                const workedMinutes = randomInt(360, 540);
                const requiredMinutes = 480;
                const lateMinutes = Math.max(0, randomInt(-10, 30));

                attendanceRecords.push({
                    tenant: tenantId,
                    employeeId: empId,
                    date: dateStr,
                    morningIn, morningOut,
                    eveningIn, eveningOut,
                    workedMinutes,
                    requiredMinutes,
                    lateMinutes,
                    missingMinutes: Math.max(0, requiredMinutes - workedMinutes),
                    overtimeMinutes: Math.max(0, workedMinutes - requiredMinutes),
                    status: lateMinutes > 15 ? 'Late' : (workedMinutes < 120 ? 'Absent' : 'Present')
                });
            }
        }
        for (let i = 0; i < attendanceRecords.length; i += BATCH_SIZE) {
            await Attendance.insertMany(attendanceRecords.slice(i, i + BATCH_SIZE));
        }
        console.log(`✅ ${attendanceRecords.length} Attendance records created.`);

        // ═══════════════════════════════════════════════════════════════
        // 6. COURIERS (tenant-scoped)
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n⏳ Generating ${VOLUMES.COURIER} Couriers...`);
        const courierNames = ['Yalidine', 'ZR Express', 'Maystro', 'Ecotrack', 'Procolis', 'Guepex', 'Alger Express'];
        const couriers = Array.from({ length: VOLUMES.COURIER }).map((_, i) => ({
            tenant: tenantId,
            name: i < courierNames.length ? courierNames[i] : faker.company.name() + ' Delivery',
            phone: '0' + randomInt(5, 7) + faker.string.numeric(8),
            status: randomItem(['Active', 'Active', 'Active', 'Inactive']),
            vehicleType: randomItem(['Motorcycle', 'Van', 'Truck', 'Car']),
            totalDeliveries: randomInt(100, 5000),
            successRate: randomInt(70, 98),
            cashCollected: randomInt(100000, 5000000),
            pendingRemittance: randomInt(10000, 500000)
        }));
        const insertedCouriers = await Courier.insertMany(couriers);
        const courierIds = insertedCouriers.map(c => c._id);
        console.log(`✅ ${VOLUMES.COURIER} Couriers created.`);

        // ═══════════════════════════════════════════════════════════════
        // 7. CATEGORIES (shared, NO tenant) & PRODUCTS + VARIANTS
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n⏳ Generating ${VOLUMES.CATEGORY} Categories and ${VOLUMES.PRODUCT} Products...`);
        const categoryNames = [
            'Electronics', 'Clothing', 'Home & Kitchen', 'Beauty & Health', 'Sports',
            'Bags & Accessories', 'Shoes', 'Toys', 'Books & Stationery', 'Automotive',
            'Phone Accessories', 'Watches', 'Jewellery', 'Food & Beverages', 'Baby & Kids'
        ];
        const categories = categoryNames.slice(0, VOLUMES.CATEGORY).map(name => ({
            name,
            description: faker.commerce.productDescription(),
            isActive: true
        }));
        const insertedCategories = await Category.insertMany(categories);
        const categoryIds = insertedCategories.map(c => c._id);

        const products = Array.from({ length: VOLUMES.PRODUCT }).map(() => ({
            name: faker.commerce.productName(),
            category: randomItem(categoryIds),
            brand: randomItem(['Samsung', 'Nike', 'Adidas', 'Apple', 'Xiaomi', 'Zara', 'H&M', 'Local Brand', 'Condor', 'IRIS']),
            description: faker.commerce.productDescription(),
            supplier: randomItem(supplierIds),
            isActive: true
        }));
        const insertedProducts = await Product.insertMany(products);
        const productIds = insertedProducts.map(p => p._id);

        const variants = productIds.map(productId => {
            const price = randomInt(1000, 25000);
            const cost = Math.round(price * (randomInt(30, 70) / 100));
            return {
                productId,
                sku: faker.string.alphanumeric(8).toUpperCase(),
                price,
                cost,
                totalStock: randomInt(10, 500),
                reservedStock: randomInt(0, 20),
                totalSold: randomInt(0, 200),
                reorderLevel: randomInt(5, 30),
                supplierId: randomItem(supplierIds),
                attributes: {
                    Size: randomItem(['S', 'M', 'L', 'XL', 'One Size']),
                    Color: randomItem(['Black', 'White', 'Red', 'Blue', 'Green', 'Brown'])
                },
                status: 'active'
            };
        });
        const insertedVariants = await ProductVariant.insertMany(variants);
        const variantIds = insertedVariants.map(v => v._id);
        const variantMap = {};
        insertedVariants.forEach(v => { variantMap[v._id.toString()] = v; });
        console.log(`✅ Categories, Products, and Variants created.`);

        // ═══════════════════════════════════════════════════════════════
        // 8. CUSTOMERS (tenant-scoped)
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n⏳ Generating ${VOLUMES.CUSTOMER} Customers...`);
        const customerBatch = Array.from({ length: VOLUMES.CUSTOMER }).map(() => {
            const totalOrders = randomInt(0, 30);
            const deliveredOrders = Math.round(totalOrders * (randomInt(50, 95) / 100));
            const lifetimeValue = totalOrders * randomInt(2000, 8000);
            return {
                tenant: tenantId,
                name: faker.person.fullName(),
                phone: '0' + randomInt(5, 7) + faker.string.numeric(8),
                email: faker.internet.email(),
                acquisitionChannel: randomItem(['Facebook', 'Instagram', 'WhatsApp', 'Referral', 'Website', 'TikTok']),
                status: randomItem(['Active', 'Active', 'Active', 'Churned', 'At Risk']),
                totalOrders,
                deliveredOrders,
                lifetimeValue,
                averageOrderValue: totalOrders > 0 ? Math.round(lifetimeValue / totalOrders) : 0,
                segment: randomItem(['VIP', 'Regular', 'New', 'At Risk']),
                trustScore: randomInt(30, 100),
                deliverySuccessRate: deliveredOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
                lastOrderDate: randomDate(90)
            };
        });
        const insertedCustomers = await Customer.insertMany(customerBatch);
        const customerIds = insertedCustomers.map(c => c._id);
        console.log(`✅ ${VOLUMES.CUSTOMER} Customers created.`);

        // ═══════════════════════════════════════════════════════════════
        // 9. ORDERS & SHIPMENTS
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n🚀 Generating ${VOLUMES.ORDER.toLocaleString()} Orders...`);
        const STATUSES = ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'];
        const CHANNELS = ['Facebook', 'WhatsApp', 'Instagram', 'Shopify', 'Website', 'TikTok'];

        let insertedOrderCount = 0;
        let insertedShipmentCount = 0;
        const orderIds = [];

        for (let i = 0; i < VOLUMES.ORDER; i += BATCH_SIZE) {
            const orderBatch = [];
            const currentBatchSize = Math.min(BATCH_SIZE, VOLUMES.ORDER - i);

            for (let j = 0; j < currentBatchSize; j++) {
                const globalIndex = i + j;
                const status = randomItem(STATUSES);
                const variantId = randomItem(variantIds);
                const variant = variantMap[variantId.toString()];
                const qty = randomInt(1, 4);
                const unitPrice = variant ? variant.price : randomInt(2000, 15000);
                const subtotal = unitPrice * qty;
                const discount = Math.random() < 0.2 ? randomInt(100, 500) : 0;
                const deliveryFee = randomInt(300, 1200);
                const finalTotal = subtotal - discount;
                const cost = variant ? variant.cost * qty : Math.round(subtotal * 0.4);
                const date = randomDate(365);
                const wilaya = randomItem(WILAYAS);
                const commune = randomItem(COMMUNES);

                orderBatch.push({
                    tenant: tenantId,
                    orderId: 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + globalIndex,
                    date,
                    customer: randomItem(customerIds),
                    totalAmount: finalTotal,
                    subtotal,
                    discount,
                    finalTotal,
                    amountToCollect: finalTotal + deliveryFee,
                    wilaya,
                    commune,
                    channel: randomItem(CHANNELS),
                    status,
                    verificationStatus: randomItem(['Pending', 'Verified', 'Verified', 'Verified']),
                    paymentStatus: ['Delivered', 'Paid'].includes(status) ? 'Paid' : 'Unpaid',
                    courier: randomItem(courierIds),
                    priority: randomItem(['Normal', 'Normal', 'Normal', 'High', 'Urgent']),
                    products: [{
                        variantId,
                        name: variant ? `Product ${globalIndex}` : 'Mock Product',
                        quantity: qty,
                        unitPrice
                    }],
                    shipping: {
                        recipientName: faker.person.fullName(),
                        phone1: '0' + randomInt(5, 7) + faker.string.numeric(8),
                        phone2: Math.random() < 0.3 ? '0' + randomInt(5, 7) + faker.string.numeric(8) : undefined,
                        address: `${randomInt(1, 200)} ${faker.location.street()}, ${commune}, ${wilaya}`,
                        wilaya,
                        commune
                    },
                    financials: {
                        subtotal,
                        discount,
                        deliveryFee,
                        totalCOD: finalTotal + deliveryFee,
                        productCost: cost,
                        netProfit: finalTotal - cost - deliveryFee
                    },
                    notes: Math.random() < 0.1 ? faker.lorem.sentence() : undefined
                });
            }

            const insertedOrdersInBatch = await Order.insertMany(orderBatch);
            insertedOrderCount += insertedOrdersInBatch.length;
            orderIds.push(...insertedOrdersInBatch.map(o => o._id));

            // Shipments for post-dispatch orders
            const shipmentBatch = insertedOrdersInBatch
                .filter(o => ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned'].includes(o.status))
                .map(o => {
                    let shipmentStatus = 'In Transit';
                    if (['Delivered', 'Paid'].includes(o.status)) shipmentStatus = 'Delivered';
                    else if (o.status === 'Out for Delivery') shipmentStatus = 'Out for Delivery';
                    else if (['Refused', 'Returned'].includes(o.status)) shipmentStatus = 'Returned to Sender';

                    return {
                        tenant: tenantId,
                        internalOrder: o._id,
                        internalOrderId: o.orderId,
                        courierProvider: randomItem(['ECOTRACK', 'YALIDINE', 'ZR_EXPRESS']),
                        externalTrackingId: 'TRK-' + faker.string.alphanumeric(12).toUpperCase(),
                        customerName: o.shipping?.recipientName || 'Customer',
                        phone1: o.shipping?.phone1 || '0500000000',
                        address: o.shipping?.address || 'Address',
                        commune: o.commune,
                        wilayaName: o.wilaya,
                        productName: o.products[0]?.name || 'Product',
                        quantity: o.products[0]?.quantity || 1,
                        operationType: 1,
                        deliveryType: randomItem([0, 0, 0, 1]),
                        codAmount: o.totalAmount,
                        courierFee: randomInt(300, 1000),
                        shipmentStatus,
                        paymentStatus: o.status === 'Paid' ? 'Paid_and_Settled' : 'COD_Expected',
                        dispatchDate: o.date,
                        deliveredDate: ['Delivered', 'Paid'].includes(o.status) ? new Date(o.date.getTime() + randomInt(1, 7) * 86400000) : undefined
                    };
                });

            if (shipmentBatch.length > 0) {
                const insertedShipmentsInBatch = await Shipment.insertMany(shipmentBatch);
                insertedShipmentCount += insertedShipmentsInBatch.length;
            }

            const progress = ((insertedOrderCount / VOLUMES.ORDER) * 100).toFixed(1);
            console.log(`📦 Orders: ${insertedOrderCount.toLocaleString()} / ${VOLUMES.ORDER.toLocaleString()} (${progress}%)`);
        }
        console.log(`✅ ${insertedOrderCount} Orders + ${insertedShipmentCount} Shipments created.`);

        // ═══════════════════════════════════════════════════════════════
        // 10. REVENUE (tenant-scoped)
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n⏳ Generating ${VOLUMES.REVENUE} Revenue entries...`);
        const revenueRecords = Array.from({ length: VOLUMES.REVENUE }).map(() => ({
            tenant: tenantId,
            date: randomDate(365),
            amount: randomInt(5000, 500000),
            source: randomItem(['Product Sales', 'Service Revenue', 'Other']),
            description: faker.finance.transactionDescription()
        }));
        await Revenue.insertMany(revenueRecords);
        console.log(`✅ ${VOLUMES.REVENUE} Revenue entries created.`);

        // ═══════════════════════════════════════════════════════════════
        // 11. EXPENSES (tenant-scoped)
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n⏳ Generating ${VOLUMES.EXPENSE} Expense entries...`);
        const expenseRecords = Array.from({ length: VOLUMES.EXPENSE }).map(() => ({
            tenant: tenantId,
            date: randomDate(365),
            amount: randomInt(1000, 200000),
            category: randomItem(['Marketing', 'Operations', 'Human Resources', 'Infrastructure', 'Equipment', 'Utilities', 'Rent', 'Other']),
            description: faker.finance.transactionDescription()
        }));
        await Expense.insertMany(expenseRecords);
        console.log(`✅ ${VOLUMES.EXPENSE} Expenses created.`);

        // ═══════════════════════════════════════════════════════════════
        // 12. SUPPORT TICKETS (tenant-scoped)
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n⏳ Generating ${VOLUMES.SUPPORT_TICKET} Support Tickets...`);
        const ticketTypes = ['General Inquiry', 'Shipping Issue', 'Product Defect', 'RMA Request'];
        const ticketStatuses = ['Open', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'];
        const ticketPriorities = ['Low', 'Medium', 'High', 'Urgent'];

        const tickets = Array.from({ length: VOLUMES.SUPPORT_TICKET }).map((_, i) => {
            const status = randomItem(ticketStatuses);
            return {
                tenant: tenantId,
                ticketNumber: `TKT-2026${(randomInt(1, 12)).toString().padStart(2, '0')}-${(i + 1).toString().padStart(4, '0')}`,
                customerId: randomItem(customerIds),
                orderId: Math.random() < 0.6 ? randomItem(orderIds.slice(0, Math.min(orderIds.length, 500))) : undefined,
                subject: randomItem([
                    'Order not received', 'Wrong item delivered', 'Request refund',
                    'Damaged package', 'Change delivery address', 'Cancel my order',
                    'Product quality issue', 'Missing items in package'
                ]),
                type: randomItem(ticketTypes),
                status,
                priority: randomItem(ticketPriorities),
                messages: [{
                    sender: 'Customer',
                    message: faker.lorem.paragraph(),
                    timestamp: randomDate(30)
                }],
                resolutionNotes: ['Resolved', 'Closed'].includes(status) ? faker.lorem.sentence() : undefined,
                resolvedAt: status === 'Resolved' ? randomDate(10) : undefined,
                closedAt: status === 'Closed' ? randomDate(5) : undefined
            };
        });
        await SupportTicket.insertMany(tickets);
        console.log(`✅ ${VOLUMES.SUPPORT_TICKET} Support Tickets created.`);

        // ═══════════════════════════════════════════════════════════════
        // SUMMARY
        // ═══════════════════════════════════════════════════════════════
        console.timeEnd("TotalSeedDuration");
        console.log(`
🎉 ══════════════════════════════════════════════
   SEED COMPLETE — Summary
   ──────────────────────────────────────────────
   Suppliers:        ${VOLUMES.SUPPLIER}
   Warehouses:       ${VOLUMES.WAREHOUSE}
   Employees:        ${VOLUMES.EMPLOYEE}
   Attendance:       ${attendanceRecords.length}
   Couriers:         ${VOLUMES.COURIER}
   Categories:       ${VOLUMES.CATEGORY}
   Products:         ${VOLUMES.PRODUCT} (+ variants)
   Customers:        ${VOLUMES.CUSTOMER}
   Orders:           ${insertedOrderCount}
   Shipments:        ${insertedShipmentCount}
   Revenue entries:  ${VOLUMES.REVENUE}
   Expenses:         ${VOLUMES.EXPENSE}
   Support Tickets:  ${VOLUMES.SUPPORT_TICKET}
══════════════════════════════════════════════════
`);
        process.exit(0);

    } catch (err) {
        console.error("❌ Fatal Error:", err);
        process.exit(1);
    }
};

seedHugeData();
