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
const SalesChannelProductMapping = require('../../models/SalesChannelProductMapping');
const SalesChannelSyncLog = require('../../models/SalesChannelSyncLog');
const AppError = require('../../shared/errors/AppError');
const logger = require('../../shared/logger');
const { createOrder } = require('../orders/order.service');
const cacheService = require('../../services/cacheService');
const { getCommunesForWilaya } = require('../../shared/constants/algeriaCommunes');
const { encryptSensitiveKeys, decryptSensitiveKeys } = require('../../shared/utils/credentialEncryption');
const { getStoreAdapter, isStoreChannel } = require('../../integrations/stores/storeAdapterFactory');
const { importOrderBatch } = require('./orderImport.service');
const { eventBus, EVENTS } = require('../../shared/events/eventBus');
const shipmentService = require('../dispatch/shipment.service');

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text) {
    let slug = text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}_-]+/gu, '')
        .replace(/--+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80);
    if (!slug) slug = crypto.randomBytes(4).toString('hex');
    return slug;
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
    const { name, description, channelType, config, domain, pixels, branding, defaultCourier } = body;

    if (!name) throw AppError.validationFailed({ name: 'Channel name is required' });

    const slug = slugify(name);
    const existing = await SalesChannel.findOne({ tenant: tenantId, slug, deletedAt: null });
    if (existing) throw AppError.conflict('A channel with this name already exists', 'DUPLICATE_CHANNEL');

    const type = channelType || 'landing_page';
    const isStore = isStoreChannel(type);

    // For landing pages, validate subdomain uniqueness
    let subdomain;
    if (type === 'landing_page') {
        subdomain = domain?.subdomain || slug;
        const subdomainTaken = await SalesChannel.findOne({ 'domain.subdomain': subdomain, deletedAt: null });
        if (subdomainTaken) throw AppError.conflict('This subdomain is already taken', 'SUBDOMAIN_TAKEN');
    }

    // Encrypt sensitive config keys for store channels
    const encryptedConfig = config ? encryptSensitiveKeys(config) : new Map();

    const channel = await SalesChannel.create({
        tenant: tenantId,
        name,
        slug,
        description,
        channelType: type,
        config: encryptedConfig,
        integration: {
            status: isStore ? 'pending_setup' : 'connected',
            syncEnabled: isStore,
        },
        domain: type === 'landing_page'
            ? { type: domain?.type || 'subdomain', subdomain, customDomain: domain?.customDomain }
            : undefined,
        pixels: pixels || {},
        branding: branding || {},
        defaultCourier: defaultCourier || null
    });

    return channel;
};

/**
 * Compute real stats from Order collection for given channel IDs.
 */
