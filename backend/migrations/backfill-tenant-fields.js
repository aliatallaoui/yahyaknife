/**
 * One-time migration: backfill `tenant` field on models that previously lacked it.
 *
 * Models affected:
 *   - AgentProfile  (tenant copied from User)
 *   - OrderNote     (tenant copied from Order)
 *   - OrderItem     (tenant copied from Order)
 *   - WorkerProductivity (tenant copied from Employee)
 *   - WorkerReward  (tenant copied from Employee)
 *
 * Usage:
 *   node backend/migrations/backfill-tenant-fields.js
 *
 * Safe to run multiple times — skips records that already have tenant set.
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Load models
require('../models/User');
require('../models/Order');
require('../models/Employee');
const AgentProfile = require('../models/AgentProfile');
const OrderNote = require('../models/OrderNote');
const OrderItem = require('../models/OrderItem');
const WorkerProductivity = require('../models/WorkerProductivity');
const WorkerReward = require('../models/WorkerReward');

async function backfillFromRef(Model, modelName, refField, RefModel, refModelName) {
    const docs = await Model.find({ tenant: null }).select(`_id ${refField}`).lean();
    if (docs.length === 0) {
        console.log(`  ${modelName}: 0 records to backfill`);
        return 0;
    }

    const refIds = [...new Set(docs.map(d => d[refField]?.toString()).filter(Boolean))];
    const refs = await RefModel.find({ _id: { $in: refIds } }).select('_id tenant').lean();
    const tenantMap = {};
    refs.forEach(r => { tenantMap[r._id.toString()] = r.tenant; });

    let updated = 0;
    const bulkOps = [];
    for (const doc of docs) {
        const tenant = tenantMap[doc[refField]?.toString()];
        if (tenant) {
            bulkOps.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: { tenant } }
                }
            });
        }
    }

    if (bulkOps.length > 0) {
        const result = await Model.bulkWrite(bulkOps);
        updated = result.modifiedCount;
    }
    console.log(`  ${modelName}: ${updated}/${docs.length} records backfilled from ${refModelName}.tenant`);
    return updated;
}

async function backfillAgentProfiles() {
    const profiles = await AgentProfile.find({ tenant: null }).select('_id user').lean();
    if (profiles.length === 0) {
        console.log('  AgentProfile: 0 records to backfill');
        return 0;
    }

    const User = mongoose.model('User');
    const userIds = profiles.map(p => p.user);
    const users = await User.find({ _id: { $in: userIds } }).select('_id tenant').lean();
    const tenantMap = {};
    users.forEach(u => { tenantMap[u._id.toString()] = u.tenant; });

    const bulkOps = [];
    for (const profile of profiles) {
        const tenant = tenantMap[profile.user?.toString()];
        if (tenant) {
            bulkOps.push({
                updateOne: {
                    filter: { _id: profile._id },
                    update: { $set: { tenant } }
                }
            });
        }
    }

    let updated = 0;
    if (bulkOps.length > 0) {
        const result = await AgentProfile.bulkWrite(bulkOps);
        updated = result.modifiedCount;
    }
    console.log(`  AgentProfile: ${updated}/${profiles.length} records backfilled from User.tenant`);
    return updated;
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');
    console.log('Backfilling tenant fields...\n');

    const Order = mongoose.model('Order');
    const Employee = mongoose.model('Employee');

    await backfillAgentProfiles();
    await backfillFromRef(OrderNote, 'OrderNote', 'orderId', Order, 'Order');
    await backfillFromRef(OrderItem, 'OrderItem', 'orderId', Order, 'Order');
    await backfillFromRef(WorkerProductivity, 'WorkerProductivity', 'employeeId', Employee, 'Employee');
    await backfillFromRef(WorkerReward, 'WorkerReward', 'employeeId', Employee, 'Employee');

    console.log('\nDone!');
    process.exit(0);
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
