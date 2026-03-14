/**
 * SalesChannelService — business logic for Sales Channels & Landing Pages.
 *
 * Handles CRUD for channels/pages, storefront data serving,
 * COD order submission via OrderService, and analytics aggregation.
 */

const crypto = require('crypto');
const SalesChannel = require('../../models/SalesChannel');
const LandingPage = require('../../models/LandingPage');
const PageEvent = require('../../models/PageEvent');
const Product = require('../../models/Product');
const ProductVariant = require('../../models/ProductVariant');
const CourierCoverage = require('../../models/CourierCoverage');
const CourierPricing = require('../../models/CourierPricing');
const Courier = require('../../models/Courier');
const Customer = require('../../models/Customer');
const Order = require('../../models/Order');
const AppError = require('../../shared/errors/AppError');
const logger = require('../../shared/logger');
const { createOrder } = require('../orders/order.service');
const cacheService = require('../../services/cacheService');

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80);
}

function generateOrderId(tenantId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LP-${ts}-${rand}`;
}

function hashIp(ip) {
    return crypto.createHash('sha256').update(ip || 'unknown').digest('hex').substring(0, 16);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SALES CHANNEL CRUD
// ═══════════════════════════════════════════════════════════════════════════════

exports.createChannel = async ({ tenantId, body }) => {
    const { name, description, domain, pixels, branding, defaultCourier } = body;

    if (!name) throw AppError.validationFailed({ name: 'Channel name is required' });

    const slug = slugify(name);
    const existing = await SalesChannel.findOne({ tenant: tenantId, slug, deletedAt: null });
    if (existing) throw AppError.conflict('A channel with this name already exists', 'DUPLICATE_CHANNEL');

    // Validate subdomain uniqueness globally
    const subdomain = domain?.subdomain || slug;
    const subdomainTaken = await SalesChannel.findOne({ 'domain.subdomain': subdomain, deletedAt: null });
    if (subdomainTaken) throw AppError.conflict('This subdomain is already taken', 'SUBDOMAIN_TAKEN');

    const channel = await SalesChannel.create({
        tenant: tenantId,
        name,
        slug,
        description,
        domain: { type: domain?.type || 'subdomain', subdomain, customDomain: domain?.customDomain },
        pixels: pixels || {},
        branding: branding || {},
        defaultCourier: defaultCourier || null
    });

    return channel;
};

exports.listChannels = async ({ tenantId }) => {
    return SalesChannel.find({ tenant: tenantId, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean();
};

exports.getChannel = async ({ tenantId, channelId }) => {
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null }).lean();
    if (!channel) throw AppError.notFound('Sales Channel');
    return channel;
};

exports.updateChannel = async ({ tenantId, channelId, body }) => {
    const ALLOWED = ['name', 'description', 'domain', 'pixels', 'branding', 'defaultCourier', 'status'];
    const update = {};
    for (const key of ALLOWED) {
        if (body[key] !== undefined) update[key] = body[key];
    }

    if (update.name) update.slug = slugify(update.name);

    const channel = await SalesChannel.findOneAndUpdate(
        { _id: channelId, tenant: tenantId, deletedAt: null },
        { $set: update },
        { returnDocument: 'after', runValidators: true }
    );
    if (!channel) throw AppError.notFound('Sales Channel');
    return channel;
};

exports.deleteChannel = async ({ tenantId, channelId }) => {
    const channel = await SalesChannel.findOneAndUpdate(
        { _id: channelId, tenant: tenantId, deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { returnDocument: 'after' }
    );
    if (!channel) throw AppError.notFound('Sales Channel');

    // Soft-delete all pages in this channel
    await LandingPage.updateMany(
        { salesChannel: channelId, tenant: tenantId, deletedAt: null },
        { $set: { deletedAt: new Date(), status: 'archived' } }
    );

    return channel;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  LANDING PAGE CRUD
// ═══════════════════════════════════════════════════════════════════════════════

exports.createPage = async ({ tenantId, channelId, body }) => {
    const { title, productId, seo, variantDisplay, formConfig, theme, pixels } = body;

    if (!title || !productId) {
        throw AppError.validationFailed({ title: 'Title and product are required' });
    }

    // Verify channel exists
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null });
    if (!channel) throw AppError.notFound('Sales Channel');

    // Verify product exists and belongs to this tenant
    const product = await Product.findOne({ _id: productId, tenant: tenantId });
    if (!product) throw AppError.notFound('Product');

    const slug = slugify(title);

    const page = await LandingPage.create({
        tenant: tenantId,
        salesChannel: channelId,
        product: productId,
        title,
        slug,
        seo: seo || {},
        variantDisplay: variantDisplay || {},
        formConfig: formConfig || {},
        theme: theme || {},
        pixels: pixels || {}
    });

    // Increment channel page count
    await SalesChannel.updateOne({ _id: channelId }, { $inc: { 'stats.totalPages': 1 } });

    return page;
};

exports.listPages = async ({ tenantId, channelId, status }) => {
    const filter = { tenant: tenantId, salesChannel: channelId, deletedAt: null };
    if (status) filter.status = status;

    return LandingPage.find(filter)
        .populate('product', 'name images')
        .sort({ createdAt: -1 })
        .lean();
};

exports.getPage = async ({ tenantId, pageId }) => {
    const page = await LandingPage.findOne({ _id: pageId, tenant: tenantId, deletedAt: null })
        .populate('product', 'name images description')
        .lean();
    if (!page) throw AppError.notFound('Landing Page');
    return page;
};

exports.updatePage = async ({ tenantId, pageId, body }) => {
    const ALLOWED = [
        'title', 'seo', 'blocks', 'productOverrides', 'variantDisplay',
        'formConfig', 'theme', 'pixels', 'status'
    ];
    const update = {};
    for (const key of ALLOWED) {
        if (body[key] !== undefined) update[key] = body[key];
    }
    if (update.title) update.slug = slugify(update.title);

    const page = await LandingPage.findOneAndUpdate(
        { _id: pageId, tenant: tenantId, deletedAt: null },
        { $set: update },
        { returnDocument: 'after', runValidators: true }
    );
    if (!page) throw AppError.notFound('Landing Page');
    return page;
};

exports.publishPage = async ({ tenantId, pageId }) => {
    const page = await LandingPage.findOneAndUpdate(
        { _id: pageId, tenant: tenantId, deletedAt: null },
        { $set: { status: 'published', publishedAt: new Date() } },
        { returnDocument: 'after' }
    );
    if (!page) throw AppError.notFound('Landing Page');
    return page;
};

exports.unpublishPage = async ({ tenantId, pageId }) => {
    const page = await LandingPage.findOneAndUpdate(
        { _id: pageId, tenant: tenantId, deletedAt: null },
        { $set: { status: 'draft', publishedAt: null } },
        { returnDocument: 'after' }
    );
    if (!page) throw AppError.notFound('Landing Page');
    return page;
};

exports.deletePage = async ({ tenantId, pageId }) => {
    const page = await LandingPage.findOneAndUpdate(
        { _id: pageId, tenant: tenantId, deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { returnDocument: 'after' }
    );
    if (!page) throw AppError.notFound('Landing Page');

    await SalesChannel.updateOne(
        { _id: page.salesChannel },
        { $inc: { 'stats.totalPages': -1 } }
    );

    return page;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC STOREFRONT API (no auth required)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve a published landing page by channel slug + page slug.
 * Returns all data needed to render the storefront page.
 */
exports.getStorefrontPage = async ({ channelSlug, pageSlug }) => {
    const cacheKey = `storefront:${channelSlug}:${pageSlug}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const channel = await SalesChannel.findOne({
        $or: [
            { slug: channelSlug, deletedAt: null },
            { 'domain.subdomain': channelSlug, deletedAt: null },
            { 'domain.customDomain': channelSlug, deletedAt: null }
        ]
    }).lean();

    if (!channel || channel.status !== 'active') throw AppError.notFound('Store');

    const page = await LandingPage.findOne({
        salesChannel: channel._id,
        slug: pageSlug,
        status: 'published',
        deletedAt: null
    }).lean();

    if (!page) throw AppError.notFound('Page');

    // Fetch product + variants (scoped to channel's tenant)
    const product = await Product.findOne({ _id: page.product, tenant: channel.tenant }).lean();
    if (!product) throw AppError.notFound('Product');

    let variants = await ProductVariant.find({
        tenant: channel.tenant,
        productId: product._id,
        status: 'Active'
    }).select('sku attributes price images totalStock reservedStock').lean();

    // Apply overrides: filter hidden variants
    if (page.productOverrides?.hiddenVariants?.length) {
        const hiddenSet = new Set(page.productOverrides.hiddenVariants.map(String));
        variants = variants.filter(v => !hiddenSet.has(v._id.toString()));
    }

    // Strip cost data from public response
    variants = variants.map(v => ({
        _id: v._id,
        sku: v.sku,
        attributes: v.attributes,
        price: v.price,
        images: v.images,
        available: (v.totalStock || 0) - (v.reservedStock || 0) > 0,
        availableStock: page.productOverrides?.showStockLevel
            ? Math.max(0, (v.totalStock || 0) - (v.reservedStock || 0))
            : undefined
    }));

    // Merge pixel settings (page overrides > channel defaults)
    const pixels = {
        metaPixelId: page.pixels?.metaPixelId || channel.pixels?.metaPixelId,
        tiktokPixelId: page.pixels?.tiktokPixelId || channel.pixels?.tiktokPixelId,
        googleAnalyticsId: page.pixels?.googleAnalyticsId || channel.pixels?.googleAnalyticsId,
        googleTagManagerId: page.pixels?.googleTagManagerId || channel.pixels?.googleTagManagerId
    };

    const result = {
        channel: {
            _id: channel._id,
            name: channel.name,
            branding: channel.branding
        },
        page: {
            _id: page._id,
            title: page.title,
            seo: page.seo,
            blocks: page.blocks.filter(b => b.isVisible),
            productOverrides: page.productOverrides,
            variantDisplay: page.variantDisplay,
            formConfig: page.formConfig,
            theme: page.theme
        },
        product: {
            _id: product._id,
            name: page.productOverrides?.displayName || product.name,
            description: page.productOverrides?.description || product.description,
            images: page.productOverrides?.images?.length ? page.productOverrides.images : product.images
        },
        variants,
        pixels,
        tenant: channel.tenant
    };

    cacheService.set(cacheKey, result, 60); // 1 min cache
    return result;
};

