/**
 * Call Center Follow-Up Job
 *
 * Runs periodically to:
 * 1. Auto-requeue "No Answer" orders that have been idle for 4+ hours
 *    - Sets status back to the next call attempt (Call 1 → Call 2 → Call 3)
 * 2. Escalate orders stuck after 3+ call attempts with no confirmation
 *    - Tags them as "Escalated" for supervisor review
 * 3. Flag overdue callbacks (postponedUntil passed by 24+ hours)
 */

const Order = require('../models/Order');
const CallNote = require('../models/CallNote');
const OrderService = require('../domains/orders/order.service');
const logger = require('../shared/logger');

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

async function runCallCenterFollowUp() {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - FOUR_HOURS);
    const oneDayAgo = new Date(now.getTime() - TWENTY_FOUR_HOURS);

    let requeued = 0;
    let escalated = 0;
    let overdueTagged = 0;

    // 1. Auto-requeue "No Answer" orders idle for 4+ hours
    //    Move them to the next call stage so they re-enter the agent queue
    const staleNoAnswer = await Order.find({
        status: 'No Answer',
        deletedAt: null,
        updatedAt: { $lte: fourHoursAgo }
    }).select('_id tenant tags').lean();

    for (const order of staleNoAnswer) {
        try {
            // Count how many call attempts have been made
            const attempts = await CallNote.countDocuments({ order: order._id, tenant: order.tenant });

            if (attempts >= 3) {
                // 3+ attempts — escalate: tag for supervisor review
                const mergedTags = [...new Set([...(order.tags || []), 'Escalated'])];
                await OrderService.updateOrder({
                    orderId: order._id,
                    tenantId: order.tenant,
                    updateData: { priority: 'High Priority', tags: mergedTags },
                    bypassStateMachine: true
                });
                escalated++;
            } else {
                // Re-queue to next call stage
                const nextStatus = attempts === 0 ? 'Call 1' : attempts === 1 ? 'Call 2' : 'Call 3';
                await OrderService.updateOrder({
                    orderId: order._id,
                    tenantId: order.tenant,
                    updateData: { status: nextStatus },
                    bypassStateMachine: true
                });
                requeued++;
            }
        } catch (err) {
            logger.error({ err, orderId: order._id }, 'callCenterFollowUp: failed to requeue order');
        }
    }

    // 2. Flag overdue postponed orders (callback was due 24+ hours ago)
    const overduePostponed = await Order.find({
        status: 'Postponed',
        postponedUntil: { $lte: oneDayAgo },
        deletedAt: null,
        tags: { $ne: 'Overdue Callback' }
    }).select('_id tenant tags').lean();

    for (const order of overduePostponed) {
        try {
            const mergedTags = [...new Set([...(order.tags || []), 'Overdue Callback'])];
            await OrderService.updateOrder({
                orderId: order._id,
                tenantId: order.tenant,
                updateData: { priority: 'High Priority', tags: mergedTags },
                bypassStateMachine: true
            });
            overdueTagged++;
        } catch (err) {
            logger.error({ err, orderId: order._id }, 'callCenterFollowUp: failed to tag overdue order');
        }
    }

    return { requeued, escalated, overdueTagged };
}

module.exports = { runCallCenterFollowUp };
