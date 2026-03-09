const mongoose = require('mongoose');

const projectDocumentSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    fileUrl: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    uploadDate: { type: Date, default: Date.now },
    documentType: {
        type: String,
        enum: ['Contract', 'Plan', 'Specification', 'Report', 'Asset', 'Other'],
        default: 'Other'
    }
}, { timestamps: true });

module.exports = mongoose.model('ProjectDocument', projectDocumentSchema);