/**
 * Preview a page (draft or published) — requires auth.
 * Same structure as getStorefrontPage but ignores publish status.
 */
exports.previewPage = async ({ tenantId, channelId, pageId }) => {
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null }).lean();
    if (!channel) throw AppError.notFound('Sales Channel');

    const page = await LandingPage.findOne({ _id: pageId, salesChannel: channelId, deletedAt: null }).lean();
    if (!page) throw AppError.notFound('Page');

    const product = await Product.findOne({ _id: page.product, tenant: channel.tenant }).lean();
    if (!product) throw AppError.notFound('Product');

    let variants = await ProductVariant.find({ tenant: channel.tenant, productId: product._id, status: 'Active' })
        .select('sku attributes price images totalStock reservedStock').lean();

    if (page.productOverrides?.hiddenVariants?.length) {
        const hiddenSet = new Set(page.productOverrides.hiddenVariants.map(String));
        variants = variants.filter(v => !hiddenSet.has(v._id.toString()));
    }

    variants = variants.map(v => ({
        _id: v._id, sku: v.sku, attributes: v.attributes, price: v.price, images: v.images,
        available: (v.totalStock || 0) - (v.reservedStock || 0) > 0,
        availableStock: page.productOverrides?.showStockLevel ? Math.max(0, (v.totalStock || 0) - (v.reservedStock || 0)) : undefined
    }));

    return {
        channel: { _id: channel._id, name: channel.name, slug: channel.slug, branding: channel.branding },
        page: {
            _id: page._id, title: page.title, slug: page.slug, status: page.status, seo: page.seo,
            blocks: page.blocks.filter(b => b.isVisible !== false),
            productOverrides: page.productOverrides, variantDisplay: page.variantDisplay,
            formConfig: page.formConfig, theme: page.theme
        },
        product: {
            _id: product._id,
            name: page.productOverrides?.displayName || product.name,
            description: page.productOverrides?.description || product.description,
            images: page.productOverrides?.images?.length ? page.productOverrides.images : product.images
        },
        variants,
        tenant: channel.tenant
    };
};

