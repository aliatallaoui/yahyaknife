import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Edit3, ShieldAlert, ArrowDownUp, AlertTriangle, Save } from 'lucide-react';
import clsx from 'clsx';

export default function CourierPricingEngine({ courierId }) {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(null); // ruleId
    
    // Form state
    const [formData, setFormData] = useState({
        _id: null,
        ruleType: 'Wilaya',
        wilayaCode: '',
        commune: '',
        deliveryType: '',
        minWeight: '',
        maxWeight: '',
        price: '',
        priority: 0
    });

    useEffect(() => {
        if (courierId && courierId !== 'new') {
            fetchRules();
        } else {
            setLoading(false);
        }
    }, [courierId]);

    const fetchRules = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${courierId}/pricing`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRules(res.data);
        } catch (error) {
            console.error('Error fetching pricing rules:', error);
            setErrorMsg(error.response?.data?.message || 'Failed to load pricing rules.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRule = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const payload = { ...formData };
            if (payload.deliveryType === '') delete payload.deliveryType;
            if (payload.minWeight === '') delete payload.minWeight;
            if (payload.maxWeight === '') delete payload.maxWeight;

            if (formData._id) {
                await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${courierId}/pricing/${formData._id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${courierId}/pricing`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            fetchRules();
            handleCancelEdit();
        } catch (error) {
            console.error('Error saving pricing rule:', error);
            setErrorMsg(error.response?.data?.message || 'Error saving rule');
        }
    };

    const handleDelete = (ruleId) => setConfirmDelete(ruleId);

    const confirmDeleteRule = async () => {
        const ruleId = confirmDelete;
        setConfirmDelete(null);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${courierId}/pricing/${ruleId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchRules();
        } catch (error) {
            console.error('Error deleting pricing rule:', error);
            setErrorMsg('Failed to delete pricing rule.');
        }
    };

    const handleEdit = (rule) => {
        setFormData({
            _id: rule._id,
            ruleType: rule.ruleType,
            wilayaCode: rule.wilayaCode || '',
            commune: rule.commune || '',
            deliveryType: rule.deliveryType !== undefined && rule.deliveryType !== null ? rule.deliveryType : '',
            minWeight: rule.minWeight || '',
            maxWeight: rule.maxWeight || '',
            price: rule.price,
            priority: rule.priority || 0
        });
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setFormData({
            _id: null,
            ruleType: 'Wilaya',
            wilayaCode: '',
            commune: '',
            deliveryType: '',
            minWeight: '',
            maxWeight: '',
            price: '',
            priority: 0
        });
        setIsEditing(false);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Pricing Engine...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Error banner */}
            {errorMsg && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{errorMsg}</span>
                    <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600">✕</button>
                </div>
            )}
            {/* Delete rule confirm */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="font-bold text-gray-900">{t('common.confirm_delete', 'Delete this pricing rule?')}</h3>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                            <button onClick={confirmDeleteRule} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-start">
                <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-blue-900">{t('couriers.pricing_engine', 'Advanced Priority Pricing Engine')}</h4>
                    <p className="text-xs text-blue-700 mt-1">
                        {t('couriers.pricing_desc', 'Rules are evaluated continuously across payloads. The engine selects the matching rule with the HIGHEST priority index. Example: A specific exception rule (Priority 10) will override a general Wilaya rule (Priority 0).')}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Rule Form */}
                <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-base font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100 flex items-center justify-between text-start">
                        {isEditing ? t('couriers.edit_rule', 'Edit Pricing Rule') : t('couriers.add_rule', 'Create New Rule')}
                        {isEditing && (
                            <button onClick={handleCancelEdit} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
                        )}
                    </h3>
                    <form onSubmit={handleSaveRule} className="space-y-4 text-start">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">{t('couriers.rule_type', 'Rule Target Type')}</label>
                            <select
                                required
                                value={formData.ruleType}
                                onChange={e => setFormData({ ...formData, ruleType: e.target.value })}
                                className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                            >
                                <option value="Flat">🌍 Global Flat Rate (Fallback)</option>
                                <option value="Wilaya">📍 Wilaya Based</option>
                                <option value="Wilaya+Commune">📌 Wilaya + Specific Commune</option>
                                <option value="Weight">⚖️ Weight Based</option>
                            </select>
                        </div>

                        {(formData.ruleType === 'Wilaya' || formData.ruleType === 'Wilaya+Commune') && (
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">{t('couriers.wilayaCode', 'Wilaya Code / ID')}</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.wilayaCode}
                                    onChange={e => setFormData({ ...formData, wilayaCode: e.target.value })}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm p-2 border"
                                    placeholder="e.g. 16 for Alger"
                                />
                            </div>
                        )}

                        {formData.ruleType === 'Wilaya+Commune' && (
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">{t('couriers.commune', 'Commune Name')}</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.commune}
                                    onChange={e => setFormData({ ...formData, commune: e.target.value })}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm p-2 border"
                                    placeholder="e.g. Bir Mourad Rais"
                                />
                            </div>
                        )}

                        {formData.ruleType === 'Weight' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Min Weight (kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.minWeight}
                                        onChange={e => setFormData({ ...formData, minWeight: e.target.value })}
                                        className="w-full text-sm rounded-lg border-gray-300 shadow-sm p-2 border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Max Weight (kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.maxWeight}
                                        onChange={e => setFormData({ ...formData, maxWeight: e.target.value })}
                                        className="w-full text-sm rounded-lg border-gray-300 shadow-sm p-2 border"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">{t('couriers.delivery_modifier', 'Delivery Type Modifier')}</label>
                            <select
                                value={formData.deliveryType}
                                onChange={e => setFormData({ ...formData, deliveryType: e.target.value })}
                                className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                            >
                                <option value="">Any Delivery Type (Default)</option>
                                <option value="0">Home Delivery Only</option>
                                <option value="1">Desk / Office Only</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div>
                                <label className="block text-xs font-black text-gray-900 mb-1">{t('couriers.price', 'Final Cost (DZD)')}</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                                    className="w-full text-sm rounded-lg border-indigo-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border bg-indigo-50 font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-900 mb-1 flex items-center justify-between">
                                    Priority Index
                                    <ArrowDownUp className="w-3 h-3 text-gray-400" />
                                </label>
                                <input
                                    type="number"
                                    required
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border font-mono"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
                        >
                            {isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {isEditing ? t('common.save', 'Save Changes') : t('couriers.add_rule_btn', 'Add Pricing Rule')}
                        </button>
                    </form>
                </div>

                {/* Rules Table */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-start rtl:text-right whitespace-nowrap text-sm">
                            <thead className="bg-gray-50/80 text-gray-500 text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Priority</th>
                                    <th className="px-4 py-3 font-bold">Rule Type</th>
                                    <th className="px-4 py-3 font-bold">Target</th>
                                    <th className="px-4 py-3 font-bold text-end">Price</th>
                                    <th className="px-4 py-3 font-bold text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rules.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                                            No active pricing rules. Add a rule to calculate live delivery fees.
                                        </td>
                                    </tr>
                                ) : (
                                    rules.map((rule) => (
                                        <tr key={rule._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={clsx(
                                                    "inline-flex items-center justify-center w-6 h-6 rounded-md font-black text-xs",
                                                    rule.priority > 5 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"
                                                )}>
                                                    {rule.priority}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-gray-900">
                                                {rule.ruleType}
                                                {rule.deliveryType !== undefined && rule.deliveryType !== null && (
                                                    <span className="ml-2 inline-block px-2 border rounded text-[10px] text-gray-500 bg-white">
                                                        {rule.deliveryType === 0 ? 'Home' : 'Office'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 font-medium">
                                                {rule.ruleType === 'Flat' && <span className="text-gray-400 italic">Global Fallback</span>}
                                                {rule.ruleType === 'Wilaya' && <span>Wilaya: {rule.wilayaCode}</span>}
                                                {rule.ruleType === 'Wilaya+Commune' && <span>{rule.commune} ({rule.wilayaCode})</span>}
                                                {rule.ruleType === 'Weight' && <span>{rule.minWeight || 0}kg - {rule.maxWeight || 'Max'}kg</span>}
                                            </td>
                                            <td className="px-4 py-3 text-end">
                                                <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
                                                    {rule.price} DZD
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleEdit(rule)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(rule._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
