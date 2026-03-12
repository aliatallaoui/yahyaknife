const mongoose = require('mongoose');
const WorkshopTool = require('../models/WorkshopTool');
const { ok, created, message } = require('../shared/utils/ApiResponse');

exports.getTools = async (req, res) => {
    try {
        const tools = await WorkshopTool.find().populate('assignedTo', 'name role').sort({ createdAt: -1 });
        res.json(ok(tools));
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.addTool = async (req, res) => {
    try {
        const { name, category, serialNumber, status, assignedTo, acquisitionDate, nextMaintenanceDate } = req.body;
        const tool = new WorkshopTool({ name, category, serialNumber, status, assignedTo, acquisitionDate, nextMaintenanceDate });
        await tool.save();
        res.status(201).json(created(tool));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateTool = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const { name, category, serialNumber, status, assignedTo, acquisitionDate, nextMaintenanceDate } = req.body;
        const tool = await WorkshopTool.findByIdAndUpdate(
            req.params.id,
            { name, category, serialNumber, status, assignedTo, acquisitionDate, nextMaintenanceDate },
            { new: true }
        ).populate('assignedTo', 'name');
        if (!tool) return res.status(404).json({ error: 'Tool not found' });
        res.json(ok(tool));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.addMaintenanceNote = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const tool = await WorkshopTool.findById(req.params.id);
        if (!tool) return res.status(404).json({ error: 'Tool not found' });

        const { note, date, performedBy, status: newStatus } = req.body;
        tool.maintenanceNotes.push({ note, date, performedBy });
        tool.lastMaintenanceDate = date || Date.now();
        if (newStatus) tool.status = newStatus;

        await tool.save();
        res.json(ok(tool));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteTool = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ error: 'Invalid ID' });
        const tool = await WorkshopTool.findByIdAndDelete(req.params.id);
        if (!tool) return res.status(404).json({ error: 'Tool not found' });
        res.json(message('Tool removed'));
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
