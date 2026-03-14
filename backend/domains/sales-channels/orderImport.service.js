/**
 * Order Import Service — central pipeline for importing orders from external stores.
 *
 * Flow: external order → normalize → dedup → product mapping → OrderService.createOrder()
 *
 * Used by:
 *   - Inbound webhooks (WooCommerce, Shopify, etc.)
 *   - Manual sync (polling)
 *   - Bulk import
 */

const mongoose = require('mongoose');
const SalesChannel = require('../../models/SalesChannel');
const SalesChannelProductMapping = require('../../models/SalesChannelProductMapping');
const SalesChannelSyncLog = require('../../models/SalesChannelSyncLog');
const Order = require('../../models/Order');
const { createOrder } = require('../orders/order.service');
const { getStoreAdapter } = require('../../integrations/stores/storeAdapterFactory');
const { decryptSensitiveKeys } = require('../../shared/utils/credentialEncryption');
const AppError = require('../../shared/errors/AppError');
const logger = require('../../shared/logger');
const { eventBus, EVENTS } = require('../../shared/events/eventBus');

// Map channelType → Order.channel enum value
const CHANNEL_TYPE_TO_ORDER_CHANNEL = {
    woocommerce: 'WooCommerce',
    shopify: 'Shopify',
    tiktok_shop: 'TikTok',
    facebook_shop: 'Facebook',
    custom_api: 'Marketplace',
    manual: 'Manual',
    landing_page: 'LandingPage',
};

/**
 * Generate a unique order ID for imported orders.
 */
function generateImportOrderId(channelType) {
    const prefix = (channelType || 'IMP').substring(0, 3).toUpperCase();
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${ts}-${rand}`;
}

/**
 * Import a single external order into the platform.
 *
 * @param {object} params
 * @param {ObjectId} params.tenantId
 * @param {ObjectId} params.salesChannelId
 * @param {object} params.normalizedOrder - Output of adapter.normalizeOrder()
 * @param {string} params.importMethod - 'webhook' | 'sync' | 'manual_import' | 'api'
 * @param {object} [params.salesChannel] - Pre-loaded SalesChannel doc (optional, avoids re-fetch)
 * @returns {{ order: Order|null, skipped: boolean, error?: string }}
 */
async function importOrder({ tenantId, salesChannelId, normalizedOrder, importMethod, salesChannel }) {
    const channelId = salesChannelId.toString();

    // 1. Deduplication check
    if (normalizedOrder.externalOrderId) {
        const exists = await Order.exists({
            tenant: tenantId,
            'salesChannelSource.salesChannel': salesChannelId,
            externalOrderId: normalizedOrder.externalOrderId,
            deletedAt: null
        });
        if (exists) {
            logger.debug({ externalOrderId: normalizedOrder.externalOrderId, channelId }, 'Order already imported, skipping');
            return { order: null, skipped: true };
        }
    }

    // 2. Resolve product mappings
    const resolvedProducts = [];
    for (const item of normalizedOrder.items) {
        const mapping = await SalesChannelProductMapping.findOne({
            tenant: tenantId,
            salesChannel: salesChannelId,
            externalProductId: item.externalProductId,
            ...(item.externalVariantId ? { externalVariantId: item.externalVariantId } : {}),
            deletedAt: null
        }).lean();

        if (mapping) {
            resolvedProducts.push({
                variantId: mapping.internalVariant,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            });
        } else {
            // Unmapped product — import as custom line item (no variantId)
            resolvedProducts.push({
                name: item.name || `External #${item.externalProductId}`,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            });
            logger.warn(
                { externalProductId: item.externalProductId, channelId },
                'No product mapping found, importing as custom line item'
            );
        }
    }

    if (resolvedProducts.length === 0) {
        return { order: null, skipped: true, error: 'No products in order' };
    }

    // 3. Load channel for metadata if not provided
    if (!salesChannel) {
        salesChannel = await SalesChannel.findOne({ _id: salesChannelId, tenant: tenantId, deletedAt: null }).lean();
    }
    if (!salesChannel) {
        throw AppError.notFound('Sales channel not found');
    }

    const orderChannel = CHANNEL_TYPE_TO_ORDER_CHANNEL[salesChannel.channelType] || 'Other';

    // 4. Build order body for OrderService.createOrder()
    const orderBody = {
        orderId: generateImportOrderId(salesChannel.channelType),
        channel: orderChannel,
        customerPhone: normalizedOrder.customerPhone,
        customerName: normalizedOrder.customerName,
        products: resolvedProducts,
        status: 'New',
        notes: normalizedOrder.notes || '',
        tags: [salesChannel.name],
        shipping: {
            recipientName: normalizedOrder.shipping?.recipientName || normalizedOrder.customerName,
            phone1: normalizedOrder.shipping?.phone1 || normalizedOrder.customerPhone,
            wilayaName: normalizedOrder.shipping?.wilayaName || '',
            commune: normalizedOrder.shipping?.commune || '',
            address: normalizedOrder.shipping?.address || '',
        },
        financials: {
            codAmount: normalizedOrder.totalAmount ?? 0,
            discount: normalizedOrder.discount ?? 0,
        },
        courier: salesChannel.defaultCourier || undefined,
        salesChannelSource: {
            salesChannel: salesChannelId,
        },
    };

    // 5. Create the order
    const order = await createOrder({
        tenantId,
        userId: null, // System import, no user
        body: orderBody,
    });

    // 6. Set external tracking fields (directly, since createOrder doesn't know about them)
    if (normalizedOrder.externalOrderId || importMethod) {
        await Order.updateOne(
            { _id: order._id, tenant: tenantId },
            {
                $set: {
                    ...(normalizedOrder.externalOrderId ? { externalOrderId: normalizedOrder.externalOrderId } : {}),
                    ...(importMethod ? { importMethod } : {}),
                }
            }
        );
    }

    // 7. Emit event
    eventBus.emit(EVENTS.STORE_ORDER_IMPORTED, {
        tenantId,
        orderId: order._id,
        salesChannelId,
        externalOrderId: normalizedOrder.externalOrderId,
        importMethod,
    });

    return { order, skipped: false };
}

