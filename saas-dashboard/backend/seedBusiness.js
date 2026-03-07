require('dotenv').config();
const mongoose = require('mongoose');
const Expense = require('./models/Expense');
const Revenue = require('./models/Revenue');
const Product = require('./models/Product');
const ProductVariant = require('./models/ProductVariant');
const Category = require('./models/Category');
const Supplier = require('./models/Supplier');
const Order = require('./models/Order');
const Customer = require('./models/Customer');
const Feedback = require('./models/Feedback');
const Employee = require('./models/Employee');
const LeaveRequest = require('./models/LeaveRequest');
const Project = require('./models/Project');
const Task = require('./models/Task');
const Milestone = require('./models/Milestone');
const RawMaterial = require('./models/RawMaterial');
const BillOfMaterial = require('./models/BillOfMaterial');
const ProductionOrder = require('./models/ProductionOrder');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected for Full Platform Seeding.');

        // 0. Clear existing data
        await Promise.all([
            Expense.deleteMany(), Revenue.deleteMany(), Product.deleteMany(),
            ProductVariant.deleteMany(), Category.deleteMany(), Supplier.deleteMany(),
            Order.deleteMany(), Customer.deleteMany(), Feedback.deleteMany(),
            Employee.deleteMany(), LeaveRequest.deleteMany(), Project.deleteMany(),
            Task.deleteMany(), Milestone.deleteMany(), RawMaterial.deleteMany(),
            BillOfMaterial.deleteMany(), ProductionOrder.deleteMany()
        ]);

        // 1. Suppliers
        const suppliers = await Supplier.insertMany([
            { name: 'Acme Corp Materials', contactPerson: 'John Smith', email: 'john@acme.com', phone: '555-0100', address: '123 Factory Row' },
            { name: 'Globex Logistics & Supply', contactPerson: 'Jane Doe', email: 'jane@globex.com', phone: '555-0200', address: '456 Warehouse Blvd' },
        ]);

        // 2. Categories
        const categories = await Category.insertMany([
            { name: 'Widgets', description: 'Standard utility items' },
            { name: 'Hardware', description: 'Nuts, bolts, and cogs' }
        ]);

        // 3. Products
        const products = await Product.insertMany([
            { name: 'Premium Widget A', brand: 'Acme', description: 'High quality widget', category: categories[0]._id, supplier: suppliers[0]._id },
            { name: 'Standard Widget B', brand: 'Acme', description: 'Standard widget', category: categories[0]._id, supplier: suppliers[0]._id },
            { name: 'Industrial Cog', brand: 'Globex', description: 'Heavy duty cog', category: categories[1]._id, supplier: suppliers[1]._id },
            { name: 'Basic Fastener Array', brand: 'Globex', description: 'Hardware fasteners', category: categories[1]._id, supplier: suppliers[1]._id },
        ]);

        // 4. Product Variants
        const variants = await ProductVariant.insertMany([
            { productId: products[0]._id, sku: 'PRM-W-01-RED', attributes: { Color: 'Red' }, price: 120, cost: 45, totalStock: 1250, reorderLevel: 500 },
            { productId: products[0]._id, sku: 'PRM-W-01-BLU', attributes: { Color: 'Blue' }, price: 120, cost: 45, totalStock: 1250, reorderLevel: 500 },
            { productId: products[1]._id, sku: 'STD-W-02-DEF', attributes: { Type: 'Default' }, price: 65, cost: 20, totalStock: 8000, reorderLevel: 1000 },
            { productId: products[2]._id, sku: 'IND-C-01-HVY', attributes: { Weight: 'Heavy' }, price: 210, cost: 85, totalStock: 1200, reorderLevel: 300 },
            { productId: products[3]._id, sku: 'BSC-F-12-SML', attributes: { Size: 'Small' }, price: 15, cost: 4, totalStock: 450, reorderLevel: 500 },
        ]);

        // 5. Customers
        const customers = [];
        const acquisitionChannels = ['Organic Search', 'Direct Traffic', 'Social Media', 'Referral', 'Paid Ads', 'Other'];
        const customerStatuses = ['Active', 'Active', 'Active', 'Inactive', 'Churned'];

        for (let i = 1; i <= 50; i++) {
            const joinDate = new Date();
            joinDate.setDate(joinDate.getDate() - Math.floor(Math.random() * 365));
            customers.push({
                name: `Client User ${i}`,
                email: `client${i}@example.com`,
                joinDate,
                acquisitionChannel: acquisitionChannels[Math.floor(Math.random() * acquisitionChannels.length)],
                status: customerStatuses[Math.floor(Math.random() * customerStatuses.length)],
                isReturning: Math.random() > 0.4
            });
        }
        const insertedCustomers = await Customer.insertMany(customers);

        // 6. Orders (Linked to Customers and Variants)
        const orders = [];
        const channels = ['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website'];
        const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

        for (let i = 1; i <= 150; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));
            const randomCustomer = insertedCustomers[Math.floor(Math.random() * insertedCustomers.length)];

            const numItems = Math.floor(Math.random() * 3) + 1;
            const orderProducts = [];
            let totalAmount = 0;

            for (let j = 0; j < numItems; j++) {
                const variant = variants[Math.floor(Math.random() * variants.length)];
                const qty = Math.floor(Math.random() * 5) + 1;
                orderProducts.push({
                    productId: variant.productId,
                    quantity: qty,
                    unitPrice: variant.price
                });
                totalAmount += (variant.price * qty);
            }

            orders.push({
                orderId: `ORD-${20000 + i}`,
                date,
                customer: randomCustomer._id,
                customerName: randomCustomer.name, // denormalized for easy listing
                products: orderProducts,
                totalAmount,
                channel: channels[Math.floor(Math.random() * channels.length)],
                status: statuses[Math.floor(Math.random() * statuses.length)]
            });
        }
        await Order.insertMany(orders);

        // 7. Finance (Expenses & Revenue)
        const expenses = [];
        const expenseCats = ['Marketing', 'Operations', 'Human Resources', 'Infrastructure', 'Equipment', 'Utilities', 'Rent', 'Other'];
        for (let i = 0; i < 50; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));
            expenses.push({
                date,
                amount: Math.floor(Math.random() * 5000) + 100,
                category: expenseCats[Math.floor(Math.random() * expenseCats.length)],
                description: `Auto-generated expense ${i}`
            });
        }
        expenses.push({ date: new Date(), amount: 25000, category: 'Rent', description: 'Monthly HQ Rent' });
        expenses.push({ date: new Date(), amount: 65000, category: 'Human Resources', description: 'Monthly Payroll' });
        await Expense.insertMany(expenses);

        const revenues = [];
        const revSources = ['Product Sales', 'Service Revenue', 'Subscription Income'];
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));
            revenues.push({
                date,
                amount: Math.floor(Math.random() * 15000) + 500,
                source: revSources[Math.floor(Math.random() * revSources.length)],
                description: `Auto-generated revenue ${i}`
            });
        }
        await Revenue.insertMany(revenues);

        // 8. Other DB entries (Feedback, Employees, Projects, Manufacturing)
        console.log('Building remaining peripheral relationships...');
        // Skipping HR/Projects/Manufacturing bulk for brevity as they are decoupled right now and don't affect Core CRM/Inventory APIs directly, but can easily be added back if needed by the views. To ensure the views don't break, I'll add minimal HR/Mfg data.

        const employees = await Employee.insertMany([
            { name: 'Staff A', email: 'a@company.com', department: 'Engineering', role: 'Software Engineer', salary: 75000, joinDate: new Date(), status: 'Active' },
            { name: 'Staff B', email: 'b@company.com', department: 'HR', role: 'Manager', salary: 85000, joinDate: new Date(), status: 'Active' }
        ]);

        const rawMaterials = await RawMaterial.insertMany([
            { name: 'Steel', sku: 'RM-STL-001', category: 'Metal', costPerUnit: 12.50, unitOfMeasure: 'meters', stockLevel: 250, minimumStock: 50, supplier: suppliers[0]._id },
            { name: 'Plastic', sku: 'RM-PLA-001', category: 'Plastic', costPerUnit: 4.10, unitOfMeasure: 'units', stockLevel: 500, minimumStock: 100, supplier: suppliers[1]._id }
        ]);

        console.log('Platform Data Synchronized and Seeded Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding business database:', error);
        process.exit(1);
    }
};

seedData();
