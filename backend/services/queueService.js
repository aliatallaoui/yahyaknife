const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createObjectCsvWriter } = require('csv-writer');
const Order = require('../models/Order');
const { PriorityQueue } = require('./priorityQueue');
const usageTracker = require('./usageTracker');

// In-memory job registry. In production, this would be Redis/BullMQ.
const exportJobs = new Map();

// Priority queue for exports — higher-tier tenants process first
const exportQueue = new PriorityQueue({ concurrency: 2, name: 'export' });

// Ensure exports directory exists
const EXPORT_DIR = path.join(__dirname, '..', 'public', 'exports');
if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const queueService = {
    /**
     * Start pushing orders to a CSV asynchronously.
     * Jobs are prioritised by tenant plan tier (Enterprise first, Free last).
     * @param {string} tenantId
     * @param {Object} query
     * @param {string} userEmail
     * @param {string} [planTier='Free'] - Tenant's plan tier for queue priority
     */
    async enqueueExport(tenantId, query, userEmail, planTier = 'Free') {
        const jobId = uuidv4();
        const fileName = `export_${tenantId}_${Date.now()}.csv`;
        const filePath = path.join(EXPORT_DIR, fileName);

        exportJobs.set(jobId, {
            id: jobId,
            status: 'queued',
            progress: 0,
            fileName: null,
            downloadUrl: null,
            error: null,
            createdAt: new Date()
        });

        // Route through priority queue
        exportQueue.enqueue(
            jobId,
            () => this._processExport(jobId, tenantId, query, filePath, fileName),
            planTier,
            { tenantId, userEmail }
        );

        return jobId;
    },

    getJobStatus(jobId) {
        return exportJobs.get(jobId) || null;
    },

    async _processExport(jobId, tenantId, query, filePath, fileName) {
        // Enforce tenant isolation in the background job
        const secureQuery = { ...query, tenant: tenantId };
        
        const totalRecords = await Order.countDocuments(secureQuery);
        
        if (totalRecords === 0) {
            exportJobs.set(jobId, { ...exportJobs.get(jobId), status: 'completed', progress: 100, fileName: null });
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

        // Use a MongoDB cursor to stream data instead of loading all into RAM
        const cursor = Order.find(secureQuery)
            .populate('customer', 'name phone')
            .populate({ path: 'products.variantId', select: 'sku name price productId', populate: { path: 'productId', select: 'name' } })
            .cursor({ batchSize });

        let batchRecords = [];

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
                totalAmount: order.totalAmount || 0,
                products: productNames
            });

            processed++;

            if (batchRecords.length >= batchSize) {
                await csvWriter.writeRecords(batchRecords);
                batchRecords = [];
                // Update progress
                const progress = Math.floor((processed / totalRecords) * 100);
                exportJobs.set(jobId, { ...exportJobs.get(jobId), progress });
            }
        }

        // Flush remaining records
        if (batchRecords.length > 0) {
            await csvWriter.writeRecords(batchRecords);
        }

        exportJobs.set(jobId, {
            ...exportJobs.get(jobId),
            status: 'completed',
            progress: 100,
            fileName,
            downloadUrl: `/exports/${fileName}`
        });

        // Track usage
        usageTracker.increment(tenantId, 'exports').catch(() => {});

        // Set an auto-cleanup timeout (delete file after 24 hours)
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                exportJobs.delete(jobId);
                logger.info({ fileName }, 'Cleaned up expired export file');
            }
        }, 24 * 60 * 60 * 1000);
    }
};

queueService.exportQueue = exportQueue;

module.exports = queueService;
