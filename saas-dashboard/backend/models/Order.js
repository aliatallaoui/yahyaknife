const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    products: [{
        variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
        name: { type: String }, // Storing snapshot of the product name
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    channel: {
        type: String,
        required: true,
        enum: ['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Other']
    },
    // Main COD Lifecycle Status
    status: {
        type: String,
        enum: ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'],
        default: 'New'
    },
    verificationStatus: {
        type: String,
        enum: ['Pending', 'Phone Confirmed', 'Auto-Verified'],
        default: 'Pending'
    },
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
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
