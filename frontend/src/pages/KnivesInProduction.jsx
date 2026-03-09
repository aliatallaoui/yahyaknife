import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Clock, Search, GripVertical, User } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';
import KnifeCardModal from '../components/KnifeCardModal';
import { getStageTranslation } from './KnifeDashboard';

const COLUMNS = ['Design', 'In Production', 'Heat Treatment', 'Grinding', 'Handle Installation', 'Finishing', 'Sharpening', 'Completed'];

export default function KnivesInProduction() {
    const { t } = useTranslation();
    const [knives, setKnives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingKnife, setEditingKnife] = useState(null);

    const fetchKnives = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/cards`);
            const data = await res.json();
            // We only want knives currently in the workshop, not Sold.
            setKnives(data.filter(k => k.status !== 'Sold'));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchKnives(); }, []);

    const updateKnifeStatus = async (knifeId, newStatus) => {
        try {
            // Optimistic update
            setKnives(prev => prev.map(k => k._id === knifeId ? { ...k, status: newStatus } : k));

            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/knives/cards/${knifeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error('Failed to update status');
            // Re-fetch to ensure sync
            fetchKnives();
        } catch (e) {
            console.error(e);
            fetchKnives(); // revert
        }
    };

    const handleDragStart = (e, knifeId) => {
        e.dataTransfer.setData('knifeId', knifeId);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // allow drop
    };

    const handleDrop = async (e, targetStatus) => {
        e.preventDefault();
        const knifeId = e.dataTransfer.getData('knifeId');
        if (knifeId) {
            const knife = knives.find(k => k._id === knifeId);
            if (knife && knife.status !== targetStatus) {
                updateKnifeStatus(knifeId, targetStatus);
            }
        }
    };

    const filteredKnives = knives.filter(k =>
        k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.knifeId && k.knifeId.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading && knives.length === 0) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
    }

    return (
        <div className="flex flex-col h-full gap-4">
            <PageHeader
                title={t('knives.productionTitle', 'Production Floor')}
                subtitle={t('knives.productionDesc', 'Monitor and manage knife lifecycles across the bladesmithing workshop.')}
                variant="production"
                actions={
                    <div className="flex flex-wrap gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder={t('knives.searchDb', 'Search blades...')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#5D5DFF] focus:bg-white/10 transition-all w-48 sm:w-64"
                            />
                        </div>
                        <button
                            onClick={() => { setEditingKnife(null); setIsModalOpen(true); }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#5D5DFF] hover:bg-[#4D4DFF] text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 leading-none"
                        >
                            <Plus className="w-5 h-5" /> {t('knives.addKnife', 'New Blade')}
                        </button>
                    </div>
                }
            />

            <div className="flex-1 overflow-x-auto overflow-y-hidden rounded-2xl bg-gray-50/50 p-2">
                <div className="flex h-full gap-4 items-start w-max pb-4">
                    {COLUMNS.map(column => {
                        const colKnives = filteredKnives.filter(k => k.status === column);
                        return (
                            <div
                                key={column}
                                className="w-72 sm:w-80 flex flex-col h-full max-h-[calc(100vh-16rem)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden shrink-0 transition-colors"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, column)}
                            >
                                {/* Column Header */}
                                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center group">
                                    <h3 className="font-bold text-gray-700">{getStageTranslation(t, column)}</h3>
                                    <span className={clsx(
                                        "px-2.5 py-1 text-xs font-black rounded-lg transition-colors",
                                        colKnives.length > 0 ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-500"
                                    )}>
                                        {colKnives.length}
                                    </span>
                                </div>

                                {/* Column Body */}
                                <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3 min-h-[150px]">
                                    {colKnives.map(knife => (
                                        <div
                                            key={knife._id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, knife._id)}
                                            onClick={() => { setEditingKnife(knife); setIsModalOpen(true); }}
                                            className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-300 cursor-grab active:cursor-grabbing transition-all group"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md w-fit mb-1 border border-indigo-100">
                                                        {knife.knifeId}
                                                    </span>
                                                    <h4 className="font-black text-gray-900 leading-tight">
                                                        {knife.name}
                                                    </h4>
                                                </div>
                                                <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>

                                            <p className="text-xs text-gray-500 font-medium mb-3">
                                                {knife.type} • {knife.steelType || t('knives.unknownSteel', '? Steel')}
                                            </p>

                                            <div className="flex items-center justify-between text-[11px] border-t border-gray-100 pt-3">
                                                <div className="flex items-center gap-1.5 text-gray-500">
                                                    {knife.maker ? (
                                                        <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-md font-bold flex items-center gap-1">
                                                            <User className="w-3 h-3" /> {knife.maker.name.split(' ')[0]}
                                                        </span>
                                                    ) : (
                                                        <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-md font-bold">Unassigned</span>
                                                    )}
                                                </div>
                                                <div className="font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                                                    {knife.suggestedPrice > 0 ? `${knife.suggestedPrice.toLocaleString()} DZ` : '-'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {colKnives.length === 0 && (
                                        <div className="h-full flex items-center justify-center p-6 text-center text-sm font-medium text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                            {t('knives.dropHere', 'Drop here')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <KnifeCardModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={editingKnife}
                onSaved={() => {
                    fetchKnives();
                }}
            />
        </div>
    );
}
