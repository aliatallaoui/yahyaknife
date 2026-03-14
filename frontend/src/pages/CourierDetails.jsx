import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Trash2, Truck, Key, MapPin, DollarSign, Activity, Settings2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useConfirmDialog } from '../components/ConfirmDialog';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';

// Import sub-components for the tabs
import CourierApiSettings from '../components/couriers/CourierApiSettings';
import CourierPricingEngine from '../components/couriers/CourierPricingEngine';
import CourierCoverageMap from '../components/couriers/CourierCoverageMap';
import CourierStatusMapping from '../components/couriers/CourierStatusMapping';

export default function CourierDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { hasPermission } = React.useContext(AuthContext);
    const isRTL = i18n.language === 'ar';
    const isNew = id === 'new';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [saveToast, setSaveToast] = useState(null); // { type: 'success'|'error', msg }
    const { dialog, confirm } = useConfirmDialog();

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
            const res = await apiFetch('/api/couriers');
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || t('couriers.loadFailed', 'Failed to load courier data.'));
            }
            const json = await res.json();
            const data = json.data ?? json;
            const found = data.find(c => c._id === id);
            if (found) {
                setCourier(found);
            }
            setLoading(false);
        } catch (error) {
            setSaveToast({ type: 'error', msg: error.message || t('couriers.loadFailed', 'Failed to load courier data.') });
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (isNew) {
                const res = await apiFetch('/api/couriers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(courier) });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || t('couriers.saveFailed', 'Error saving courier.'));
                }
                const json = await res.json();
                const data = json.data ?? json;
                navigate(`/couriers/${data._id}`);
            } else {
                const res = await apiFetch(`/api/couriers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(courier) });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || t('couriers.saveFailed', 'Error saving courier.'));
                }
                showSuccess();
            }
        } catch (error) {
            setSaveToast({ type: 'error', msg: error.message || t('couriers.saveFailed', 'Error saving courier.') });
        } finally {
            setSaving(false);
        }
    };

    const showSuccess = () => {
        setSaveToast({ type: 'success', msg: t('common.saved_successfully', 'Saved successfully!') });
        setTimeout(() => setSaveToast(null), 3000);
    };

    const handleDelete = () => {
        confirm({
            title: t('couriers.deleteTitle', 'Delete Courier'),
            body: t('couriers.deleteBody', 'This courier will be permanently removed. Active shipments must be reassigned first. This action cannot be undone.'),
            danger: true,
            confirmLabel: t('common.delete', 'Delete'),
            onConfirm: async () => {
                setDeleting(true);
                try {
                    const res = await apiFetch(`/api/couriers/${id}`, { method: 'DELETE' });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || err.message || t('couriers.deleteFailed', 'Failed to delete courier.'));
                    }
                    navigate('/couriers');
                } catch (error) {
                    setSaveToast({ type: 'error', msg: error.message });
                    setDeleting(false);
                }
            }
        });
    };

    const tabs = [
        { id: 'general', label: t('couriers.tabs.general', 'General Info'), icon: <Truck className="w-4 h-4" /> },
        { id: 'api', label: t('couriers.tabs.api', 'API Integration'), icon: <Key className="w-4 h-4" />, disabled: isNew || !hasPermission('couriers.api.connect') },
        { id: 'coverage', label: t('couriers.tabs.coverage', 'Coverage Regions'), icon: <MapPin className="w-4 h-4" />, disabled: isNew },
        { id: 'pricing', label: t('couriers.tabs.pricing', 'Pricing Engine'), icon: <DollarSign className="w-4 h-4" />, disabled: isNew },
        { id: 'mapping', label: t('couriers.tabs.mapping', 'Status Mapping'), icon: <Activity className="w-4 h-4" />, disabled: isNew }
    ];

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 dark:text-gray-500">
            <div className="w-8 h-8 rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 animate-spin" />
            <span className="text-sm font-medium">{t('common.loading', 'Loading...')}</span>
        </div>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title={isNew ? t('couriers.add_courier', 'Add New Courier') : courier.name}
                subtitle={isNew ? t('couriers.add_subtitle', 'Create a new logistics partner') : t('couriers.edit_subtitle', 'Manage configuration & pricing')}
                actions={
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/couriers')}
                            className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center transition-colors"
                        >
                            <ArrowLeft className={clsx("w-4 h-4", isRTL ? "ml-2 rotate-180" : "mr-2")} />
                            {t('common.back', 'Back')}
                        </button>
                        {(isNew ? hasPermission('couriers.create') : hasPermission('couriers.edit')) && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm border border-transparent disabled:opacity-50 flex items-center transition-colors"
                            >
                                <Save className={clsx("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                                {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
                            </button>
                        )}
                        {!isNew && hasPermission('couriers.delete') && (
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="px-4 py-2 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 font-bold rounded-lg shadow-sm border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 flex items-center transition-colors"
                            >
                                <Trash2 className={clsx("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                                {deleting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
                            </button>
                        )}
                    </div>
                }
            />

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="border-b border-gray-200 dark:border-gray-700 flex overflow-x-auto hide-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            disabled={tab.disabled}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                                activeTab === tab.id
                                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/20"
                                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700",
                                tab.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-4 sm:p-6">
                    {activeTab === 'general' && (
                        <div className="max-w-3xl space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('couriers.name', 'Company Name')}</label>
                                    <input
                                        type="text"
                                        value={courier.name}
                                        onChange={e => setCourier({ ...courier, name: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border dark:bg-gray-700 dark:text-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('couriers.phone', 'Contact Dispatch Number')}</label>
                                    <input
                                        type="text"
                                        value={courier.phone}
                                        onChange={e => setCourier({ ...courier, phone: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border dark:bg-gray-700 dark:text-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('couriers.integrationType', 'Integration Mode')}</label>
                                    <select
                                        value={courier.integrationType}
                                        onChange={e => setCourier({ ...courier, integrationType: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border dark:bg-gray-700 dark:text-gray-100"
                                    >
                                        <option value="Manual">{t('couriers.integrationManual', 'Manual Logistics (Internal Riders)')}</option>
                                        <option value="API">{t('couriers.integrationApi', 'Full API Automation')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('couriers.status', 'System Status')}</label>
                                    <select
                                        value={courier.status}
                                        onChange={e => setCourier({ ...courier, status: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border bg-gray-50 dark:bg-gray-700 dark:text-gray-100"
                                    >
                                        <option value="Active">🟢 {t('couriers.statusActive', 'Active')}</option>
                                        <option value="Inactive">🔴 {t('couriers.statusInactive', 'Disabled')}</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('couriers.notes', 'Internal Notes')}</label>
                                <textarea
                                    value={courier.notes}
                                    onChange={e => setCourier({ ...courier, notes: e.target.value })}
                                    rows="3"
                                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border dark:bg-gray-700 dark:text-gray-100"
                                />
                            </div>
                        </div>
                    )}

                    {!isNew && activeTab !== 'general' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {activeTab === 'api' && <CourierApiSettings courier={courier} setCourier={setCourier} onSave={handleSave} saving={saving} />}
                            {activeTab === 'coverage' && <CourierCoverageMap courierId={courier._id} />}
                            {activeTab === 'pricing' && <CourierPricingEngine courierId={courier._id} courier={courier} />}
                            {activeTab === 'mapping' && <CourierStatusMapping courier={courier} setCourier={setCourier} />}
                        </div>
                    )}
                </div>
            </div>

            {saveToast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-2xl max-w-sm ${saveToast.type === 'success' ? 'bg-emerald-600' : 'bg-gray-900'}`}>
                    {saveToast.type === 'success'
                        ? <CheckCircle className="w-4 h-4 shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                    <span className="flex-1 leading-snug">{saveToast.msg}</span>
                    <button onClick={() => setSaveToast(null)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity shrink-0"><X className="w-4 h-4" /></button>
                </div>
            )}

            {dialog}
        </div>
    );
}
