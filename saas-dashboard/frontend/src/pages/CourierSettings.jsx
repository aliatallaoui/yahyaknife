import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Save, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export default function CourierSettings() {
    const { t } = useTranslation();
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
            setSettings(res.data);
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
                apiUrl: settings.apiUrl,
                apiToken: settings.apiToken
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSettings(res.data);
            setMessage(t('courier.settingsSaved', 'Settings saved and connection tested successfully.'));
        } catch (error) {
            console.error('Error saving courier settings:', error);
            setMessage(error.response?.data?.message || t('courier.settingsError', 'Failed to save settings.'));
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
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">{t('courier.title', 'Courier Integration Settings')}</h1>
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
                            <h2 className="text-lg font-semibold text-gray-900">ECOTRACK Integration</h2>
                            <p className="text-sm text-gray-500 mt-1">Configure your ECOTRACK API credentials to enable automated dispatch.</p>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-sm text-gray-500 mb-1">Live Status</span>
                            {renderStatusBadge(settings.connectionStatus)}
                        </div>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">API Gateway URL</label>
                                <input
                                    type="url"
                                    required
                                    value={settings.apiUrl}
                                    onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 transition-colors"
                                    placeholder="https://api.ecotrack.dz/v1"
                                />
                                <p className="mt-1.5 text-xs text-gray-500">Ensure this points to the active V1 environment.</p>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Bearer Token</label>
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
                                <p className="mt-1.5 text-xs text-gray-500">Your secret API token. Keep this safe; it grants full access to create shipments.</p>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                            >
                                {saving ? (
                                    <><RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" /> Validating...</>
                                ) : (
                                    <><Save className="-ml-1 mr-2 h-4 w-4" /> Save & Test Connection</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* API Usage & Rate Limits Module */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <RefreshCw className="w-5 h-5 mr-2 text-gray-400" />
                    API Rate Limits & Usage Tracker
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium">Requests Per Minute</p>
                        <div className="mt-2 flex items-baseline">
                            <span className="text-2xl font-bold text-gray-900">{settings.currentUsage?.minuteCount || 0}</span>
                            <span className="ml-1 text-sm text-gray-500">/ {settings.rateLimits?.requestsPerMinute || 50}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.min(((settings.currentUsage?.minuteCount || 0) / (settings.rateLimits?.requestsPerMinute || 50)) * 100, 100)}%` }}></div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium">Requests Per Hour</p>
                        <div className="mt-2 flex items-baseline">
                            <span className="text-2xl font-bold text-gray-900">{settings.currentUsage?.hourCount || 0}</span>
                            <span className="ml-1 text-sm text-gray-500">/ {settings.rateLimits?.requestsPerHour || 1500}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.min(((settings.currentUsage?.hourCount || 0) / (settings.rateLimits?.requestsPerHour || 1500)) * 100, 100)}%` }}></div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium">Daily Quota</p>
                        <div className="mt-2 flex items-baseline">
                            <span className="text-2xl font-bold text-gray-900">{settings.currentUsage?.dayCount || 0}</span>
                            <span className="ml-1 text-sm text-gray-500">/ {settings.rateLimits?.requestsPerDay || 15000}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                            <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${Math.min(((settings.currentUsage?.dayCount || 0) / (settings.rateLimits?.requestsPerDay || 15000)) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-4">API usage counters automatically reset based on calendar time boundaries. Bypassing limits will result in temporary suspension by the provider.</p>
            </div>
        </div>
    );
}
