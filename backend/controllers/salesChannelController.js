const salesChannelService = require('../domains/sales-channels/salesChannel.service');
const aiPageGenerator = require('../domains/sales-channels/aiPageGenerator.service');
const ApiResponse = require('../shared/utils/ApiResponse');

// ═══════════════════════════════════════════════════════════════════════════════
//  SALES CHANNELS
// ═══════════════════════════════════════════════════════════════════════════════

exports.createChannel = async (req, res, next) => {
    try {
        const channel = await salesChannelService.createChannel({
            tenantId: req.user.tenant,
            body: req.body
        });
        res.status(201).json(ApiResponse.created(channel));
    } catch (err) { next(err); }
};

exports.listChannels = async (req, res, next) => {
    try {
        const channels = await salesChannelService.listChannels({ tenantId: req.user.tenant });
        res.json(ApiResponse.ok(channels));
    } catch (err) { next(err); }
};

exports.getChannel = async (req, res, next) => {
    try {
        const channel = await salesChannelService.getChannel({
            tenantId: req.user.tenant,
            channelId: req.params.id
        });
        res.json(ApiResponse.ok(channel));
    } catch (err) { next(err); }
};

exports.updateChannel = async (req, res, next) => {
    try {
        const channel = await salesChannelService.updateChannel({
            tenantId: req.user.tenant,
            channelId: req.params.id,
            body: req.body
        });
        res.json(ApiResponse.ok(channel));
    } catch (err) { next(err); }
};

