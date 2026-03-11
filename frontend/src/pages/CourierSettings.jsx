import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Save, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';

export default function CourierSettings() {
    const { t } = useTranslation();
    const { hasPermission } = React.useContext(AuthContext);
    const [settings, setSettings] = useState({
        apiUrl: 'https://api.ecotrack.dz/v1',
        apiToken: '',
        connectionStatus: 'Invalid Token',
        rateLimits: {},
        currentUsage: {}
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/courier-settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Ensure we merge defaults if backend returns partial data
            setSettings(prev => ({ ...prev, ...res.data }));
            setLoading(false);
        } catch (error) {
            console.error('Error fetching courier settings:', error);
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/courier-settings`, {
                apiUrl: settings.apiUrl.trim(),
                apiToken: settings.apiToken.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSettings(res.data);
            setMessage(t('courier.settingsSaved'));
            // Refresh to ensure everything is in sync
            setTimeout(() => setMessage(''), 5000);
        } catch (error) {
            console.error('Error saving courier settings:', error);
            setMessage(error.response?.data?.message || t('courier.settingsError'));
        } finally {
            setSaving(false);
        }
    };

    const renderStatusBadge = (status) => {
        switch (status) {
            case 'Valid':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />{t('courier.statusValid', 'Connected & Valid')}</span>;
            case 'Invalid Token':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />{t('courier.statusInvalid', 'Invalid Token')}</span>;
            case 'Not Allowed':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />{t('courier.statusNotAllowed', 'IP/Account Restricted')}</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Configuration...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl font-black text-gray-900 flex items-center gap-3">
                        {t('courier.title', 'Courier Integration Settings')}
                    </h1>
                </div>
            </div>

            {message && (
                <div className={clsx("p-4 rounded-lg flex items-center mb-6", message.includes('failed') || message.includes('Failed') ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")}>
                    {message.includes('failed') || message.includes('Failed') ? <XCircle className="w-5 h-5 mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                    {message}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">{t('couriers.ecotrack', 'ECOTRACK Integration')}</h2>
                            <p className="text-sm text-gray-500 mt-1">{t('couriers.ecotrackSub', 'Configure your ECOTRACK API credentials to enable automated dispatch.')}</p>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-sm text-gray-500 mb-1">{t('couriers.liveStatus', 'Live Status')}</span>
                            {renderStatusBadge(settings.connectionStatus)}
                        </div>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('couriers.gatewayUrl', 'API Gateway URL')}</label>
                                <input
                                    type="url"
                                    required
                                    value={settings.apiUrl}
                                    onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 transition-colors"
                                    placeholder="https://api.ecotrack.dz/v1"
                                />
                                <p className="mt-1.5 text-xs text-gray-500">{t('couriers.gatewaySub', 'Ensure this points to the active V1 environment.')}</p>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">{t('couriers.bearerToken', 'Bearer Token')}</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <input
                                        type="password"
                                        required
                                        value={settings.apiToken}
                                        onChange={(e) => setSettings({ ...settings, apiToken: e.target.value })}
                                        className="block w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-2.5 font-mono text-sm"
                                        placeholder="eyX..."
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-gray-500">{t('couriers.bearerSub', 'Your secret API token. Keep this safe; it grants full access to create shipments.')}</p>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 flex justify-end">
                            {hasPermission('couriers.api.connect') && (
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                                >
                                    {saving ? (
                                        <><RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" /> Validating...</>
                                    ) : (
                                        <><Save className="-ml-1 mr-2 h-4 w-4" />{t('couriers.saveTest', 'Save & Test Connection')}</>
                                    )}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            {/* API Usage & Rate Limits Module */}
            <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between flex-wrap gap-4 items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 me-3">
                            <RefreshCw className="w-5 h-5 shrink-0" />
                        </div>
                        {t('couriers.rateLimits', 'API Rate Limits & Usage Tracker')}
                    </h3>
                    {hasPermission('couriers.api.connect') && (
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center px-4 py-2 border border-indigo-200 rounded-lg shadow-sm text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                        >
                            {saving ? (
                                <><RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" /> Validating...</>
                            ) : (
                                <><Save className="-ml-1 mr-2 h-4 w-4" />{t('couriers.saveLimits', 'Update Limits')}</>
                            )}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 font-bold">{t('couriers.reqMin', 'Requests / Minute')}</span>
                                <span className="font-bold text-gray-900">{settings.currentUsage?.minuteCount || 0} used</span>
                            </div>
                            <div className="mt-3">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{t('couriers.limitConfig', 'Configuration Limit')}</label>
                                <input
                                    type="number"
                                    value={settings.rateLimits?.requestsPerMinute || 50}
                                    onChange={(e) => setSettings({ ...settings, rateLimits: { ...settings.rateLimits, requestsPerMinute: Number(e.target.value) } })}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-bold"
                                />
                            </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                            <div className={clsx("h-2 rounded-full", ((settings.currentUsage?.minuteCount || 0) / (settings.rateLimits?.requestsPerMinute || 50)) > 0.8 ? "bg-rose-500" : "bg-indigo-500")} style={{ width: `${Math.min(((settings.currentUsage?.minuteCount || 0) / (settings.rateLimits?.requestsPerMinute || 50)) * 100, 100)}%` }}></div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 font-bold">{t('couriers.reqHour', 'Requests / Hour')}</span>
                                <span className="font-bold text-gray-900">{settings.currentUsage?.hourCount || 0} used</span>
                            </div>
                            <div className="mt-3">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{t('couriers.limitConfig', 'Configuration Limit')}</label>
                                <input
                                    type="number"
                                    value={settings.rateLimits?.requestsPerHour || 1500}
                                    onChange={(e) => setSettings({ ...settings, rateLimits: { ...settings.rateLimits, requestsPerHour: Number(e.target.value) } })}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-bold"
                                />
                            </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                            <div className={clsx("h-2 rounded-full", ((settings.currentUsage?.hourCount || 0) / (settings.rateLimits?.requestsPerHour || 1500)) > 0.8 ? "bg-rose-500" : "bg-indigo-500")} style={{ width: `${Math.min(((settings.currentUsage?.hourCount || 0) / (settings.rateLimits?.requestsPerHour || 1500)) * 100, 100)}%` }}></div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 font-bold">{t('couriers.dailyQuota', 'Daily Quota')}</span>
                                <span className="font-bold text-gray-900">{settings.currentUsage?.dayCount || 0} used</span>
                            </div>
                            <div className="mt-3">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{t('couriers.limitConfig', 'Configuration Limit')}</label>
                                <input
                                    type="number"
                                    value={settings.rateLimits?.requestsPerDay || 15000}
                                    onChange={(e) => setSettings({ ...settings, rateLimits: { ...settings.rateLimits, requestsPerDay: Number(e.target.value) } })}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-bold"
                                />
                            </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                            <div className={clsx("h-2 rounded-full", ((settings.currentUsage?.dayCount || 0) / (settings.rateLimits?.requestsPerDay || 15000)) > 0.8 ? "bg-rose-500" : "bg-purple-500")} style={{ width: `${Math.min(((settings.currentUsage?.dayCount || 0) / (settings.rateLimits?.requestsPerDay || 15000)) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-gray-500 font-medium mt-5 bg-blue-50/50 p-3 rounded-lg border border-blue-100">{t('couriers.resetInfo', 'API usage counters automatically reset based on calendar time boundaries. Bypassing limits will result in temporary suspension by the provider.')}</p>
            </form>
        </div>
    );
}
