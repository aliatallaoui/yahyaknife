/**
 * Assignment Engine — 4-mode order assignment with strict priority.
 *
 * PRIORITY ORDER (highest wins):
 *   1. Manual assignment (order.assignedAgent already set by manager)
 *   2. Product-based (AssignmentRule type='product')
 *   3. Store-based (AssignmentRule type='store')
 *   4. Round-robin (default fallback)
 *
 * This module:
 *   - resolveAssignment(): determine which agent should own an order
 *   - assignOrder(): set the agent + log history
 *   - reassignOrder(): change agent + log with reason
 *   - claimOrder(): agent self-assigns from unassigned pool
 *   - runRoundRobin(): distribute unassigned orders evenly
 */

const mongoose = require('mongoose');
const Order = require('../../models/Order');
const AssignmentRule = require('../../models/AssignmentRule');
const AssignmentHistory = require('../../models/AssignmentHistory');
const AgentProfile = require('../../models/AgentProfile');
const logger = require('../../shared/logger');

// ── Tenant-scoped setting for round-robin index (in-memory, resets on restart) ──
const roundRobinState = new Map(); // tenantId → lastIndex

/**
 * Resolve which agent should own this order based on priority rules.
 * Returns { agent: ObjectId, mode: string } or null if no rule matches.
 */
async function resolveAssignment(order, tenantId) {
    // Priority 1: Manual — already has assignedAgent (skip resolution)
    if (order.assignedAgent) {
        return { agent: order.assignedAgent, mode: 'manual' };
    }

    // Priority 2: Product-based — check if any product in this order has a rule
    if (order.products?.length) {
        const variantIds = order.products.map(p => p.variantId).filter(Boolean);
        if (variantIds.length) {
            // Look up which product(s) these variants belong to
            const ProductVariant = require('../../models/ProductVariant');
            const variants = await ProductVariant.find({ _id: { $in: variantIds } }, { productId: 1 }).lean();
            const productIds = [...new Set(variants.map(v => v.productId?.toString()).filter(Boolean))];

            if (productIds.length) {
                const productRule = await AssignmentRule.findOne({
                    tenant: tenantId,
                    type: 'product',
                    sourceId: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) },
                    isActive: true
                }).lean();

                if (productRule) {
                    return { agent: productRule.agent, mode: 'product' };
                }
            }
        }
    }

    // Priority 3: Store-based — check salesChannelSource
    const channelId = order.salesChannelSource?.salesChannel;
    if (channelId) {
        const storeRule = await AssignmentRule.findOne({
            tenant: tenantId,
            type: 'store',
            sourceId: channelId,
            isActive: true
        }).lean();

        if (storeRule) {
            return { agent: storeRule.agent, mode: 'store' };
        }
    }

    // Priority 4: Round-robin — filter to current tenant
    const activeProfiles = await AgentProfile.find({ tenant: tenantId, isActive: true }).limit(500).lean();
    if (activeProfiles.length === 0) return null;

    const agentIds = activeProfiles.map(p => p.user);
    const tenantKey = tenantId.toString();
    const lastIdx = roundRobinState.get(tenantKey) ?? -1;
    const nextIdx = (lastIdx + 1) % agentIds.length;
    roundRobinState.set(tenantKey, nextIdx);

    return { agent: agentIds[nextIdx], mode: 'round_robin' };
}

/**
 * Assign an order to an agent and log the assignment history.
 */
async function assignOrder(orderId, tenantId, agentId, mode, changedBy, reason = '') {
    const order = await Order.findOne({ _id: orderId, tenant: tenantId });
    if (!order) throw new Error('Order not found');

    const previousAgent = order.assignedAgent || null;

    order.assignedAgent = agentId;
    order.assignmentMode = mode;
    await order.save();

    // Log assignment history
    await AssignmentHistory.create({
        tenant: tenantId,
        order: orderId,
        previousAgent,
        newAgent: agentId,
        assignmentMode: mode,
        changedBy,
        reason
    });

    return order;
}

