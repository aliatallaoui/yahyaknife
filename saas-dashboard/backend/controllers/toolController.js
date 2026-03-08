const WorkshopTool = require('../models/WorkshopTool');

// Get all tools
exports.getTools = async (req, res) => {
    try {
        const tools = await WorkshopTool.find().populate('assignedTo', 'name role').sort({ createdAt: -1 });
        res.json(tools);
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
};

// Add new tool
exports.addTool = async (req, res) => {
    try {
        const tool = new WorkshopTool(req.body);
        await tool.save();
        res.status(201).json(tool);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Update a tool
exports.updateTool = async (req, res) => {
    try {
        const tool = await WorkshopTool.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('assignedTo', 'name');
        if (!tool) return res.status(404).json({ error: 'Tool not found' });
        res.json(tool);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Add Maintenance Note
exports.addMaintenanceNote = async (req, res) => {
    try {
        const tool = await WorkshopTool.findById(req.params.id);
        if (!tool) return res.status(404).json({ error: 'Tool not found' });

        tool.maintenanceNotes.push(req.body);
        tool.lastMaintenanceDate = req.body.date || Date.now();

        // Also update status if provided in request
        if (req.body.status) {
            tool.status = req.body.status;
        }

        await tool.save();
        res.json(tool);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete a tool
exports.deleteTool = async (req, res) => {
    try {
        const tool = await WorkshopTool.findByIdAndDelete(req.params.id);
        if (!tool) return res.status(404).json({ error: 'Tool not found' });
        res.json({ message: 'Tool removed' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
