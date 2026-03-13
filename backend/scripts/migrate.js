const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const LOCAL_URI = process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';
const REMOTE_URI = process.env.REMOTE_MONGO_URI || process.env.MONGO_URI;

if (!REMOTE_URI) {
    console.error('ERROR: REMOTE_MONGO_URI (or MONGO_URI) env var is required. Set it in backend/.env');
    process.exit(1);
}

async function migrateData() {
    console.log('Starting Database Migration: Local -> Atlas');

    // Connect to local DB to read data
    const localConnection = await mongoose.createConnection(LOCAL_URI).asPromise();
    console.log('Connected to Local Database.');

    // Connect to remote DB to write data
    const remoteConnection = await mongoose.createConnection(REMOTE_URI).asPromise();
    console.log('Connected to Remote Atlas Database.');

    try {
        // Get all collections from the local database
        const collections = await localConnection.db.collections();
        console.log(`Found ${collections.length} collections to migrate.`);

        for (const localCollection of collections) {
            const collectionName = localCollection.collectionName;

            // Skip system collections
            if (collectionName.startsWith('system.')) continue;

            console.log(`\nMigrating collection: ${collectionName} ...`);

            // Fetch all documents from the local collection
            const documents = await localCollection.find({}).toArray();

            if (documents.length === 0) {
                console.log(`- Collection ${collectionName} is empty. Skipping.`);
                continue;
            }

            console.log(`- Found ${documents.length} documents.`);

            // Get the corresponding collection in the remote db
            const remoteCollection = remoteConnection.db.collection(collectionName);

            // Optional: clear remote collection first to avoid duplicates if migration is re-run
            await remoteCollection.deleteMany({});
            console.log(`- Cleared existing data in remote ${collectionName}.`);

            // Insert documents in chunks to avoid memory/payload limits
            const chunkSize = 500;
            for (let i = 0; i < documents.length; i += chunkSize) {
                const chunk = documents.slice(i, i + chunkSize);
                await remoteCollection.insertMany(chunk);
                console.log(`- Inserted chunk ${i / chunkSize + 1} (${chunk.length} docs) into ${collectionName}.`);
            }

            console.log(`✅ Successfully migrated ${collectionName}.`);
        }

        console.log('\n🎉 Entire database migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
    } finally {
        await localConnection.close();
        await remoteConnection.close();
        console.log('Database connections closed.');
        process.exit(0);
    }
}

migrateData();
