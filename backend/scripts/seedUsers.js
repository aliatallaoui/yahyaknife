const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');

dotenv.config({ path: '../.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const testUsersToCreate = [
    { name: 'Alice Owner', email: 'owner@company.com', roleName: 'Owner / Founder' },
    { name: 'Bob Operations', email: 'ops@company.com', roleName: 'Operations Manager' },
    { name: 'Charlie Sales', email: 'sales@company.com', roleName: 'Sales Manager' },
    { name: 'Diana Inventory', email: 'inventory@company.com', roleName: 'Inventory Manager' },
    { name: 'Evan Procurement', email: 'procurement@company.com', roleName: 'Procurement Manager' },
    { name: 'Fiona Workshop', email: 'workshop@company.com', roleName: 'Workshop Manager' },
    { name: 'George HumanResources', email: 'hr@company.com', roleName: 'HR Manager' },
    { name: 'Hannah Finance', email: 'finance@company.com', roleName: 'Finance Manager' },
    { name: 'Ian Dispatch', email: 'dispatch@company.com', roleName: 'Dispatch / Logistics Operator' },
    { name: 'Jack Worker', email: 'worker@company.com', roleName: 'Workshop Worker' },
    { name: 'Kelly Support', email: 'support@company.com', roleName: 'Customer Support Agent' },
];

const seedUsers = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB. Seeding test users...');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        for (const userData of testUsersToCreate) {
            // Find the role by name
            const role = await Role.findOne({ name: userData.roleName });
            if (!role) {
                console.warn(`[SKIP] Role '${userData.roleName}' not found in DB. Did you run seedRoles.js?`);
                continue;
            }

            // Create or update the user
            const user = await User.findOneAndUpdate(
                { email: userData.email },
                {
                    $set: {
                        name: userData.name,
                        password: hashedPassword,
                        role: role._id, // Assign the proper ObjectID
                        isActive: true
                    }
                },
                { returnDocument: 'after', upsert: true }
            );

            console.log(`Seeded User: ${user.name} (${user.email}) -> Role: ${userData.roleName}`);
        }

        console.log('\nUser seeding completed successfully!');
        console.log('You can now log in with any of the emails above and password: password123');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
};

seedUsers();
