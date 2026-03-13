const mongoose = require('mongoose');

/**
 * TenantRepo — base helper for tenant-scoped Mongoose queries.
 *
 * Wraps a Mongoose model and automatically injects `{ tenant: tenantId }`
 * into every query, preventing accidental cross-tenant data leaks.
 *
 * Usage:
 *   const repo = new TenantRepo(Order, req.user.tenant);
 *   const orders = await repo.find({ status: 'New' }).sort({ createdAt: -1 }).lean();
 *   const order = await repo.findById(id);
 *   const count = await repo.countDocuments({ status: 'Delivered' });
 *   const created = await repo.create({ ... });
 *   const updated = await repo.findByIdAndUpdate(id, { status: 'Confirmed' });
 *   const deleted = await repo.findByIdAndDelete(id);
 *   const agg = await repo.aggregate([{ $group: { ... } }]);
 */
class TenantRepo {
    /**
     * @param {import('mongoose').Model} model
     * @param {string|import('mongoose').Types.ObjectId} tenantId
     */
    constructor(model, tenantId) {
        if (!tenantId) throw new Error('TenantRepo: tenantId is required');
        this.model = model;
        this.tenantId = tenantId;
        this._tenantObjectId = typeof tenantId === 'string'
            ? new mongoose.Types.ObjectId(tenantId)
            : tenantId;
    }

    /** Inject tenant filter into a plain filter object */
    _scope(filter = {}) {
        return { ...filter, tenant: this.tenantId };
    }

    // ── Query Methods (return Mongoose Query — chainable) ────────────────

    find(filter = {}, projection, options) {
        return this.model.find(this._scope(filter), projection, options);
    }

    findOne(filter = {}, projection, options) {
        return this.model.findOne(this._scope(filter), projection, options);
    }

    findById(id, projection, options) {
        return this.model.findOne(this._scope({ _id: id }), projection, options);
    }

    findByIdAndUpdate(id, update, options = {}) {
        return this.model.findOneAndUpdate(this._scope({ _id: id }), update, options);
    }

    findByIdAndDelete(id, options = {}) {
        return this.model.findOneAndDelete(this._scope({ _id: id }), options);
    }

    findOneAndUpdate(filter = {}, update, options = {}) {
        return this.model.findOneAndUpdate(this._scope(filter), update, options);
    }

    findOneAndDelete(filter = {}, options = {}) {
        return this.model.findOneAndDelete(this._scope(filter), options);
    }

    updateMany(filter = {}, update, options = {}) {
        return this.model.updateMany(this._scope(filter), update, options);
    }

    deleteMany(filter = {}, options = {}) {
        return this.model.deleteMany(this._scope(filter), options);
    }

    // ── Scalar Methods ──────────────────────────────────────────────────

    countDocuments(filter = {}) {
        return this.model.countDocuments(this._scope(filter));
    }

    estimatedDocumentCount() {
        // Cannot scope estimated count — fall back to countDocuments
        return this.model.countDocuments(this._scope());
    }

    distinct(field, filter = {}) {
        return this.model.distinct(field, this._scope(filter));
    }

    exists(filter = {}) {
        return this.model.exists(this._scope(filter));
    }

    // ── Write Methods ───────────────────────────────────────────────────

    create(doc) {
        if (Array.isArray(doc)) {
            return this.model.insertMany(doc.map(d => ({ ...d, tenant: this.tenantId })));
        }
        return this.model.create({ ...doc, tenant: this.tenantId });
    }

    insertMany(docs, options = {}) {
        return this.model.insertMany(
            docs.map(d => ({ ...d, tenant: this.tenantId })),
            options
        );
    }

    // ── Aggregation ─────────────────────────────────────────────────────

    /**
     * Runs an aggregation pipeline with a $match for tenant prepended.
     * @param {Array} pipeline
     */
    aggregate(pipeline = []) {
        return this.model.aggregate([
            { $match: { tenant: this._tenantObjectId } },
            ...pipeline,
        ]);
    }

    // ── Cursor ──────────────────────────────────────────────────────────

    cursor(filter = {}, options = {}) {
        return this.model.find(this._scope(filter)).cursor(options);
    }
}

module.exports = TenantRepo;
