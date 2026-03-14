const logger = require('../shared/logger');
const mongoose = require('mongoose');
const CourierCoverage = require('../models/CourierCoverage');
const Courier = require('../models/Courier');
const axios = require('axios');

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Get all coverage areas for a courier
// @route   GET /api/couriers/:id/coverage
// @access  Private
exports.getCoverage = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });
        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });
        const coverage = await CourierCoverage.find({ courierId: id, tenant: req.user.tenant })
            .sort({ wilayaCode: 1, commune: 1 })
            .lean();
        res.json(coverage);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching courier coverage');
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Add a coverage area (or update if combination exists)
// @route   POST /api/couriers/:id/coverage
// @access  Private
exports.upsertCoverage = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });
        const { wilayaCode, commune, homeSupported, officeSupported } = req.body;

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const updated = await CourierCoverage.findOneAndUpdate(
            { courierId: id, wilayaCode, commune, tenant: req.user.tenant },
            { homeSupported, officeSupported, tenant: req.user.tenant },
            { returnDocument: 'after', upsert: true }
        );
        
        res.status(200).json(updated);
    } catch (error) {
        logger.error({ err: error }, 'Error upserting courier coverage');
        res.status(400).json({ error: 'Invalid coverage data' });
    }
};

// @desc    Delete a coverage area
// @route   DELETE /api/couriers/:id/coverage/:coverageId
// @access  Private
exports.deleteCoverage = async (req, res) => {
    try {
        const { id, coverageId } = req.params;
        if (!validId(id) || !validId(coverageId)) return res.status(400).json({ message: 'Invalid ID' });

        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });
        if (!courier) return res.status(404).json({ message: 'Courier not found' });

        const deleted = await CourierCoverage.findOneAndDelete({ _id: coverageId, courierId: id, tenant: req.user.tenant });
        if (!deleted) return res.status(404).json({ message: 'Coverage area not found' });

        res.json({ message: 'Coverage area deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting courier coverage');
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Sync coverage areas from Ecotrack API
// @route   POST /api/couriers/:id/coverage/sync
// @access  Private
exports.syncEcotrackCoverage = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validId(id)) return res.status(400).json({ message: 'Invalid courier ID' });
        const courier = await Courier.findOne({ _id: id, tenant: req.user.tenant, deletedAt: null });

        if (!courier) return res.status(404).json({ message: 'Courier not found' });
        if (courier.integrationType !== 'API') {
            return res.status(400).json({ message: 'Courier is not configured for API integration.' });
        }

        const provider = courier.apiProvider || 'Ecotrack';
        let totalAddedOrUpdated = 0;
        const operations = [];

        if (provider === 'Yalidin') {
            if (!courier.apiId || !courier.apiToken) {
                 return res.status(400).json({ message: 'Yalidin API ID and Token are not configured.' });
            }
            
            
            const baseUrl = 'https://api.yalidine.com/v1';
            
            let currentUrl = `${baseUrl}/communes`;
            let hasMore = true;
            
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

            let currentPage = 1;

            while (hasMore) {
                logger.info({ page: currentPage, url: currentUrl }, '[Yalidin Sync] Fetching page');
                const requestHeaders = {
                    'X-API-ID': courier.apiId,
                    'X-API-TOKEN': courier.apiToken,
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                };
                
                const communesRes = await axios.get(`${currentUrl}?page=${currentPage}`, {
                    headers: requestHeaders
                });

                const pageData = communesRes.data;
                const communes = pageData?.data;
                
                if (Array.isArray(communes)) {
                    if (communes.length === 0) {
                        hasMore = false;
                        break;
                    }
                    
                    for (const c of communes) {
                        const wilayaId = c.wilaya_id;
                        const communeName = c.name;
                        
                        let homeSupported = true;
                        let officeSupported = (c.has_stop_desk == 1 || c.has_stop_desk === true) ? true : false;
    
                        operations.push({
                            updateOne: {
                                filter: { courierId: id, wilayaCode: wilayaId.toString(), commune: communeName, tenant: req.user.tenant },
                                update: {
                                    $set: {
                                        homeSupported,
                                        officeSupported,
                                        tenant: req.user.tenant
                                    }
                                },
                                upsert: true
                            }
                        });
                        totalAddedOrUpdated++;
                    }
                } else {
                     return res.status(400).json({ message: 'Invalid response from Yalidin API for communes.' });
                }
                
                hasMore = pageData?.has_more === true;
                if (hasMore) {
                    currentPage++;
                    // Rate Limit Protection: 5 req / sec = 200ms min delay
                    await delay(250);
                }
            }

        } else {
            // Ecotrack logic
            if (!courier.apiBaseUrl || !courier.apiToken) {
                return res.status(400).json({ message: 'Ecotrack API Base URL and Token are not configured.' });
            }

            const baseUrl = courier.apiBaseUrl.replace(/\/$/, ""); 
            
            // 1. Fetch Wilayas
            const wilayasRes = await axios.get(`${baseUrl}/api/v1/get/wilayas`, {
                headers: {
                    ...(courier.authType === 'Bearer Token' ? { Authorization: `Bearer ${courier.apiToken}` } :
                       courier.authType === 'API Key' ? { 'x-api-key': courier.apiToken } : {})
                }
            });

            const wilayas = wilayasRes.data;
            if (!Array.isArray(wilayas)) {
                 return res.status(400).json({ message: 'Invalid response from Ecotrack API for wilayas.' });
            }

            // 2. Loop through wilayas and fetch communes
            for (const w of wilayas) {
                const wilayaId = w.wilaya_id;
                
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
                            
                            let homeSupported = true;
                            let officeSupported = (c.has_stop_desk || c.is_stop_desk) ? true : false;

                            operations.push({
                                updateOne: {
                                    filter: { courierId: id, wilayaCode: wilayaId.toString(), commune: communeName, tenant: req.user.tenant },
                                    update: {
                                        $set: {
                                            homeSupported,
                                            officeSupported,
                                            tenant: req.user.tenant
                                        }
                                    },
                                    upsert: true
                                }
                            });
                            totalAddedOrUpdated++;
                        }
                    }
                } catch (err) {
                    logger.error({ err, wilayaId }, 'Failed to fetch communes for wilaya');
                }
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
        logger.error({ err: error, responseData: error.response?.data, failedUrl: error.config?.url }, 'Ecotrack Sync Error');
        res.status(500).json({ error: 'Server Error' });
    }
};
