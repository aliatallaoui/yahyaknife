const mongoose = require('mongoose');

const productionOrderSchema = new mongoose.Schema({
    orderNumber: { type: String, required: true, unique: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    bom: { type: mongoose.Schema.Types.ObjectId, ref: 'BillOfMaterial', required: true },
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
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ProductionOrder', productionOrderSchema);
