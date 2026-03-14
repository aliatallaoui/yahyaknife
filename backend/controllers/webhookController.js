const crypto = require('crypto');
const mongoose = require('mongoose');
const Webhook = require('../models/Webhook');
const WebhookDelivery = require('../models/WebhookDelivery');
const { WEBHOOK_EVENTS } = require('../services/webhookService');
const logger = require('../shared/logger');
const { validateWebhookUrl } = require('../shared/utils/validateUrl');

// ─── GET /api/webhooks ──────────────────────────────────────────────────────
exports.listWebhooks = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const webhooks = await Webhook.find({ tenant: tenantId })
            .select('-secret')
            .sort({ createdAt: -1 })
            .lean();
        res.json(webhooks);
    } catch (err) {
        logger.error({ err }, 'webhookController.listWebhooks');
        res.status(500).json({ message: 'Failed to load webhooks. Please try again.' });
    }
};

// ─── GET /api/webhooks/events ───────────────────────────────────────────────
exports.listEvents = (_req, res) => {
    res.json(WEBHOOK_EVENTS);
};

// ─── POST /api/webhooks ─────────────────────────────────────────────────────
exports.createWebhook = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { url, events, description } = req.body;

        if (!url || !events || !Array.isArray(events) || events.length === 0) {
            return res.status(400).json({ message: 'url and events[] are required' });
        }

        const urlErr = validateWebhookUrl(url);
        if (urlErr) return res.status(400).json({ message: urlErr });

        // Validate events
        const invalid = events.filter(e => !WEBHOOK_EVENTS.includes(e));
        if (invalid.length > 0) {
            return res.status(400).json({ message: `Invalid events: ${invalid.join(', ')}` });
        }

        // Cap webhooks per tenant
        const count = await Webhook.countDocuments({ tenant: tenantId });
        if (count >= 20) {
            return res.status(400).json({ message: 'Maximum 20 webhooks per workspace' });
        }

        // Generate signing secret
        const secret = crypto.randomBytes(32).toString('hex');

        const webhook = await Webhook.create({
            tenant: tenantId,
            url,
            events,
            secret,
            description: description || '',
        });

        // Secret is shown ONCE at creation — stripped from all subsequent reads
        res.status(201).json(webhook);
    } catch (err) {
        logger.error({ err }, 'webhookController.createWebhook');
        res.status(500).json({ message: 'Failed to create webhook. Please try again.' });
    }
};

// ─── PATCH /api/webhooks/:id ────────────────────────────────────────────────
exports.updateWebhook = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid webhook ID' });
        }

        const { url, events, isActive, description } = req.body;
        const update = {};

        if (url !== undefined) {
            const urlErr = validateWebhookUrl(url);
            if (urlErr) return res.status(400).json({ message: urlErr });
            update.url = url;
        }
        if (description !== undefined) update.description = description;
        if (isActive !== undefined) {
            update.isActive = isActive;
            // Clear auto-disable when manually re-enabling
            if (isActive) {
                update.autoDisabledAt = null;
                update['stats.consecutiveFailures'] = 0;
            }
        }
        if (events) {
            const invalid = events.filter(e => !WEBHOOK_EVENTS.includes(e));
            if (invalid.length > 0) {
                return res.status(400).json({ message: `Invalid events: ${invalid.join(', ')}` });
            }
            update.events = events;
        }

        const webhook = await Webhook.findOneAndUpdate(
            { _id: id, tenant: tenantId },
            { $set: update },
            { returnDocument: 'after' }
        ).select('-secret').lean();

        if (!webhook) return res.status(404).json({ message: 'Webhook not found' });

        res.json(webhook);
    } catch (err) {
        logger.error({ err }, 'webhookController.updateWebhook');
        res.status(500).json({ message: 'Failed to update webhook. Please try again.' });
    }
};

// ─── DELETE /api/webhooks/:id ───────────────────────────────────────────────
exports.deleteWebhook = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid webhook ID' });
        }

        const webhook = await Webhook.findOneAndDelete({ _id: id, tenant: tenantId });
        if (!webhook) return res.status(404).json({ message: 'Webhook not found' });

        // Clean up delivery logs
        await WebhookDelivery.deleteMany({ webhook: id, tenant: tenantId });

        res.json({ message: 'Webhook deleted' });
    } catch (err) {
        logger.error({ err }, 'webhookController.deleteWebhook');
        res.status(500).json({ message: 'Failed to delete webhook. Please try again.' });
    }
};

// ─── GET /api/webhooks/:id/deliveries ───────────────────────────────────────
exports.getDeliveries = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid webhook ID' });
        }

        // Verify ownership
        const webhook = await Webhook.findOne({ _id: id, tenant: tenantId }).lean();
        if (!webhook) return res.status(404).json({ message: 'Webhook not found' });

        const deliveries = await WebhookDelivery.find({ webhook: id, tenant: tenantId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json(deliveries);
    } catch (err) {
        logger.error({ err }, 'webhookController.getDeliveries');
        res.status(500).json({ message: 'Failed to load webhook deliveries. Please try again.' });
    }
};

// ─── POST /api/webhooks/:id/test ────────────────────────────────────────────
// Send a test ping to the webhook URL
exports.testWebhook = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid webhook ID' });
        }

        const webhook = await Webhook.findOne({ _id: id, tenant: tenantId });
        if (!webhook) return res.status(404).json({ message: 'Webhook not found' });

        const body = JSON.stringify({
            event: 'webhook.test',
            timestamp: new Date().toISOString(),
            data: { message: 'This is a test delivery from your webhook configuration.' },
        });

        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Warsha-Webhook/1.0',
            'X-Webhook-Event': 'webhook.test',
        };

        if (webhook.secret) {
            const signature = crypto
                .createHmac('sha256', webhook.secret)
                .update(body)
                .digest('hex');
            headers['X-Webhook-Signature'] = `sha256=${signature}`;
        }

        const startTime = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        try {
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal,
            });
            clearTimeout(timeout);
            const durationMs = Date.now() - startTime;
            const responseBody = await response.text().catch(() => '');

            res.json({
                success: response.ok,
                statusCode: response.status,
                durationMs,
                responseBody: responseBody.substring(0, 500),
            });
        } catch (fetchErr) {
            clearTimeout(timeout);
            res.json({
                success: false,
                error: fetchErr.message,
                durationMs: Date.now() - startTime,
            });
        }
    } catch (err) {
        logger.error({ err }, 'webhookController.testWebhook');
        res.status(500).json({ message: 'Failed to test webhook. Please try again.' });
    }
};
