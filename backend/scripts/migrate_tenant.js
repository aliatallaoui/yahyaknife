const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const migrateTenants = async () => {
    let client;
    try {
        client = new MongoClient(process.env.MONGO_URI);
        await client.connect();
        const db = client.db();
        console.log('Raw MongoDB Connected.');

        // 1. Create Default Tenant
        let defaultTenant = await db.collection('tenants').findOne({ name: 'Default Master Workspace' });
        
        let tenantId;
        if (!defaultTenant) {
            const insertResult = await db.collection('tenants').insertOne({
                name: 'Default Master Workspace',
                planTier: 'Enterprise',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            tenantId = insertResult.insertedId;
            console.log(`Created Default Tenant with ID: ${tenantId}`);
        } else {
            tenantId = defaultTenant._id;
            console.log(`Default Tenant already exists: ${tenantId}`);
        }

        // 2. Pre-clean nulls
        await db.collection('customers').updateMany({ email: null }, { $unset: { email: "" } });
        await db.collection('customers').updateMany({ phone: null }, { $unset: { phone: "" } });
        console.log(`Cleaned up null emails and phones in customers collection to prevent index collisions.`);

        // 3. Drop existing offending indexes to allow clean rebuild
        try {
            await db.collection('customers').dropIndex('email_1');
            await db.collection('customers').dropIndex('phone_1');
            console.log('Dropped legacy unique global indexes on phone/email.');
        } catch (e) {
            console.log('Legacy indexes not found or already dropped.');
        }

        try {
            await db.collection('customers').dropIndex('tenant_1_email_1');
            await db.collection('customers').dropIndex('tenant_1_phone_1');
            console.log('Dropped broken sparse compound indexes.');
        } catch (e) {
            console.log('Compound indexes not found or already dropped.');
        }

        // 4. Migrate Collections
        const usersResult = await db.collection('users').updateMany(
            { tenant: { $exists: false } },
            { $set: { tenant: tenantId } }
        );
        console.log(`Migrated ${usersResult.modifiedCount} Users.`);

        const customersResult = await db.collection('customers').updateMany(
            { tenant: { $exists: false } },
            { $set: { tenant: tenantId } }
        );
        console.log(`Migrated ${customersResult.modifiedCount} Customers.`);

        const ordersResult = await db.collection('orders').updateMany(
            { tenant: { $exists: false } },
            { $set: { tenant: tenantId } }
        );
        console.log(`Migrated ${ordersResult.modifiedCount} Orders.`);

        console.log('Migration Complete via raw driver!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        if (client) {
            await client.close();
        }
    }
};

migrateTenants();
