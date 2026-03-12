import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Plus, RefreshCw, Edit2, Trash2, BookOpen, ChevronRight, Loader2, X, Save, AlertTriangle, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import BOMBuilder from '../components/BOMBuilder';
import { useTranslation } from 'react-i18next';
import { useHotkey } from '../hooks/useHotkey';

const KNIFE_TYPES = ['Hunter', 'Chef', 'Tactical', 'Utility', 'Damascus', 'Cleaver', 'Fillet', 'Bowie', 'Custom', 'Other'];
const STEEL_TYPES = ['D2', '1095', 'O1', 'AEB-L', 'Damascus', '5160', '52100', 'S30V', 'VG-10', 'Other'];
const HANDLE_MATERIALS = ['Walnut', 'Rosewood', 'Olive Wood', 'G10', 'Micarta', 'Carbon Fiber', 'Bone', 'Horn', 'Stabilized Wood', 'Other'];

const EMPTY = {
    name: '', type: 'Hunter', description: '',
    defaultSteelType: '', defaultHandleMaterial: '', defaultGuardMaterial: '',
    defaultPins: '', sheathRequired: false,
    bladeLengthMin: '', bladeLengthMax: '', typicalWeight: '',
    suggestedPriceMin: '', suggestedPriceMax: '', estimatedProductionCost: '',
    notes: '', bom: []
};