exports.deleteChannel = async (req, res, next) => {
    try {
        await salesChannelService.deleteChannel({
            tenantId: req.user.tenant,
            channelId: req.params.id
        });
        res.json(ApiResponse.message('Sales channel deleted'));
    } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  LANDING PAGES
// ═══════════════════════════════════════════════════════════════════════════════

exports.createPage = async (req, res, next) => {
    try {
        const page = await salesChannelService.createPage({
            tenantId: req.user.tenant,
            channelId: req.params.channelId,
            body: req.body
        });
        res.status(201).json(ApiResponse.created(page));
    } catch (err) { next(err); }
};

exports.listPages = async (req, res, next) => {
    try {
        const pages = await salesChannelService.listPages({
            tenantId: req.user.tenant,
            channelId: req.params.channelId,
            status: req.query.status
        });
        res.json(ApiResponse.ok(pages));
    } catch (err) { next(err); }
};

exports.getPage = async (req, res, next) => {
    try {
        const page = await salesChannelService.getPage({
            tenantId: req.user.tenant,
            pageId: req.params.pageId
        });
        res.json(ApiResponse.ok(page));
    } catch (err) { next(err); }
};

exports.previewPage = async (req, res, next) => {
    try {
        const data = await salesChannelService.previewPage({
            tenantId: req.user.tenant,
            channelId: req.params.channelId,
            pageId: req.params.pageId
        });
        res.json(ApiResponse.ok(data));
    } catch (err) { next(err); }
};

exports.updatePage = async (req, res, next) => {
    try {
        const page = await salesChannelService.updatePage({
            tenantId: req.user.tenant,
            pageId: req.params.pageId,
            body: req.body
        });
        res.json(ApiResponse.ok(page));
    } catch (err) { next(err); }
};

exports.publishPage = async (req, res, next) => {
    try {
        const page = await salesChannelService.publishPage({
            tenantId: req.user.tenant,
            pageId: req.params.pageId
        });
        res.json(ApiResponse.ok(page));
    } catch (err) { next(err); }
};

exports.unpublishPage = async (req, res, next) => {
    try {
        const page = await salesChannelService.unpublishPage({
            tenantId: req.user.tenant,
            pageId: req.params.pageId
        });
        res.json(ApiResponse.ok(page));
    } catch (err) { next(err); }
};

exports.deletePage = async (req, res, next) => {
    try {
        await salesChannelService.deletePage({
            tenantId: req.user.tenant,
            pageId: req.params.pageId
        });
        res.json(ApiResponse.message('Landing page deleted'));
    } catch (err) { next(err); }
};

exports.clonePage = async (req, res, next) => {
    try {
        const page = await salesChannelService.clonePage({
            tenantId: req.user.tenant,
            pageId: req.params.pageId,
            targetChannelId: req.body.targetChannelId
        });
        res.status(201).json(ApiResponse.created(page));
    } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

exports.getPageAnalytics = async (req, res, next) => {
    try {
        const analytics = await salesChannelService.getPageAnalytics({
            tenantId: req.user.tenant,
            pageId: req.params.pageId,
            from: req.query.from,
            to: req.query.to
        });
        res.json(ApiResponse.ok(analytics));
    } catch (err) { next(err); }
};

exports.getChannelAnalytics = async (req, res, next) => {
    try {
        const analytics = await salesChannelService.getChannelAnalytics({
            tenantId: req.user.tenant,
            channelId: req.params.id,
            from: req.query.from,
            to: req.query.to
        });
        res.json(ApiResponse.ok(analytics));
    } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  AI PAGE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

exports.generateAIPage = async (req, res, next) => {
    try {
        // Allow up to 3 minutes for AI generation (content + image generation + retries)
        req.setTimeout(180000);
        const { productId, images, productName, productDescription, theme, language, generateImages, enabledBlocks } = req.body;
        const page = await aiPageGenerator.generateLandingPage({
            tenantId: req.user.tenant,
            channelId: req.params.channelId,
            productId,
            images,
            productName,
            productDescription,
            themeName: theme,
            language,
            generateImages: generateImages !== false,
            enabledBlocks: Array.isArray(enabledBlocks) ? enabledBlocks : undefined
        });
        res.status(201).json(ApiResponse.created(page));
    } catch (err) { next(err); }
};

exports.getThemeTemplates = async (req, res, next) => {
    try {
        const templates = aiPageGenerator.getThemeTemplates();
        res.json(ApiResponse.ok(templates));
    } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC STOREFRONT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

exports.getStorefrontPage = async (req, res, next) => {
    try {
        const data = await salesChannelService.getStorefrontPage({
            channelSlug: req.params.channelSlug,
            pageSlug: req.params.pageSlug
        });
        res.json(ApiResponse.ok(data));
    } catch (err) { next(err); }
};

exports.submitStorefrontOrder = async (req, res, next) => {
    try {
        const result = await salesChannelService.submitStorefrontOrder({
            channelSlug: req.params.channelSlug,
            pageSlug: req.params.pageSlug,
            body: req.body,
            ip: req.ip
        });
        res.status(201).json(ApiResponse.created(result));
    } catch (err) { next(err); }
};

exports.getStorefrontCoverage = async (req, res, next) => {
    try {
        // tenantId is passed via the resolved page's tenant
        const pageData = await salesChannelService.getStorefrontPage({
            channelSlug: req.params.channelSlug,
            pageSlug: req.params.pageSlug
        });
        const coverage = await salesChannelService.getStorefrontCoverage({
            tenantId: pageData.tenant,
            wilayaCode: req.query.wilayaCode
        });
        res.json(ApiResponse.ok(coverage));
    } catch (err) { next(err); }
};

exports.calculateStorefrontPrice = async (req, res, next) => {
    try {
        const pageData = await salesChannelService.getStorefrontPage({
            channelSlug: req.params.channelSlug,
            pageSlug: req.params.pageSlug
        });
        const priceData = await salesChannelService.calculateStorefrontDeliveryPrice({
            tenantId: pageData.tenant,
            channelId: pageData.channel._id,
            wilayaCode: req.query.wilayaCode,
            commune: req.query.commune,
            deliveryType: req.query.deliveryType
        });
        res.json(ApiResponse.ok(priceData));
    } catch (err) { next(err); }
};

exports.trackEvent = async (req, res, next) => {
    try {
        const { event, sessionId, visitorId, utm, device, referrer, data } = req.body;
        const pageData = await salesChannelService.getStorefrontPage({
            channelSlug: req.params.channelSlug,
            pageSlug: req.params.pageSlug
        });

        // Fire-and-forget — don't block response on analytics write
        salesChannelService.trackEvent({
            tenantId: pageData.tenant,
            landingPageId: pageData.page._id,
            salesChannelId: pageData.channel._id,
            event,
            sessionId,
            visitorId,
            utm,
            device,
            referrer,
            ip: req.ip,
            data
        });

        res.status(202).json(ApiResponse.message('Event tracked'));
    } catch (err) { next(err); }
};
