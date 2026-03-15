const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');
const { Queue, Worker } = require('bullmq');
const redis = require('./redisClient');
const { createObjectCsvWriter } = require('csv-writer');
const Order = require('../models/Order');
const usageTracker = require('./usageTracker');

// BullMQ connection (reuse the ioredis instance)
const connection = redis;

// Priority mapping — BullMQ: lower number = higher priority (1 = highest)
const PLAN_PRIORITY = {
    Enterprise: 1,
    Pro:        2,
    Basic:      3,
    Free:       4,
};

// Ensure exports directory exists
const EXPORT_DIR = path.join(__dirname, '..', 'public', 'exports');
if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// ─── Export Queue ────────────────────────────────────────────────────────────

const exportQueue = new Queue('exports', {
    connection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 100 },   // Keep last 100 or 1 hour
        removeOnFail: { age: 86400, count: 200 },       // Keep failures 24h for debugging
    },
});

// ─── Export Worker (only started on worker-designated process) ────────────────

let exportWorker = null;

function startExportWorker() {
    if (exportWorker) return;

    exportWorker = new Worker('exports', async (job) => {
        const { tenantId, query, filePath, fileName } = job.data;

        // Enforce tenant isolation
        const secureQuery = { ...query, tenant: tenantId };
        const totalRecords = await Order.countDocuments(secureQuery);

        if (totalRecords === 0) {
            await job.updateProgress(100);
            return { status: 'completed', fileName: null, downloadUrl: null };
        }

        const csvWriter = createObjectCsvWriter({
            path: filePath,
            header: [
                { id: 'orderId', title: 'Order ID' },
                { id: 'date', title: 'Date' },
                { id: 'customerName', title: 'Customer Name' },
                { id: 'phone', title: 'Phone' },
                { id: 'wilaya', title: 'Wilaya' },
                { id: 'commune', title: 'Commune' },
                { id: 'status', title: 'Status' },
                { id: 'totalAmount', title: 'Total Amount' },
                { id: 'products', title: 'Products' }
            ]
        });

        const batchSize = 500;
        let processed = 0;
        let batchRecords = [];

        const cursor = Order.find(secureQuery)
            .populate('customer', 'name phone')
            .populate({ path: 'products.variantId', select: 'sku name price productId', populate: { path: 'productId', select: 'name' } })
            .cursor({ batchSize });

        for await (const order of cursor) {
            const productNames = order.products.map(p => {
                const name = p.variantId?.productId?.name || 'Unknown Item';
                const qty = p.quantity || 1;
                return `${qty}x ${name}`;
            }).join(' | ');

            batchRecords.push({
                orderId: order.orderId,
                date: order.date ? new Date(order.date).toLocaleDateString() : '',
                customerName: order.customer?.name || order.shipping?.name || '',
                phone: order.customer?.phone || order.shipping?.phone1 || '',
                wilaya: order.shipping?.wilaya || '',
                commune: order.shipping?.commune || '',
                status: order.status,
                totalAmount: order.totalAmount ?? 0,
                products: productNames
            });

            processed++;

            if (batchRecords.length >= batchSize) {
                await csvWriter.writeRecords(batchRecords);
                batchRecords = [];
                const progress = Math.floor((processed / totalRecords) * 100);
                await job.updateProgress(progress);
            }
        }

        // Flush remaining
        if (batchRecords.length > 0) {
            await csvWriter.writeRecords(batchRecords);
        }

        await job.updateProgress(100);

        // Track usage
        usageTracker.increment(tenantId, 'exports').catch(() => {});

        return {
            status: 'completed',
            fileName,
            downloadUrl: `/exports/${fileName}`,
            totalRecords: processed,
        };
    }, {
        connection,
        concurrency: 2,
        limiter: { max: 5, duration: 60000 }, // Max 5 exports per minute across all tenants
    });

    exportWorker.on('completed', (job, result) => {
        logger.info({ jobId: job.id, fileName: result?.fileName }, 'Export job completed');

        // Auto-cleanup file after 24 hours
        if (result?.fileName) {
            const filePath = path.join(EXPORT_DIR, result.fileName);
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    logger.info({ fileName: result.fileName }, 'Cleaned up expired export file');
                }
            }, 24 * 60 * 60 * 1000);
        }
    });

    exportWorker.on('failed', (job, err) => {
        logger.error({ err, jobId: job?.id }, 'Export job failed');
    });

    logger.info('Export worker started');
}

// ─── Public API (same interface as before) ───────────────────────────────────

const queueService = {
    /**
     * Enqueue an export job. Returns a jobId for status polling.
     */
    async enqueueExport(tenantId, query, userEmail, planTier = 'Free') {
        const fileName = `export_${tenantId}_${Date.now()}.csv`;
        const filePath = path.join(EXPORT_DIR, fileName);
        const priority = PLAN_PRIORITY[planTier] || PLAN_PRIORITY.Free;

        const job = await exportQueue.add('csv-export', {
            tenantId,
            query,
            filePath,
            fileName,
            userEmail,
        }, {
            priority,
            jobId: `export_${tenantId}_${Date.now()}`,
        });

        return job.id;
    },

    /**
     * Get export job status by jobId.
     */
    async getJobStatus(jobId) {
        const job = await exportQueue.getJob(jobId);
        if (!job) return null;

        const state = await job.getState();
        const progress = job.progress || 0;
        const result = job.returnvalue;

        return {
            id: job.id,
            status: state === 'completed' ? 'completed' : state === 'failed' ? 'failed' : state === 'active' ? 'processing' : 'queued',
            progress,
            fileName: result?.fileName || null,
            downloadUrl: result?.downloadUrl || null,
            error: job.failedReason || null,
            createdAt: new Date(job.timestamp),
        };
    },

    /**
     * Start the worker process. Call once from the primary process
     * or from a dedicated worker instance.
     */
    startWorker: startExportWorker,

    /**
     * Queue stats for monitoring.
     */
    async stats() {
        const [waiting, active, completed, failed] = await Promise.all([
            exportQueue.getWaitingCount(),
            exportQueue.getActiveCount(),
            exportQueue.getCompletedCount(),
            exportQueue.getFailedCount(),
        ]);
        return { name: 'exports', waiting, active, completed, failed };
    },

    // Expose for direct access if needed
    exportQueue,
};

module.exports = queueService;
