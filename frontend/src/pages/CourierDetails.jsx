import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Truck, Key, MapPin, DollarSign, Activity, Settings2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';

// Import sub-components for the tabs
import CourierApiSettings from '../components/couriers/CourierApiSettings';
import CourierPricingEngine from '../components/couriers/CourierPricingEngine';
import CourierCoverageMap from '../components/couriers/CourierCoverageMap';
import CourierStatusMapping from '../components/couriers/CourierStatusMapping';

export default function CourierDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';
    const isNew = id === 'new';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    const [courier, setCourier] = useState({
        name: '',
        phone: '',
        status: 'Active',
        integrationType: 'Manual', // 'Manual' or 'API'
        vehicleType: 'Motorcycle',
        notes: ''
    });

    useEffect(() => {
        if (!isNew) {
            fetchCourier();
        }
    }, [id]);

    const fetchCourier = async () => {
        try {
            const token = localStorage.getItem('token');
            // Reusing getCouriers but we might need a specific getById later. For now let's just fetch all and find it.
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/couriers`, { headers: { Authorization: `Bearer ${token}` } });
            const found = res.data.find(c => c._id === id);
            if (found) {
                setCourier(found);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching courier:', error);
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            if (isNew) {
                const res = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/couriers`, courier, { headers: { Authorization: `Bearer ${token}` } });
                navigate(`/couriers/${res.data._id}`);
            } else {
                await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${id}`, courier, { headers: { Authorization: `Bearer ${token}` } });
            }
        } catch (error) {
            console.error('Error saving courier:', error);
            alert(error.response?.data?.message || 'Error saving courier');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'general', label: t('couriers.tabs.general', 'General Info'), icon: <Truck className="w-4 h-4" /> },
        { id: 'api', label: t('couriers.tabs.api', 'API Integration'), icon: <Key className="w-4 h-4" />, disabled: isNew },
        { id: 'coverage', label: t('couriers.tabs.coverage', 'Coverage Regions'), icon: <MapPin className="w-4 h-4" />, disabled: isNew },
        { id: 'pricing', label: t('couriers.tabs.pricing', 'Pricing Engine'), icon: <DollarSign className="w-4 h-4" />, disabled: isNew },
        { id: 'mapping', label: t('couriers.tabs.mapping', 'Status Mapping'), icon: <Activity className="w-4 h-4" />, disabled: isNew }
    ];

    if (loading) return <div className="p-8 text-center text-gray-500">{t('common.loading', 'Loading...')}</div>;

    return (
        <div className="space-y-6">
            <PageHeader
                title={isNew ? t('couriers.add_courier', 'Add New Courier') : courier.name}
                subtitle={isNew ? t('couriers.add_subtitle', 'Create a new logistics partner') : t('couriers.edit_subtitle', 'Manage configuration & pricing')}
                actions={
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/couriers')}
                            className="px-4 py-2 bg-white text-gray-700 font-medium rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 flex items-center transition-colors"
                        >
                            <ArrowLeft className={clsx("w-4 h-4", isRTL ? "ml-2 rotate-180" : "mr-2")} />
                            {t('common.back', 'Back')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm border border-transparent disabled:opacity-50 flex items-center transition-colors"
                        >
                            <Save className={clsx("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
                        </button>
                    </div>
                }
            />

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="border-b border-gray-200 flex overflow-x-auto hide-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            disabled={tab.disabled}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                                activeTab === tab.id
                                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/30"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                                tab.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {activeTab === 'general' && (
                        <div className="max-w-3xl space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.name', 'Company Name')}</label>
                                    <input
                                        type="text"
                                        value={courier.name}
                                        onChange={e => setCourier({ ...courier, name: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.phone', 'Contact Dispatch Number')}</label>
                                    <input
                                        type="text"
                                        value={courier.phone}
                                        onChange={e => setCourier({ ...courier, phone: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.integrationType', 'Integration Mode')}</label>
                                    <select
                                        value={courier.integrationType}
                                        onChange={e => setCourier({ ...courier, integrationType: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                    >
                                        <option value="Manual">{t('couriers.integrationManual', 'Manual Logistics (Internal Riders)')}</option>
                                        <option value="API">{t('couriers.integrationApi', 'Full API Automation')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.status', 'System Status')}</label>
                                    <select
                                        value={courier.status}
                                        onChange={e => setCourier({ ...courier, status: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border bg-gray-50"
                                    >
                                        <option value="Active">🟢 Active</option>
                                        <option value="Inactive">🔴 Disabled</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('couriers.notes', 'Internal Notes')}</label>
                                <textarea
                                    value={courier.notes}
                                    onChange={e => setCourier({ ...courier, notes: e.target.value })}
                                    rows="3"
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                                />
                            </div>
                        </div>
                    )}

                    {!isNew && activeTab !== 'general' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {activeTab === 'api' && <CourierApiSettings courier={courier} setCourier={setCourier} />}
                            {activeTab === 'coverage' && <CourierCoverageMap courierId={courier._id} />}
                            {activeTab === 'pricing' && <CourierPricingEngine courierId={courier._id} />}
                            {activeTab === 'mapping' && <CourierStatusMapping courier={courier} setCourier={setCourier} />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
