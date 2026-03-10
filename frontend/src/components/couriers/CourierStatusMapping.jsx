import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Activity, Save, RefreshCw } from 'lucide-react';

export default function CourierStatusMapping({ courier, setCourier }) {
    const { t } = useTranslation();
    const [saving, setSaving] = useState(false);

    // List of standard COD internal statuses to map against
    const internalStatuses = [
        'Created in Courier',
        'Validated',
        'In Transit',
        'Out for Delivery',
        'Delivered',
        'Failed Attempt',
        'Return Initiated',
        'Returned',
        'Cancelled'
    ];

    // Some common ECOTRACK external statuses for the UI defaults
    const commonExternal = [
        'order_information_received',
        'dispatched_to_driver',
        'in_delivery',
        'livred',
        'encaissed',
        'failed',
        'returned_to_hub'
    ];

    const [mapping, setMapping] = useState({ ...courier.statusMapping });

    const handleAddPair = () => {
        // Just add an empty key to the dictionary
        setMapping({ ...mapping, '': 'In Transit' });
    };

    const handleKeyChange = (oldKey, newKey) => {
        const newMap = { ...mapping };
        const val = newMap[oldKey];
        delete newMap[oldKey];
        newMap[newKey] = val;
        setMapping(newMap);
    };

    const handleValChange = (key, val) => {
        setMapping({ ...mapping, [key]: val });
    };

    const handleDelete = (key) => {
        const newMap = { ...mapping };
        delete newMap[key];
        setMapping(newMap);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            // Clean up any empty keys
            const cleanMapping = {};
            Object.keys(mapping).forEach(k => {
                if (k.trim()) cleanMapping[k.trim()] = mapping[k];
            });

            const res = await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${courier._id}`, {
                ...courier,
                statusMapping: cleanMapping
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCourier(res.data);
            alert(t('couriers.mapping_saved', 'Mapping configuration saved successfully.'));
        } catch (error) {
            console.error('Error saving mapping:', error);
            alert(error.response?.data?.message || 'Error saving mapping');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white border text-start border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-500" />
                    {t('couriers.status_mapping', 'Lifecycle Event Mapping')}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                    {t('couriers.mapping_desc', 'Map the exact status codes returned by the Courier\'s API/Webhooks into the standardized internal ERP status lifecycle.')}
                </p>

                <div className="grid grid-cols-12 gap-4 mb-4 font-bold text-xs text-gray-500 uppercase tracking-wider px-2">
                    <div className="col-span-5">{t('couriers.external_status', 'External API Status String')}</div>
                    <div className="col-span-1 text-center font-normal">→</div>
                    <div className="col-span-5">{t('couriers.internal_status', 'Internal ERP Target Stage')}</div>
                    <div className="col-span-1 text-right"></div>
                </div>

                <div className="space-y-3 mb-6">
                    {Object.keys(mapping).map((extKey, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-4 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                            <div className="col-span-5 relative">
                                <input
                                    type="text"
                                    value={extKey}
                                    onChange={(e) => handleKeyChange(extKey, e.target.value)}
                                    placeholder="e.g. dispatched_to_driver"
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm p-2 border font-mono text-indigo-700 bg-white"
                                    list="common-external"
                                />
                                <datalist id="common-external">
                                    {commonExternal.map(ce => <option key={ce} value={ce} />)}
                                </datalist>
                            </div>
                            
                            <div className="col-span-1 text-center text-gray-400 font-bold">→</div>
                            
                            <div className="col-span-5">
                                <select
                                    value={mapping[extKey]}
                                    onChange={(e) => handleValChange(extKey, e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border bg-white font-bold text-gray-700"
                                >
                                    {internalStatuses.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-span-1 text-right">
                                <button 
                                    onClick={() => handleDelete(extKey)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded transition-colors"
                                    title="Remove Rule"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {Object.keys(mapping).length === 0 && (
                        <div className="py-6 text-center text-gray-400 border border-dashed rounded-lg">
                            {t('couriers.no_mapping', 'No mappings defined. Manual updates will be required.')}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <button
                        onClick={handleAddPair}
                        className="px-4 py-2 bg-white text-indigo-600 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors shadow-sm"
                    >
                        + {t('couriers.add_mapping_rule', 'Add Mapping Rule')}
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex flex-row items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save Configuration')}
                    </button>
                </div>
            </div>
        </div>
    );
}
