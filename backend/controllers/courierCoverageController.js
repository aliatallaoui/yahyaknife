const CourierCoverage = require('../models/CourierCoverage');
const Courier = require('../models/Courier');
const axios = require('axios');

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

// @desc    Sync coverage areas from Ecotrack API
// @route   POST /api/couriers/:id/coverage/sync
// @access  Private
exports.syncEcotrackCoverage = async (req, res) => {
    try {
        const { id } = req.params;
        const courier = await Courier.findById(id);

        if (!courier) return res.status(404).json({ message: 'Courier not found' });
        if (courier.integrationType !== 'API' || !courier.apiBaseUrl || !courier.apiToken) {
            return res.status(400).json({ message: 'Courier is not configured for API integration.' });
        }

        const baseUrl = courier.apiBaseUrl.replace(/\/$/, ""); // Remove trailing slash if any
        
        // 1. Fetch Wilayas
        const wilayasRes = await axios.get(`${baseUrl}/api/v1/get/wilayas`, {
            headers: {
                // Determine auth header formatting based on authType
                ...(courier.authType === 'Bearer Token' ? { Authorization: `Bearer ${courier.apiToken}` } :
                   courier.authType === 'API Key' ? { 'x-api-key': courier.apiToken } : {})
            }
        });

        const wilayas = wilayasRes.data;
        if (!Array.isArray(wilayas)) {
             return res.status(400).json({ message: 'Invalid response from Ecotrack API for wilayas.' });
        }

        let totalAddedOrUpdated = 0;
        const operations = [];

        // 2. Loop through wilayas and fetch communes
        for (const w of wilayas) {
            const wilayaId = w.wilaya_id;
            const wilayaName = w.wilaya_name || w.name;
            
            try {
                const communesRes = await axios.get(`${baseUrl}/api/v1/get/communes?wilaya_id=${wilayaId}`, {
                    headers: {
                        ...(courier.authType === 'Bearer Token' ? { Authorization: `Bearer ${courier.apiToken}` } :
                           courier.authType === 'API Key' ? { 'x-api-key': courier.apiToken } : {})
                    }
                });

                const communes = communesRes.data;
                if (Array.isArray(communes)) {
                    for (const c of communes) {
                        const communeName = c.commune_name || c.name;
                        
                        // Default options
                        let homeSupported = true;
                        let officeSupported = false; // Desk stop usually false by default unless specified

                        if(c.has_stop_desk || c.is_stop_desk) {
                            officeSupported = true;
                        }

                        // We will build bulk operations for speed
                        operations.push({
                            updateOne: {
                                filter: { courierId: id, wilayaCode: wilayaId.toString(), commune: communeName },
                                update: { 
                                    $set: { 
                                        homeSupported, 
                                        officeSupported 
                                    } 
                                },
                                upsert: true
                            }
                        });
                        totalAddedOrUpdated++;
                    }
                }
            } catch (err) {
                console.error(`Failed to fetch communes for wilaya ${wilayaId}:`, err.message);
                // Continue with other wilayas
            }
        }

        if (operations.length > 0) {
            await CourierCoverage.bulkWrite(operations);
        }

        // Update last sync time
        courier.lastSyncAt = new Date();
        await courier.save();

        res.json({ message: `Successfully synced ${totalAddedOrUpdated} coverage combinations.`, count: totalAddedOrUpdated });
    } catch (error) {
        console.error('Ecotrack Sync Error:', error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
};
