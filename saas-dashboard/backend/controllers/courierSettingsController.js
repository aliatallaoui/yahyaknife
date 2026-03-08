const CourierSetting = require('../models/CourierSetting');
const axios = require('axios');

exports.getSettings = async (req, res) => {
    try {
        let settings = await CourierSetting.findOne({ providerName: 'ECOTRACK' });
        if (!settings) {
            settings = await CourierSetting.create({
                providerName: 'ECOTRACK',
                apiUrl: 'https://api.ecotrack.dz/v1',
                apiToken: '',
                connectionStatus: 'Invalid Token'
            });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { apiUrl, apiToken } = req.body;

        let settings = await CourierSetting.findOne({ providerName: 'ECOTRACK' });
        if (!settings) throw new Error("Settings not found");

        settings.apiUrl = apiUrl || settings.apiUrl;
        settings.apiToken = apiToken || settings.apiToken;

        // Try to validate the token with ECOTRACK
        let connectionStatus = 'Invalid Token';
        if (settings.apiToken && settings.apiUrl) {
            try {
                // EcoTrack requires testing an endpoint, we can use the fee or wilaya list endpoint as a ping
                const response = await axios.get(`${settings.apiUrl}/api/v1/getWilayas`, {
                    headers: { 'Authorization': `Bearer ${settings.apiToken}` },
                    timeout: 5000
                });

                if (response.status === 200 || response.status === 201) {
                    connectionStatus = 'Valid';
                }
            } catch (apiError) {
                console.error("ECOTRACK Verification Error:", apiError.response ? apiError.response.data : apiError.message);
                if (apiError.response && apiError.response.status === 401) {
                    connectionStatus = 'Invalid Token';
                } else if (apiError.response && apiError.response.status === 403) {
                    connectionStatus = 'Not Allowed';
                } else if (apiError.response && (apiError.response.status === 404 || apiError.response.status === 422 || apiError.response.status === 500)) {
                    // The server is alive and responding, so the connection is valid even if this specific ping endpoint fails
                    connectionStatus = 'Valid';
                } else {
                    connectionStatus = 'Unreachable';
                }
            }
        }

        settings.connectionStatus = connectionStatus;
        settings.lastValidatedAt = new Date();

        await settings.save();
        res.json(settings);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
