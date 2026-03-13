const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// ── Page Builder Block Schema ───────────────────────────────────────────────

const blockSchema = new mongoose.Schema({
    id: { type: String, default: () => uuidv4() },
    type: {
        type: String,
        required: true,
        enum: [
            'hero', 'productGallery', 'benefits', 'variantSelector', 'codForm',
            'image', 'video', 'reviews', 'faq', 'cta', 'guarantee',
            'countdown', 'trustBadges', 'deliveryInfo', 'stockScarcity',
            'text', 'testimonials', 'spacer'
        ]
    },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    isVisible: { type: Boolean, default: true }
}, { _id: false });

// ── Form Field Config ───────────────────────────────────────────────────────

const formFieldSchema = new mongoose.Schema({
    required: { type: Boolean, default: true },
    label: { type: String },
    visible: { type: Boolean, default: true },
    placeholder: { type: String }
}, { _id: false });

// ── Main Landing Page Schema ────────────────────────────────────────────────

const landingPageSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    salesChannel: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesChannel', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

    // ── Identity ────────────────────────────────────────────────────────────
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },

    // ── SEO ─────────────────────────────────────────────────────────────────
    seo: {
        title: { type: String, maxlength: 70 },
        description: { type: String, maxlength: 160 },
        ogImage: { type: String },
        keywords: [{ type: String, maxlength: 50 }]
    },

    // ── Page Builder Blocks (ordered) ───────────────────────────────────────
    blocks: {
        type: [blockSchema],
        default: () => [
            { id: uuidv4(), type: 'hero', settings: { headline: '', subheadline: '' }, isVisible: true },
            { id: uuidv4(), type: 'productGallery', settings: {}, isVisible: true },
            { id: uuidv4(), type: 'benefits', settings: { items: [] }, isVisible: true },
            { id: uuidv4(), type: 'variantSelector', settings: {}, isVisible: true },
            { id: uuidv4(), type: 'codForm', settings: {}, isVisible: true },
            { id: uuidv4(), type: 'testimonials', settings: { items: [] }, isVisible: true },
            { id: uuidv4(), type: 'faq', settings: { items: [] }, isVisible: true },
            { id: uuidv4(), type: 'trustBadges', settings: {}, isVisible: true }
        ]
    },

    // ── Product Display Overrides ───────────────────────────────────────────
    productOverrides: {
        displayName: { type: String, maxlength: 200 },
        description: { type: String, maxlength: 5000 },
        images: [{ type: String }],
        promotionalPrice: { type: Number, min: 0 },
        hiddenVariants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' }],
        defaultVariant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
        showStockLevel: { type: Boolean, default: false },
        showOriginalPrice: { type: Boolean, default: true }
    },

    // ── Variant Display Style ───────────────────────────────────────────────
    variantDisplay: {
        style: {
            type: String,
            enum: ['dropdown', 'buttons', 'images', 'colorSwatches', 'cards', 'radio', 'grid'],
            default: 'buttons'
        },
        showPrice: { type: Boolean, default: true },
        showStock: { type: Boolean, default: false },
        showImages: { type: Boolean, default: true }
    },

    // ── COD Form Configuration ──────────────────────────────────────────────
    formConfig: {
        fields: {
            name: { type: formFieldSchema, default: () => ({ required: true, visible: true }) },
            phone: { type: formFieldSchema, default: () => ({ required: true, visible: true }) },
            phone2: { type: formFieldSchema, default: () => ({ required: false, visible: true }) },
            wilaya: { type: formFieldSchema, default: () => ({ required: true, visible: true }) },
            commune: { type: formFieldSchema, default: () => ({ required: true, visible: true }) },
            address: { type: formFieldSchema, default: () => ({ required: true, visible: true }) },
            deliveryType: { type: formFieldSchema, default: () => ({ required: false, visible: true }) },
            quantity: { type: formFieldSchema, default: () => ({ required: false, visible: true }) },
            notes: { type: formFieldSchema, default: () => ({ required: false, visible: false }) }
        },
        maxQuantity: { type: Number, default: 10, min: 1 },
        submitButtonText: { type: String, default: 'Order Now', maxlength: 50 },
        successMessage: { type: String, default: 'Order placed successfully!', maxlength: 500 },
        enableDuplicateDetection: { type: Boolean, default: true },
        enableFraudCheck: { type: Boolean, default: true }
    },

    // ── Page-level Pixel Overrides ──────────────────────────────────────────
    pixels: {
        metaPixelId: { type: String, trim: true, maxlength: 30 },
        tiktokPixelId: { type: String, trim: true, maxlength: 30 },
        googleAnalyticsId: { type: String, trim: true, maxlength: 30 },
        googleTagManagerId: { type: String, trim: true, maxlength: 30 }
    },

    // ── Page Styling ────────────────────────────────────────────────────────
    theme: {
        primaryColor: { type: String, default: '#2563eb' },
        accentColor: { type: String, default: '#f59e0b' },
        backgroundColor: { type: String, default: '#ffffff' },
        textColor: { type: String, default: '#1f2937' },
        buttonStyle: { type: String, enum: ['rounded', 'square', 'pill'], default: 'rounded' },
        layout: { type: String, enum: ['standard', 'minimal', 'bold'], default: 'standard' }
    },

    // ── Lifecycle ───────────────────────────────────────────────────────────
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    publishedAt: { type: Date },
    deletedAt: { type: Date, default: null },

    // ── Denormalized Stats ──────────────────────────────────────────────────
    stats: {
        views: { type: Number, default: 0 },
        uniqueVisitors: { type: Number, default: 0 },
        orders: { type: Number, default: 0 },
        revenue: { type: Number, default: 0 },
        conversionRate: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// Unique slug per sales channel (active records only)
landingPageSchema.index(
    { salesChannel: 1, slug: 1 },
    { unique: true, partialFilterExpression: { deletedAt: null } }
);
landingPageSchema.index({ tenant: 1, salesChannel: 1, status: 1 });
landingPageSchema.index({ tenant: 1, status: 1, _id: -1 });
landingPageSchema.index({ product: 1 });

module.exports = mongoose.model('LandingPage', landingPageSchema);
