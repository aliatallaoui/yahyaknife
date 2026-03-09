/**
 * FULL Database Reset — Drops ALL data from every collection
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

async function resetDB() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log(`\n🗑️  Wiping ${collections.length} collections...\n`);

    for (const col of collections) {
        const name = col.name;
        try {
            const result = await db.collection(name).deleteMany({});
            console.log(`   ✓ ${name} — deleted ${result.deletedCount} docs`);
        } catch (e) {
            console.log(`   ✗ ${name} — ${e.message}`);
        }
    }

    // Also drop any stale indexes that might cause issues
    for (const col of collections) {
        try {
            const indexes = await db.collection(col.name).indexes();
            for (const idx of indexes) {
                if (idx.name !== '_id_' && idx.unique) {
                    await db.collection(col.name).dropIndex(idx.name);
                    console.log(`   🔧 Dropped stale unique index: ${col.name}.${idx.name}`);
                }
            }
        } catch (e) { /* ignore */ }
    }

    console.log('\n✅ Database fully reset! All collections empty.');
    console.log('   Run "node seedFresh.js" to re-seed orders & customers.\n');
    process.exit(0);
}

resetDB().catch(err => {
    console.error('❌ Reset error:', err);
    process.exit(1);
});
