const mongoose = require('mongoose');

const historyLogSchema = new mongoose.Schema({
    stage: { type: String },
    notes: { type: String },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    date: { type: Date, default: Date.now }
}, { _id: false });

const knifeCardSchema = new mongoose.Schema({
    knifeId: { type: String, unique: true },          // auto-generated: KN-2024-001
    name: { type: String, required: true },            // e.g. "Hunter's Companion"
    type: {
        type: String,
        enum: ['Hunter', 'Chef', 'Tactical', 'Utility', 'Damascus', 'Cleaver', 'Fillet', 'Bowie', 'Custom', 'Other'],
        default: 'Custom'
    },
    knifeModelRef: { type: mongoose.Schema.Types.ObjectId, ref: 'KnifeModel' }, // optional template link

    // ── Materials ──
    steelType: { type: String },          // D2, 1095, O1, AEB-L, Damascus...
    handleMaterial: { type: String },     // Walnut, G10, Micarta, Bone...
    guardMaterial: { type: String },      // Brass, Steel, Copper, None
    pins: { type: String },               // e.g. "2x Brass pins"
    sheathRequired: { type: Boolean, default: false },
    sheathMaterial: { type: String },

    // ── Specs ──
    bladeLength: { type: Number },        // cm
    totalLength: { type: Number },        // cm
    weight: { type: Number },             // grams
    hardnessHRC: { type: Number },        // Rockwell hardness

    // ── Provenance ──
    maker: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    productionStartDate: { type: Date },
    productionEndDate: { type: Date },

    // ── BOM & Cost ──
    bomRef: { type: mongoose.Schema.Types.ObjectId, ref: 'BillOfMaterial' },
    bom: [{
        material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
        quantityRequired: { type: Number },
        unit: { type: String },
        estimatedCost: { type: Number }
    }],
    materialsConsumed: { type: Boolean, default: false },
    materialCost: { type: Number, default: 0 },
    laborCost: { type: Number, default: 0 },
    otherCosts: { type: Number, default: 0 },
    totalProductionCost: { type: Number, default: 0 },

    // ── Pricing ──
    suggestedPrice: { type: Number, default: 0 },
    actualSalePrice: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 0 },   // %

    // ── Status ──
    status: {
        type: String,
        enum: ['Design', 'In Production', 'Heat Treatment', 'Grinding', 'Handle Installation', 'Finishing', 'Sharpening', 'Completed', 'Sold'],
        default: 'Design'
    },

    // ── Sales link ──
    saleOrderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    customOrderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomOrder' },
    soldDate: { type: Date },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

    // ── Photos ──
    photos: [{ type: String }],    // URLs or base64 strings

    // ── Timeline ──
    historyLog: [historyLogSchema],

    notes: { type: String }
}, { timestamps: true });

// Auto-generate knifeId before save
knifeCardSchema.pre('save', async function (next) {
    if (this.knifeId) return next();
    const year = new Date().getFullYear();
    const count = await mongoose.model('KnifeCard').countDocuments();
    const seq = String(count + 1).padStart(3, '0');
    this.knifeId = `KN-${year}-${seq}`;
    next();
});

// Auto-calculate total cost and profit
knifeCardSchema.pre('save', function (next) {
    this.totalProductionCost = (this.materialCost || 0) + (this.laborCost || 0) + (this.otherCosts || 0);
    if (this.actualSalePrice > 0 && this.totalProductionCost > 0) {
        this.profit = this.actualSalePrice - this.totalProductionCost;
        this.profitMargin = parseFloat(((this.profit / this.actualSalePrice) * 100).toFixed(1));
    }
    next();
});

module.exports = mongoose.model('KnifeCard', knifeCardSchema);
