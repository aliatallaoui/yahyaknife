const mongoose = require('mongoose');

/**
 * InternalCommune — Canonical commune reference.
 *
 * NOT tenant-scoped: shared geography reference data.
 * Each commune belongs to one wilaya.
 */
const internalCommuneSchema = new mongoose.Schema({
    wilaya:         { type: mongoose.Schema.Types.ObjectId, ref: 'InternalWilaya', required: true },
    wilayaCode:     { type: Number, required: true },
    officialFrName: { type: String, required: true, trim: true },
    officialArName: { type: String, trim: true, default: '' },
    aliases:        [{ type: String, trim: true }],
    normalizedKey:  { type: String, required: true, index: true },
    country:        { type: String, default: 'DZ', maxlength: 3 }
}, { timestamps: true });

// Fast lookups for normalization engine
internalCommuneSchema.index({ wilayaCode: 1, normalizedKey: 1 });
internalCommuneSchema.index({ wilaya: 1, normalizedKey: 1 });
internalCommuneSchema.index({ country: 1, normalizedKey: 1 });
// Unique per wilaya
internalCommuneSchema.index({ wilayaCode: 1, officialFrName: 1 }, { unique: true });

module.exports = mongoose.model('InternalCommune', internalCommuneSchema);
