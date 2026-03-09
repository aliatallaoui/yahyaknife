// backend/models/Role.js
const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    isSystemRole: {
        type: Boolean,
        default: false, // Core roles cannot be deleted
    },
    permissions: [{
        type: String
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
