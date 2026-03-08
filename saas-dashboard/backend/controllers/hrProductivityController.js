const WorkerProductivity = require('../models/WorkerProductivity');
const WorkerReward = require('../models/WorkerReward');
const Employee = require('../models/Employee');

exports.getProductivity = async (req, res) => {
    try {
        const query = req.query.employeeId ? { employeeId: req.query.employeeId } : {};
        const productivity = await WorkerProductivity.find(query)
            .populate('employeeId', 'name workshopRole')
            .populate('knivesWorkedOn', 'orderId status')
            .sort({ date: -1 });
        res.json(productivity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.logProductivity = async (req, res) => {
    try {
        const prod = new WorkerProductivity(req.body);
        const saved = await prod.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getRewards = async (req, res) => {
    try {
        const query = req.query.employeeId ? { employeeId: req.query.employeeId } : {};
        const rewards = await WorkerReward.find(query)
            .populate('employeeId', 'name workshopRole')
            .sort({ dateAwarded: -1 });
        res.json(rewards);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.grantReward = async (req, res) => {
    try {
        const reward = new WorkerReward(req.body);
        const saved = await reward.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};
