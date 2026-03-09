const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('../models/Role');
const User = require('../models/User');

dotenv.config({ path: '../.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const migrateUsers = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB. Starting User Role migration...');

        // Fetch all roles to map names to ObjectIds
        const roles = await Role.find({});
        const roleMap = {};
        roles.forEach(r => {
            roleMap[r.name] = r._id;
        });

        // We use native MongoDB cursor to bypass Mongoose Schema casting, since we are dealing with string roles on an ObjectId schema
        const usersCollection = mongoose.connection.collection('users');
        const users = await usersCollection.find({}).toArray();

        let migratedCount = 0;

        for (const user of users) {
            if (user.role && typeof user.role === 'string') {
                // Determine appropriate role to assign based on the old string
                let newRoleId = roleMap['Super Admin']; // fallback

                if (roleMap[user.role]) {
                    newRoleId = roleMap[user.role];
                } else if (user.role === 'admin' || user.role === 'SuperAdmin') {
                    newRoleId = roleMap['Super Admin'];
                } else if (user.role === 'user') {
                    newRoleId = roleMap['Viewer / Read Only']; // Safe default
                }

                await usersCollection.updateOne(
                    { _id: user._id },
                    { $set: { role: newRoleId } }
                );
                migratedCount++;
                console.log(`Migrated user ${user.email} from string '${user.role}' to ObjectId ${newRoleId}`);
            }
        }

        console.log(`Migration completed successfully! Migrated ${migratedCount} users.`);
        process.exit(0);
    } catch (error) {
        console.error('Error during migration:', error);
        process.exit(1);
    }
};

migrateUsers();
