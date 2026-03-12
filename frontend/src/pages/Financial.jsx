import { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { useHotkey } from '../hooks/useHotkey';
import { DollarSign, TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight, Edit2, Trash2, Plus, Truck, Package, CheckCircle2, Search, Wallet, AlertTriangle, RefreshCw, LayoutDashboard, BookOpen } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
    LineChart, Line
} from 'recharts';
import clsx from 'clsx';
import moment from 'moment';
import { TransactionContext } from '../context/TransactionContext';
import { AuthContext } from '../context/AuthContext';
import TransactionModal from '../components/TransactionModal';
import { useTranslation } from 'react-i18next';

// Compute ISO date range from a period key
function periodToRange(period) {
    const now = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    if (period === 'thisMonth') {
        return { startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: fmt(now) };
    }
    if (period === 'lastMonth') {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last  = new Date(now.getFullYear(), now.getMonth(), 0);
        return { startDate: fmt(first), endDate: fmt(last) };
    }
    if (period === '3m') {
        const from = new Date(now); from.setMonth(from.getMonth() - 3);
        return { startDate: fmt(from), endDate: fmt(now) };
    }
    if (period === 'ytd') {
        return { startDate: `${now.getFullYear()}-01-01`, endDate: fmt(now) };
    }
    return {}; // 'all' — no date filter
}

