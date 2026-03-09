const mongoose = require('mongoose');
require('dotenv').config({ path: 'd:/ورشة يحيى/saas-dashboard/backend/.env' });

async function wipe() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/saas-dashboard');
        console.log('Connected to DB. Dropping collections...');
        const collections = ['products', 'orders', 'purchaseorders', 'stockmovements'];
        for (const col of collections) {
            try {
                await mongoose.connection.db.dropCollection(col);
                console.log(`Dropped ${col}`);
            } catch (e) {
                console.log(`Could not drop ${col} - might not exist yet.`);
            }
        }
        console.log('Done.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
wipe();
