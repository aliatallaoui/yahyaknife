const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('./Role'); // Ensure Role is registered before User populates it

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: [12, 'Password must be at least 12 characters'],
        select: false
    },
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        default: null
    },
    permissionOverrides: [{
        permission: { type: String, required: true },
        effect: { type: String, enum: ['allow', 'deny'], required: true }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    preferences: {
        language: { type: String, default: 'ar' }, // default Arabic based on the image provided
        timezone: { type: String, default: 'UTC' },
        dateFormat: { type: String, default: 'DD/MM/YYYY' },
        currency: { type: String, default: 'DZD' },
        theme: { type: String, default: 'system' }
    },
    refreshToken: {
        type: String,
        select: false
    },
    refreshTokenExpiresAt: {
        type: Date,
        select: false
    },
    resetPasswordToken: {
        type: String,
        select: false
    },
    resetPasswordExpire: {
        type: Date,
        select: false
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant'
    }
}, {
    timestamps: true
});

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