async function computeChannelStats(tenantId, channelIds) {
    if (!channelIds.length) return {};

    const agg = await Order.aggregate([
        {
            $match: {
                tenant: tenantId,
                'salesChannelSource.salesChannel': { $in: channelIds },
                deletedAt: null,
            }
        },
        {
            $group: {
                _id: '$salesChannelSource.salesChannel',
                totalOrders: { $sum: 1 },
                totalRevenue: {
                    $sum: {
                        $cond: [
                            { $in: ['$status', ['Delivered', 'Paid']] },
                            '$totalAmount',
                            0
                        ]
                    }
                },
                confirmed: {
                    $sum: {
                        $cond: [
                            { $in: ['$status', ['Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid']] },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const map = {};
    for (const row of agg) {
        map[row._id.toString()] = {
            totalOrders: row.totalOrders,
            totalRevenue: row.totalRevenue,
            confirmationRate: row.totalOrders > 0
                ? parseFloat(((row.confirmed / row.totalOrders) * 100).toFixed(1))
                : 0,
        };
    }
    return map;
}

exports.listChannels = async ({ tenantId, channelType }) => {
    const filter = { tenant: tenantId, deletedAt: null };
    if (channelType) filter.channelType = channelType;

    const channels = await SalesChannel.find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

    // Overlay real stats from Order collection
    const channelIds = channels.map(c => c._id);
    const statsMap = await computeChannelStats(tenantId, channelIds);

    for (const ch of channels) {
        const real = statsMap[ch._id.toString()];
        if (real) {
            ch.stats = { ...ch.stats, ...real };
        }
    }

    return channels;
};

exports.getChannel = async ({ tenantId, channelId }) => {
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null }).lean();
    if (!channel) throw AppError.notFound('Sales Channel');

    // Overlay real stats
    const statsMap = await computeChannelStats(tenantId, [channel._id]);
    const real = statsMap[channel._id.toString()];
    if (real) {
        channel.stats = { ...channel.stats, ...real };
    }

    return channel;
};

exports.updateChannel = async ({ tenantId, channelId, body }) => {
    const ALLOWED = ['name', 'description', 'domain', 'pixels', 'branding', 'defaultCourier', 'status'];
    const update = {};
    for (const key of ALLOWED) {
        if (body[key] !== undefined) update[key] = body[key];
    }

    if (update.name) update.slug = slugify(update.name);

    // Handle config updates (encrypt sensitive keys)
    if (body.config) {
        update.config = encryptSensitiveKeys(body.config);
    }

    // Handle integration settings
    if (body.integration) {
        const allowed = ['syncEnabled'];
        for (const key of allowed) {
            if (body.integration[key] !== undefined) {
                update[`integration.${key}`] = body.integration[key];
            }
        }
    }

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
        .limit(500)
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
        'title', 'slug', 'seo', 'blocks', 'productOverrides', 'variantDisplay',
        'formConfig', 'theme', 'pixels', 'status'
    ];
    const update = {};
    for (const key of ALLOWED) {
        if (body[key] !== undefined) update[key] = body[key];
    }
    if (update.slug) {
        update.slug = slugify(update.slug);
    } else if (update.title) {
        update.slug = slugify(update.title);
    }

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

exports.clonePage = async ({ tenantId, pageId, targetChannelId }) => {
    const source = await LandingPage.findOne({ _id: pageId, tenant: tenantId, deletedAt: null }).lean();
    if (!source) throw AppError.notFound('Landing Page');

    const channelId = targetChannelId || source.salesChannel;
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null });
    if (!channel) throw AppError.notFound('Sales Channel');

    const baseSlug = slugify(source.title + ' copy');
    let slug = baseSlug;
    let attempt = 0;
    while (await LandingPage.exists({ salesChannel: channelId, slug, deletedAt: null })) {
        attempt++;
        slug = `${baseSlug}-${attempt}`;
    }

    const clone = await LandingPage.create({
        tenant: tenantId,
        salesChannel: channelId,
        product: source.product,
        title: source.title + ' (Copy)',
        slug,
        status: 'draft',
        seo: source.seo || {},
        blocks: source.blocks || [],
        productOverrides: source.productOverrides || {},
        variantDisplay: source.variantDisplay || {},
        formConfig: source.formConfig || {},
        theme: source.theme || {},
        pixels: source.pixels || {},
        stats: { views: 0, uniqueVisitors: 0, orders: 0, revenue: 0, conversionRate: 0 }
    });

    await SalesChannel.updateOne({ _id: channelId }, { $inc: { 'stats.totalPages': 1 } });

    return clone;
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
 * Store homepage — returns channel info + all published landing pages.
 */
exports.getStorefrontHome = async ({ channelSlug }) => {
    const cacheKey = `storefront-home:${channelSlug}`;
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

    const pages = await LandingPage.find({
        salesChannel: channel._id,
        status: 'published',
        deletedAt: null
    })
        .populate('product', 'name images description')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

    // Build page cards with product info and pricing
    const pageCards = pages.map(page => ({
        _id: page._id,
        title: page.title,
        slug: page.slug,
        product: {
            name: page.productOverrides?.displayName || page.product?.name,
            image: page.productOverrides?.images?.[0] || page.product?.images?.[0],
            description: page.productOverrides?.description || page.product?.description,
            promotionalPrice: page.productOverrides?.promotionalPrice
        },
        theme: page.theme,
        stats: {
            views: page.stats?.views ?? 0,
            orders: page.stats?.orders ?? 0
        }
    }));

    const result = {
        channel: {
            _id: channel._id,
            name: channel.name,
            slug: channel.slug,
            description: channel.description,
            branding: channel.branding
        },
        pages: pageCards
    };

    cacheService.set(cacheKey, result, 60);
    return result;
};

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

    let coverage = [];
    if (couriers.length) {
        const courierIds = couriers.map(c => c._id);
        coverage = await CourierCoverage.find({
            courierId: { $in: courierIds },
            wilayaCode: String(wilayaCode),
            tenant: tenantId
        }).lean();
    }

    if (coverage.length) {
        // Group by commune from CourierCoverage records
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
    }

    // Fallback: no CourierCoverage records — return all communes from local data
    const communes = getCommunesForWilaya(wilayaCode);
    return communes.map(name => ({
        commune: name,
        homeSupported: true,
        officeSupported: false
    }));
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

    const rules = await CourierPricing.find({ courierId, tenant: tenantId }).sort({ priority: -1 }).limit(500).lean();
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

    // ── Auto-Dispatch ────────────────────────────────────────────────────────
    let trackingNumber = null;
    if (channel.autoDispatch && channel.defaultCourier) {
        try {
            const shipment = await shipmentService.quickDispatch(order._id, channel.tenant);
            trackingNumber = shipment.externalTrackingId || null;
            logger.info({ orderId: order.orderId, trackingNumber }, 'Auto-dispatched storefront order');
        } catch (err) {
            // Auto-dispatch failure is non-fatal — order is created, dispatch can be retried manually
            logger.warn({ err, orderId: order.orderId }, 'Auto-dispatch failed for storefront order');
        }
    }

    return {
        orderId: order.orderId,
        trackingNumber,
        message: page.formConfig?.successMessage || 'Order placed successfully!'
    };
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
            .limit(200)
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

// ═══════════════════════════════════════════════════════════════════════════════
//  WOOCOMMERCE OAUTH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initiate WooCommerce OAuth — called BEFORE channel exists.
 * Stores pending channel data in cache, returns OAuth URL.
 * The channel is only created when the callback receives valid credentials.
 */
exports.initiateWcOAuth = async ({ tenantId, channelData, returnUrl }) => {
    const { name, storeUrl, description } = channelData;
    if (!storeUrl) {
        throw AppError.validationFailed({ storeUrl: 'Store URL is required' });
    }
    if (!name?.trim()) {
        throw AppError.validationFailed({ name: 'Channel name is required' });
    }

    // Generate a one-time state token
    const stateToken = crypto.randomBytes(24).toString('hex');

    // Store pending channel data in cache (10 min TTL)
    cacheService.set(`wc-oauth:${stateToken}`, {
        tenantId: String(tenantId),
        name: name.trim(),
        description: description || '',
        storeUrl: storeUrl.replace(/\/+$/, ''),
        returnUrl: returnUrl || null,
    }, 600);

    // Build the WooCommerce OAuth URL
    const appName = process.env.APP_NAME || 'Octomatic';
    const apiBase = process.env.API_BASE_URL;
    if (!apiBase) {
        throw AppError.validationFailed({ config: 'API_BASE_URL environment variable is required for OAuth (must be HTTPS)' });
    }
    const callbackUrl = `${apiBase}/api/integrations/webhooks/wc-auth/callback`;
    const finalReturnUrl = returnUrl || `${process.env.APP_BASE_URL || apiBase}/sales-channels`;

    const normalizedStoreUrl = storeUrl.replace(/\/+$/, '');
    const params = new URLSearchParams({
        app_name: appName,
        scope: 'read_write',
        user_id: stateToken,
        return_url: finalReturnUrl,
        callback_url: callbackUrl,
    });

    const authUrl = `${normalizedStoreUrl}/wc-auth/v1/authorize?${params.toString()}`;

    return { authUrl, stateToken };
};

/**
 * Generate WooCommerce OAuth URL for an EXISTING channel (reconnect flow).
 */
exports.generateWcAuthUrl = async ({ tenantId, channelId, returnUrl }) => {
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null });
    if (!channel) throw AppError.notFound('Sales Channel');
    if (channel.channelType !== 'woocommerce') {
        throw AppError.validationFailed({ channelType: 'Only WooCommerce channels support OAuth' });
    }

    const configObj = decryptSensitiveKeys(channel.config);
    const storeUrl = configObj.storeUrl;
    if (!storeUrl) {
        throw AppError.validationFailed({ storeUrl: 'Store URL is required. Set it in channel settings first.' });
    }

    const stateToken = crypto.randomBytes(24).toString('hex');

    // Store reconnect data in cache
    cacheService.set(`wc-oauth:${stateToken}`, {
        channelId: String(channelId),
        tenantId: String(tenantId),
        storeUrl: storeUrl.replace(/\/+$/, ''),
        reconnect: true,
        returnUrl: returnUrl || null,
    }, 600);

    const appName = process.env.APP_NAME || 'Octomatic';
    const apiBase = process.env.API_BASE_URL;
    if (!apiBase) {
        throw AppError.validationFailed({ config: 'API_BASE_URL environment variable is required for OAuth (must be HTTPS)' });
    }
    const callbackUrl = `${apiBase}/api/integrations/webhooks/wc-auth/callback`;
    const finalReturnUrl = returnUrl || `${process.env.APP_BASE_URL || apiBase}/sales-channels/${channelId}`;

    const normalizedStoreUrl = storeUrl.replace(/\/+$/, '');
    const params = new URLSearchParams({
        app_name: appName,
        scope: 'read_write',
        user_id: stateToken,
        return_url: finalReturnUrl,
        callback_url: callbackUrl,
    });

    return { authUrl: `${normalizedStoreUrl}/wc-auth/v1/authorize?${params.toString()}` };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  STORE INTEGRATION METHODS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Test connection to an external store.
 */
exports.testConnection = async ({ tenantId, channelId }) => {
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null });
    if (!channel) throw AppError.notFound('Sales Channel');
    if (!isStoreChannel(channel.channelType)) {
        throw AppError.validationFailed({ channelType: 'This channel type does not support connection testing' });
    }

    const decryptedConfig = decryptSensitiveKeys(channel.config);

    if (!decryptedConfig.storeUrl || !decryptedConfig.consumerKey || !decryptedConfig.consumerSecret) {
        throw AppError.validationFailed({
            credentials: 'Store credentials could not be decrypted. Please reconnect the store via OAuth.'
        });
    }

    const adapter = getStoreAdapter(channel, decryptedConfig);
    const result = await adapter.testConnection();

    // Update integration status
    await SalesChannel.updateOne(
        { _id: channelId, tenant: tenantId },
        {
            $set: {
                'integration.status': result.success ? 'connected' : 'error',
                'integration.lastError': result.success ? null : result.message,
            }
        }
    );

    // Log the test
    await SalesChannelSyncLog.create({
        tenant: tenantId,
        salesChannel: channelId,
        syncType: 'test_connection',
        status: result.success ? 'success' : 'failed',
        errors: result.success ? [] : [{ message: result.message }],
    });

    if (!result.success) {
        eventBus.emit(EVENTS.STORE_CONNECTION_ERROR, { tenantId, salesChannelId: channelId, error: result.message });
    }

    return result;
};

/**
 * Register webhooks on the external store.
 */
exports.registerWebhooks = async ({ tenantId, channelId }) => {
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null });
    if (!channel) throw AppError.notFound('Sales Channel');
    if (!isStoreChannel(channel.channelType)) {
        throw AppError.validationFailed({ channelType: 'This channel type does not support webhooks' });
    }

    const decryptedConfig = decryptSensitiveKeys(channel.config);
    const adapter = getStoreAdapter(channel, decryptedConfig);

    // Build callback URL
    const baseUrl = process.env.API_BASE_URL || `${process.env.BASE_URL || 'http://localhost:5000'}`;
    const callbackUrl = `${baseUrl}/api/integrations/webhooks/${channelId}/${channel.channelType}`;

    // Remove existing webhooks first
    if (channel.integration?.webhookId) {
        try {
            await adapter.removeWebhook(channel.integration.webhookId);
        } catch (err) {
            logger.warn({ err, channelId }, 'Failed to remove existing webhooks');
        }
    }

    const result = await adapter.registerWebhook(callbackUrl);

    await SalesChannel.updateOne(
        { _id: channelId, tenant: tenantId },
        {
            $set: {
                'integration.webhookId': result.webhookId,
                'integration.status': 'connected',
            }
        }
    );

    // If webhook returned a secret, store it encrypted
    if (result.secret) {
        const configUpdate = encryptSensitiveKeys({ webhookSecret: result.secret });
        await SalesChannel.updateOne(
            { _id: channelId, tenant: tenantId },
            { $set: { 'config.webhookSecret': configUpdate.get('webhookSecret') } }
        );
    }

    return { message: 'Webhooks registered successfully', webhookId: result.webhookId };
};

