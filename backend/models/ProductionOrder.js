const mongoose = require('mongoose');

const productionOrderSchema = new mongoose.Schema({
    orderNumber: { type: String, required: true, unique: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' }, // Made optional
    bom: { type: mongoose.Schema.Types.ObjectId, ref: 'BillOfMaterial' }, // Made optional
    quantityPlanned: { type: Number, required: true, min: 1 },
    quantityCompleted: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['Planned', 'In Progress', 'Quality Check', 'Completed', 'Cancelled'],
        default: 'Planned'
    },
    startDate: { type: Date },
    completionDate: { type: Date },
    assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    productionTeam: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    productionWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    notes: { type: String },

    // Bladesmith / Workshop fields
    knifeRef: { type: mongoose.Schema.Types.ObjectId, ref: 'KnifeCard' },
    assignedBladesmith: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    stageHistory: [{
        stage: { type: String },
        startedAt: { type: Date, default: Date.now },
        completedAt: { type: Date },
        notes: { type: String }
    }],
    priority: {
        type: String,
        enum: ['Low', 'Normal', 'Rush'],
        default: 'Normal'
    }
}, { timestamps: true });

module.exports = mongoose.model('ProductionOrder', productionOrderSchema);
