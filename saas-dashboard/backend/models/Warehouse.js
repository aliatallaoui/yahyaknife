const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    location: {
        address: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
    },
    manager: {
        name: String,
        phone: String,
        email: String
    },
    capacity: {
        type: Number, // Optional capacity limits in units or volume
        default: 0
    },
    status: {
        type: String,
        enum: ['Active', 'Maintenance', 'Closed'],
        default: 'Active'
    }
}, { timestamps: true });

module.exports = mongoose.model('Warehouse', warehouseSchema);
