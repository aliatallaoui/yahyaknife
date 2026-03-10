const mongoose = require('mongoose');

const courierCoverageSchema = new mongoose.Schema({
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier', required: true, index: true },
    wilayaCode: { type: String, required: true },
    commune: { type: String, required: true },
    homeSupported: { type: Boolean, default: true },
    officeSupported: { type: Boolean, default: false }
}, { timestamps: true });

// Compound index for fast lookups
courierCoverageSchema.index({ courierId: 1, wilayaCode: 1, commune: 1 }, { unique: true });

module.exports = mongoose.model('CourierCoverage', courierCoverageSchema);
