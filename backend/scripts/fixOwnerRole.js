/**
 * One-time fix: assigns the "Owner / Founder" role to tenant owners
 * who currently have role: null (caused by name mismatch bug).
 *
 * Usage:  node scripts/fixOwnerRole.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    const Role = require('../models/Role');
    const User = require('../models/User');
    const Tenant = require('../models/Tenant');

    // Find the Owner / Founder role
    const ownerRole = await Role.findOne({ name: 'Owner / Founder', isSystemRole: true });
    if (!ownerRole) {
        console.error('Owner / Founder role not found. Run seedRoles first:  node scripts/seedRoles.js');
        process.exit(1);
    }

    // Find all tenants and their owners
    const tenants = await Tenant.find({ owner: { $ne: null } }).select('owner name').lean();
    let fixed = 0;

    for (const t of tenants) {
        const user = await User.findById(t.owner);
        if (user && !user.role) {
            user.role = ownerRole._id;
            await user.save();
            console.log(`  Fixed: ${user.email} (tenant: ${t.name}) → Owner / Founder`);
            fixed++;
        }
    }

    if (fixed === 0) {
        console.log('No users needed fixing — all tenant owners already have a role assigned.');
    } else {
        console.log(`\nDone. Fixed ${fixed} user(s).`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
