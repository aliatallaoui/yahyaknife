const mongoose = require('mongoose');

/**
 * InternalWilaya — Canonical wilaya (province) reference.
 *
 * NOT tenant-scoped: shared geography reference data.
 * Seeded from algeriaCommunes.js and can be extended for multi-country support.
 */
const internalWilayaSchema = new mongoose.Schema({
    code:           { type: Number, required: true, unique: true, min: 1 },
    officialFrName: { type: String, required: true, trim: true },
    officialArName: { type: String, trim: true, default: '' },
    aliases:        [{ type: String, trim: true }],
    normalizedKey:  { type: String, required: true, index: true },
    country:        { type: String, default: 'DZ', maxlength: 3 }
}, { timestamps: true });

// Fast lookup by normalized key (for matching)
internalWilayaSchema.index({ country: 1, normalizedKey: 1 });
internalWilayaSchema.index({ country: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('InternalWilaya', internalWilayaSchema);
