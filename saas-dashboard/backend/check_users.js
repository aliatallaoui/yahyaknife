const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard')
    .then(async () => {
        const users = await User.find({});
        console.log('Users found:', users.map(u => ({ id: u._id, email: u.email, role: u.role, isActive: u.isActive })));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
