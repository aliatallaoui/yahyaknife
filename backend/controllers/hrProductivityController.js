const mongoose = require('mongoose');
const WorkerProductivity = require('../models/WorkerProductivity');
const WorkerReward = require('../models/WorkerReward');
const Employee = require('../models/Employee');

/**
 * Resolves a set of employeeIds scoped to the current tenant.
 * If a specific employeeId is requested, verifies it belongs to this tenant.
 * Returns null if the requested employee doesn't belong to this tenant (caller should 404).
 */
const resolveTenantEmployeeIds = async (tenant, requestedId) => {
    if (requestedId) {
        const emp = await Employee.findOne({ _id: requestedId, tenant }).select('_id').lean();
        if (!emp) return null; // not found in this tenant
        return [emp._id];
    }
    return Employee.find({ tenant }).distinct('_id');
};

exports.getProductivity = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const requestedId = req.query.employeeId;

        if (requestedId && !mongoose.Types.ObjectId.isValid(requestedId))
            return res.status(400).json({ error: 'Invalid employeeId' });

        const employeeIds = await resolveTenantEmployeeIds(tenant, requestedId || null);
        if (employeeIds === null)
            return res.status(404).json({ error: 'Employee not found' });

        const productivity = await WorkerProductivity.find({ employeeId: { $in: employeeIds } })
            .populate('employeeId', 'name')
            .sort({ date: -1 });
        res.json(productivity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.logProductivity = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { employeeId, date, tasksCompleted, operations, notes } = req.body;
        if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId))
            return res.status(400).json({ error: 'Valid employeeId is required' });

        // Verify employee belongs to this tenant
        const emp = await Employee.findOne({ _id: employeeId, tenant }).select('_id').lean();
        if (!emp) return res.status(404).json({ error: 'Employee not found' });

        const prod = new WorkerProductivity({ employeeId, date, tasksCompleted, operations, notes });
        const saved = await prod.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getRewards = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const requestedId = req.query.employeeId;

        if (requestedId && !mongoose.Types.ObjectId.isValid(requestedId))
            return res.status(400).json({ error: 'Invalid employeeId' });

        const employeeIds = await resolveTenantEmployeeIds(tenant, requestedId || null);
        if (employeeIds === null)
            return res.status(404).json({ error: 'Employee not found' });

        const rewards = await WorkerReward.find({ employeeId: { $in: employeeIds } })
            .populate('employeeId', 'name role')
            .sort({ dateAwarded: -1 });
        res.json(rewards);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.grantReward = async (req, res) => {
    try {
        const tenant = req.user.tenant;
        const { employeeId, dateAwarded, type, amount, currency, reason, relatedProductivityId } = req.body;
        if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId))
            return res.status(400).json({ error: 'Valid employeeId is required' });

        // Verify employee belongs to this tenant
        const emp = await Employee.findOne({ _id: employeeId, tenant }).select('_id').lean();
        if (!emp) return res.status(404).json({ error: 'Employee not found' });

        const reward = new WorkerReward({ employeeId, dateAwarded, type, amount, currency, reason, relatedProductivityId });
        const saved = await reward.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
