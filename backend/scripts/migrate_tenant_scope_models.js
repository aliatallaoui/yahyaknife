/**
 * Migration: Add tenant field to Supplier, PurchaseOrder, Warehouse, ReorderAlert
 *
 * This script:
 * 1. Drops the old unique index on PurchaseOrder.poNumber (now compound with tenant)
 * 2. Drops the old unique index on Warehouse.code (now compound with tenant)
 * 3. Drops the old unique index on CourierSetting.providerName (now compound with tenant)
 * 4. Backfills tenant field on existing documents from the first active tenant
 *
 * Usage: node scripts/migrate_tenant_scope_models.js
 *
 * IMPORTANT: Run this ONCE after deploying the model changes.
 * For multi-tenant deployments with existing data, you may need to manually
 * assign the correct tenant to each document based on your business logic.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Drop old unique indexes
    try {
        const poIndexes = await db.collection('purchaseorders').indexes();
        const poUniqueIdx = poIndexes.find(i => i.key?.poNumber && i.unique);
        if (poUniqueIdx) {
            await db.collection('purchaseorders').dropIndex(poUniqueIdx.name);
            console.log('✓ Dropped old unique index on PurchaseOrder.poNumber');
        } else {
            console.log('- No old unique poNumber index found (already migrated or never existed)');
        }
    } catch (e) {
        console.log('- PurchaseOrder index drop skipped:', e.message);
    }

    try {
        const whIndexes = await db.collection('warehouses').indexes();
        const whUniqueIdx = whIndexes.find(i => i.key?.code && i.unique);
        if (whUniqueIdx) {
            await db.collection('warehouses').dropIndex(whUniqueIdx.name);
            console.log('✓ Dropped old unique index on Warehouse.code');
        } else {
            console.log('- No old unique code index found (already migrated or never existed)');
        }
    } catch (e) {
        console.log('- Warehouse index drop skipped:', e.message);
    }

    try {
        const csIndexes = await db.collection('couriersettings').indexes();
        const csUniqueIdx = csIndexes.find(i => i.key?.providerName && i.unique);
        if (csUniqueIdx) {
            await db.collection('couriersettings').dropIndex(csUniqueIdx.name);
            console.log('✓ Dropped old unique index on CourierSetting.providerName');
        } else {
            console.log('- No old unique providerName index found (already migrated or never existed)');
        }
    } catch (e) {
        console.log('- CourierSetting index drop skipped:', e.message);
    }

    // 2. Backfill tenant on documents that don't have one
    const Tenant = require('../models/Tenant');
    const firstTenant = await Tenant.findOne({ isActive: true }).select('_id').lean();

    if (!firstTenant) {
        console.log('No active tenant found — skipping backfill');
    } else {
        const tenantId = firstTenant._id;
        console.log(`Using tenant ${tenantId} for backfill`);

        for (const collName of ['suppliers', 'purchaseorders', 'warehouses', 'reorderalerts', 'couriersettings', 'stockmovementledgers']) {
            const result = await db.collection(collName).updateMany(
                { tenant: { $exists: false } },
                { $set: { tenant: tenantId } }
            );
            console.log(`✓ ${collName}: backfilled ${result.modifiedCount} documents`);
        }
    }

    // 3. Drop old non-tenant indexes and let Mongoose recreate tenant-scoped ones
    try {
        // Old supplier indexes
        await db.collection('suppliers').dropIndex('status_1').catch(() => {});
        await db.collection('suppliers').dropIndex('name_1').catch(() => {});
        console.log('✓ Dropped old Supplier indexes');
    } catch (e) { /* already dropped */ }

    console.log('\nMigration complete. Restart the server to create new compound indexes.');
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
