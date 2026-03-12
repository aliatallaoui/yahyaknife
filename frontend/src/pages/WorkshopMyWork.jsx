import { useState, useEffect, useContext, useRef } from 'react';
import { useHotkey } from '../hooks/useHotkey';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronRight, Loader2, RefreshCw, Hammer, PackageCheck, AlertTriangle, X, Search } from 'lucide-react';
import { getStageTranslation } from './KnifeDashboard';

const STAGES = ['Design', 'In Production', 'Heat Treatment', 'Grinding', 'Handle Installation', 'Finishing', 'Sharpening', 'Completed'];

const STAGE_COLORS = {
    'Design':                'bg-slate-100 text-slate-700',
    'In Production':         'bg-amber-100 text-amber-800',
    'Heat Treatment':        'bg-orange-100 text-orange-800',
    'Grinding':              'bg-yellow-100 text-yellow-800',
    'Handle Installation':   'bg-lime-100 text-lime-800',
    'Finishing':             'bg-teal-100 text-teal-800',
    'Sharpening':            'bg-indigo-100 text-indigo-800',
    'Completed':             'bg-emerald-100 text-emerald-800',
};

export default function WorkshopMyWork() {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const [knives, setKnives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [advancing, setAdvancing] = useState(null); // knifeId being advanced
    const [errorMsg, setErrorMsg] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState('All');
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    const fetchKnives = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/cards?limit=100`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            const data = Array.isArray(json) ? json : (json.data ?? []);
            setKnives(data.filter(k => k.status !== 'Sold'));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchKnives(); }, []);

    const advanceStage = async (knife) => {
        const currentIdx = STAGES.indexOf(knife.status);
        if (currentIdx === -1 || currentIdx >= STAGES.length - 1) return;
        const nextStage = STAGES[currentIdx + 1];

        setAdvancing(knife._id);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/cards/${knife._id}/advance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({})
            });
            if (!res.ok) throw new Error('Failed');
            // Optimistic local update
            setKnives(prev => prev.map(k => k._id === knife._id ? { ...k, status: nextStage } : k));
        } catch (e) {
            console.error(e);
            fetchKnives(); // revert optimistic update
            setErrorMsg(t('workshop.mywork.advanceError', 'Failed to advance stage. Please try again.'));
            setTimeout(() => setErrorMsg(null), 4000);
        } finally {
            setAdvancing(null);
        }
    };

    const filterFn = k => {
        if (stageFilter !== 'All' && k.status !== stageFilter) return false;
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            return k.name?.toLowerCase().includes(q) || k.knifeId?.toLowerCase().includes(q);
        }
        return true;
    };
    const active = knives.filter(k => k.status !== 'Completed' && filterFn(k));
    const done   = knives.filter(k => k.status === 'Completed' && filterFn(k));

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">
                        {t('workshop.mywork.title', 'Workshop Floor')}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {t('workshop.mywork.subtitle', 'Active blades · tap to advance stage')}
                    </p>
                </div>
                <button
                    onClick={fetchKnives}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Search + Stage Filter */}
            {knives.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={t('workshop.mywork.search', 'Search by name or ID... (Press /)')}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-amber-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium shadow-sm"
                        />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {['All', ...STAGES.filter(s => s !== 'Completed')].map(s => (
                            <button
                                key={s}
                                onClick={() => setStageFilter(s)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${stageFilter === s ? 'bg-amber-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                {s === 'All' ? t('common.all', 'All') : getStageTranslation(t, s)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Active blades */}
            {active.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <PackageCheck className="w-12 h-12 text-emerald-300 mb-3" />
                    <p className="font-bold text-gray-500 text-lg">
                        {t('workshop.mywork.allDone', 'All blades completed!')}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                        {t('workshop.mywork.allDoneHint', 'No active production orders right now.')}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {active.map(knife => {
                        const currentIdx = STAGES.indexOf(knife.status);
                        const nextStage = currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null;
                        const isLast = !nextStage;
                        const isAdvancing = advancing === knife._id;

                        return (
                            <div key={knife._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                                {/* Knife icon */}
                                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                    <Hammer className="w-6 h-6 text-amber-500" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-gray-900 text-base truncate">{knife.name}</p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STAGE_COLORS[knife.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                            {getStageTranslation(t, knife.status)}
                                        </span>
                                        {knife.knifeId && (
                                            <span className="text-[11px] font-mono text-gray-400">{knife.knifeId}</span>
                                        )}
                                        {knife.maker?.name && (
                                            <span className="text-[11px] text-gray-400">{knife.maker.name}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Advance button */}
                                {!isLast && (
                                    <button
                                        onClick={() => advanceStage(knife)}
                                        disabled={isAdvancing}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors shadow-sm shadow-amber-200 shrink-0 active:scale-95"
                                    >
                                        {isAdvancing
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <ChevronRight className="w-4 h-4" />
                                        }
                                        <span className="hidden sm:inline">
                                            {getStageTranslation(t, nextStage)}
                                        </span>
                                        <span className="sm:hidden">Next</span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {errorMsg && (
                <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold px-4 py-3 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="opacity-60 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Completed section */}
            {done.length > 0 && (
                <div>
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        {t('workshop.mywork.completed', 'Completed')} ({done.length})
                    </h2>
                    <div className="space-y-2">
                        {done.map(knife => (
                            <div key={knife._id} className="bg-emerald-50/50 rounded-xl border border-emerald-100 px-4 py-3 flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-700 truncate">{knife.name}</p>
                                    {knife.knifeId && <p className="text-[11px] font-mono text-gray-400">{knife.knifeId}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
