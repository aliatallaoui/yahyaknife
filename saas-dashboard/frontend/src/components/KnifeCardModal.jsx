import { useState, useEffect } from 'react';
import { X, ChevronRight, Calendar, User, Activity, Flame, Shield, Wrench, Check, Save, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import KnifeStageTracker from './KnifeStageTracker';
import BOMBuilder from './BOMBuilder';
import { useTranslation } from 'react-i18next';
import { getStageTranslation } from '../pages/KnifeDashboard';

const KNIFE_TYPES = ['Hunter', 'Chef', 'Tactical', 'Utility', 'Damascus', 'Cleaver', 'Fillet', 'Bowie', 'Custom', 'Other'];
const STATUS_LIST = ['Design', 'In Production', 'Heat Treatment', 'Grinding', 'Handle Installation', 'Finishing', 'Sharpening', 'Completed', 'Sold'];
const STEEL_TYPES = ['D2', '1095', 'O1', 'AEB-L', 'Damascus', '5160', '52100', 'S30V', '154CM', 'VG-10', 'Other'];
const HANDLE_MATERIALS = ['Walnut', 'Rosewood', 'Olive Wood', 'G10', 'Micarta', 'Carbon Fiber', 'Bone', 'Horn', 'Stabilized Wood', 'Other'];

const EMPTY_FORM = {
    name: '', type: 'Custom', steelType: '', handleMaterial: '', guardMaterial: '',
    pins: '', bladeLength: '', totalLength: '', weight: '', hardnessHRC: '',
    sheathRequired: false,
    sheathMaterial: '',
    materialCost: 0,
    laborCost: 0,
    otherCosts: 0,
    salePrice: 0,
    bom: [],
    status: 'Design', notes: '',
    knifeModelRef: ''
};

export default function KnifeCardModal({ isOpen, onClose, onSaved, initialData = null, knifeModels = [], workers = [] }) {
    const { t } = useTranslation();
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('basic');

    useEffect(() => {
        if (isOpen) {
            setForm(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM);
            setError('');
            setTab('basic');
        }
    }, [isOpen, initialData]);

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    // Auto-fill from knife model template
    const handleModelSelect = (modelId) => {
        set('knifeModelRef', modelId);
        const model = knifeModels.find(m => m._id === modelId);
        if (model) {
            setForm(f => ({
                ...f,
                knifeModelRef: modelId,
                type: model.type || f.type,
                steelType: model.defaultSteelType || f.steelType,
                handleMaterial: model.defaultHandleMaterial || f.handleMaterial,
                guardMaterial: model.defaultGuardMaterial || f.guardMaterial,
                pins: model.defaultPins || f.pins,
                bladeLength: model.bladeLengthMax || '',
                weight: model.typicalWeight || '',
                materialCost: model.estimatedProductionCost || 0,
                salePrice: Math.round((model.suggestedPriceMin + model.suggestedPriceMax) / 2) || 0,
                bom: model.bom || [],
                sheathRequired: model.sheathRequired ?? f.sheathRequired,
                suggestedPrice: model.suggestedPriceMin || f.suggestedPrice,
            }));
        }
    };

    const totalCost = (parseFloat(form.materialCost) || 0)
        + (parseFloat(form.laborCost) || 0)
        + (parseFloat(form.otherCosts) || 0);

    const handleSubmit = async () => {
        if (!form.name.trim()) { setError(t('knives.nameRequired', 'Knife name is required')); return; }
        setSaving(true);
        setError('');
        try {
            const payload = { ...form };
            if (!payload.knifeModelRef) delete payload.knifeModelRef;
            if (!payload.maker) delete payload.maker;
            if (!payload.customerTarget) delete payload.customerTarget;

            const url = initialData?._id ? `/api/knives/cards/${initialData._id}` : '/api/knives/cards';
            const method = initialData?._id ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
            const saved = await res.json();
            onSaved(saved);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleConsumeMaterials = async () => {
        if (!form._id) return;
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/knives/cards/${form._id}/consume`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to consume materials');
            setForm(prev => ({ ...prev, materialsConsumed: true }));
            onSaved({ ...form, materialsConsumed: true });
            alert(t('knives.consumeSuccess', 'Materials successfully deducted from inventory.'));
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';
    const labelCls = 'block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            🗡️ {initialData ? t('knives.editCard', 'Edit Knife Card') : t('knives.newCard', 'New Knife Card')}
                        </h2>
                        {initialData?.knifeId && (
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{initialData.knifeId}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Stage tracker */}
                {initialData && (
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                        <KnifeStageTracker status={form.status} />
                    </div>
                )}

                {/* Tab nav */}
                <div className="flex gap-1 px-6 pt-4 border-b border-gray-100 overflow-x-auto">
                    {[
                        ['basic', '📋 ' + t('knives.basicInfo', 'Basic Info')],
                        ['specs', '📐 ' + t('knives.specs', 'Specs & Materials')],
                        ['bom', '📦 ' + t('knives.bom', 'Bill of Material')],
                        ['cost', '💰 ' + t('knives.costPrice', 'Cost & Price')]
                    ].map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={clsx(
                                'px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap',
                                tab === key ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'
                            )}
                        >{label}</button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {tab === 'basic' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Model template */}
                            {knifeModels.length > 0 && (
                                <div className="sm:col-span-2">
                                    <label className={labelCls}>{t('knives.fromTemplate', 'From Library Template')}</label>
                                    <select className={inputCls} value={form.knifeModelRef} onChange={e => handleModelSelect(e.target.value)}>
                                        <option value="">{t('knives.startScratch', '— Start from scratch —')}</option>
                                        {knifeModels.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="sm:col-span-2">
                                <label className={labelCls}>{t('knives.nameLabel', 'Knife Name *')}</label>
                                <input className={inputCls} placeholder={t('knives.namePlaceholder', "e.g. Hunter's Companion")} value={form.name} onChange={e => set('name', e.target.value)} />
                            </div>

                            <div>
                                <label className={labelCls}>{t('knives.typeLabel', 'Type')}</label>
                                <select className={inputCls} value={form.type} onChange={e => set('type', e.target.value)}>
                                    {KNIFE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className={labelCls}>{t('knives.statusLabel', 'Status')}</label>
                                <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
                                    {STATUS_LIST.map(s => <option key={s} value={s}>{getStageTranslation(t, s)}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className={labelCls}>{t('knives.makerLabel', 'Responsible Maker')}</label>
                                <select className={inputCls} value={form.maker || ''} onChange={e => set('maker', e.target.value)}>
                                    <option value="">{t('knives.unassigned', '— Unassigned —')}</option>
                                    {workers.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className={labelCls}>{t('knives.startDateLabel', 'Production Start')}</label>
                                <input type="date" className={inputCls} value={form.productionStartDate?.slice(0, 10) || ''} onChange={e => set('productionStartDate', e.target.value)} />
                            </div>

                            <div className="sm:col-span-2">
                                <label className={labelCls}>{t('knives.notesLabel', 'Notes')}</label>
                                <textarea className={inputCls} rows={3} placeholder={t('knives.notesPlaceholder', 'Any special notes, customer requests...')} value={form.notes} onChange={e => set('notes', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {tab === 'specs' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>{t('knives.steelLabel', 'Steel Type')}</label>
                                <select className={inputCls} value={form.steelType} onChange={e => set('steelType', e.target.value)}>
                                    <option value="">{t('knives.selectPrompt', '— Select —')}</option>
                                    {STEEL_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>{t('knives.handleLabel', 'Handle Material')}</label>
                                <select className={inputCls} value={form.handleMaterial} onChange={e => set('handleMaterial', e.target.value)}>
                                    <option value="">{t('knives.selectPrompt', '— Select —')}</option>
                                    {HANDLE_MATERIALS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>{t('knives.guardLabel', 'Guard Material')}</label>
                                <input className={inputCls} placeholder={t('knives.guardPlaceholder', 'Brass, Steel, None...')} value={form.guardMaterial} onChange={e => set('guardMaterial', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('knives.pinsLabel', 'Pins / Rivets')}</label>
                                <input className={inputCls} placeholder={t('knives.pinsPlaceholder', 'e.g. 2x Brass')} value={form.pins} onChange={e => set('pins', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('knives.bladeLengthLabel', 'Blade Length (cm)')}</label>
                                <input type="number" className={inputCls} value={form.bladeLength} onChange={e => set('bladeLength', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('knives.totalLengthLabel', 'Total Length (cm)')}</label>
                                <input type="number" className={inputCls} value={form.totalLength} onChange={e => set('totalLength', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('knives.weightLabel', 'Weight (g)')}</label>
                                <input type="number" className={inputCls} value={form.weight} onChange={e => set('weight', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('knives.hardnessLabel', 'Hardness (HRC)')}</label>
                                <input type="number" className={inputCls} placeholder="e.g. 60" value={form.hardnessHRC} onChange={e => set('hardnessHRC', e.target.value)} />
                            </div>
                            <div className="col-span-2 flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                                <input type="checkbox" id="sheath" checked={form.sheathRequired} onChange={e => set('sheathRequired', e.target.checked)} className="w-4 h-4 rounded" />
                                <label htmlFor="sheath" className="text-sm font-semibold text-amber-800">{t('knives.sheathLabel', 'Leather Sheath Required')}</label>
                                {form.sheathRequired && (
                                    <input className={`${inputCls} flex-1 ms-2`} placeholder={t('knives.sheathMaterialPlaceholder', 'Sheath material...')} value={form.sheathMaterial} onChange={e => set('sheathMaterial', e.target.value)} />
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'bom' && (
                        <div className="flex flex-col gap-4">
                            <p className="text-sm text-gray-500 font-medium">Define the specific workshop materials consumed for this knife model or custom order.</p>
                            <BOMBuilder
                                value={form.bom || []}
                                onChange={v => {
                                    set('bom', v);
                                    // Auto-update material cost based on BOM sum
                                    const sum = v.reduce((acc, item) => acc + (item.estimatedCost || 0), 0);
                                    if (sum > 0) set('materialCost', sum);
                                }}
                            />
                            {form._id && !form.materialsConsumed && form.bom?.length > 0 && (
                                <button
                                    onClick={(e) => { e.preventDefault(); handleConsumeMaterials(); }}
                                    disabled={saving}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl mt-2 self-end transition-colors shadow-sm"
                                >
                                    {t('knives.consumeMaterialsBtn', 'Consume Materials from Stock')}
                                </button>
                            )}
                            {form.materialsConsumed && (
                                <div className="bg-emerald-50 text-emerald-700 font-bold px-4 py-2 rounded-xl mt-2 self-end flex items-center gap-2 border border-emerald-100">
                                    <Check className="w-4 h-4" /> {t('knives.materialsConsumedMsg', 'Materials already deducted')}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'cost' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>{t('knives.materialCost', 'Material Cost (DZ)')}</label>
                                <input type="number" className={inputCls} value={form.materialCost} onChange={e => set('materialCost', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('knives.laborCost', 'Labor Cost (DZ)')}</label>
                                <input type="number" className={inputCls} value={form.laborCost} onChange={e => set('laborCost', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>{t('knives.otherCosts', 'Other Costs (DZ)')}</label>
                                <input type="number" className={inputCls} placeholder={t('knives.otherCostsPlaceholder', 'Packaging, finishing...')} value={form.otherCosts} onChange={e => set('otherCosts', e.target.value)} />
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-col justify-center">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{t('knives.totalCost', 'Total Production Cost')}</p>
                                <p className="text-2xl font-black text-gray-900">{totalCost.toLocaleString()} <span className="text-sm font-medium text-gray-400">DZ</span></p>
                            </div>
                            <div>
                                <label className={labelCls}>{t('knives.suggPrice', 'Suggested Price (DZ)')}</label>
                                <input type="number" className={inputCls} value={form.suggestedPrice} onChange={e => set('suggestedPrice', e.target.value)} />
                            </div>
                            {form.suggestedPrice > 0 && totalCost > 0 && (
                                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex flex-col justify-center">
                                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1">{t('knives.margin', 'Margin')}</p>
                                    <p className="text-2xl font-black text-emerald-700">
                                        {Math.round(((form.suggestedPrice - totalCost) / form.suggestedPrice) * 100)}%
                                    </p>
                                    <p className="text-xs text-emerald-600 mt-1">+{t('knives.profit', { amount: (form.suggestedPrice - totalCost).toLocaleString(), defaultValue: '{{amount}} DZ profit' })}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {error && <p className="px-6 py-2 text-sm text-rose-600 font-medium bg-rose-50 border-t border-rose-100">{error}</p>}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-3xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">{t('knives.cancel', 'Cancel')}</button>
                    <button onClick={handleSubmit} disabled={saving} className="px-6 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 transition-colors shadow-sm disabled:opacity-60">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? t('knives.saving', 'Saving...') : t('knives.save', 'Save Knife')}
                    </button>
                </div>
            </div>
        </div>
    );
}