/**
 * Manually sync orders from an external store (polling).
 */
exports.syncOrders = async ({ tenantId, channelId, since }) => {
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null });
    if (!channel) throw AppError.notFound('Sales Channel');
    if (!isStoreChannel(channel.channelType)) {
        throw AppError.validationFailed({ channelType: 'This channel type does not support order sync' });
    }

    const decryptedConfig = decryptSensitiveKeys(channel.config);

    // Validate credentials were decrypted successfully
    if (!decryptedConfig.storeUrl || !decryptedConfig.consumerKey || !decryptedConfig.consumerSecret) {
        throw AppError.validationFailed({
            credentials: 'Store credentials could not be decrypted. Please reconnect the store via OAuth.'
        });
    }

    const adapter = getStoreAdapter(channel, decryptedConfig);

    // Default: sync orders from last 24h or last sync time
    const syncSince = since
        ? new Date(since)
        : (channel.integration?.lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000));

    // Fetch orders page by page
    const allOrders = [];
    let page = 1;
    let hasMore = true;
    const maxPages = 20; // Safety limit

    try {
        while (hasMore && page <= maxPages) {
            const result = await adapter.fetchOrders({ since: syncSince, page, perPage: 50 });
            const normalized = result.orders.map(o => adapter.normalizeOrder(o));
            allOrders.push(...normalized);
            hasMore = result.hasMore;
            page++;
        }
    } catch (fetchErr) {
        const status = fetchErr.response?.status;
        if (status === 401) throw AppError.unauthorized('Store API credentials are invalid. Please reconnect.');
        if (status === 404) throw AppError.notFound('Store API endpoint not found. Check the store URL.');
        throw new AppError(fetchErr.message || 'Failed to fetch orders from store', status >= 400 && status < 500 ? status : 502);
    }

    if (allOrders.length === 0) {
        // Update sync time even if no orders
        await SalesChannel.updateOne(
            { _id: channelId, tenant: tenantId },
            { $set: { 'integration.lastSyncAt': new Date() } }
        );
        return { imported: 0, skipped: 0, errors: [], total: 0 };
    }

    // Import through the batch pipeline
    const result = await importOrderBatch({
        tenantId,
        salesChannelId: channelId,
        normalizedOrders: allOrders,
        importMethod: 'sync',
        syncType: 'poll_sync',
    });

    return { ...result, total: allOrders.length };
};

