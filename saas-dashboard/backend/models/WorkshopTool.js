const mongoose = require('mongoose');

const workshopToolSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['Grinder', 'Forge', 'Press', 'Hand Tool', 'Testing Equipment', 'Other'],
        default: 'Hand Tool'
    },
    serialNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    status: {
        type: String,
        enum: ['Operational', 'Needs Maintenance', 'Under Repair', 'Decommissioned'],
        default: 'Operational'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    acquisitionDate: {
        type: Date
    },
    lastMaintenanceDate: {
        type: Date,
        default: Date.now
    },
    nextMaintenanceDate: {
        type: Date
    },
    maintenanceNotes: [{
        date: { type: Date, default: Date.now },
        note: String,
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    }]
}, { timestamps: true });

module.exports = mongoose.model('WorkshopTool', workshopToolSchema);
