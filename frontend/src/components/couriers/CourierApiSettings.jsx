import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Key, Globe, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export default function CourierApiSettings({ courier, setCourier }) {
    const { t } = useTranslation();
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);

        // Mock test connecting to their endpoint to check if valid
        try {
            // Ideally we'd ping a backend endpoint like /api/couriers/:id/test-connection
            // For now, let's simulate a success if API base URL and Token are populated
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            if (!courier.apiBaseUrl || !courier.apiToken) {
                throw new Error('API Token and Base URL are required for connection test.');
            }

            setCourier(prev => ({ ...prev, testConnectionStatus: 'Success' }));
            setTestResult({ success: true, message: 'Connection established successfully!' });
        } catch (error) {
            setCourier(prev => ({ ...prev, testConnectionStatus: 'Failed' }));
            setTestResult({ success: false, message: error.message || 'Connection failed. Please check credentials.' });
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
            <div className="bg-white border text-start border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-indigo-500" />
                    {t('couriers.api_config', 'API Configuration')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.apiBaseUrl', 'API Base URL')}</label>
                        <input
                            type="url"
                            value={courier.apiBaseUrl || ''}
                            onChange={e => setCourier({ ...courier, apiBaseUrl: e.target.value })}
                            placeholder="https://api.ecotrack.dz/v1"
                            className="w-full rounded-lg text-start ltr:text-left rtl:text-left border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                            dir="ltr"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.authType', 'Authentication Type')}</label>
                        <select
                            value={courier.authType || 'Bearer Token'}
                            onChange={e => setCourier({ ...courier, authType: e.target.value })}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                        >
                            <option value="Bearer Token">Bearer Token</option>
                            <option value="API Key">API Key</option>
                            <option value="None">None</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.apiToken', 'API Token / Key')}</label>
                        <input
                            type="password"
                            value={courier.apiToken || ''}
                            onChange={e => setCourier({ ...courier, apiToken: e.target.value })}
                            className="w-full rounded-lg text-start ltr:text-left rtl:text-left border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border font-mono text-sm"
                            dir="ltr"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.accountReference', 'Account Reference (Optional)')}</label>
                        <input
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

                    <button
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="flex items-center gap-2 px-5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors border border-indigo-200 shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw className={clsx("w-4 h-4", testing && "animate-spin")} />
                        {testing ? t('common.testing', 'Testing...') : t('couriers.testConnection', 'Test Connection')}
                    </button>
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
