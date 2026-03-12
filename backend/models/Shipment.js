const mongoose = require('mongoose');

const shipmentActivitySchema = new mongoose.Schema({
    status: { type: String, required: true },
    date: { type: Date, default: Date.now },
    location: { type: String },
    remarks: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }  // actor (null = system/cron)
});

const shipmentSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // Internal Links
    internalOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    internalOrderId: { type: String, required: true }, // For quick reference/searching

    // Courier Identifiers
    courierProvider: { type: String, default: 'ECOTRACK' },
    externalTrackingId: { type: String }, // Provided by courier API
    externalReference: { type: String },  // Our internal ID sent to the courier

    // Customer & Delivery Info
    customerName: { type: String, required: true },
    phone1: { type: String, required: true },
    phone2: { type: String },
    address: { type: String, required: true },
    commune: { type: String, required: true },
    wilayaCode: { type: String },
    wilayaName: { type: String, required: true },
    postalCode: { type: String },
    gpsLink: { type: String },

    // Package Details
    productName: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    weight: { type: Number, default: 1 }, // in kg
    remark: { type: String },
    boutique: { type: String }, // Store or Sender name

    // Configuration Flags
    operationType: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4], // 1=delivery, 2=exchange, 3=pickup, 4=collection
        default: 1
    },
    deliveryType: {
        type: Number, // 0 = home delivery, 1 = stop desk
        required: true,
        default: 0
    },
    stopDeskFlag: { type: Boolean, default: false },
    fragileFlag: { type: Boolean, default: false },

    // Financial (COD Tracking)
    codAmount: { type: Number, required: true, default: 0 },
    courierFee: { type: Number, default: 0 },
    returnFee: { type: Number, default: 0 },

    // Core Statuses
    shipmentStatus: {
        type: String,
        enum: [
            'Draft',
            'Created in Courier',
            'Validated',
            'In Transit',
            'Out for Delivery',
            'Delivered',
            'Failed Attempt',
            'Return Initiated',
            'Returned',
            'Cancelled'
        ],
        default: 'Draft'
    },
    paymentStatus: {
        type: String,
        enum: [
            'COD_Expected',
            'Delivered_Not_Collected',
            'Collected_Not_Paid',
            'Paid_and_Settled',
            'No_COD'
        ],
        default: 'COD_Expected'
    },

    // Raw tracking integration
    courierStatus: { type: String }, // Raw status from ECOTRACK
    activityHistory: [shipmentActivitySchema],
    labelUrl: { type: String }, // URL to download the PDF label

    // Lifecycle timestamps
    dispatchDate: { type: Date },
    deliveredDate: { type: Date },
    returnRequestedAt: { type: Date },
    returnReceivedAt: { type: Date },
    codCollectedAt: { type: Date },
    codPaidAt: { type: Date }

}, { timestamps: true });

module.exports = mongoose.model('Shipment', shipmentSchema);
