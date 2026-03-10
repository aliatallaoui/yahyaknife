const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    products: [{
        variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
        knifeCardRef: { type: mongoose.Schema.Types.ObjectId, ref: 'KnifeCard' },
        customOrderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomOrder' },
        name: { type: String }, // Storing snapshot of the product name
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    wilaya: {
        type: String,
        required: true
    },
    commune: {
        type: String,
        required: true
    },
    assignedAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    channel: {
        type: String,
        required: true,
        enum: ['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Direct', 'Other']
    },
    // Main COD Lifecycle Status
    status: {
        type: String,
        enum: ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'],
        default: 'New'
    },
    verificationStatus: {
        type: String,
        enum: ['Pending', 'Phone Confirmed', 'Auto-Verified'],
        default: 'Pending'
    },
    priority: {
        type: String,
        enum: ['Normal', 'High Priority', 'Urgent'],
        default: 'Normal'
    },
    tags: [{ type: String }],
    fraudRiskScore: { type: Number, default: 0 },
    // Courier relation for dispatch
    courier: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier' },
    paymentStatus: {
        type: String,
        enum: ['Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Unpaid'
    },
    fulfillmentStatus: {
        type: String,
        enum: ['Unfulfilled', 'Partially Fulfilled', 'Fulfilled', 'Returned'],
        default: 'Unfulfilled'
    },
    fulfillmentPipeline: {
        type: String,
        enum: ['Pending', 'Picking', 'Packing', 'Ready to Ship', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    financials: {
        deposit: { type: Number, default: 0 },
        cogs: { type: Number, default: 0 },
        marketplaceFees: { type: Number, default: 0 },
        gatewayFees: { type: Number, default: 0 },
        shippingCosts: { type: Number, default: 0 },
        courierFee: { type: Number, default: 0 }, // Specific explicit fee per COD delivery
        codAmount: { type: Number, default: 0 },  // Cash expected to be collected
        netProfit: { type: Number, default: 0 }
    },
    trackingInfo: {
        carrier: { type: String },
        trackingNumber: { type: String },
        expectedDeliveryDate: { type: Date }
    },
    deliveryStatus: {
        refusalReason: { type: String },
        deliveryTimeMinutes: { type: Number },
        deliveredAt: { type: Date }
    },
    // Shipping details for courier dispatch
    shipping: {
        recipientName: { type: String },
        phone1: { type: String },
        phone2: { type: String },
        wilayaCode: { type: String },
        wilayaName: { type: String },
        commune: { type: String },
        address: { type: String },
        weight: { type: Number, default: 1 },
        fragile: { type: Boolean, default: false },
        deliveryType: { type: Number, default: 0 } // 0=home, 1=stop desk
    },
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
