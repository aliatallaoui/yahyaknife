import React, { useState } from 'react';
import { apiFetch } from '../../utils/apiFetch';
import { useTranslation } from 'react-i18next';
import { Key, Globe, CheckCircle, XCircle, RefreshCw, Save } from 'lucide-react';
import clsx from 'clsx';

export default function CourierApiSettings({ courier, setCourier, onSave, saving }) {
    const { t } = useTranslation();
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);

        try {
            const isYalidin = courier.apiProvider === 'Yalidin';
            
            if (isYalidin) {
                if (!courier.apiId || !courier.apiToken) {
                    throw new Error(t('couriers.yalidinValidation', 'API ID and API Token are required for Yalidin connection test.'));
                }
            } else {
                if (!courier.apiBaseUrl || !courier.apiToken) {
                    throw new Error(t('couriers.ecotrackValidation', 'API Token and Base URL are required for Ecotrack connection test.'));
                }
            }

            const res = await apiFetch('/api/couriers/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiProvider: courier.apiProvider || 'Ecotrack',
                    apiId: courier.apiId,
                    apiBaseUrl: courier.apiBaseUrl,
                    authType: courier.authType || 'Bearer Token',
                    apiToken: courier.apiToken
                })
            });

            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.message || t('couriers.connectionFailed', 'Connection failed. Please check credentials.'));
            }

            setCourier(prev => ({ ...prev, testConnectionStatus: 'Success' }));
            setTestResult({ success: true, message: t('couriers.connectionOk', 'Connection established successfully!') });
        } catch (error) {
            setCourier(prev => ({ ...prev, testConnectionStatus: 'Failed' }));
            setTestResult({ success: false, message: error.message || t('couriers.connectionFailed', 'Connection failed. Please check credentials.') });
        } finally {
            setTesting(false);
        }
    };

    if (courier.integrationType !== 'API') {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Key className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{t('couriers.manual_mode', 'Manual Mode Active')}</h3>
                <p className="text-gray-500 max-w-sm">
                    {t('couriers.manual_desc', 'This courier is configured for manual dispatch. To enable API credentials, change the Integration Mode under General Info to "API".')}
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white border text-start border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-indigo-500" />
                    {t('couriers.api_config', 'API Configuration')}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="md:col-span-2">
                        <label htmlFor="api-provider" className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.apiProvider', 'API Provider')}</label>
                        <select
                            id="api-provider"
                            value={courier.apiProvider || 'Ecotrack'}
                            onChange={e => setCourier({ ...courier, apiProvider: e.target.value })}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                        >
                            <option value="Ecotrack">{t('couriers.providerEcotrack', 'ECOTRACK Compatible API')}</option>
                            <option value="Yalidin">{t('couriers.providerYalidin', 'Yalidin Express')}</option>
                            <option value="Other">{t('couriers.providerOther', 'Custom / Other')}</option>
                        </select>
                    </div>

                    {courier.apiProvider !== 'Yalidin' && (
                        <>
                            <div>
                                <label htmlFor="api-base-url" className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.apiBaseUrl', 'API Base URL')}</label>
                                <input
                                    id="api-base-url"
                                    type="url"
                                    value={courier.apiBaseUrl || ''}
                                    onChange={e => setCourier({ ...courier, apiBaseUrl: e.target.value })}
                                    placeholder="https://api.ecotrack.dz/v1"
                                    className="w-full rounded-lg text-start ltr:text-left rtl:text-left border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label htmlFor="api-auth-type" className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.authType', 'Authentication Type')}</label>
                                <select
                                    id="api-auth-type"
                                    value={courier.authType || 'Bearer Token'}
                                    onChange={e => setCourier({ ...courier, authType: e.target.value })}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                >
                                    <option value="Bearer Token">{t('couriers.authBearer', 'Bearer Token')}</option>
                                    <option value="API Key">{t('couriers.authApiKey', 'API Key')}</option>
                                    <option value="None">{t('couriers.authNone', 'None')}</option>
                                </select>
                            </div>
                        </>
                    )}

                    {courier.apiProvider === 'Yalidin' && (
                        <div className="md:col-span-2">
                            <label htmlFor="api-yalidin-id" className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.apiId', 'Yalidin API ID')}</label>
                            <input
                                id="api-yalidin-id"
                                type="text"
                                value={courier.apiId || ''}
                                onChange={e => setCourier({ ...courier, apiId: e.target.value })}
                                className="w-full rounded-lg text-start ltr:text-left rtl:text-left border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border font-mono text-sm"
                                dir="ltr"
                            />
                        </div>
                    )}

                    <div className="md:col-span-2">
                        <label htmlFor="api-token" className="block text-sm font-medium text-gray-700 mb-1">
                            {courier.apiProvider === 'Yalidin' ? t('couriers.apiTokenYalidin', 'Yalidin API Token') : t('couriers.apiToken', 'API Token / Key')}
                        </label>
                        <input
                            id="api-token"
                            type="password"
                            value={courier.apiToken || ''}
                            onChange={e => setCourier({ ...courier, apiToken: e.target.value })}
                            className="w-full rounded-lg text-start ltr:text-left rtl:text-left border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border font-mono text-sm"
                            dir="ltr"
                        />
                    </div>
                    <div>
                        <label htmlFor="api-account-ref" className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.accountReference', 'Account Reference (Optional)')}</label>
                        <input
                            id="api-account-ref"
                            type="text"
                            value={courier.accountReference || ''}
                            onChange={e => setCourier({ ...courier, accountReference: e.target.value })}
                            placeholder="e.g. ACC10293"
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                        />
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">{t('couriers.connectionStatus', 'Connection Status:')}</span>
                        {courier.testConnectionStatus === 'Success' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                                <CheckCircle className="w-4 h-4" /> {t('common.verified', 'Verified & Connected')}
                            </span>
                        ) : courier.testConnectionStatus === 'Failed' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                                <XCircle className="w-4 h-4" /> {t('common.failed', 'Connection Failed')}
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                {t('common.untested', 'Untested')}
                            </span>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleTestConnection}
                            disabled={testing}
                            className="flex items-center gap-2 px-5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors border border-indigo-200 shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw className={clsx("w-4 h-4", testing && "animate-spin")} />
                            {testing ? t('common.testing', 'Testing...') : t('couriers.testConnection', 'Test Connection')}
                        </button>
                        <button
                            onClick={onSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                            <Save className={clsx("w-4 h-4", saving && "animate-pulse")} />
                            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
                        </button>
                    </div>
                </div>

                {testResult && (
                    <div className={clsx("mt-4 p-4 rounded-lg text-sm font-medium", testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>
                        {testResult.message}
                    </div>
                )}
            </div>
        </div>
    );
}
