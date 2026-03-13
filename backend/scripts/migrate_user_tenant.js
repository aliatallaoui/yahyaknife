#!/usr/bin/env node
/**
 * migrate_user_tenant.js
 *
 * Phase A migration: ensure every User document has a `tenant` field.
 *
 * Strategy:
 *  1. Find all users without a tenant.
 *  2. If exactly ONE active tenant exists, assign all orphan users to it.
 *  3. If zero or multiple tenants exist, print guidance and exit.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   node backend/scripts/migrate_user_tenant.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

const MONGO_URI = process.env.MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // Find orphan users (no tenant field or null)
    const orphans = await User.find({ $or: [{ tenant: null }, { tenant: { $exists: false } }] })
        .select('_id name email')
        .lean();

    if (orphans.length === 0) {
        console.log('✅ All users already have a tenant. Nothing to migrate.');
        await mongoose.disconnect();
        return;
    }

    console.log(`Found ${orphans.length} user(s) without a tenant:`);
    orphans.forEach(u => console.log(`  - ${u.name} <${u.email}> (${u._id})`));

    // Check available tenants
    const tenants = await Tenant.find({ isActive: true }).select('_id name').lean();

    if (tenants.length === 0) {
        console.error('\n❌ No active tenants found. Create a tenant first:');
        console.error('   node backend/scripts/createSuperAdmin.js');
        await mongoose.disconnect();
        process.exit(1);
    }

    if (tenants.length > 1) {
        console.error(`\n❌ Multiple tenants found (${tenants.length}). Cannot auto-assign.`);
        console.error('   Assign each user manually or modify this script to specify a target tenant.');
        tenants.forEach(t => console.error(`  - ${t.name} (${t._id})`));
        await mongoose.disconnect();
        process.exit(1);
    }

    // Exactly one tenant — assign all orphans
    const targetTenant = tenants[0];
    console.log(`\nAssigning all orphan users to tenant: ${targetTenant.name} (${targetTenant._id})`);

    const result = await User.updateMany(
        { $or: [{ tenant: null }, { tenant: { $exists: false } }] },
        { $set: { tenant: targetTenant._id } }
    );

    console.log(`✅ Updated ${result.modifiedCount} user(s).`);
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
