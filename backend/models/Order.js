const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    orderId: { type: String, required: true }, // Removed global unique constraint; uniqueness should be per tenant if needed
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
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    finalTotal: { type: Number, default: 0 }, // subtotal + courierFee - discount
    amountToCollect: { type: Number, default: 0 },
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
        enum: ['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Direct', 'Manual', 'WhatsApp', 'Facebook', 'TikTok', 'Shopify', 'WooCommerce', 'Instagram', 'Marketplace', 'Other']
    },
    // Main COD Lifecycle Status
    status: {
        type: String,
        enum: ['New', 'Calling', 'No Answer', 'Out of Coverage', 'Postponed', 'Wrong Number', 'Cancelled by Customer', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'],
        default: 'New'
    },
    verificationStatus: {
        type: String,
        enum: ['Pending', 'Phone Confirmed', 'Auto-Verified'],
        default: 'Pending'
    },
    priority: {
        type: String,
        enum: ['Normal', 'High', 'Urgent', 'VIP', 'High Priority'],
        default: 'Normal'
    },
    tags: [{ type: String }],
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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
        commune: { type: String },
        neighborhood: { type: String },
        address: { type: String },
        weight: { type: Number, default: 1 },
        fragile: { type: Boolean, default: false },
        deliveryType: { type: Number, default: 0 } // 0=home, 1=stop desk
    },
    notes: { type: String }
}, { timestamps: true });

// Tenant Execution Indexes
orderSchema.index({ tenant: 1, _id: -1 }); // Fast Cursor Pagination
orderSchema.index({ tenant: 1, status: 1, _id: -1 }); // Fast View Pagination
orderSchema.index({ tenant: 1, 'shipping.phone1': 1 }); // Call Center Lookup
orderSchema.index({ tenant: 1, courier: 1, 'deliveryStatus.deliveredAt': -1 }); // Courier KPI lookups

// Text Search Index (Replaces slow Regex collection scans)
// Weighted so Order ID matches rank higher than random tracking numbers
orderSchema.index(
    { orderId: 'text', 'trackingInfo.trackingNumber': 'text', 'shipping.phone1': 'text' },
    { weights: { orderId: 10, 'trackingInfo.trackingNumber': 5, 'shipping.phone1': 2 }, name: "order_text_idx" }
);

module.exports = mongoose.model('Order', orderSchema);
