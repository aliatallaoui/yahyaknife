#!/usr/bin/env node
/**
 * Cleanup & Migrate Script for Atlas
 *
 * What it does:
 *   1. Drops order-related collections (Order, OrderItem, OrderNote, OrderStatusHistory, Shipment)
 *   2. Drops stale analytics (DailyRollup, WeeklyReport, MonthlyReport, KPISnapshot)
 *   3. Resets courier settlements & financials (CourierSettlement, Revenue, Expense)
 *   4. Resets inventory ledgers (InventoryLedger, StockMovementLedger, ReorderAlert)
 *   5. Resets product stock counters to 0 (keeps catalog)
 *   6. Resets courier cash counters to 0 (keeps courier configs)
 *   7. Resets customer order stats (keeps customer records)
 *   8. Runs tenant-scoping migrations for newly scoped models
 *   9. KEEPS: HR, Auth/Tenant, Products, Categories, Suppliers, Warehouses, Couriers, etc.
 *
 * Usage:
 *   node scripts/cleanupAndMigrate.js              (dry-run by default)
 *   node scripts/cleanupAndMigrate.js --execute    (actually run)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const ATLAS_URI = process.env.ATLAS_MONGO_URI;
const DRY_RUN = !process.argv.includes('--execute');

async function main() {
    if (!ATLAS_URI) {
        console.error('❌ ATLAS_MONGO_URI not set in .env');
        process.exit(1);
    }

    console.log(`\n🔗 Connecting to Atlas...`);
    console.log(DRY_RUN ? '⚠️  DRY RUN — no changes will be made. Use --execute to apply.\n' : '🔴 LIVE RUN — changes WILL be applied.\n');

    await mongoose.connect(ATLAS_URI);
    const db = mongoose.connection.db;

    // ─── 1. DROP ORDER-RELATED COLLECTIONS ─────────────────────────────────
    const orderCollections = ['orders', 'orderitems', 'ordernotes', 'orderstatushistories', 'shipments'];
    for (const col of orderCollections) {
        const exists = await db.listCollections({ name: col }).hasNext();
        if (exists) {
            const count = await db.collection(col).countDocuments();
            console.log(`🗑️  Drop ${col} (${count} docs)`);
            if (!DRY_RUN) await db.collection(col).drop();
        } else {
            console.log(`⏭️  ${col} — doesn't exist, skip`);
        }
    }

    // ─── 2. DROP STALE ANALYTICS ───────────────────────────────────────────
    const analyticsCollections = ['dailyrollups', 'weeklyreports', 'monthlyreports', 'kpisnapshots'];
    for (const col of analyticsCollections) {
        const exists = await db.listCollections({ name: col }).hasNext();
        if (exists) {
            const count = await db.collection(col).countDocuments();
            console.log(`🗑️  Drop ${col} (${count} docs)`);
            if (!DRY_RUN) await db.collection(col).drop();
        } else {
            console.log(`⏭️  ${col} — doesn't exist, skip`);
        }
    }

    // ─── 3. DROP FINANCE COLLECTIONS ───────────────────────────────────────
    const financeCollections = ['couriersettlements', 'revenues', 'expenses'];
    for (const col of financeCollections) {
        const exists = await db.listCollections({ name: col }).hasNext();
        if (exists) {
            const count = await db.collection(col).countDocuments();
            console.log(`🗑️  Drop ${col} (${count} docs)`);
            if (!DRY_RUN) await db.collection(col).drop();
        } else {
            console.log(`⏭️  ${col} — doesn't exist, skip`);
        }
    }

    // ─── 4. DROP INVENTORY LEDGERS & ALERTS ────────────────────────────────
    const ledgerCollections = ['inventoryledgers', 'stockmovementledgers', 'reorderalerts'];
    for (const col of ledgerCollections) {
        const exists = await db.listCollections({ name: col }).hasNext();
        if (exists) {
            const count = await db.collection(col).countDocuments();
            console.log(`🗑️  Drop ${col} (${count} docs)`);
            if (!DRY_RUN) await db.collection(col).drop();
        } else {
            console.log(`⏭️  ${col} — doesn't exist, skip`);
        }
    }

    // ─── 5. RESET PRODUCT VARIANT STOCK COUNTERS ───────────────────────────
    const pvCol = db.collection('productvariants');
    const pvExists = await db.listCollections({ name: 'productvariants' }).hasNext();
    if (pvExists) {
        const pvCount = await pvCol.countDocuments();
        console.log(`🔄 Reset stock counters on ${pvCount} product variants`);
        if (!DRY_RUN) {
            await pvCol.updateMany({}, {
                $set: {
                    totalStock: 0,
                    reservedStock: 0,
                    'analytics.totalSold': 0,
                    'analytics.totalReturned': 0,
                    'analytics.historicalDemand30Days': 0,
                    lifecycleStatus: 'New',
                }
            });
        }
    }

    // ─── 6. RESET COURIER CASH COUNTERS ────────────────────────────────────
    const courierCol = db.collection('couriers');
    const courierExists = await db.listCollections({ name: 'couriers' }).hasNext();
    if (courierExists) {
        const cCount = await courierCol.countDocuments();
        console.log(`🔄 Reset courier cash counters on ${cCount} couriers`);
        if (!DRY_RUN) {
            await courierCol.updateMany({}, {
                $set: {
                    cashCollected: 0,
                    pendingRemittance: 0,
                    totalDelivered: 0,
                    totalFailed: 0,
                    totalShipments: 0,
                    successRate: 0,
                    reliabilityScore: 100,
                }
            });
        }
    }

    // ─── 7. RESET CUSTOMER ORDER STATS ─────────────────────────────────────
    const custCol = db.collection('customers');
    const custExists = await db.listCollections({ name: 'customers' }).hasNext();
    if (custExists) {
        const custCount = await custCol.countDocuments();
        console.log(`🔄 Reset customer order stats on ${custCount} customers`);
        if (!DRY_RUN) {
            await custCol.updateMany({}, {
                $set: {
                    totalOrders: 0,
                    deliveredOrders: 0,
                    refusedOrders: 0,
                    returnedOrders: 0,
                    totalSpent: 0,
                    blacklisted: false,
                    'scoring.riskScore': 0,
                    'scoring.ltv': 0,
                }
            });
        }
    }

    // ─── 8. DROP SUPPORT/CALL LOGS (order-dependent) ───────────────────────
    const supportCollections = ['callnotes', 'supporttickets', 'assignmenthistories', 'auditlogs'];
    for (const col of supportCollections) {
        const exists = await db.listCollections({ name: col }).hasNext();
        if (exists) {
            const count = await db.collection(col).countDocuments();
            console.log(`🗑️  Drop ${col} (${count} docs)`);
            if (!DRY_RUN) await db.collection(col).drop();
        } else {
            console.log(`⏭️  ${col} — doesn't exist, skip`);
        }
    }

    // ─── 9. TENANT-SCOPING MIGRATIONS ──────────────────────────────────────
    console.log('\n── Tenant-scoping migrations ──');

    // 9a. CourierSetting — backfill tenant from parent courier
    const csCol = db.collection('couriersettings');
    const csExists = await db.listCollections({ name: 'couriersettings' }).hasNext();
    if (csExists) {
        const noTenant = await csCol.countDocuments({ tenant: { $exists: false } });
        console.log(`📋 CourierSetting: ${noTenant} docs missing tenant`);
        if (!DRY_RUN && noTenant > 0) {
            // CourierSettings are global per provider — assign to first tenant
            const tenant = await db.collection('tenants').findOne();
            if (tenant) {
                await csCol.updateMany({ tenant: { $exists: false } }, { $set: { tenant: tenant._id } });
                console.log(`   ✅ Set tenant to ${tenant._id}`);
            }
        }
    }

    // 9b. CourierCoverage & CourierPricing — backfill tenant from parent courier
    for (const colName of ['couriercoverages', 'courierpricings']) {
        const col = db.collection(colName);
        const exists = await db.listCollections({ name: colName }).hasNext();
        if (!exists) continue;
        const noTenant = await col.countDocuments({ tenant: { $exists: false } });
        console.log(`📋 ${colName}: ${noTenant} docs missing tenant`);
        if (!DRY_RUN && noTenant > 0) {
            const docs = await col.find({ tenant: { $exists: false } }).toArray();
            let fixed = 0, orphaned = 0;
            for (const doc of docs) {
                const courier = await db.collection('couriers').findOne({ _id: doc.courierId });
                if (courier?.tenant) {
                    await col.updateOne({ _id: doc._id }, { $set: { tenant: courier.tenant } });
                    fixed++;
                } else {
                    await col.deleteOne({ _id: doc._id });
                    orphaned++;
                }
            }
            console.log(`   ✅ Fixed: ${fixed}, Orphaned/deleted: ${orphaned}`);
        }
    }

    // 9c. Supplier, Warehouse, PurchaseOrder, ReorderAlert — assign to first tenant if missing
    for (const colName of ['suppliers', 'warehouses', 'purchaseorders']) {
        const col = db.collection(colName);
        const exists = await db.listCollections({ name: colName }).hasNext();
        if (!exists) continue;
        const noTenant = await col.countDocuments({ tenant: { $exists: false } });
        console.log(`📋 ${colName}: ${noTenant} docs missing tenant`);
        if (!DRY_RUN && noTenant > 0) {
            const tenant = await db.collection('tenants').findOne();
            if (tenant) {
                await col.updateMany({ tenant: { $exists: false } }, { $set: { tenant: tenant._id } });
                console.log(`   ✅ Set tenant to ${tenant._id}`);
            }
        }
    }

    // ─── 10. DROP OLD INDEXES THAT CONFLICT WITH NEW TENANT-SCOPED ONES ───
    console.log('\n── Index cleanup ──');
    const indexDrops = [
        { col: 'couriersettings', idx: 'providerName_1' },
        { col: 'purchaseorders', idx: 'poNumber_1' },
    ];
    for (const { col, idx } of indexDrops) {
        const exists = await db.listCollections({ name: col }).hasNext();
        if (!exists) continue;
        try {
            const indexes = await db.collection(col).indexes();
            if (indexes.some(i => i.name === idx)) {
                console.log(`🔧 Drop old index ${col}.${idx}`);
                if (!DRY_RUN) await db.collection(col).dropIndex(idx);
            }
        } catch (e) {
            console.log(`   ⚠️  ${col}.${idx}: ${e.message}`);
        }
    }

    // ─── SUMMARY ───────────────────────────────────────────────────────────
    console.log('\n── Preserved collections ──');
    const preserved = ['employees', 'attendances', 'leaverequests', 'payrolls',
                        'workerproductivities', 'workerrewards',  // HR
                        'users', 'tenants', 'tenantmemberships', 'roles', 'usagerecords',  // Auth
                        'products', 'productvariants', 'categories',  // Catalog
                        'couriers', 'couriercoverages', 'courierpricings', 'couriersettings',  // Courier config
                        'suppliers', 'warehouses',  // Procurement
                        'agentprofiles', 'assignmentrules',  // Call center config
                        'saleschannels', 'landingpages', 'pageevents',  // Storefront
                        'webhooks', 'webhookdeliveries',  // Integrations
                       ];
    for (const col of preserved) {
        const exists = await db.listCollections({ name: col }).hasNext();
        if (exists) {
            const count = await db.collection(col).countDocuments();
            console.log(`   ✅ ${col}: ${count} docs`);
        }
    }

    console.log(DRY_RUN ? '\n⚠️  DRY RUN complete. Run with --execute to apply changes.' : '\n✅ All done!');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('❌ Fatal:', err);
    process.exit(1);
});