/**
 * Get sync logs for a channel.
 */
exports.getSyncLogs = async ({ tenantId, channelId, page = 1, limit = 20 }) => {
    const skip = (page - 1) * Math.min(limit, 100);
    const [logs, total] = await Promise.all([
        SalesChannelSyncLog.find({ tenant: tenantId, salesChannel: channelId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Math.min(limit, 100))
            .lean(),
        SalesChannelSyncLog.countDocuments({ tenant: tenantId, salesChannel: channelId }),
    ]);
    return { logs, total, page, limit };
};

/**
 * Get channel health summary for the integration dashboard.
 */
exports.getChannelHealthSummary = async ({ tenantId }) => {
    const channels = await SalesChannel.find({ tenant: tenantId, deletedAt: null })
        .select('name slug channelType status integration stats defaultCourier branding.primaryColor')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

    // Get today's import counts per channel
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayImports = await SalesChannelSyncLog.aggregate([
        {
            $match: {
                tenant: tenantId,
                createdAt: { $gte: todayStart },
            }
        },
        {
            $group: {
                _id: '$salesChannel',
                ordersToday: { $sum: '$ordersImported' },
                errorsToday: { $sum: { $size: '$errors' } },
            }
        }
    ]);

    const importMap = {};
    for (const row of todayImports) {
        importMap[row._id.toString()] = row;
    }

    return channels.map(ch => ({
        ...ch,
        ordersToday: importMap[ch._id.toString()]?.ordersToday || 0,
        errorsToday: importMap[ch._id.toString()]?.errorsToday || 0,
    }));
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCT MAPPING CRUD
// ═══════════════════════════════════════════════════════════════════════════════

exports.getProductMappings = async ({ tenantId, channelId }) => {
    return SalesChannelProductMapping.find({
        tenant: tenantId,
        salesChannel: channelId,
        deletedAt: null,
    })
        .populate('internalVariant', 'sku attributes price')
        .populate('internalProduct', 'name')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();
};

exports.createProductMapping = async ({ tenantId, channelId, body }) => {
    const { externalProductId, externalVariantId, externalProductName, externalSku, internalVariant, internalProduct } = body;

    if (!externalProductId || !internalVariant) {
        throw AppError.validationFailed({ fields: 'externalProductId and internalVariant are required' });
    }

    // Verify channel exists
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null });
    if (!channel) throw AppError.notFound('Sales Channel');

    // Verify variant belongs to tenant
    const variant = await ProductVariant.findOne({ _id: internalVariant, tenant: tenantId });
    if (!variant) throw AppError.notFound('Product Variant');

    const mapping = await SalesChannelProductMapping.create({
        tenant: tenantId,
        salesChannel: channelId,
        externalProductId,
        externalVariantId: externalVariantId || null,
        externalProductName: externalProductName || null,
        externalSku: externalSku || null,
        internalVariant,
        internalProduct: internalProduct || variant.productId,
    });

    return mapping;
};

exports.deleteProductMapping = async ({ tenantId, channelId, mappingId }) => {
    const mapping = await SalesChannelProductMapping.findOneAndUpdate(
        { _id: mappingId, tenant: tenantId, salesChannel: channelId, deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { returnDocument: 'after' }
    );
    if (!mapping) throw AppError.notFound('Product Mapping');
    return mapping;
};

/**
 * Fetch products from the external store (for mapping).
 */
exports.fetchExternalProducts = async ({ tenantId, channelId, page = 1 }) => {
    const channel = await SalesChannel.findOne({ _id: channelId, tenant: tenantId, deletedAt: null });
    if (!channel) throw AppError.notFound('Sales Channel');
    if (!isStoreChannel(channel.channelType)) {
        throw AppError.validationFailed({ channelType: 'This channel type does not support product fetching' });
    }

    const decryptedConfig = decryptSensitiveKeys(channel.config);
    const adapter = getStoreAdapter(channel, decryptedConfig);
    const result = await adapter.fetchProducts({ page, perPage: 50 });

    // Normalize products for display
    const products = result.products.map(p => adapter.normalizeProduct(p));
    return { products, hasMore: result.hasMore };
};