function ModelModal({ isOpen, onClose, onSaved, initial = null }) {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) { setForm(initial ? { ...EMPTY, ...initial } : EMPTY); setError(''); }
    }, [isOpen, initial]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.name.trim()) { setError('Model name required'); return; }
        setSaving(true);
        try {
            const base = import.meta.env.VITE_API_URL || '';
            const url = initial?._id ? `${base}/api/knives/models/${initial._id}` : `${base}/api/knives/models`;
            const method = initial?._id ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            onSaved();
            onClose();
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    };

    if (!isOpen) return null;
    const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200';
    const lbl = 'block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-black text-gray-900">📚 {initial ? t('knives.editModel', 'Edit Knife Model') : t('knives.addModel', 'Add Model')}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="col-span-1 sm:col-span-2">
                            <label className={lbl}>Model Name *</label>
                            <input className={inp} placeholder="e.g. Classic Hunter Knife" value={form.name} onChange={e => set('name', e.target.value)} />
                        </div>
                        <div>
                            <label className={lbl}>Type</label>
                            <select className={inp} value={form.type} onChange={e => set('type', e.target.value)}>
                                {KNIFE_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Default Steel</label>
                            <select className={inp} value={form.defaultSteelType} onChange={e => set('defaultSteelType', e.target.value)}>
                                <option value="">— None —</option>
                                {STEEL_TYPES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Default Handle</label>
                            <select className={inp} value={form.defaultHandleMaterial} onChange={e => set('defaultHandleMaterial', e.target.value)}>
                                <option value="">— None —</option>
                                {HANDLE_MATERIALS.map(h => <option key={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Guard Material</label>
                            <input className={inp} placeholder="Brass, Steel, None..." value={form.defaultGuardMaterial} onChange={e => set('defaultGuardMaterial', e.target.value)} />
                        </div>
                        <div>
                            <label className={lbl}>Blade Min (cm)</label>
                            <input type="number" className={inp} value={form.bladeLengthMin} onChange={e => set('bladeLengthMin', e.target.value)} />
                        </div>
                        <div>
                            <label className={lbl}>Blade Max (cm)</label>
                            <input type="number" className={inp} value={form.bladeLengthMax} onChange={e => set('bladeLengthMax', e.target.value)} />
                        </div>
                        <div>
                            <label className={lbl}>Est. Cost (DZ)</label>
                            <input type="number" className={inp} value={form.estimatedProductionCost} onChange={e => set('estimatedProductionCost', e.target.value)} />
                        </div>
                        <div>
                            <label className={lbl}>Price Min (DZ)</label>
                            <input type="number" className={inp} value={form.suggestedPriceMin} onChange={e => set('suggestedPriceMin', e.target.value)} />
                        </div>
                        <div>
                            <label className={lbl}>Price Max (DZ)</label>
                            <input type="number" className={inp} value={form.suggestedPriceMax} onChange={e => set('suggestedPriceMax', e.target.value)} />
                        </div>
                        <div className="col-span-1 sm:col-span-2 flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <input type="checkbox" id="sheath" checked={form.sheathRequired} onChange={e => set('sheathRequired', e.target.checked)} />
                            <label htmlFor="sheath" className="text-sm font-semibold text-amber-700">Sheath typically required</label>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                            <label className={lbl}>Notes</label>
                            <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-2">{t('knives.defaultBom', 'Default Bill of Materials')}</h3>
                        <p className="text-xs text-gray-500 mb-4">{t('knives.bomDesc', 'Define standard ingredients. These will be copied when creating a new knife from this model.')}</p>
                        <BOMBuilder
                            value={form.bom || []}
                            onChange={v => {
                                set('bom', v);
                                const sum = v.reduce((acc, item) => acc + (item.estimatedCost || 0), 0);
                                if (sum > 0) set('estimatedProductionCost', sum);
                            }}
                        />
                    </div>
                </div>
                {error && <p className="px-6 py-2 text-sm text-rose-600 bg-rose-50 border-t border-rose-100">{error}</p>}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-3xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl">{t('knives.cancel', 'Cancel')}</button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2 disabled:opacity-60">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t('knives.saveModel', 'Save Model')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function KnifeLibrary() {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingModel, setEditingModel] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All');
    const navigate = useNavigate();
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    const filteredModels = models.filter(m => {
        if (filterType !== 'All' && m.type !== filterType) return false;
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            if (!m.name?.toLowerCase().includes(q) && !m.type?.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const fetchModels = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/models`, { headers: { Authorization: `Bearer ${token}` } });
            const json = await res.json();
            setModels(json.data ?? (Array.isArray(json) ? json : []));
        } catch (e) { console.error(e); setFetchError('Failed to load knife models.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchModels(); }, []);

    const handleDelete = (id) => {
        setConfirmDialog({
            onConfirm: async () => {
                await fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/models/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                fetchModels();
            }
        });
    };

    // Navigate to Knife Dashboard with this model pre-selected
    const handleCreateFromModel = (modelId) => {
        navigate(`/knives?model=${modelId}`);
    };

    const TYPE_COLORS = {
        Hunter: 'bg-amber-100 text-amber-700',
        Chef: 'bg-blue-100 text-blue-700',
        Tactical: 'bg-gray-100 text-gray-700',
        Damascus: 'bg-purple-100 text-purple-700',
        default: 'bg-slate-100 text-slate-600'
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={t('knives.libraryTitle', 'Knife Architecture Library')}
                subtitle={t('knives.libraryDesc', 'Design and manage reusable patterns for high-precision bladesmithing.')}
                variant="production"
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setEditingModel(null); setModalOpen(true); }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#5D5DFF] hover:bg-[#4D4DFF] text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 leading-none"
                        >
                            <Plus className="w-5 h-5" /> {t('knives.addModel', 'New Template')}
                        </button>
                        <button onClick={fetchModels} className="p-2.5 rounded-xl bg-white border border-indigo-200 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm active:scale-95">
                            <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin")} />
                        </button>
                    </div>
                }
            />

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600">✕</button>
                </div>
            )}

            {/* Filter Bar */}
            {!loading && models.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Search className="w-4 h-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder={t('knives.searchModels', 'Search models... (Press /)')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full ps-9 pe-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all font-bold"
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {['All', ...KNIFE_TYPES].map(type => {
                            const count = type === 'All' ? models.length : models.filter(m => m.type === type).length;
                            if (type !== 'All' && count === 0) return null;
                            return (
                                <button key={type} onClick={() => setFilterType(type)}
                                    className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                                        filterType === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                    )}>
                                    {type === 'All' ? t('knives.allTypes', 'All') : type}
                                    <span className={clsx('text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none',
                                        filterType === type ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                    )}>{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-indigo-600 animate-spin" /></div>
            ) : models.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 py-20 text-center">
                    <span className="text-5xl block mb-4">📚</span>
                    <p className="text-gray-500 font-medium">{t('knives.emptyLibrary', 'No knife models yet. Add your first template!')}</p>
                    <button onClick={() => setModalOpen(true)} className="mt-4 px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl">{t('knives.addModel', 'Add Model')}</button>
                </div>
            ) : filteredModels.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 py-16 text-center">
                    <Search className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium text-sm">{t('knives.noModelMatch', 'No models match your search or filter.')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredModels.map(model => (
                        <div key={model._id} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col">
                            <div className="p-5 flex-1">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-black text-gray-900 text-base mb-1">{model.name}</h3>
                                        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', TYPE_COLORS[model.type] || TYPE_COLORS.default)}>
                                            {model.type}
                                        </span>
                                    </div>
                                    <BookOpen className="w-5 h-5 text-indigo-300" />
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold mt-4">
                                    {model.defaultSteelType && <div className="bg-slate-50 rounded-lg p-2"><span className="text-gray-400">Steel</span><br /><span className="text-gray-800">{model.defaultSteelType}</span></div>}
                                    {model.defaultHandleMaterial && <div className="bg-amber-50 rounded-lg p-2"><span className="text-amber-500">Handle</span><br /><span className="text-gray-800">{model.defaultHandleMaterial}</span></div>}
                                    {(model.bladeLengthMin || model.bladeLengthMax) && <div className="bg-blue-50 rounded-lg p-2"><span className="text-blue-400">Blade</span><br /><span className="text-gray-800">{model.bladeLengthMin}–{model.bladeLengthMax} cm</span></div>}
                                    {model.estimatedProductionCost > 0 && <div className="bg-gray-50 rounded-lg p-2"><span className="text-gray-400">Est. Cost</span><br /><span className="text-gray-800">{model.estimatedProductionCost.toLocaleString()} DZ</span></div>}
                                </div>

                                {(model.suggestedPriceMin > 0 || model.suggestedPriceMax > 0) && (
                                    <div className="mt-3 bg-emerald-50 rounded-xl p-3 flex justify-between items-center border border-emerald-100">
                                        <span className="text-xs font-bold text-emerald-600">Price Range</span>
                                        <span className="text-sm font-black text-emerald-800">{model.suggestedPriceMin?.toLocaleString()} – {model.suggestedPriceMax?.toLocaleString()} DZ</span>
                                    </div>
                                )}

                                {model.sheathRequired && (
                                    <span className="mt-2 inline-block text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">🪢 {t('knives.sheathIncluded', 'Sheath included')}</span>
                                )}
                            </div>

                            <div className="flex border-t border-gray-100">
                                <button
                                    onClick={() => handleCreateFromModel(model._id)}
                                    className="flex-1 py-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    🗡️ {t('knives.createFromThis', 'Create Knife from This')} <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => { setEditingModel(model); setModalOpen(true); }}
                                    className="px-3 text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors border-s border-gray-100">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(model._id)}
                                    className="px-3 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors border-s border-gray-100">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ModelModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSaved={fetchModels}
                initial={editingModel}
            />

            {confirmDialog && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <h3 className="text-base font-black text-gray-900 mb-2">Delete knife model?</h3>
                        <p className="text-sm text-gray-500 mb-6">This model and its BOM will be permanently removed.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                            <button onClick={() => { setConfirmDialog(null); confirmDialog.onConfirm(); }} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
