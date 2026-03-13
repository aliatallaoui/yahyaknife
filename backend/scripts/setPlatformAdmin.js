/**
 * setPlatformAdmin.js
 *
 * Promotes a user to platform_admin by email.
 *
 * Usage:  node scripts/setPlatformAdmin.js user@example.com
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
    const email = process.argv[2];
    if (!email) {
        console.error('Usage: node scripts/setPlatformAdmin.js <email>');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email });
    if (!user) {
        console.error(`User not found: ${email}`);
        process.exit(1);
    }

    user.platformRole = 'platform_admin';
    await user.save();

    console.log(`User ${user.name} (${email}) is now a platform admin.`);
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
