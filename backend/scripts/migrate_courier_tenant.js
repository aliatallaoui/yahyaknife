/**
 * Migration: Add tenant field to CourierCoverage and CourierPricing documents.
 *
 * Strategy:
 *   - For each document without a tenant field, look up the parent Courier
 *     to find which tenant owns it, then stamp the document with that tenant.
 *   - Documents whose parent courier no longer exists are orphans and get deleted.
 *
 * Usage:
 *   node backend/scripts/migrate_courier_tenant.js
 *
 * Safe to run multiple times (idempotent).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Courier = require('../models/Courier');
const CourierCoverage = require('../models/CourierCoverage');
const CourierPricing = require('../models/CourierPricing');

async function migrate() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Build courier → tenant lookup
    const couriers = await Courier.find({}, '_id tenant').lean();
    const courierTenantMap = {};
    for (const c of couriers) {
        if (c.tenant) courierTenantMap[c._id.toString()] = c.tenant;
    }
    console.log(`Found ${couriers.length} couriers`);

    // --- CourierCoverage ---
    const coverageDocs = await CourierCoverage.find({ tenant: { $exists: false } }).lean();
    console.log(`CourierCoverage docs without tenant: ${coverageDocs.length}`);

    let covUpdated = 0, covOrphaned = 0;
    const covOps = [];
    for (const doc of coverageDocs) {
        const tenant = courierTenantMap[doc.courierId?.toString()];
        if (tenant) {
            covOps.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: { tenant } }
                }
            });
            covUpdated++;
        } else {
            covOps.push({ deleteOne: { filter: { _id: doc._id } } });
            covOrphaned++;
        }
    }
    if (covOps.length > 0) await CourierCoverage.bulkWrite(covOps);
    console.log(`CourierCoverage: ${covUpdated} updated, ${covOrphaned} orphans deleted`);

    // --- CourierPricing ---
    const pricingDocs = await CourierPricing.find({ tenant: { $exists: false } }).lean();
    console.log(`CourierPricing docs without tenant: ${pricingDocs.length}`);

    let prUpdated = 0, prOrphaned = 0;
    const prOps = [];
    for (const doc of pricingDocs) {
        const tenant = courierTenantMap[doc.courierId?.toString()];
        if (tenant) {
            prOps.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: { tenant } }
                }
            });
            prUpdated++;
        } else {
            prOps.push({ deleteOne: { filter: { _id: doc._id } } });
            prOrphaned++;
        }
    }
    if (prOps.length > 0) await CourierPricing.bulkWrite(prOps);
    console.log(`CourierPricing: ${prUpdated} updated, ${prOrphaned} orphans deleted`);

    // Drop old non-tenant unique index on CourierCoverage if it exists
    try {
        const indexes = await CourierCoverage.collection.indexes();
        const oldIndex = indexes.find(i =>
            i.key?.courierId === 1 && i.key?.wilayaCode === 1 && i.key?.commune === 1 && !i.key?.tenant
        );
        if (oldIndex) {
            await CourierCoverage.collection.dropIndex(oldIndex.name);
            console.log(`Dropped old unique index: ${oldIndex.name}`);
        }
    } catch (err) {
        console.log('Index cleanup skipped:', err.message);
    }

    console.log('Migration complete');
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
