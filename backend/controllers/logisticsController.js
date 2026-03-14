/**
 * LogisticsController — HTTP handlers for logistics resolution operations.
 *
 * Provides endpoints for:
 *  - Re-resolving logistics for an order
 *  - Getting logistics status for an order
 *  - Manually overriding logistics resolution
 *  - Bulk re-resolution for orders in needs_review
 */

const Order = require('../models/Order');
const { resolveLogistics } = require('../domains/logistics/logistics.resolver');
const { LOGISTICS_STATUS, BLOCKING_STATUSES } = require('../domains/logistics/logistics.constants');
const AppError = require('../shared/errors/AppError');
const ApiResponse = require('../shared/utils/ApiResponse');
const logger = require('../shared/logger');

/**
 * GET /api/logistics/orders/:orderId/resolution
 * Get logistics resolution details for an order.
 */
exports.getResolution = async (req, res) => {
    const order = await Order.findOne({
        _id: req.params.orderId,
        tenant: req.user.tenant,
        deletedAt: null
    }).select('rawSource internalGeography courierGeography logistics shipping courier')
      .populate('internalGeography.wilayaId', 'code officialFrName officialArName')
      .populate('internalGeography.communeId', 'officialFrName officialArName wilayaCode')
      .populate('courierGeography.nearestOfficeCommuneId', 'officialFrName')
      .populate('courier', 'name apiProvider')
      .populate('logistics.fallbackCourierId', 'name')
      .lean();

    if (!order) throw AppError.notFound('Order');

    return ApiResponse.ok(res, {
        rawSource:         order.rawSource || {},
        internalGeography: order.internalGeography || {},
        courierGeography:  order.courierGeography || {},
        logistics:         order.logistics || {},
        shipping:          order.shipping || {},
        courier:           order.courier || null
    });
};

/**
 * POST /api/logistics/orders/:orderId/re-resolve
 * Re-run logistics resolution for an order (preserves raw source).
 */
exports.reResolve = async (req, res) => {
    const tenantId = req.user.tenant;
    const order = await Order.findOne({
        _id: req.params.orderId,
        tenant: tenantId,
        deletedAt: null
    });
    if (!order) throw AppError.notFound('Order');

    const rawWilaya  = order.rawSource?.wilaya || order.shipping?.wilayaName || '';
    const rawCommune = order.rawSource?.commune || order.shipping?.commune || '';
    const rawAddress = order.rawSource?.address || order.shipping?.address || '';

    const result = await resolveLogistics({
        tenantId,
        rawWilaya,
        rawCommune,
        rawAddress,
        courierId:    order.courier || null,
        deliveryType: order.shipping?.deliveryType ?? 0
    });

    // Apply updates
    const updates = {
        internalGeography: result.internalGeography,
        courierGeography:  result.courierGeography,
        logistics:         result.logistics
    };

    if (result.shippingUpdates.wilayaName) updates['shipping.wilayaName'] = result.shippingUpdates.wilayaName;
    if (result.shippingUpdates.commune)    updates['shipping.commune'] = result.shippingUpdates.commune;
    if (result.shippingUpdates.wilayaCode) updates['shipping.wilayaCode'] = result.shippingUpdates.wilayaCode;
    if (result.selectedCourierId) updates.courier = result.selectedCourierId;
    if (result.deliveryFee !== null) updates['financials.courierFee'] = result.deliveryFee;

    const updated = await Order.findOneAndUpdate(
        { _id: order._id, tenant: tenantId },
        { $set: updates },
        { new: true }
    ).select('rawSource internalGeography courierGeography logistics shipping courier financials')
     .lean();

    logger.info({ orderId: order.orderId, status: result.logistics.resolutionStatus }, 'Logistics re-resolved');

    return ApiResponse.ok(res, {
        resolutionStatus: result.logistics.resolutionStatus,
        warningMessage:   result.logistics.warningMessage,
        order: updated
    });
};

