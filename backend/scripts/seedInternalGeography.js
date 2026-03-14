#!/usr/bin/env node
/**
 * seedInternalGeography.js
 *
 * Seeds InternalWilaya and InternalCommune collections from the static
 * algeriaCommunes.js data. Safe to run multiple times (upserts).
 *
 * Usage:
 *   node scripts/seedInternalGeography.js
 *
 * Requires MONGODB_URI env var or .env file in project root.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const InternalWilaya = require('../models/InternalWilaya');
const InternalCommune = require('../models/InternalCommune');
const { algeriaWilayas, getCommunesForWilaya } = require('../shared/constants/algeriaCommunes');

// Normalize key — same logic as location.normalizer.js
function normalizeKey(str) {
    if (!str) return '';
    let s = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.toLowerCase();
    s = s.replace(/[-'.,()\s]+/g, '');
    return s.trim();
}

async function seed() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DEV_MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI environment variable is required');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // ── Seed Wilayas ─────────────────────────────────────────────────────────
    console.log(`Seeding ${algeriaWilayas.length} wilayas...`);
    const wilayaMap = {}; // code → _id

    for (const w of algeriaWilayas) {
        const key = normalizeKey(w.name);
        const result = await InternalWilaya.findOneAndUpdate(
            { code: w.code },
            {
                $set: {
                    code: w.code,
                    officialFrName: w.name,
                    normalizedKey: key,
                    country: 'DZ'
                },
                $setOnInsert: {
                    officialArName: '',
                    aliases: []
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        wilayaMap[w.code] = result._id;
    }
    console.log(`✓ ${algeriaWilayas.length} wilayas upserted`);

    // ── Seed Communes ────────────────────────────────────────────────────────
    let communeCount = 0;

    for (const w of algeriaWilayas) {
        const communes = getCommunesForWilaya(w.code);
        if (!communes || communes.length === 0) continue;

        const bulkOps = communes.map(communeName => ({
            updateOne: {
                filter: { wilayaCode: w.code, officialFrName: communeName },
                update: {
                    $set: {
                        wilaya: wilayaMap[w.code],
                        wilayaCode: w.code,
                        officialFrName: communeName,
                        normalizedKey: normalizeKey(communeName),
                        country: 'DZ'
                    },
                    $setOnInsert: {
                        officialArName: '',
                        aliases: []
                    }
                },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            await InternalCommune.bulkWrite(bulkOps, { ordered: false });
            communeCount += communes.length;
        }
    }

    console.log(`✓ ${communeCount} communes upserted`);

    // ── Verify ───────────────────────────────────────────────────────────────
    const wCount = await InternalWilaya.countDocuments();
    const cCount = await InternalCommune.countDocuments();
    console.log(`\nVerification: ${wCount} wilayas, ${cCount} communes in database`);

    await mongoose.disconnect();
    console.log('Done.');
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
