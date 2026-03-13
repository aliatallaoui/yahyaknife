const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to DB');
        const users = await User.find({}).select('+password');
        console.log(`Found ${users.length} users`);
        for (const user of users.slice(0, 3)) {
            try {
                const match = await user.matchPassword('password123');
                console.log(`User: ${user.email}, isActive: ${user.isActive}, Password match 'password123': ${match}`);
            } catch (err) {
                console.error(`  Error matching password for ${user.email}:`, err);
            }
        }
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
