/**
 * Migration: Add channelType to existing SalesChannel documents.
 *
 * All existing channels are landing_page type with connected status.
 *
 * Usage: node scripts/migrate_saleschannel_type.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
    const uri = process.env.MONGO_URI;
    if (!uri) { console.error('MONGO_URI not set'); process.exit(1); }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const result = await mongoose.connection.db.collection('saleschannels').updateMany(
        { channelType: { $exists: false } },
        {
            $set: {
                channelType: 'landing_page',
                integration: { status: 'connected', syncEnabled: true }
            }
        }
    );

    console.log(`Updated ${result.modifiedCount} SalesChannel documents`);
    await mongoose.disconnect();
    console.log('Done');
}

migrate().catch(err => { console.error(err); process.exit(1); });
