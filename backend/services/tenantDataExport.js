const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../shared/logger');

// Models to export — all tenant-scoped collections
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const Category = require('../models/Category');
const Shipment = require('../models/Shipment');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const EXPORT_DIR = path.join(__dirname, '..', 'public', 'exports');
if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// In-memory job tracker
const exportJobs = new Map();

/**
 * Collections to include in GDPR export.
 * Each entry: { name, model, select (optional field filter) }
 */
const COLLECTIONS = [
    { name: 'orders', model: Order, select: '-__v' },
    { name: 'customers', model: Customer, select: '-__v' },
    { name: 'products', model: Product, select: '-__v' },
    { name: 'product_variants', model: ProductVariant, select: '-__v' },
    { name: 'categories', model: Category, select: '-__v' },
    { name: 'shipments', model: Shipment, select: '-__v' },
    { name: 'employees', model: Employee, select: '-__v' },
    { name: 'attendance', model: Attendance, select: '-__v' },
    { name: 'payroll', model: Payroll, select: '-__v' },
    { name: 'expenses', model: Expense, select: '-__v' },
    { name: 'revenue', model: Revenue, select: '-__v' },
    { name: 'users', model: User, select: 'name email phone jobTitle isActive role createdAt' },
    { name: 'audit_log', model: AuditLog, select: '-__v' },
];

const tenantDataExport = {
    /**
     * Enqueue a full tenant data export.
     * Returns a jobId to poll for status.
     */
    async enqueue(tenantId) {
        const jobId = uuidv4();
        const dirName = `gdpr_${tenantId}_${Date.now()}`;
        const exportPath = path.join(EXPORT_DIR, dirName);

        exportJobs.set(jobId, {
            id: jobId,
            status: 'processing',
            progress: 0,
            collections: COLLECTIONS.length,
            completedCollections: 0,
            downloadUrl: null,
            error: null,
            createdAt: new Date(),
        });

        // Fire and forget
        this._process(jobId, tenantId, exportPath, dirName).catch(err => {
            logger.error({ err, jobId }, 'Tenant data export failed');
            exportJobs.set(jobId, { ...exportJobs.get(jobId), status: 'failed', error: err.message });
        });

        return jobId;
    },

    getStatus(jobId) {
        return exportJobs.get(jobId) || null;
    },

    async _process(jobId, tenantId, exportPath, dirName) {
        fs.mkdirSync(exportPath, { recursive: true });

        let completed = 0;

        for (const col of COLLECTIONS) {
            try {
                const docs = await col.model.find({ tenant: tenantId })
                    .select(col.select)
                    .lean();

                const filePath = path.join(exportPath, `${col.name}.json`);
                fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');

                completed++;
                exportJobs.set(jobId, {
                    ...exportJobs.get(jobId),
                    completedCollections: completed,
                    progress: Math.floor((completed / COLLECTIONS.length) * 100),
                });
            } catch (err) {
                logger.error({ err, collection: col.name }, 'Error exporting collection');
                // Write error file but continue
                const errorPath = path.join(exportPath, `${col.name}_ERROR.txt`);
                fs.writeFileSync(errorPath, err.message, 'utf-8');
                completed++;
            }
        }

        // Write manifest
        const manifest = {
            tenantId,
            exportDate: new Date().toISOString(),
            collections: COLLECTIONS.map(c => c.name),
            totalCollections: COLLECTIONS.length,
        };
        fs.writeFileSync(path.join(exportPath, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

        exportJobs.set(jobId, {
            ...exportJobs.get(jobId),
            status: 'completed',
            progress: 100,
            downloadUrl: `/exports/${dirName}`,
        });

        logger.info({ tenantId, jobId, dirName }, 'Tenant data export completed');

        // Auto-cleanup after 48 hours
        setTimeout(() => {
            try {
                fs.rmSync(exportPath, { recursive: true, force: true });
                exportJobs.delete(jobId);
                logger.info({ dirName }, 'Cleaned up tenant data export');
            } catch { /* ignore */ }
        }, 48 * 60 * 60 * 1000);
    },
};

module.exports = tenantDataExport;