/**
 * Get courier coverage for a wilaya (used by storefront COD form).
 */
exports.getStorefrontCoverage = async ({ tenantId, wilayaCode }) => {
    // Find active couriers for tenant
    const couriers = await Courier.find({ tenant: tenantId, status: 'Active' }).select('_id name').lean();
    if (!couriers.length) return [];

    const courierIds = couriers.map(c => c._id);
    const coverage = await CourierCoverage.find({
        courierId: { $in: courierIds },
        wilayaCode: String(wilayaCode),
        tenant: tenantId
    }).lean();

    // Group by commune
    const communeMap = {};
    for (const cov of coverage) {
        if (!communeMap[cov.commune]) {
            communeMap[cov.commune] = {
                commune: cov.commune,
                homeSupported: false,
                officeSupported: false
            };
        }
        if (cov.homeSupported) communeMap[cov.commune].homeSupported = true;
        if (cov.officeSupported) communeMap[cov.commune].officeSupported = true;
    }

    return Object.values(communeMap);
};

/**
 * Calculate delivery price for a storefront order.
 */
exports.calculateStorefrontDeliveryPrice = async ({ tenantId, channelId, wilayaCode, commune, deliveryType }) => {
    // Use channel's default courier, or find first active courier
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId }).lean();
    let courierId = channel?.defaultCourier;

    if (!courierId) {
        const fallback = await Courier.findOne({ tenant: tenantId, status: 'Active' }).select('_id').lean();
        courierId = fallback?._id;
    }

    if (!courierId) return { price: null, courier: null };

    const rules = await CourierPricing.find({ courierId, tenant: tenantId }).sort({ priority: -1 }).lean();
    let matched = null;

    for (const rule of rules) {
        if (rule.ruleType === 'Wilaya+Commune' && rule.wilayaCode === String(wilayaCode) && rule.commune === commune) {
            if (deliveryType !== undefined && rule.deliveryType !== undefined && rule.deliveryType !== Number(deliveryType)) continue;
            matched = rule; break;
        }
        if (rule.ruleType === 'Wilaya' && rule.wilayaCode === String(wilayaCode) && !matched) {
            matched = rule;
        }
        if (rule.ruleType === 'Flat' && !matched) {
            matched = rule;
        }
    }

    return {
        price: matched?.price ?? null,
        courier: courierId
    };
};

