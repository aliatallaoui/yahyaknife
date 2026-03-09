import { useState, useEffect } from 'react';
import { Plus, Search, RefreshCw, Filter, ChevronRight, Swords, Flame, CheckCircle2, ShoppingBag, Edit2, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';
import KnifeCardModal from '../components/KnifeCardModal';
import KnifeStageTracker from '../components/KnifeStageTracker';
import { useTranslation } from 'react-i18next';

// Helper for stage translations
export const getStageTranslation = (t, stage) => {
    switch (stage) {
        case 'Design': return t('knives.stages.design', 'Design');
        case 'In Production': return t('knives.stages.inProduction', 'In Production');
        case 'Heat Treatment': return t('knives.stages.heatTreatment', 'Heat Treatment');
        case 'Grinding': return t('knives.stages.grinding', 'Grinding');
        case 'Handle Installation': return t('knives.stages.handleInstallation', 'Handle Install');
        case 'Finishing': return t('knives.stages.finishing', 'Finishing');
        case 'Sharpening': return t('knives.stages.sharpening', 'Sharpening');
        case 'Completed': return t('knives.stages.completed', 'Completed');
        case 'Sold': return t('knives.stages.sold', 'Sold');
        default: return stage;
    }
};

const STATUS_CONFIG = {
    'Design': { color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400', label: 'Design' },
    'In Production': { color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', label: 'In Production' },
    'Heat Treatment': { color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500', label: 'Heat Treatment' },
    'Grinding': { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500', label: 'Grinding' },
    'Handle Installation': { color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Handle Install' },
    'Finishing': { color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', label: 'Finishing' },
    'Sharpening': { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', label: 'Sharpening' },
    'Completed': { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Completed' },
    'Sold': { color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-400', label: 'Sold' },
};

const FILTER_OPTIONS = ['All', 'Design', 'In Production', 'Heat Treatment', 'Grinding', 'Handle Installation', 'Finishing', 'Sharpening', 'Completed', 'Sold'];

function KnifeCard({ knife, onEdit, onDelete, onAdvance }) {
    const { t } = useTranslation();
    const cfg = STATUS_CONFIG[knife.status] || STATUS_CONFIG['Design'];
    const translatedLabel = getStageTranslation(t, knife.status);
    const daysSinceStart = knife.productionStartDate
        ? Math.floor((Date.now() - new Date(knife.productionStartDate)) / 86400000)
        : null;

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
            {/* Status bar */}
            <div className={clsx('h-1.5 w-full', cfg.dot)} />

            <div className="p-5 flex flex-col gap-3 flex-1">
                {/* Header row */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-mono font-bold text-gray-400">{knife.knifeId}</span>
                            {daysSinceStart > 7 && knife.status !== 'Completed' && knife.status !== 'Sold' && (
                                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100">⚠ {daysSinceStart}{t('knives.daySuffix', 'd')}</span>
                            )}
                        </div>
                        <h3 className="font-black text-gray-900 text-base leading-tight">{knife.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{knife.type}{knife.steelType ? ` · ${knife.steelType}` : ''}</p>
                    </div>
                    <span className={clsx('text-[10px] font-bold px-2.5 py-1 rounded-full border', cfg.color)}>
                        <span className={clsx('inline-block w-1.5 h-1.5 rounded-full me-1', cfg.dot)} />{translatedLabel}
                    </span>
                </div>

                {/* Materials row */}
                <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
                    {knife.steelType && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">🔩 {knife.steelType}</span>}
                    {knife.handleMaterial && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">🪵 {knife.handleMaterial}</span>}
                    {knife.sheathRequired && <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">🪢 {t('knives.sheathIncluded', 'Sheath')}</span>}
                </div>

                {/* Stage tracker */}
                <KnifeStageTracker status={knife.status} compact />

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    {knife.bladeLength && (
                        <div className="bg-gray-50 rounded-xl p-2">
                            <p className="text-xs font-black text-gray-900">{knife.bladeLength}cm</p>
                            <p className="text-[10px] text-gray-400">{t('knives.blade', 'blade')}</p>
                        </div>
                    )}
                    {knife.totalProductionCost > 0 && (
                        <div className="bg-gray-50 rounded-xl p-2">
                            <p className="text-xs font-black text-gray-900">{knife.totalProductionCost.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400">{t('knives.costDz', 'cost DZ')}</p>
                        </div>
                    )}
                    {knife.suggestedPrice > 0 && (
                        <div className="bg-emerald-50 rounded-xl p-2">
                            <p className="text-xs font-black text-emerald-800">{knife.suggestedPrice.toLocaleString()}</p>
                            <p className="text-[10px] text-emerald-500">{t('knives.priceDz', 'price DZ')}</p>
                        </div>
                    )}
                </div>

                {/* Maker */}
                {knife.maker && (
                    <p className="text-[11px] text-gray-400 font-medium">👤 {knife.maker.name}</p>
                )}
            </div>

            {/* Action row */}
            <div className="flex border-t border-gray-100">
                <button onClick={() => onEdit(knife)} className="flex-1 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center justify-center gap-1">
                    <Edit2 className="w-3.5 h-3.5" /> {t('knives.edit', 'Edit')}
                </button>
                {!['Completed', 'Sold'].includes(knife.status) && (
                    <button onClick={() => onAdvance(knife._id)} className="flex-1 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1 border-s border-gray-100">
                        <ChevronRight className="w-3.5 h-3.5" /> {t('knives.advanceStage', 'Advance Stage')}
                    </button>
                )}
                <button onClick={() => onDelete(knife._id)} className="px-3 py-2.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors border-s border-gray-100">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

export default function KnifeDashboard() {
    const { t } = useTranslation();
    const [knives, setKnives] = useState([]);
    const [knifeModels, setKnifeModels] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingKnife, setEditingKnife] = useState(null);
    const [stats, setStats] = useState(null);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [knivesRes, modelsRes, workersRes, statsRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/cards`),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/models`),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/employees`),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/cards/stats`),
            ]);
            setKnives(await knivesRes.json());
            setKnifeModels(await modelsRes.json());
            const w = await workersRes.json();
            setWorkers(Array.isArray(w) ? w : []);
            setStats(await statsRes.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleEdit = (knife) => { setEditingKnife(knife); setModalOpen(true); };
    const handleNew = () => { setEditingKnife(null); setModalOpen(true); };
    const handleSaved = () => fetchAll();

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this knife card?')) return;
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/cards/${id}`, { method: 'DELETE' });
        fetchAll();
    };

    const handleAdvance = async (id) => {
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/cards/${id}/advance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        fetchAll();
    };

    const filtered = knives.filter(k => {
        const matchStatus = filterStatus === 'All' || k.status === filterStatus;
        const matchSearch = !search || k.name?.toLowerCase().includes(search.toLowerCase()) || k.knifeId?.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
    });

    const inProgress = knives.filter(k => !['Design', 'Completed', 'Sold'].includes(k.status)).length;
    const completed = knives.filter(k => k.status === 'Completed').length;
    const sold = knives.filter(k => k.status === 'Sold').length;

    return (
        <div className="flex flex-col gap-6">
            {/* Page header */}
            <PageHeader
                title={t('knives.workshop', 'Knife Workshop')}
                subtitle={t('knives.overviewDesc', 'Track every knife from design to sale')}
                actions={
                    <button
                        onClick={handleNew}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[#5D5DFF] hover:bg-[#4D4DFF] text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 leading-none"
                    >
                        <Plus className="w-5 h-5" /> {t('knives.newCard', 'New Knife Card')}
                    </button>
                }
            />

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: t('knives.totalKnives', 'Total Knives'), value: knives.length, icon: '🗡️', color: 'bg-slate-50 border-slate-100' },
                    { label: t('knives.inProgress', 'In Progress'), value: inProgress, icon: '🔨', color: 'bg-blue-50 border-blue-100' },
                    { label: t('knives.completed', 'Completed'), value: completed, icon: '✅', color: 'bg-emerald-50 border-emerald-100' },
                    { label: t('knives.sold', 'Sold'), value: sold, icon: '💰', color: 'bg-amber-50 border-amber-100' },
                ].map(s => (
                    <div key={s.label} className={clsx('rounded-2xl border p-4 flex items-center gap-3', s.color)}>
                        <span className="text-2xl">{s.icon}</span>
                        <div>
                            <p className="text-xl font-black text-gray-900">{s.value}</p>
                            <p className="text-xs font-semibold text-gray-500">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-2 w-full sm:w-auto sm:max-w-xs">
                    <div className="relative flex-1">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            className="w-full ps-9 pe-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder={t('knives.searchBy', 'Search by name or ID...')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={fetchAll} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400 shrink-0">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 flex-1">
                    {FILTER_OPTIONS.map(opt => (
                        <button
                            key={opt}
                            onClick={() => setFilterStatus(opt)}
                            className={clsx(
                                'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                                filterStatus === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                            )}
                        >
                            {opt === 'All' ? t('knives.all', 'All') : getStageTranslation(t, opt)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Cards grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 py-20 text-center">
                    <span className="text-5xl mb-4 block">🗡️</span>
                    <p className="text-gray-500 font-medium">{t('knives.emptyTitle', 'No knives yet. Create your first Knife Card!')}</p>
                    <button onClick={handleNew} className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl">
                        {t('knives.newCard', 'New Knife Card')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filtered.map(knife => (
                        <KnifeCard
                            key={knife._id}
                            knife={knife}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onAdvance={handleAdvance}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            <KnifeCardModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSaved={handleSaved}
                initialData={editingKnife}
                knifeModels={knifeModels}
                workers={workers}
            />
        </div>
    );
}