/**
 * Auto-assign a single new order using the priority resolver.
 * Called from order.service.js on order creation (fire-and-forget).
 */
async function autoAssignOrder(orderId, tenantId) {
    try {
        const order = await Order.findOne({
            _id: orderId,
            tenant: tenantId,
            status: 'New',
            assignedAgent: null
        }).lean();

        if (!order) return; // Already assigned or not New

        const result = await resolveAssignment(order, tenantId);
        if (!result) return; // No agents available

        await Order.updateOne(
            { _id: orderId, tenant: tenantId },
            { $set: { assignedAgent: result.agent, assignmentMode: result.mode } }
        );

        // Log (changedBy = system/agent itself)
        await AssignmentHistory.create({
            tenant: tenantId,
            order: orderId,
            previousAgent: null,
            newAgent: result.agent,
            assignmentMode: result.mode,
            changedBy: result.agent, // system-initiated
            reason: `Auto-assigned via ${result.mode}`
        });

        logger.info({ orderId: orderId.toString(), agent: result.agent.toString(), mode: result.mode }, 'Auto-assigned order');
    } catch (err) {
        logger.error({ err, orderId: orderId?.toString() }, 'Auto-assign failed');
    }
}

/**
 * Reassign an order from one agent to another with audit trail.
 */
async function reassignOrder(orderId, tenantId, newAgentId, changedById, reason = '') {
    return assignOrder(orderId, tenantId, newAgentId, 'manual', changedById, reason);
}

/**
 * Agent claims an unassigned order from the shared pool.
 */
async function claimOrder(orderId, tenantId, agentId) {
    const order = await Order.findOne({
        _id: orderId,
        tenant: tenantId,
        assignedAgent: null,
        deletedAt: null
    });

    if (!order) throw new Error('Order not available for claiming (already assigned or not found)');

    order.assignedAgent = agentId;
    order.assignmentMode = 'claim';
    await order.save();

    await AssignmentHistory.create({
        tenant: tenantId,
        order: orderId,
        previousAgent: null,
        newAgent: agentId,
        assignmentMode: 'claim',
        changedBy: agentId,
        reason: 'Agent self-claimed from unassigned pool'
    });

    return order;
}

/**
 * Distribute all unassigned 'New' orders using the priority resolver.
 * Returns count of orders distributed.
 */
async function distributeUnassignedOrders(tenantId, changedById) {
    const DISTRIBUTABLE = ['New', 'Call 1', 'Call 2', 'Call 3', 'No Answer', 'Postponed', 'Confirmed'];
    const unassigned = await Order.find({
        tenant: tenantId,
        status: { $in: DISTRIBUTABLE },
        assignedAgent: null,
        deletedAt: null
    }).limit(5000).lean();

    if (!unassigned.length) return 0;

    let count = 0;
    for (const order of unassigned) {
        const result = await resolveAssignment(order, tenantId);
        if (!result) continue;

        await Order.updateOne(
            { _id: order._id, tenant: tenantId },
            { $set: { assignedAgent: result.agent, assignmentMode: result.mode } }
        );

        await AssignmentHistory.create({
            tenant: tenantId,
            order: order._id,
            previousAgent: null,
            newAgent: result.agent,
            assignmentMode: result.mode,
            changedBy: changedById,
            reason: `Bulk distribute via ${result.mode}`
        });

        count++;
    }

    return count;
}

/**
 * Get assignment history for an order.
 */
async function getOrderAssignmentHistory(orderId, tenantId) {
    return AssignmentHistory.find({ order: orderId, tenant: tenantId })
        .populate('previousAgent', 'name')
        .populate('newAgent', 'name')
        .populate('changedBy', 'name')
        .sort({ createdAt: -1 })
        .lean();
}

module.exports = {
    resolveAssignment,
    assignOrder,
    autoAssignOrder,
    reassignOrder,
    claimOrder,
    distributeUnassignedOrders,
    getOrderAssignmentHistory
};
