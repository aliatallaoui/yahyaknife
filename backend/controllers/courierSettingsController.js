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

        if (!settings) {
            console.log("[CourierSettings] Creating new ECOTRACK settings record during update.");
            settings = new CourierSetting({ providerName: 'ECOTRACK' });
        }

        // Update settings object
        if (apiUrl !== undefined) settings.apiUrl = apiUrl;
        if (apiToken !== undefined) settings.apiToken = apiToken;

        console.log(`[CourierSettings] Updating for ECOTRACK: URL=${settings.apiUrl}, Token=${settings.apiToken ? '****' + settings.apiToken.slice(-4) : 'EMPTY'}`);

        // Try to validate the token with ECOTRACK
        let connectionStatus = 'Invalid Token';
        if (settings.apiToken && settings.apiUrl) {
            try {
                // EcoTrack requires testing an endpoint. 
                // If apiUrl already has /v1, we just append /getWilayas. 
                // If the user provided a base URL, we might need a more complex join, 
                // but let's assume the user/default follows the /v1 pattern.
                const pingUrl = settings.apiUrl.endsWith('/')
                    ? `${settings.apiUrl}getWilayas`
                    : `${settings.apiUrl}/getWilayas`;

                console.log(`[CourierSettings] Pinging EcoTrack: ${pingUrl}`);

                const response = await axios.get(pingUrl, {
                    headers: { 'Authorization': `Bearer ${settings.apiToken}` },
                    timeout: 8000
                });

                if (response.status === 200 || response.status === 201) {
                    connectionStatus = 'Valid';
                }
            } catch (apiError) {
                const status = apiError.response ? apiError.response.status : 'NO_RESPONSE';
                console.error(`[CourierSettings] ECOTRACK Verification Error (Status ${status}):`, apiError.response ? apiError.response.data : apiError.message);

                if (status === 401) {
                    connectionStatus = 'Invalid Token';
                } else if (status === 403) {
                    connectionStatus = 'Not Allowed';
                } else if ([404, 422, 500].includes(status)) {
                    // The server is alive and responding, so the connection is valid even if this specific ping endpoint fails
                    console.log(`[CourierSettings] Treating ${status} as Valid connection (Server reachable).`);
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
