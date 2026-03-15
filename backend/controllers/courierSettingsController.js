const CourierSetting = require('../models/CourierSetting');
const axios = require('axios');
const logger = require('../shared/logger');

exports.getSettings = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        let settings = await CourierSetting.findOne({ tenant: tenantId, providerName: 'ECOTRACK' }).select('+apiToken');
        if (!settings) {
            settings = await CourierSetting.create({
                tenant: tenantId,
                providerName: 'ECOTRACK',
                apiUrl: 'https://api.ecotrack.dz/v1',
                apiToken: '',
                connectionStatus: 'Invalid Token'
            });
        }
        // Redact raw token — UI only needs connection status, not the credential
        const { apiToken: _raw, ...safe } = settings.toObject();
        safe.apiToken = settings.apiToken ? '****' + settings.apiToken.slice(-4) : '';
        res.json(safe);
    } catch (error) {
        logger.error({ err: error }, 'Courier settings fetch error');
        res.status(500).json({ message: 'Failed to load courier settings. Please try again.' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const tenantId = req.user.tenant;
        const { apiUrl, apiToken } = req.body;

        let settings = await CourierSetting.findOne({ tenant: tenantId, providerName: 'ECOTRACK' }).select('+apiToken');

        if (!settings) {
            settings = new CourierSetting({ tenant: tenantId, providerName: 'ECOTRACK' });
        }

        // Update settings object — normalize URL (strip trailing slashes, whitespace)
        if (apiUrl !== undefined) settings.apiUrl = apiUrl.trim().replace(/\/+$/, '');
        if (apiToken !== undefined) settings.apiToken = apiToken.trim();

        // Try to validate the token with ECOTRACK
        let connectionStatus = 'Invalid Token';
        if (settings.apiToken && settings.apiUrl) {
            try {
                // Use Ecotrack's dedicated token validation endpoint
                const pingUrl = `${settings.apiUrl}/api/v1/validate/token`;

                logger.info('[CourierSettings] Validating EcoTrack token');

                const response = await axios.get(pingUrl, {
                    params: { api_token: settings.apiToken },
                    headers: { 'Authorization': `Bearer ${settings.apiToken}` },
                    timeout: 8000
                });

                if (response.status === 200 || response.status === 201) {
                    connectionStatus = 'Valid';
                }
            } catch (apiError) {
                const status = apiError.response ? apiError.response.status : 'NO_RESPONSE';
                logger.warn({ status }, '[CourierSettings] ECOTRACK verification returned non-200');

                if (status === 401) {
                    connectionStatus = 'Invalid Token';
                } else if (status === 403) {
                    connectionStatus = 'Not Allowed';
                } else if ([404, 422, 500].includes(status)) {
                    logger.info({ status }, '[CourierSettings] Treating as valid connection (server reachable)');
                    connectionStatus = 'Valid';
                } else {
                    connectionStatus = 'Unreachable';
                }
            }
        }

        settings.connectionStatus = connectionStatus;
        settings.lastValidatedAt = new Date();

        await settings.save();
        const { apiToken: _raw2, ...safeResponse } = settings.toObject();
        safeResponse.apiToken = settings.apiToken ? '****' + settings.apiToken.slice(-4) : '';
        res.json(safeResponse);
    } catch (error) {
        res.status(400).json({ message: 'Failed to update courier settings' });
    }
};
