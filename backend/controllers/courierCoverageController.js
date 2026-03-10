const CourierCoverage = require('../models/CourierCoverage');
const Courier = require('../models/Courier');

// @desc    Get all coverage areas for a courier
// @route   GET /api/couriers/:id/coverage
// @access  Private
exports.getCoverage = async (req, res) => {
    try {
        const { id } = req.params;
        const coverage = await CourierCoverage.find({ courierId: id })
            .sort({ wilayaCode: 1, commune: 1 });
        res.json(coverage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Add a coverage area (or update if combination exists)
// @route   POST /api/couriers/:id/coverage
// @access  Private
exports.upsertCoverage = async (req, res) => {
    try {
        const { id } = req.params;
        const { wilayaCode, commune, homeSupported, officeSupported } = req.body;
        
        const courier = await Courier.findById(id);
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const updated = await CourierCoverage.findOneAndUpdate(
            { courierId: id, wilayaCode, commune },
            { homeSupported, officeSupported },
            { new: true, upsert: true }
        );
        
        res.status(200).json(updated);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// @desc    Delete a coverage area
// @route   DELETE /api/couriers/:id/coverage/:coverageId
// @access  Private
exports.deleteCoverage = async (req, res) => {
    try {
        const { id, coverageId } = req.params;

        const deleted = await CourierCoverage.findOneAndDelete({ _id: coverageId, courierId: id });
        if (!deleted) return res.status(404).json({ message: 'Coverage area not found' });

        res.json({ message: 'Coverage area deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
