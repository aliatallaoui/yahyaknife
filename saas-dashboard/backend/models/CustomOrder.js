const mongoose = require('mongoose');

const customOrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    date: { type: Date, default: Date.now },
    requestedType: { type: String },
    requestedSteel: { type: String },
    requestedHandle: { type: String },
    measurements: {
        bladeLength: { type: Number },
        totalLength: { type: Number }
    },
    sheathRequired: { type: Boolean, default: false },
    deadline: { type: Date },
    depositPaid: { type: Number, default: 0 },
    finalPrice: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'In Production', 'Completed', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    generatedKnifeCard: { type: mongoose.Schema.Types.ObjectId, ref: 'KnifeCard' },
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('CustomOrder', customOrderSchema);
