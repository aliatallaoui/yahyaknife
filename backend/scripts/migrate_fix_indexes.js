/**
 * One-time migration: drop global-unique indexes that should be tenant-scoped.
 *
 * Run: node scripts/migrate_fix_indexes.js
 *
 * Safe to re-run — silently skips if index doesn't exist.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.PROD_MONGO_URI || process.env.DEV_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Employee: drop old global email_1 unique index
    try {
        await db.collection('employees').dropIndex('email_1');
        console.log('[Employee] Dropped old global email_1 index');
    } catch (err) {
        if (err.codeName === 'IndexNotFound') {
            console.log('[Employee] email_1 index already removed — skipping');
        } else {
            console.error('[Employee] Error dropping index:', err.message);
        }
    }

    // 2. Verify the compound tenant+email index exists (Mongoose auto-creates from schema)
    const employeeIndexes = await db.collection('employees').indexes();
    const hasTenantEmail = employeeIndexes.some(i => i.key?.tenant === 1 && i.key?.email === 1);
    console.log(`[Employee] tenant+email compound index: ${hasTenantEmail ? 'EXISTS' : 'WILL BE CREATED ON NEXT APP START'}`);

    // 3. AuditLog: check that tenant index exists
    try {
        const auditIndexes = await db.collection('auditlogs').indexes();
        const hasTenant = auditIndexes.some(i => i.key?.tenant === 1);
        console.log(`[AuditLog] tenant index: ${hasTenant ? 'EXISTS' : 'WILL BE CREATED ON NEXT APP START'}`);
    } catch {
        console.log('[AuditLog] Collection does not exist yet — indexes will be created on first write');
    }

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
