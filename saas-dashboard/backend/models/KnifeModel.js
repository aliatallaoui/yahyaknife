const mongoose = require('mongoose');

const knifeModelSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },  // e.g. "Hunter Knife"
    type: {
        type: String,
        enum: ['Hunter', 'Chef', 'Tactical', 'Utility', 'Damascus', 'Cleaver', 'Fillet', 'Bowie', 'Custom', 'Other'],
        default: 'Custom'
    },
    description: { type: String },

    // ── Default specs ──
    defaultSteelType: { type: String },          // D2, 1095...
    defaultHandleMaterial: { type: String },     // Walnut, G10...
    defaultGuardMaterial: { type: String },
    defaultPins: { type: String },
    sheathRequired: { type: Boolean, default: false },

    // ── Default dimensions range ──
    bladeLengthMin: { type: Number },    // cm
    bladeLengthMax: { type: Number },
    typicalWeight: { type: Number },     // grams

    // ── BOM template ──
    defaultBOM: { type: mongoose.Schema.Types.ObjectId, ref: 'BillOfMaterial' },

    // ── Suggested pricing ──
    suggestedPriceMin: { type: Number },
    suggestedPriceMax: { type: Number },
    estimatedProductionCost: { type: Number },

    // ── Visual ──
    photo: { type: String },

    notes: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('KnifeModel', knifeModelSchema);
