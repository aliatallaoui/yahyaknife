const mongoose = require('mongoose');

const courierPricingSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier', required: true, index: true },
    
    // Core Engine Types
    ruleType: { 
        type: String, 
        enum: ['Flat', 'Wilaya', 'Wilaya+Commune', 'Product', 'Weight', 'Special'], 
        required: true, 
        default: 'Wilaya' 
    },
    
    // Geographical
    wilayaCode: { type: String }, // Used if ruleType is Wilaya or Wilaya+Commune
    commune: { type: String }, // Used if ruleType is Wilaya+Commune
    deliveryType: { type: Number, enum: [0, 1] }, // 0=Home, 1=Office(Stop Desk). Can be null if generic
    
    // Product & Weight Based Rules
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    minWeight: { type: Number },
    maxWeight: { type: Number },

    // The result
    price: { type: Number, required: true },
    
    // Evaluation Order
    // Higher priority rules match first (e.g., specific Product rule = 10 overrides general Wilaya = 5)
    priority: { type: Number, default: 0 }

}, { timestamps: true });

courierPricingSchema.index({ tenant: 1, courierId: 1, wilayaCode: 1 });

module.exports = mongoose.model('CourierPricing', courierPricingSchema);
