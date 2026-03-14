const mongoose = require('mongoose');
const logger = require('../shared/logger');
const queueService = require('../services/queueService');
const Customer = require('../models/Customer');

exports.enqueueOrderExport = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const userEmail = req.user.email; // Optional, to send notification later

        const { search, status, courier, agent, wilaya, channel, salesChannelId, dateFrom, dateTo, stage } = req.query;

        // Build the identical query object as the frontend table
        const query = { tenant: tenantId, deletedAt: null };

        if (stage) {
            if (stage === 'pre-dispatch') {
                query.status = { $in: ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Refused', 'Cancelled'] };
            } else if (stage === 'post-dispatch') {
                query.status = { $in: ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned'] };
            } else if (stage === 'returns') {
                query.status = { $in: ['Returned', 'Refused'] };
            }
        }

        if (status) query.status = status;
        if (courier) query.courier = courier === 'unassigned' ? null : courier;
        if (agent) query.assignedAgent = agent === 'unassigned' ? null : agent;
        if (wilaya) query.wilaya = wilaya;
        if (channel) query.channel = channel;
        if (salesChannelId && mongoose.Types.ObjectId.isValid(salesChannelId)) {
            query['salesChannelSource.salesChannel'] = new mongoose.Types.ObjectId(salesChannelId);
        }

        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
            if (dateTo) query.createdAt.$lte = new Date(dateTo);
        }

        if (search) {
            const matchingCustomers = await Customer.find({
                tenant: tenantId,
                deletedAt: null,
                $text: { $search: search }
            }).select('_id').lean();
            const customerIds = matchingCustomers.map(c => c._id);

            if (customerIds.length > 0) {
                query.$or = [
                    { $text: { $search: search } },
                    { customer: { $in: customerIds } }
                ];
            } else {
                query.$text = { $search: search };
            }
        }

        // Fire background worker — plan tier determines queue priority
        const planTier = req.tenantPlanTier || 'Free';
        const jobId = await queueService.enqueueExport(tenantId, query, userEmail, planTier);

        // Instantly return 202 Accepted so the UI doesn't freeze
        res.status(202).json({
            message: 'Export job successfully queued in the background.',
            jobId: jobId
        });

    } catch (error) {
        logger.error({ err: error }, 'Error enqueuing order export');
        res.status(500).json({ message: 'Failed to start export. Please try again.' });
    }
};

exports.getExportJobStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobStatus = queueService.getJobStatus(jobId);

        if (!jobStatus) {
            return res.status(404).json({ message: 'Export Job not found or expired.' });
        }

        res.json(jobStatus);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching export job status');
        res.status(500).json({ message: 'Failed to download export. Please try again.' });
    }
};