/**
 * Submit a COD order from a storefront landing page.
 */
exports.submitStorefrontOrder = async ({ channelSlug, pageSlug, body, ip }) => {
    // Resolve page
    const channel = await SalesChannel.findOne({
        $or: [
            { slug: channelSlug, deletedAt: null },
            { 'domain.subdomain': channelSlug, deletedAt: null }
        ]
    }).lean();
    if (!channel) throw AppError.notFound('Store');

    const page = await LandingPage.findOne({
        salesChannel: channel._id,
        slug: pageSlug,
        status: 'published',
        deletedAt: null
    }).lean();
    if (!page) throw AppError.notFound('Page');

    const { customerName, phone, phone2, wilayaCode, wilayaName, commune, address,
            deliveryType, variantId, quantity, notes, utm } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!customerName || !phone || !wilayaCode || !commune) {
        throw AppError.validationFailed({
            fields: 'Customer name, phone, wilaya, and commune are required'
        });
    }

    // Phone format validation (Algeria: 05/06/07 + 8 digits)
    const phoneClean = phone.replace(/\s+/g, '');
    if (!/^(0[567]\d{8})$/.test(phoneClean)) {
        throw AppError.validationFailed({ phone: 'Invalid phone number format' });
    }

    // ── Duplicate Detection ─────────────────────────────────────────────────
    if (page.formConfig?.enableDuplicateDetection) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const duplicate = await Order.findOne({
            tenant: channel.tenant,
            'shipping.phone1': phoneClean,
            'salesChannelSource.landingPage': page._id,
            createdAt: { $gte: oneHourAgo },
            deletedAt: null
        }).lean();

        if (duplicate) {
            throw AppError.conflict('An order was already placed with this phone number recently', 'DUPLICATE_ORDER');
        }
    }

    // ── Resolve Variant & Price ─────────────────────────────────────────────
    const variant = await ProductVariant.findOne({ _id: variantId, tenant: channel.tenant }).lean();
    if (!variant) throw AppError.notFound('Product Variant');

    const qty = Math.min(Math.max(Number(quantity) || 1, 1), page.formConfig?.maxQuantity || 10);
    const unitPrice = page.productOverrides?.promotionalPrice || variant.price;

    // ── Courier & Delivery Fee ──────────────────────────────────────────────
    const { price: courierFee, courier: courierId } = await exports.calculateStorefrontDeliveryPrice({
        tenantId: channel.tenant,
        channelId: channel._id,
        wilayaCode,
        commune,
        deliveryType
    });

    // ── Create Order via OrderService ───────────────────────────────────────
    const orderId = generateOrderId(channel.tenant);
    const product = await Product.findOne({ _id: page.product, tenant: channel.tenant }).select('name').lean();

    const order = await createOrder({
        tenantId: channel.tenant,
        userId: null, // storefront — no authenticated user
        body: {
            orderId,
            channel: 'LandingPage',
            customerName,
            customerPhone: phoneClean,
            products: [{
                variantId: variant._id,
                name: product?.name || page.title,
                quantity: qty,
                unitPrice
            }],
            status: 'New',
            courier: courierId || undefined,
            shipping: {
                recipientName: customerName,
                phone1: phoneClean,
                phone2: phone2 || undefined,
                wilayaCode: String(wilayaCode),
                wilayaName: wilayaName || '',
                commune,
                address: address || '',
                deliveryType: Number(deliveryType) || 0
            },
            financials: {
                courierFee: courierFee || 0,
                codAmount: (unitPrice * qty) + (courierFee || 0)
            },
            notes: notes || '',
            tags: ['Landing Page'],
            salesChannelSource: {
                salesChannel: channel._id,
                landingPage: page._id,
                utm: utm || {}
            }
        }
    });

    // ── Update Stats ────────────────────────────────────────────────────────
    const revenue = unitPrice * qty;
    await LandingPage.updateOne({ _id: page._id }, {
        $inc: { 'stats.orders': 1, 'stats.revenue': revenue }
    });
    await SalesChannel.updateOne({ _id: channel._id }, {
        $inc: { 'stats.totalOrders': 1, 'stats.totalRevenue': revenue }
    });

    // Invalidate storefront cache
    cacheService.del(`storefront:${channelSlug}:${pageSlug}`);

    return { orderId: order.orderId, message: page.formConfig?.successMessage || 'Order placed successfully!' };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Track a page event (called from public storefront).
 */
