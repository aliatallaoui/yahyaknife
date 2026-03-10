const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createObjectCsvWriter } = require('csv-writer');
const Order = require('../models/Order');

// In-memory job registry. In production, this would be Redis/BullMQ.
const exportJobs = new Map();

// Ensure exports directory exists
const EXPORT_DIR = path.join(__dirname, '..', 'public', 'exports');
if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const queueService = {
    /**
     * Start pushing orders to a CSV asynchronously
     */
    async enqueueExport(tenantId, query, userEmail) {
        const jobId = uuidv4();
        const fileName = `export_${tenantId}_${Date.now()}.csv`;
        const filePath = path.join(EXPORT_DIR, fileName);

        exportJobs.set(jobId, {
            id: jobId,
            status: 'processing',
            progress: 0,
            fileName: null,
            downloadUrl: null,
            error: null,
            createdAt: new Date()
        });

        // Fire and forget the background worker
        this._processExport(jobId, tenantId, query, filePath, fileName).catch(err => {
            console.error(`Export Job [${jobId}] Failed:`, err);
            exportJobs.set(jobId, { ...exportJobs.get(jobId), status: 'failed', error: err.message });
        });

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
            .populate({ path: 'products.variantId', populate: { path: 'productId' } })
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

        // Set an auto-cleanup timeout (delete file after 24 hours)
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                exportJobs.delete(jobId);
                console.log(`Cleaned up expired export file: ${fileName}`);
            }
        }, 24 * 60 * 60 * 1000);
    }
};

module.exports = queueService;
