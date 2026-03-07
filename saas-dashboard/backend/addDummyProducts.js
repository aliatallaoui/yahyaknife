require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Supplier = require('./models/Supplier');
const Product = require('./models/Product');
const ProductVariant = require('./models/ProductVariant');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const seedProducts = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB. Starting product seed...');

        // 1. Create Categories
        const catElectronics = await Category.findOneAndUpdate(
            { name: 'Electronics' },
            { name: 'Electronics', description: 'Gadgets and devices' },
            { upsert: true, new: true }
        );

        const catApparel = await Category.findOneAndUpdate(
            { name: 'Apparel' },
            { name: 'Apparel', description: 'Clothing and accessories' },
            { upsert: true, new: true }
        );

        // 2. Create Suppliers
        const suppTech = await Supplier.findOneAndUpdate(
            { name: 'Global Tech Supplies' },
            { name: 'Global Tech Supplies', contactPerson: 'Alice', email: 'alice@tech.com', phone: '555-0001' },
            { upsert: true, new: true }
        );

        const suppFashion = await Supplier.findOneAndUpdate(
            { name: 'Trendy Textiles' },
            { name: 'Trendy Textiles', contactPerson: 'Bob', email: 'bob@trendy.com', phone: '555-0002' },
            { upsert: true, new: true }
        );

        // 3. Dummy Products Data
        const productsData = [
            {
                name: 'Wireless Noise-Canceling Headphones',
                brand: 'AudioMax',
                description: 'Over-ear headphones with active noise cancellation and 30-hour battery life.',
                category: catElectronics._id,
                supplier: suppTech._id,
                variants: [
                    { sku: 'AM-WH-BLK', attributes: { Color: 'Black' }, price: 299, cost: 150, stock: 120, reorderLevel: 20 },
                    { sku: 'AM-WH-SLV', attributes: { Color: 'Silver' }, price: 299, cost: 150, stock: 85, reorderLevel: 20 }
                ]
            },
            {
                name: 'Ergonomic Office Chair',
                brand: 'ComfortFurn',
                description: 'Adjustable mesh office chair with lumbar support.',
                category: catElectronics._id, // Reusing category for simplicity
                supplier: suppTech._id,
                variants: [
                    { sku: 'CF-EC-GRY', attributes: { Color: 'Grey' }, price: 199, cost: 85, stock: 45, reorderLevel: 10 },
                    { sku: 'CF-EC-BLK', attributes: { Color: 'Black' }, price: 199, cost: 85, stock: 60, reorderLevel: 10 }
                ]
            },
            {
                name: 'Premium Cotton T-Shirt',
                brand: 'Basics+',
                description: 'Pre-shrunk 100% organic cotton t-shirt.',
                category: catApparel._id,
                supplier: suppFashion._id,
                variants: [
                    { sku: 'TS-COT-S-WHT', attributes: { Size: 'S', Color: 'White' }, price: 25, cost: 8, stock: 200, reorderLevel: 50 },
                    { sku: 'TS-COT-M-WHT', attributes: { Size: 'M', Color: 'White' }, price: 25, cost: 8, stock: 350, reorderLevel: 50 },
                    { sku: 'TS-COT-L-WHT', attributes: { Size: 'L', Color: 'White' }, price: 25, cost: 8, stock: 150, reorderLevel: 50 },
                    { sku: 'TS-COT-S-BLK', attributes: { Size: 'S', Color: 'Black' }, price: 25, cost: 8, stock: 180, reorderLevel: 50 },
                    { sku: 'TS-COT-M-BLK', attributes: { Size: 'M', Color: 'Black' }, price: 25, cost: 8, stock: 300, reorderLevel: 50 }
                ]
            }
        ];

        // 4. Insert Products and Variants
        for (const p of productsData) {
            // Check if product exists to avoid duplicates if run multiple times
            let product = await Product.findOne({ name: p.name });
            if (!product) {
                product = await Product.create({
                    name: p.name,
                    category: p.category,
                    brand: p.brand,
                    description: p.description,
                    supplier: p.supplier
                });

                // Create variants
                for (const v of p.variants) {
                    await ProductVariant.create({
                        productId: product._id,
                        sku: v.sku,
                        attributes: v.attributes,
                        price: v.price,
                        cost: v.cost,
                        totalStock: v.stock,
                        reorderLevel: v.reorderLevel
                    });
                }
                console.log(`Created product: ${p.name} with ${p.variants.length} variants.`);
            } else {
                console.log(`Product ${p.name} already exists. Skipping.`);
            }
        }

        console.log('Dummy products seeded successfully!');
        process.exit(0);

    } catch (err) {
        console.error('Error seeding products:', err);
        process.exit(1);
    }
};

seedProducts();