/**
 * POST /api/logistics/orders/:orderId/override
 * Manually override logistics resolution (set resolved + clear warnings).
 */
exports.overrideResolution = async (req, res) => {
    const tenantId = req.user.tenant;
    const { resolutionStatus, warningMessage } = req.body;

    const order = await Order.findOneAndUpdate(
        { _id: req.params.orderId, tenant: tenantId, deletedAt: null },
        {
            $set: {
                'logistics.resolutionStatus': resolutionStatus || LOGISTICS_STATUS.RESOLVED,
                'logistics.warningMessage':   warningMessage || '',
                'logistics.resolvedAt':       new Date()
            }
        },
        { new: true }
    ).select('logistics').lean();

    if (!order) throw AppError.notFound('Order');

    return ApiResponse.ok(res, order.logistics);
};

/**
 * GET /api/logistics/review-queue
 * Get orders that need logistics review.
 */
exports.getReviewQueue = async (req, res) => {
    const tenantId = req.user.tenant;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const statusFilter = req.query.status;
    const query = {
        tenant: tenantId,
        deletedAt: null,
        'logistics.resolutionStatus': statusFilter
            ? statusFilter
            : { $in: [
                LOGISTICS_STATUS.NEEDS_REVIEW,
                LOGISTICS_STATUS.UNSUPPORTED_WILAYA,
                LOGISTICS_STATUS.UNSUPPORTED_COMMUNE,
                LOGISTICS_STATUS.UNSUPPORTED_DELIVERY_TYPE,
                LOGISTICS_STATUS.STOP_DESK_NOT_AVAILABLE,
                LOGISTICS_STATUS.LOW_CONFIDENCE_LOCATION_MATCH,
                LOGISTICS_STATUS.NO_COURIER_ASSIGNED,
                LOGISTICS_STATUS.NO_PRICING_RULE
            ]}
    };

    const [orders, total] = await Promise.all([
        Order.find(query)
            .select('orderId status rawSource shipping logistics courier createdAt')
            .populate('courier', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Order.countDocuments(query)
    ]);

    return ApiResponse.paginated(res, orders, total, page, limit);
};

/**
 * POST /api/logistics/bulk-re-resolve
 * Re-resolve logistics for all orders in review queue.
 */
exports.bulkReResolve = async (req, res) => {
    const tenantId = req.user.tenant;
    const maxOrders = 100;

    const orders = await Order.find({
        tenant: tenantId,
        deletedAt: null,
        'logistics.resolutionStatus': {
            $in: [LOGISTICS_STATUS.NEEDS_REVIEW, LOGISTICS_STATUS.LOW_CONFIDENCE_LOCATION_MATCH, LOGISTICS_STATUS.PENDING]
        }
    }).select('rawSource shipping courier').limit(maxOrders);

    let resolved = 0;
    let failed = 0;

    for (const order of orders) {
        try {
            const result = await resolveLogistics({
                tenantId,
                rawWilaya:  order.rawSource?.wilaya || order.shipping?.wilayaName || '',
                rawCommune: order.rawSource?.commune || order.shipping?.commune || '',
                rawAddress: order.rawSource?.address || order.shipping?.address || '',
                courierId:    order.courier || null,
                deliveryType: order.shipping?.deliveryType ?? 0
            });

            const updates = {
                internalGeography: result.internalGeography,
                courierGeography:  result.courierGeography,
                logistics:         result.logistics
            };
            if (result.shippingUpdates.wilayaName) updates['shipping.wilayaName'] = result.shippingUpdates.wilayaName;
            if (result.shippingUpdates.commune) updates['shipping.commune'] = result.shippingUpdates.commune;
            if (result.deliveryFee !== null) updates['financials.courierFee'] = result.deliveryFee;

            await Order.updateOne({ _id: order._id, tenant: tenantId }, { $set: updates });
            resolved++;
        } catch {
            failed++;
        }
    }

    return ApiResponse.ok(res, { resolved, failed, total: orders.length });
};
