const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const Tenant = require('../models/Tenant');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const createSuperAdmin = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB. Creating Super Admin user...');

        const role = await Role.findOne({ name: 'Super Admin' });
        if (!role) {
            console.error("Role 'Super Admin' not found. Please run seedRoles.js first.");
            process.exit(1);
        }

        // Ensure a default tenant exists
        let tenant = await Tenant.findOne({ name: 'Default Organization' });
        if (!tenant) {
            tenant = await Tenant.create({
                name: 'Default Organization',
                planTier: 'Enterprise',
                subscription: { status: 'active' },
                settings: { currency: 'DZD', timezone: 'Africa/Algiers' }
            });
            console.log(`Created default tenant: ${tenant._id}`);
        }

        const salt = await bcrypt.genSalt(10);
        const password = process.env.SUPER_ADMIN_PASSWORD;
        if (!password || password.length < 12) {
            console.error('ERROR: Set SUPER_ADMIN_PASSWORD env var (min 12 chars) before running this script.');
            process.exit(1);
        }
        const hashedPassword = await bcrypt.hash(password, salt);
        const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@company.com';

        const user = await User.findOneAndUpdate(
            { email },
            {
                $set: {
                    name: 'Super Admin',
                    password: hashedPassword,
                    role: role._id,
                    tenant: tenant._id,
                    isActive: true
                }
            },
            { new: true, upsert: true }
        );

        console.log(`\nSuper Admin created successfully!`);
        console.log(`Email: ${email}`);
        console.log(`Tenant: ${tenant.name} (${tenant._id})`);

        process.exit(0);
    } catch (error) {
        console.error('Error creating super admin:', error);
        process.exit(1);
    }
};

createSuperAdmin();
