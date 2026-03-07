const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const promoteFirstUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard');

        let users = await User.find({});
        console.log("Found users: ", users.map(u => u.email));

        if (users.length > 0) {
            let firstUser = users[0];
            firstUser.role = 'Super Admin';
            firstUser.isActive = true;
            await firstUser.save();
            console.log(`Successfully promoted ${firstUser.email} to Super Admin.`);
        } else {
            console.log('No users found in database.');
        }

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

promoteFirstUser();
