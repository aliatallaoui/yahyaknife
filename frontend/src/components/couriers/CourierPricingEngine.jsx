import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/apiFetch';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Edit3, ShieldAlert, ArrowDownUp, AlertTriangle, Save } from 'lucide-react';
import clsx from 'clsx';
import { useConfirmDialog } from '../ConfirmDialog';

export default function CourierPricingEngine({ courierId }) {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const { dialog: confirmDialogEl, confirm: showConfirm } = useConfirmDialog();
    
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
            const res = await apiFetch(`/api/couriers/${courierId}/pricing`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || t('couriers.loadPricingFailed', 'Failed to load pricing rules.'));
            setRules(json.data ?? json);
        } catch (error) {
            setErrorMsg(error.message || t('couriers.loadPricingFailed', 'Failed to load pricing rules.'));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRule = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData };
            if (payload.deliveryType === '') delete payload.deliveryType;
            if (payload.minWeight === '') delete payload.minWeight;
            if (payload.maxWeight === '') delete payload.maxWeight;

            const url = formData._id
                ? `/api/couriers/${courierId}/pricing/${formData._id}`
                : `/api/couriers/${courierId}/pricing`;
            const method = formData._id ? 'PUT' : 'POST';
            const res = await apiFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.message || t('couriers.saveRuleFailed', 'Error saving rule'));
            }
            fetchRules();
            handleCancelEdit();
        } catch (error) {
            setErrorMsg(error.message || t('couriers.saveRuleFailed', 'Error saving rule'));
        }
    };

    const handleDelete = (ruleId) => {
        showConfirm({
            title: t('common.confirm_delete', 'Delete this pricing rule?'),
            danger: true,
            onConfirm: async () => {
                try {
                    const res = await apiFetch(`/api/couriers/${courierId}/pricing/${ruleId}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error();
                    fetchRules();
                } catch (error) {
                    setErrorMsg(t('couriers.deleteRuleFailed', 'Failed to delete pricing rule.'));
                }
            },
        });
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

    if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('common.loading', 'Loading...')}</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Error banner */}
            {errorMsg && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{errorMsg}</span>
                    <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600">✕</button>
                </div>
            )}
            {confirmDialogEl}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex gap-3 text-start">
                <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">{t('couriers.pricing_engine', 'Advanced Priority Pricing Engine')}</h4>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                        {t('couriers.pricing_desc', 'Rules are evaluated continuously across payloads. The engine selects the matching rule with the HIGHEST priority index. Example: A specific exception rule (Priority 10) will override a general Wilaya rule (Priority 0).')}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Rule Form */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between text-start">
                        {isEditing ? t('couriers.edit_rule', 'Edit Pricing Rule') : t('couriers.add_rule', 'Create New Rule')}
                        {isEditing && (
                            <button onClick={handleCancelEdit} className="text-xs text-gray-500 hover:text-gray-700 font-medium">{t('common.cancel', 'Cancel')}</button>
                        )}
                    </h3>
                    <form onSubmit={handleSaveRule} className="space-y-4 text-start">
                        <div>
                            <label htmlFor="rule-type" className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">{t('couriers.rule_type', 'Rule Target Type')}</label>
                            <select
                                id="rule-type"
                                required
                                value={formData.ruleType}
                                onChange={e => setFormData({ ...formData, ruleType: e.target.value })}
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                            >
                                <option value="Flat">🌍 {t('couriers.ruleFlat', 'Global Flat Rate (Fallback)')}</option>
                                <option value="Wilaya">📍 {t('couriers.ruleWilaya', 'Wilaya Based')}</option>
                                <option value="Wilaya+Commune">📌 {t('couriers.ruleWilayaCommune', 'Wilaya + Specific Commune')}</option>
                                <option value="Weight">⚖️ {t('couriers.ruleWeight', 'Weight Based')}</option>
                            </select>
                        </div>

                        {(formData.ruleType === 'Wilaya' || formData.ruleType === 'Wilaya+Commune') && (
                            <div>
                                <label htmlFor="rule-wilaya" className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">{t('couriers.wilayaCode', 'Wilaya Code / ID')}</label>
                                <input
                                    id="rule-wilaya"
                                    type="text"
                                    required
                                    value={formData.wilayaCode}
                                    onChange={e => setFormData({ ...formData, wilayaCode: e.target.value })}
                                    className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm p-2 border"
                                    placeholder="e.g. 16 for Alger"
                                />
                            </div>
                        )}

                        {formData.ruleType === 'Wilaya+Commune' && (
                            <div>
                                <label htmlFor="rule-commune" className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">{t('couriers.commune', 'Commune Name')}</label>
                                <input
                                    id="rule-commune"
                                    type="text"
                                    required
                                    value={formData.commune}
                                    onChange={e => setFormData({ ...formData, commune: e.target.value })}
                                    className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm p-2 border"
                                    placeholder="e.g. Bir Mourad Rais"
                                />
                            </div>
                        )}

                        {formData.ruleType === 'Weight' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="rule-min-weight" className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">{t('couriers.minWeight', 'Min Weight (kg)')}</label>
                                    <input
                                        id="rule-min-weight"
                                        type="number"
                                        step="0.1"
                                        value={formData.minWeight}
                                        onChange={e => setFormData({ ...formData, minWeight: e.target.value })}
                                        className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm p-2 border"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="rule-max-weight" className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">{t('couriers.maxWeight', 'Max Weight (kg)')}</label>
                                    <input
                                        id="rule-max-weight"
                                        type="number"
                                        step="0.1"
                                        value={formData.maxWeight}
                                        onChange={e => setFormData({ ...formData, maxWeight: e.target.value })}
                                        className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm p-2 border"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label htmlFor="rule-delivery-type" className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">{t('couriers.delivery_modifier', 'Delivery Type Modifier')}</label>
                            <select
                                id="rule-delivery-type"
                                value={formData.deliveryType}
                                onChange={e => setFormData({ ...formData, deliveryType: e.target.value })}
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                            >
                                <option value="">{t('couriers.deliveryAny', 'Any Delivery Type (Default)')}</option>
                                <option value="0">{t('couriers.deliveryHome', 'Home Delivery Only')}</option>
                                <option value="1">{t('couriers.deliveryDesk', 'Desk / Office Only')}</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div>
                                <label htmlFor="rule-price" className="block text-xs font-black text-gray-900 dark:text-white mb-1">{t('couriers.price', 'Final Cost (DZD)')}</label>
                                <input
                                    id="rule-price"
                                    type="number"
                                    required
                                    min="0"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                                    className="w-full text-sm rounded-lg border-indigo-300 dark:border-indigo-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold"
                                />
                            </div>
                            <div>
                                <label htmlFor="rule-priority" className="block text-xs font-black text-gray-900 dark:text-white mb-1 flex items-center justify-between">
                                    {t('couriers.priorityIndex', 'Priority Index')}
                                    <ArrowDownUp className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                </label>
                                <input
                                    id="rule-priority"
                                    type="number"
                                    required
                                    min="0"
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                    className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border font-mono"
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
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-start rtl:text-right whitespace-nowrap text-sm">
                            <thead className="bg-gray-50/80 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 font-bold">{t('couriers.colPriority', 'Priority')}</th>
                                    <th className="px-4 py-3 font-bold">{t('couriers.colRuleType', 'Rule Type')}</th>
                                    <th className="px-4 py-3 font-bold">{t('couriers.colTarget', 'Target')}</th>
                                    <th className="px-4 py-3 font-bold text-end">{t('couriers.colPrice', 'Price')}</th>
                                    <th className="px-4 py-3 font-bold text-center">{t('common.actions', 'Actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {rules.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                                            {t('couriers.noPricingRules', 'No active pricing rules. Add a rule to calculate live delivery fees.')}
                                        </td>
                                    </tr>
                                ) : (
                                    rules.map((rule) => (
                                        <tr key={rule._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={clsx(
                                                    "inline-flex items-center justify-center w-6 h-6 rounded-md font-black text-xs",
                                                    rule.priority > 5 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                                )}>
                                                    {rule.priority}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                                                {rule.ruleType}
                                                {rule.deliveryType !== undefined && rule.deliveryType !== null && (
                                                    <span className="ml-2 inline-block px-2 border dark:border-gray-600 rounded text-[10px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700">
                                                        {rule.deliveryType === 0 ? t('couriers.homeDelivery', 'Home') : t('couriers.officeDelivery', 'Office')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">
                                                {rule.ruleType === 'Flat' && <span className="text-gray-400 dark:text-gray-500 italic">{t('couriers.globalFallback', 'Global Fallback')}</span>}
                                                {rule.ruleType === 'Wilaya' && <span>{t('couriers.wilayaLabel', 'Wilaya')}: {rule.wilayaCode}</span>}
                                                {rule.ruleType === 'Wilaya+Commune' && <span>{rule.commune} ({rule.wilayaCode})</span>}
                                                {rule.ruleType === 'Weight' && <span>{rule.minWeight || 0}kg - {rule.maxWeight || t('common.max', 'Max')}kg</span>}
                                            </td>
                                            <td className="px-4 py-3 text-end">
                                                <span className="font-black text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">
                                                    {rule.price} {t('common.dzd', 'DZD')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleEdit(rule)} className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(rule._id)} className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
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