/**
 * Import a batch of external orders.
 *
 * @param {object} params
 * @param {ObjectId} params.tenantId
 * @param {ObjectId} params.salesChannelId
 * @param {object[]} params.normalizedOrders - Array of normalized order objects
 * @param {string} params.importMethod
 * @param {string} params.syncType - For logging: 'webhook_received' | 'poll_sync' | 'manual_import'
 * @returns {{ imported: number, skipped: number, errors: { message: string, externalOrderId: string }[] }}
 */
async function importOrderBatch({ tenantId, salesChannelId, normalizedOrders, importMethod, syncType }) {
    const startTime = Date.now();
    let imported = 0;
    let skipped = 0;
    const errors = [];

    // Pre-load channel once
    const salesChannel = await SalesChannel.findOne({ _id: salesChannelId, tenant: tenantId, deletedAt: null }).lean();
    if (!salesChannel) {
        throw AppError.notFound('Sales channel not found');
    }

    for (const normalizedOrder of normalizedOrders) {
        try {
            const result = await importOrder({
                tenantId,
                salesChannelId,
                normalizedOrder,
                importMethod,
                salesChannel,
            });
            if (result.skipped) {
                skipped++;
            } else {
                imported++;
            }
        } catch (err) {
            errors.push({
                message: err.message || 'Unknown error',
                externalOrderId: normalizedOrder.externalOrderId || 'unknown',
            });
            logger.error({ err, externalOrderId: normalizedOrder.externalOrderId }, 'Failed to import order');
        }
    }

    const duration = Date.now() - startTime;

    // Log sync result
    await SalesChannelSyncLog.create({
        tenant: tenantId,
        salesChannel: salesChannelId,
        syncType: syncType || 'manual_import',
        status: errors.length === 0 ? 'success' : (imported > 0 ? 'partial' : 'failed'),
        ordersImported: imported,
        ordersSkipped: skipped,
        errors: errors.slice(0, 50), // Cap error log
        duration,
    });

    // Update channel stats and sync timestamp
    await SalesChannel.updateOne(
        { _id: salesChannelId, tenant: tenantId },
        {
            $set: { 'integration.lastSyncAt': new Date() },
            $inc: { 'stats.totalOrders': imported },
        }
    );

    // Emit batch event
    eventBus.emit(EVENTS.STORE_SYNC_COMPLETED, {
        tenantId,
        salesChannelId,
        imported,
        skipped,
        errorCount: errors.length,
    });

    return { imported, skipped, errors };
}

module.exports = {
    importOrder,
    importOrderBatch,
    generateImportOrderId,
    CHANNEL_TYPE_TO_ORDER_CHANNEL,
};
