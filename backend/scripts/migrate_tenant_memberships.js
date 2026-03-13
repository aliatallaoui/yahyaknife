/**
 * migrate_tenant_memberships.js
 *
 * Creates TenantMembership records for all existing users that don't have one.
 * Each user gets a membership for their current User.tenant with their current User.role.
 *
 * Idempotent — skips users who already have a membership for their tenant.
 *
 * Usage:  node scripts/migrate_tenant_memberships.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const TenantMembership = require('../models/TenantMembership');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({ tenant: { $ne: null } }).select('_id tenant role').lean();
    console.log(`Found ${users.length} users with tenant`);

    let created = 0;
    let skipped = 0;

    for (const user of users) {
        const existing = await TenantMembership.findOne({
            user: user._id,
            tenant: user.tenant,
        });

        if (existing) {
            skipped++;
            continue;
        }

        await TenantMembership.create({
            user: user._id,
            tenant: user.tenant,
            role: user.role || null,
            status: 'active',
            joinedAt: new Date(),
        });
        created++;
    }

    console.log(`Created: ${created}, Skipped: ${skipped}`);
    console.log('Migration complete.');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