exports.trackEvent = async ({ tenantId, landingPageId, salesChannelId, event, sessionId, visitorId, utm, device, referrer, ip, data }) => {
    try {
        await PageEvent.create({
            tenant: tenantId,
            landingPage: landingPageId,
            salesChannel: salesChannelId,
            event,
            sessionId: sessionId || crypto.randomUUID(),
            visitorId,
            utm,
            device,
            referrer,
            ipHash: hashIp(ip),
            data
        });

        // Increment page view counter
        if (event === 'page_view') {
            await LandingPage.updateOne({ _id: landingPageId }, { $inc: { 'stats.views': 1 } });
        }
    } catch (err) {
        logger.warn({ err, event, landingPageId }, 'Failed to track page event');
    }
};

/**
 * Get analytics for a landing page.
 */
exports.getPageAnalytics = async ({ tenantId, pageId, from, to }) => {
    const page = await LandingPage.findOne({ _id: pageId, tenant: tenantId, deletedAt: null }).lean();
    if (!page) throw AppError.notFound('Landing Page');

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    const matchStage = { landingPage: page._id };
    if (Object.keys(dateFilter).length) matchStage.createdAt = dateFilter;

    const [eventCounts, uniqueVisitors, ordersByWilaya, topVariants] = await Promise.all([
        // Event breakdown
        PageEvent.aggregate([
            { $match: matchStage },
            { $group: { _id: '$event', count: { $sum: 1 } } }
        ]),

        // Unique visitors
        PageEvent.aggregate([
            { $match: { ...matchStage, event: 'page_view' } },
            { $group: { _id: '$visitorId' } },
            { $count: 'total' }
        ]),

        // Orders by wilaya
        Order.aggregate([
            { $match: { tenant: tenantId, 'salesChannelSource.landingPage': page._id, deletedAt: null } },
            { $group: { _id: '$wilaya', count: { $sum: 1 }, revenue: { $sum: '$finalTotal' } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]),

        // Top variants
        Order.aggregate([
            { $match: { tenant: tenantId, 'salesChannelSource.landingPage': page._id, deletedAt: null } },
            { $unwind: '$products' },
            { $group: { _id: '$products.variantId', name: { $first: '$products.name' }, totalQty: { $sum: '$products.quantity' }, revenue: { $sum: { $multiply: ['$products.quantity', '$products.unitPrice'] } } } },
            { $sort: { totalQty: -1 } },
            { $limit: 10 }
        ])
    ]);

    const events = {};
    for (const e of eventCounts) events[e._id] = e.count;

    const pageViews = events.page_view || 0;
    const formSubmits = events.form_submit || 0;
    const ordersCreated = events.order_created || 0;

    return {
        summary: {
            ...page.stats,
            pageViews,
            uniqueVisitors: uniqueVisitors[0]?.total || 0,
            formSubmits,
            ordersCreated,
            conversionRate: pageViews > 0 ? ((page.stats.orders / pageViews) * 100).toFixed(2) : 0,
            averageOrderValue: page.stats.orders > 0 ? (page.stats.revenue / page.stats.orders).toFixed(2) : 0
        },
        ordersByWilaya,
        topVariants
    };
};

/**
 * Get channel-level analytics.
 */
exports.getChannelAnalytics = async ({ tenantId, channelId, from, to }) => {
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null }).lean();
    if (!channel) throw AppError.notFound('Sales Channel');

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    const matchStage = { salesChannel: channel._id };
    if (Object.keys(dateFilter).length) matchStage.createdAt = dateFilter;

    const [eventCounts, pagePerformance] = await Promise.all([
        PageEvent.aggregate([
            { $match: matchStage },
            { $group: { _id: '$event', count: { $sum: 1 } } }
        ]),

        LandingPage.find({ salesChannel: channel._id, deletedAt: null })
            .select('title slug stats status')
            .sort({ 'stats.orders': -1 })
            .lean()
    ]);

    const events = {};
    for (const e of eventCounts) events[e._id] = e.count;

    return {
        channel: {
            name: channel.name,
            stats: channel.stats
        },
        events,
        pages: pagePerformance
    };
};
