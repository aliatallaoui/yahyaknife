const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');
const { createBullMQConnection } = require('./redisClient');
const { createObjectCsvWriter } = require('csv-writer');
const Order = require('../models/Order');
const usageTracker = require('./usageTracker');

// Sanitize CSV values to prevent formula injection (=, +, -, @, tab, CR)
const csvSafe = (val) => {
    if (typeof val !== 'string') return val;
    if (/^[=+\-@\t\r]/.test(val)) return `'${val}`;
    return val;
};

// BullMQ needs maxRetriesPerRequest: null — use dedicated connection
const connection = createBullMQConnection(); // null if Redis not configured

// Only load BullMQ if Redis is configured
let Queue, Worker;
if (connection) {
    ({ Queue, Worker } = require('bullmq'));
}

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

// ─── Export Queue (only created if Redis available) ──────────────────────────

let exportQueue = null;

if (Queue) {
    exportQueue = new Queue('exports', {
        connection,
        defaultJobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { age: 3600, count: 100 },   // Keep last 100 or 1 hour
            removeOnFail: { age: 86400, count: 200 },       // Keep failures 24h for debugging
        },
    });
}

// ─── In-process fallback when Redis is not available ─────────────────────────

const fallbackJobs = new Map();

async function runExportInProcess(jobId, data) {
    const { tenantId, query, filePath, fileName } = data;
    const jobState = { id: jobId, tenantId, status: 'processing', progress: 0, result: null, error: null, createdAt: new Date() };
    fallbackJobs.set(jobId, jobState);

    try {
        const secureQuery = { ...query, tenant: tenantId };
        const totalRecords = await Order.countDocuments(secureQuery);

        if (totalRecords === 0) {
            jobState.status = 'completed';
            jobState.progress = 100;
            jobState.result = { status: 'completed', fileName: null, downloadUrl: null };
            return;
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
                customerName: csvSafe(order.customer?.name || order.shipping?.name || ''),
                phone: csvSafe(order.customer?.phone || order.shipping?.phone1 || ''),
                wilaya: csvSafe(order.shipping?.wilaya || ''),
                commune: csvSafe(order.shipping?.commune || ''),
                status: order.status,
                totalAmount: order.totalAmount ?? 0,
                products: csvSafe(productNames)
            });

            processed++;

            if (batchRecords.length >= batchSize) {
                await csvWriter.writeRecords(batchRecords);
                batchRecords = [];
                jobState.progress = Math.floor((processed / totalRecords) * 100);
            }
        }

        if (batchRecords.length > 0) {
            await csvWriter.writeRecords(batchRecords);
        }

        jobState.progress = 100;
        jobState.status = 'completed';
        jobState.result = { status: 'completed', fileName, downloadUrl: `/exports/${fileName}`, totalRecords: processed };

        usageTracker.increment(tenantId, 'exports').catch(err => {
            logger.error({ err, tenantId }, 'Failed to increment export usage counter');
        });

        // Auto-cleanup file after 24 hours
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info({ fileName }, 'Cleaned up expired export file');
            }
        }, 24 * 60 * 60 * 1000);

        logger.info({ jobId, fileName }, 'Export job completed (in-process fallback)');
    } catch (err) {
        jobState.status = 'failed';
        jobState.error = err.message;
        logger.error({ err, jobId }, 'Export job failed (in-process fallback)');
    }
}

// ─── Export Worker (only started on worker-designated process) ────────────────

let exportWorker = null;

function startExportWorker() {
    if (exportWorker || !Worker) {
        if (!Worker) logger.info('Redis not configured — exports will run in-process');
        return;
    }

    const workerConnection = createBullMQConnection();
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
                customerName: csvSafe(order.customer?.name || order.shipping?.name || ''),
                phone: csvSafe(order.customer?.phone || order.shipping?.phone1 || ''),
                wilaya: csvSafe(order.shipping?.wilaya || ''),
                commune: csvSafe(order.shipping?.commune || ''),
                status: order.status,
                totalAmount: order.totalAmount ?? 0,
                products: csvSafe(productNames)
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
        usageTracker.increment(tenantId, 'exports').catch(err => {
            logger.error({ err, tenantId }, 'Failed to increment export usage counter');
        });

        return {
            status: 'completed',
            fileName,
            downloadUrl: `/exports/${fileName}`,
            totalRecords: processed,
        };
    }, {
        connection: workerConnection,
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

        // BullMQ path
        if (exportQueue) {
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
        }

        // In-process fallback (no Redis)
        const jobId = `export_${tenantId}_${Date.now()}`;
        runExportInProcess(jobId, { tenantId, query, filePath, fileName, userEmail });
        return jobId;
    },

    /**
     * Get export job status by jobId.
     */
    async getJobStatus(jobId) {
        // BullMQ path
        if (exportQueue) {
            const job = await exportQueue.getJob(jobId);
            if (!job) return null;

            const state = await job.getState();
            const progress = job.progress || 0;
            const result = job.returnvalue;

            return {
                id: job.id,
                tenantId: job.data?.tenantId || null,
                status: state === 'completed' ? 'completed' : state === 'failed' ? 'failed' : state === 'active' ? 'processing' : 'queued',
                progress,
                fileName: result?.fileName || null,
                downloadUrl: result?.downloadUrl || null,
                error: job.failedReason || null,
                createdAt: new Date(job.timestamp),
            };
        }

        // In-process fallback
        const job = fallbackJobs.get(jobId);
        if (!job) return null;
        return {
            id: job.id,
            tenantId: job.tenantId || null,
            status: job.status,
            progress: job.progress,
            fileName: job.result?.fileName || null,
            downloadUrl: job.result?.downloadUrl || null,
            error: job.error,
            createdAt: job.createdAt,
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
        if (!exportQueue) {
            return { name: 'exports', waiting: 0, active: 0, completed: 0, failed: 0, mode: 'in-process' };
        }
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