export default function Financial() {
    const { transactions, loading: txLoading, addTransaction, updateTransaction, deleteTransaction, fetchTransactions } = useContext(TransactionContext);
    const { hasPermission, token } = useContext(AuthContext);
    const { t } = useTranslation();
    const [overview, setOverview] = useState(null);
    const [loadingOverview, setLoadingOverview] = useState(true);
    const [overviewError, setOverviewError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [editingTx, setEditingTx] = useState(null);

    // Period selector for KPI overview
    const [period, setPeriod] = useState('thisMonth');

    // In-app confirm dialog — replaces window.confirm
    const [confirmDialog, setConfirmDialog] = useState(null);

    // Tab navigation
    const [activeTab, setActiveTab] = useState('overview');

    // Multi-select & filters
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [filterType, setFilterType] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); setCurrentPage(1); searchRef.current?.blur(); } });
    const [batchDeleting, setBatchDeleting] = useState(false);

    // Deriving manual expenses and revenues from the unified context
    const expenses = transactions.filter(t => t.type === 'expense');
    const revenues = transactions.filter(t => t.type === 'revenue');

    // Get unique categories for filter dropdown
    const allCategories = [...new Set(transactions.map(t => t.category).filter(Boolean))].sort();

    // Filtered transactions
    const filteredTransactions = transactions.filter(tx => {
        if (filterType !== 'all' && tx.type !== filterType) return false;
        if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            if (!(tx.description?.toLowerCase().includes(s) || tx.category?.toLowerCase().includes(s) || String(tx.amount).includes(s))) return false;
        }
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / perPage));
    const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * perPage, currentPage * perPage);

    // Selection helpers
    const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleSelectAll = () => {
        const pageIds = paginatedTransactions.map(t => t._id);
        const allSelected = pageIds.every(id => selectedIds.has(id));
        setSelectedIds(prev => {
            const n = new Set(prev);
            pageIds.forEach(id => allSelected ? n.delete(id) : n.add(id));
            return n;
        });
    };
    const isAllSelected = paginatedTransactions.length > 0 && paginatedTransactions.every(t => selectedIds.has(t._id));

    const handleBatchDelete = () => {
        if (selectedIds.size === 0) return;
        setConfirmDialog({
            title: `Delete ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}?`,
            body: 'This will permanently remove the selected entries from the ledger.',
            danger: true,
            onConfirm: async () => {
                setBatchDeleting(true);
                for (const id of selectedIds) {
                    try { await deleteTransaction(id); } catch (e) { console.error('Failed to delete', id, e); }
                }
                setSelectedIds(new Set());
                setBatchDeleting(false);
            },
        });
    };

    const handleSingleDelete = (id) => {
        setConfirmDialog({
            title: 'Delete this transaction?',
            body: 'This entry will be permanently removed from the manual ledger.',
            danger: true,
            onConfirm: () => deleteTransaction(id),
        });
    };

    // Inline save helper — backend needs type + full fields to route to correct collection
    const handleInlineSave = async (tx) => {
        if (!editingTx || editingTx.id !== tx._id) return;
        const payload = {
            type: tx.type,
            amount: tx.amount,
            date: tx.date,
            description: tx.description,
            category: tx.category,
            [editingTx.field]: editingTx.value,  // override changed field
        };
        await updateTransaction(tx._id, payload);
        setEditingTx(null);
    };

    const startEdit = (tx, field) => setEditingTx({ id: tx._id, field, value: tx[field] ?? '' });

    // Used by the type dropdown onBlur (value comes from select, not editingTx state)
    const saveTypeChange = async (tx, newType) => {
        await updateTransaction(tx._id, {
            type: newType,
            amount: tx.amount,
            date: tx.date,
            description: tx.description,
            category: tx.category,
        });
        setEditingTx(null);
    };

    const fetchOverview = useCallback(async () => {
        setLoadingOverview(true);
        setOverviewError(null);
        try {
            const params = new URLSearchParams(periodToRange(period));
            const finRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/finance/overview?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (finRes.ok) { const json = await finRes.json(); setOverview(json.data ?? json); }
            else { const j = await finRes.json().catch(() => ({})); setOverviewError(j.error || 'Failed to load financial overview.'); }
        } catch (error) {
            setOverviewError('Failed to load financial overview.');
        } finally {
            setLoadingOverview(false);
        }
    }, [token, period]);

    // Re-fetch when period changes or after a transaction is mutated (tracked via length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchOverview(); }, [period, transactions.length]);

    // Listen for payroll-synced event from TransactionModal
    useEffect(() => {
        const handler = () => fetchTransactions();
        window.addEventListener('payroll-synced', handler);
        return () => window.removeEventListener('payroll-synced', handler);
    }, [fetchTransactions]);

    const handleOpenModal = (transaction = null) => {
        setSelectedTransaction(transaction);
        setIsModalOpen(true);
    };

    const handleFormSubmit = async (data) => {
        if (selectedTransaction) {
            await updateTransaction(selectedTransaction._id, data);
        } else {
            await addTransaction(data);
        }
    };

    if (loadingOverview || txLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-emerald-600 animate-spin"></div>
            </div>
        );
    }

    // Dynamic KPIs from the backend
    const pipeline = overview?.pipeline || { expectedRevenue: 0, transitRevenue: 0, deliveredRevenue: 0, settledRevenue: 0 };
    const {
        cogs = 0, operatingExpenses = 0, manualRevenue = 0, manualExpenses = 0,
        totalRecognizedRevenue = 0, totalExpenses = 0, netProfit = 0, profitMargin = 0
    } = overview || {};

    const pipelineData = [
        { name: t('finance.expected', 'Expected'), value: pipeline.expectedRevenue, fill: '#6366f1' },
        { name: t('finance.transit', 'In Transit'), value: pipeline.transitRevenue, fill: '#f59e0b' },
        { name: t('finance.delivered', 'Delivered'), value: pipeline.deliveredRevenue, fill: '#14b8a6' },
        { name: t('finance.settled', 'Settled'), value: pipeline.settledRevenue, fill: '#22c55e' }
    ];

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <PageHeader
                title={t('finance.title', 'Financial Hub')}
                subtitle={t('finance.subtitle', 'Real-time COD revenue tracking and global P&L')}
                variant="finance"
                actions={
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Period selector */}
                        <div className="flex bg-white/10 backdrop-blur-sm border border-white/20 p-0.5 rounded-xl">
                            {[
                                { key: 'thisMonth', label: 'This Month' },
                                { key: 'lastMonth', label: 'Last Month' },
                                { key: '3m',        label: '3 Months' },
                                { key: 'ytd',       label: 'YTD' },
                                { key: 'all',       label: 'All Time' },
                            ].map(p => (
                                <button
                                    key={p.key}
                                    onClick={() => setPeriod(p.key)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-white/70 hover:text-white'}`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={fetchOverview} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/20" title="Refresh">
                            <RefreshCw className={`w-4 h-4 ${loadingOverview ? 'animate-spin' : ''}`} />
                        </button>
                        {hasPermission('financial.manage_manual_transactions') && (
                            <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-700 font-bold rounded-xl transition-all shadow-lg active:scale-95 leading-none text-sm">
                                <Plus className="w-4 h-4" /> {t('finance.addManual', 'Add')}
                            </button>
                        )}
                    </div>
                }
            />

            {overviewError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{overviewError}</span>
                    <button onClick={() => setOverviewError(null)} className="text-red-400 hover:text-red-600">✕</button>
                </div>
            )}

            {/* Tab Bar */}
            <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl w-fit">
                {[
                    { key: 'overview',     label: t('finance.tab.overview', 'Overview'),     icon: LayoutDashboard },
                    { key: 'settlements',  label: t('finance.tab.settlements', 'Settlements'), icon: Truck,
                      badge: overview?.totalPendingSettlements > 0 ? overview.totalPendingSettlements.toLocaleString() : null },
                    { key: 'ledger',       label: t('finance.tab.ledger', 'Ledger'),          icon: BookOpen,
                      badge: transactions.length > 0 ? transactions.length : null },
                ].map(({ key, label, icon: Icon, badge }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                            activeTab === key
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        )}
                    >
                        <Icon className="w-4 h-4 shrink-0" />
                        {label}
                        {badge && (
                            <span className={clsx(
                                'text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none',
                                key === 'settlements' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
                            )}>{badge}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Profitability Overview */}
            {activeTab === 'overview' && <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm col-span-1 md:col-span-2 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">{t('finance.trueNetProfit', 'True Net Profit')}</p>
                        <h3 className={clsx("text-4xl font-black tracking-tighter", netProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {netProfit.toLocaleString()} {t('common.currency', 'DZ')}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1 font-medium">{t('finance.netProfitSub', 'Revenue (Delivered+Settled) - COGS - Expenses')}</p>
                    </div>
                    <div className="h-16 w-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                        <DollarSign className="w-8 h-8 text-emerald-600" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{t('finance.profitMargin', 'Profit Margin')}</p>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-2 truncate">{profitMargin}%</h3>
                        <div className="w-full">
                            <ProgressBar progress={Math.max(0, Math.min(100, profitMargin))} color="bg-emerald-500" />
                        </div>
                    </div>
                    <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shrink-0">
                        <Activity className="w-8 h-8 text-blue-600" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{t('finance.recognizedRevenue', 'Recognized Revenue')}</p>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tighter truncate">
                            {totalRecognizedRevenue.toLocaleString()} <span className="text-sm font-medium text-gray-400">{t('common.currency', 'DZ')}</span>
                        </h3>
                        <div className="flex items-center gap-1 mt-2 text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit truncate">
                            <ArrowUpRight className="w-3 h-3 shrink-0" /> <span className="truncate">{t('finance.includesSettled', 'Includes COD Settled')}</span>
                        </div>
                    </div>
                    <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 shrink-0">
                        <Wallet className="w-8 h-8 text-indigo-600" />
                    </div>
                </div>
            </div>

            {/* Cash Flow Pipelines */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Visual Pipeline */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" /> {t('finance.pipelineTitle', 'COD Cash Pipeline')}
                    </h3>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                        <PipelineNode label={t('finance.expected', 'Expected (Queued)')} value={pipeline.expectedRevenue} color="text-indigo-600" bg="bg-indigo-50" icon={Package} />
                        <PipelineNode label={t('finance.transit', 'Cash in Transit')} value={pipeline.transitRevenue} color="text-amber-600" bg="bg-amber-50" icon={Truck} />
                        <PipelineNode label={t('finance.delivered', 'Cash Delivered')} value={pipeline.deliveredRevenue} color="text-teal-600" bg="bg-teal-50" icon={TrendingUp} />
                        <PipelineNode label={t('finance.settled', 'Cash Settled')} value={pipeline.settledRevenue} color="text-emerald-600" bg="bg-emerald-50" icon={CheckCircle2} />
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={v => `${v / 1000}k`} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                    {pipelineData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Costs Breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col h-full">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-rose-500" /> {t('finance.costStructures', 'Cost Structures')}
                    </h3>
                    <div className="space-y-6 flex-1">
                        <CostItem label={t('finance.cogs', 'Cost of Goods (COGS)')} value={cogs} total={totalExpenses} color="bg-rose-500" />
                        <CostItem label={t('finance.fulfillment', 'Fulfillment & Gateway Fees')} value={operatingExpenses - manualExpenses} total={totalExpenses} color="bg-orange-500" />
                        <CostItem label={t('finance.manualExpenses', 'Manual Operating Expenses')} value={manualExpenses} total={totalExpenses} color="bg-purple-500" />

                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <span className="font-bold text-gray-700">{t('finance.totalDeductions', 'Total Deductions')}</span>
                                <span className="font-black text-gray-900 text-lg tabular-nums">{totalExpenses.toLocaleString()} {t('common.currency', 'DZ')}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            </>}

            {/* Courier Settlement Panel */}
            {activeTab === 'settlements' && (overview?.courierSettlements?.length > 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Truck className="w-5 h-5 text-amber-500" />
                            {t('finance.courierSettlements', 'Courier Settlements')}
                        </h3>
                        {overview.totalPendingSettlements > 0 && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-black">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {overview.totalPendingSettlements.toLocaleString()} DZ pending
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left min-w-[500px]">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    <th className="pb-3 pl-1">{t('finance.courier', 'Courier')}</th>
                                    <th className="pb-3 text-right">{t('finance.cashCollected', 'Cash Collected')}</th>
                                    <th className="pb-3 text-right">{t('finance.pendingRemittance', 'Pending Remittance')}</th>
                                    <th className="pb-3 text-right">{t('finance.reliabilityScore', 'Score')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {overview.courierSettlements.map(c => (
                                    <tr key={c._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3 pl-1 font-bold text-gray-900">{c.name}</td>
                                        <td className="py-3 text-right font-semibold text-emerald-700 tabular-nums">
                                            {c.cashCollected.toLocaleString()} <span className="text-xs text-gray-400">DZ</span>
                                        </td>
                                        <td className="py-3 text-right tabular-nums">
                                            {c.pendingRemittance > 0 ? (
                                                <span className="inline-flex items-center gap-1 font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                                    {c.pendingRemittance.toLocaleString()} <span className="text-[10px]">DZ</span>
                                                </span>
                                            ) : (
                                                <span className="text-emerald-600 font-bold flex items-center gap-1 justify-end">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 text-right">
                                            {c.reliabilityScore != null ? (
                                                <span className={clsx('text-xs font-black px-2 py-0.5 rounded-full', c.reliabilityScore >= 80 ? 'bg-emerald-100 text-emerald-700' : c.reliabilityScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>
                                                    {c.reliabilityScore}%
                                                </span>
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
                    <Truck className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="font-bold text-gray-400">{t('finance.noSettlements', 'No courier settlements to display.')}</p>
                    <p className="text-sm text-gray-300 mt-1">{t('finance.noSettlementsSub', 'Settlements appear once orders reach Delivered status.')}</p>
                </div>
            ))}

            {/* Manual Ledger List */}
            {activeTab === 'ledger' && <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 p-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">{t('finance.manualLedger', 'Manual Operating Ledger')}</h3>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <span className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{filteredTransactions.length} {t('finance.totalTx', 'Total Tx')}</span>
                        {hasPermission('financial.manage_manual_transactions') && (
                            <button
                                onClick={() => handleOpenModal()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                            >
                                <Plus className="w-4 h-4" /> {t('common.add', 'Add')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex-wrap">
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="w-4 h-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder={t('finance.searchPlaceholder', 'Search... (Press /)')}
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full ps-9 pe-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 transition-colors font-bold"
                        />
                    </div>
                    <select
                        value={filterType}
                        onChange={e => { setFilterType(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
                        className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-blue-400 cursor-pointer appearance-none flex-1 min-w-[120px]"
                    >
                        <option value="all">All Types</option>
                        <option value="revenue">Revenue</option>
                        <option value="expense">Expense</option>
                    </select>
                    <select
                        value={filterCategory}
                        onChange={e => { setFilterCategory(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
                        className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-blue-400 cursor-pointer appearance-none flex-1 min-w-[120px]"
                    >
                        <option value="all">All Categories</option>
                        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {(filterType !== 'all' || filterCategory !== 'all' || searchTerm) && (
                        <button
                            onClick={() => { setFilterType('all'); setFilterCategory('all'); setSearchTerm(''); setCurrentPage(1); }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {/* Batch Action Bar */}
                {selectedIds.size > 0 && hasPermission('financial.manage_manual_transactions') && (
                    <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-100">
                        <span className="text-sm font-bold text-blue-800">{selectedIds.size} selected</span>
                        <button
                            onClick={handleBatchDelete}
                            disabled={batchDeleting}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {batchDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-start border-collapse min-w-[750px]">
                        <thead>
                            <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                                {hasPermission('financial.manage_manual_transactions') && (
                                    <th className="p-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                                        />
                                    </th>
                                )}
                                <th className="p-4 font-semibold w-32">{t('finance.date', 'Date')}</th>
                                <th className="p-4 font-semibold w-28">{t('finance.type', 'Type')}</th>
                                <th className="p-4 font-semibold w-36">{t('finance.category', 'Category')}</th>
                                <th className="p-4 font-semibold">{t('finance.desc', 'Description')}</th>
                                <th className="p-4 font-semibold text-end w-36">{t('finance.amount', 'Amount (DZ)')}</th>
                                {hasPermission('financial.manage_manual_transactions') && <th className="p-4 font-semibold text-center w-20">{t('finance.actions', 'Actions')}</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {paginatedTransactions.map((tx) => {
                                const isEditing = (field) => editingTx?.id === tx._id && editingTx?.field === field;
                                const editVal = (field) => isEditing(field) ? editingTx.value : undefined;
                                return (
                                    <tr key={tx._id} className={clsx("hover:bg-blue-50/20 transition-colors group", selectedIds.has(tx._id) && "bg-blue-50/40")}>
                                        {/* Checkbox */}
                                        {hasPermission('financial.manage_manual_transactions') && (
                                            <td className="p-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(tx._id)}
                                                    onChange={() => toggleSelect(tx._id)}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                                                />
                                            </td>
                                        )}
                                        {/* Date — read-only */}
                                        <td className="p-4 text-gray-500 font-medium whitespace-nowrap">
                                            {moment(tx.date).format('MMM DD, YYYY')}
                                        </td>

                                        {/* Type — click to edit */}
                                        <td className="p-4">
                                            {isEditing('type') && hasPermission('financial.manage_manual_transactions') ? (
                                                <select
                                                    autoFocus
                                                    value={editingTx.value}
                                                    onChange={e => setEditingTx(prev => ({ ...prev, value: e.target.value }))}
                                                    onBlur={async (e) => { await saveTypeChange(tx, e.target.value); }}
                                                    className="text-xs font-bold px-2 py-1.5 rounded-lg border border-blue-400 appearance-none cursor-pointer outline-none w-full shadow-sm"
                                                >
                                                    <option value="revenue">Revenue</option>
                                                    <option value="expense">Expense</option>
                                                </select>
                                            ) : (
                                                <span
                                                    onClick={() => hasPermission('financial.manage_manual_transactions') && startEdit(tx, 'type')}
                                                    className={clsx(
                                                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-opacity',
                                                        hasPermission('financial.manage_manual_transactions') && 'cursor-pointer hover:opacity-75',
                                                        tx.type === 'revenue' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    )}
                                                    title={hasPermission('financial.manage_manual_transactions') ? "Click to change" : ""}
                                                >
                                                    {tx.type === 'revenue' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                                                </span>
                                            )}
                                        </td>

                                        {/* Category — inline input */}
                                        <td className="p-4">
                                            {isEditing('category') && hasPermission('financial.manage_manual_transactions') ? (
                                                <input
                                                    autoFocus
                                                    value={editingTx.value}
                                                    onChange={e => setEditingTx(prev => ({ ...prev, value: e.target.value }))}
                                                    onBlur={() => handleInlineSave(tx)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInlineSave(tx)}
                                                    className="w-full border border-blue-400 rounded-lg px-2 py-1 text-sm outline-none shadow-sm"
                                                />
                                            ) : (
                                                <span
                                                    onClick={() => hasPermission('financial.manage_manual_transactions') && startEdit(tx, 'category')}
                                                    className={clsx("font-semibold text-gray-700 block", hasPermission('financial.manage_manual_transactions') && "cursor-pointer hover:text-blue-600 hover:underline underline-offset-2")}
                                                    title={hasPermission('financial.manage_manual_transactions') ? "Click to edit" : ""}
                                                >{tx.category || <span className="text-gray-300">—</span>}</span>
                                            )}
                                        </td>

                                        {/* Description — inline input */}
                                        <td className="p-4">
                                            {isEditing('description') && hasPermission('financial.manage_manual_transactions') ? (
                                                <input
                                                    autoFocus
                                                    value={editingTx.value}
                                                    onChange={e => setEditingTx(prev => ({ ...prev, value: e.target.value }))}
                                                    onBlur={() => handleInlineSave(tx)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInlineSave(tx)}
                                                    className="w-full border border-blue-400 rounded-lg px-2 py-1 text-sm outline-none shadow-sm"
                                                />
                                            ) : (
                                                <span
                                                    onClick={() => hasPermission('financial.manage_manual_transactions') && startEdit(tx, 'description')}
                                                    className={clsx("text-gray-500 block truncate max-w-[220px]", hasPermission('financial.manage_manual_transactions') && "cursor-pointer hover:text-blue-600 hover:underline underline-offset-2")}
                                                    title={hasPermission('financial.manage_manual_transactions') ? "Click to edit" : ""}
                                                >{tx.description || <span className="text-gray-300 italic">Add description…</span>}</span>
                                            )}
                                        </td>

                                        {/* Amount — inline number input */}
                                        <td className="p-4 text-end">
                                            {isEditing('amount') && hasPermission('financial.manage_manual_transactions') ? (
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    value={editingTx.value}
                                                    onChange={e => setEditingTx(prev => ({ ...prev, value: e.target.value }))}
                                                    onBlur={() => handleInlineSave(tx)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInlineSave(tx)}
                                                    className="w-28 border border-blue-400 rounded-lg px-2 py-1 text-sm text-end outline-none shadow-sm ml-auto block"
                                                />
                                            ) : (
                                                <span
                                                    onClick={() => hasPermission('financial.manage_manual_transactions') && startEdit(tx, 'amount')}
                                                    className={clsx(
                                                        'font-bold tabular-nums',
                                                        hasPermission('financial.manage_manual_transactions') && 'cursor-pointer hover:underline underline-offset-2',
                                                        tx.type === 'revenue' ? 'text-emerald-700' : 'text-gray-900'
                                                    )}
                                                    title={hasPermission('financial.manage_manual_transactions') ? "Click to edit" : ""}
                                                >
                                                    {tx.type === 'revenue' ? '+' : '-'}{Number(tx.amount).toLocaleString()} DZ
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        {hasPermission('financial.manage_manual_transactions') && (
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => handleOpenModal(tx)} className="p-1.5 text-gray-400 hover:text-blue-600 bg-white shadow-sm border border-gray-100 rounded-lg transition-colors">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleSingleDelete(tx._id)} className="p-1.5 text-gray-400 hover:text-rose-600 bg-white shadow-sm border border-gray-100 rounded-lg transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {paginatedTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center border border-dashed rounded-xl m-4 text-gray-400 italic">
                                        {t('finance.noTransactions', 'No manual transactions recorded yet.')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Numbered Pagination + rows per page */}
                {totalPages >= 1 && (() => {
                    const range = [];
                    const delta = 2;
                    const left = currentPage - delta;
                    const right = currentPage + delta;
                    let last = 0;
                    for (let i = 1; i <= totalPages; i++) {
                        if (i === 1 || i === totalPages || (i >= left && i <= right)) {
                            if (last && i - last > 1) range.push('...');
                            range.push(i);
                            last = i;
                        }
                    }
                    return (
                        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/30 rounded-b-2xl flex-wrap gap-3">
                            {/* Left */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-400">
                                    Page <strong className="text-gray-700">{currentPage}</strong> of <strong className="text-gray-700">{totalPages}</strong>
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-400">Show</span>
                                    <select
                                        value={perPage}
                                        onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        className="bg-white border border-gray-200 rounded-lg py-1 px-2 text-sm font-semibold text-gray-700 outline-none focus:border-blue-400 cursor-pointer"
                                    >
                                        {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                    <span className="text-xs text-gray-400">per page</span>
                                </div>
                            </div>
                            {/* Right */}
                            <div className="flex items-center gap-1">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    ‹ Prev
                                </button>
                                {range.map((p, i) =>
                                    p === '...' ? (
                                        <span key={`e-${i}`} className="px-2 py-1.5 text-sm text-gray-400">…</span>
                                    ) : (
                                        <button key={p} onClick={() => setCurrentPage(p)}
                                            className={clsx('min-w-[36px] px-2 py-1.5 text-sm font-bold rounded-lg border transition-all',
                                                p === currentPage ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                            )}>{p}</button>
                                    )
                                )}
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    Next ›
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </div>
            </>}

            {isModalOpen && (
                <TransactionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleFormSubmit}
                    initialData={selectedTransaction}
                />
            )}

            {/* In-app confirm dialog */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm animate-in zoom-in-95 duration-150">
                        <div className="p-5 border-b border-red-100 bg-red-50/40">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-gray-900 leading-snug">{confirmDialog.title}</p>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{confirmDialog.body}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 p-4">
                            <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                                className="px-4 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PipelineNode({ label, value, color, bg, icon: Icon }) {
    return (
        <div className={clsx("p-3 sm:p-4 rounded-xl border border-gray-100 flex flex-col gap-2 sm:gap-3", bg)}>
            <div className="flex items-center gap-1.5 sm:gap-2">
                <Icon className={clsx("w-4 h-4 shrink-0", color)} />
                <span className={clsx("text-[10px] sm:text-xs font-bold uppercase tracking-wider line-clamp-1", color)} title={label}>{label}</span>
            </div>
            <span className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight truncate">{value.toLocaleString()}</span>
        </div>
    );
}

function CostItem({ label, value, total, color }) {
    const percent = total > 0 ? (value / total) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-gray-700">{label}</span>
                <span className="text-sm font-black text-gray-900">{value.toLocaleString()} <span className="text-gray-400 font-medium ms-1">({percent.toFixed(1)}%)</span></span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className={clsx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
}

function ProgressBar({ progress, color }) {
    return (
        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mt-3">
            <div className={clsx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${progress}%` }}></div>
        </div>
    );
}
