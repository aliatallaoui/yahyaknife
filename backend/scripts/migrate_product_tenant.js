/**
 * migrate_product_tenant.js
 *
 * Backfill the `tenant` field on Product, ProductVariant, and Category documents
 * that were created before the multi-tenant scoping was added.
 *
 * Strategy:
 *   - If exactly 1 tenant exists → assign all orphan docs to it.
 *   - If multiple tenants exist → abort with instructions.
 *
 * Usage:  node scripts/migrate_product_tenant.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const Category = require('../models/Category');
const Tenant = require('../models/Tenant');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const tenants = await Tenant.find({ isActive: true }).select('_id name').lean();
    console.log(`Found ${tenants.length} active tenant(s)`);

    if (tenants.length === 0) {
        console.log('No tenants found. Nothing to migrate.');
        process.exit(0);
    }

    if (tenants.length > 1) {
        console.log('Multiple tenants found. Cannot auto-assign.');
        console.log('Tenants:', tenants.map(t => `${t._id} — ${t.name}`).join('\n  '));
        console.log('\nPlease run manually:');
        console.log('  Product.updateMany({ tenant: null }, { $set: { tenant: "<TENANT_ID>" } })');
        console.log('  ProductVariant.updateMany({ tenant: null }, { $set: { tenant: "<TENANT_ID>" } })');
        console.log('  Category.updateMany({ tenant: null }, { $set: { tenant: "<TENANT_ID>" } })');
        process.exit(1);
    }

    const tenantId = tenants[0]._id;
    console.log(`Single tenant: ${tenants[0].name} (${tenantId})`);

    // Backfill Product
    const productResult = await Product.updateMany(
        { $or: [{ tenant: null }, { tenant: { $exists: false } }] },
        { $set: { tenant: tenantId } }
    );
    console.log(`Products updated: ${productResult.modifiedCount}`);

    // Backfill ProductVariant
    const variantResult = await ProductVariant.updateMany(
        { $or: [{ tenant: null }, { tenant: { $exists: false } }] },
        { $set: { tenant: tenantId } }
    );
    console.log(`ProductVariants updated: ${variantResult.modifiedCount}`);

    // Backfill Category
    const categoryResult = await Category.updateMany(
        { $or: [{ tenant: null }, { tenant: { $exists: false } }] },
        { $set: { tenant: tenantId } }
    );
    console.log(`Categories updated: ${categoryResult.modifiedCount}`);

    console.log('\nMigration complete.');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
