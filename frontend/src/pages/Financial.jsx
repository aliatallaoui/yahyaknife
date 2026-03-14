import { useEffect, useState, useContext, useCallback, useRef, useMemo } from 'react';
import { useHotkey } from '../hooks/useHotkey';
import { DollarSign, TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight, Edit2, Trash2, Plus, Truck, Package, CheckCircle2, Search, Wallet, AlertTriangle, RefreshCw, LayoutDashboard, BookOpen, Download } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
    LineChart, Line
} from 'recharts';
import clsx from 'clsx';
import { fmtMediumDate, toISODate } from '../utils/dateUtils';
import { TransactionContext } from '../context/TransactionContext';
import { AuthContext } from '../context/AuthContext';
import TransactionModal from '../components/TransactionModal';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../utils/apiFetch';
import { useConfirmDialog } from '../components/ConfirmDialog';
import TableSkeleton from '../components/TableSkeleton';

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
    const { transactions, loading: txLoading, fetchError: txError, addTransaction, updateTransaction, deleteTransaction, fetchTransactions } = useContext(TransactionContext);
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
    // Revenue trend data from daily rollups
    const [revenueTrend, setRevenueTrend] = useState([]);

    // Shared confirm dialog
    const { dialog: confirmDialogEl, confirm: showConfirm } = useConfirmDialog();

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

    // Memoized derived data — prevents re-filtering 500+ transactions on every render
    const allCategories = useMemo(() => [...new Set(transactions.map(t => t.category).filter(Boolean))].sort(), [transactions]);

    const filteredTransactions = useMemo(() => transactions.filter(tx => {
        if (filterType !== 'all' && tx.type !== filterType) return false;
        if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            if (!(tx.description?.toLowerCase().includes(s) || tx.category?.toLowerCase().includes(s) || String(tx.amount).includes(s))) return false;
        }
        return true;
    }), [transactions, filterType, filterCategory, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / perPage));
    const paginatedTransactions = useMemo(() => filteredTransactions.slice((currentPage - 1) * perPage, currentPage * perPage), [filteredTransactions, currentPage, perPage]);

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
        showConfirm({
            title: t('finance.deleteBulkTitle', 'Delete {{count}} transaction(s)?', { count: selectedIds.size }),
            body: t('finance.deleteBulkBody', 'This will permanently remove the selected entries from the ledger.'),
            danger: true,
            onConfirm: async () => {
                setBatchDeleting(true);
                let failCount = 0;
                for (const id of selectedIds) {
                    try { await deleteTransaction(id); } catch { failCount++; }
                }
                setSelectedIds(new Set());
                setBatchDeleting(false);
                if (failCount > 0) setOverviewError(`${failCount} transaction(s) could not be deleted. Please retry.`);
            },
        });
    };

    const handleSingleDelete = (id) => {
        showConfirm({
            title: t('finance.deleteTxTitle', 'Delete this transaction?'),
            body: t('finance.deleteTxBody', 'This entry will be permanently removed from the manual ledger.'),
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
            const range = periodToRange(period);
            const params = new URLSearchParams(range);
            const finRes = await apiFetch(`/api/finance/overview?${params}`);
            if (finRes.ok) { const json = await finRes.json(); setOverview(json.data ?? json); }
            else { const j = await finRes.json().catch(() => ({})); setOverviewError(j.error || t('finance.errorLoadOverview', 'Failed to load financial overview.')); }

            // Fetch daily rollups for trend chart
            const from = range.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const to = range.endDate || new Date().toISOString().slice(0, 10);
            const trendRes = await apiFetch(`/api/analytics/daily?from=${from}&to=${to}`);
            if (trendRes.ok) {
                const tJson = await trendRes.json();
                setRevenueTrend((tJson.data?.rollups ?? []).map(d => ({
                    date: d.date.slice(5),
                    revenue: d.revenue.gross || 0,
                    profit: d.revenue.netProfit || 0,
                    cogs: d.revenue.cogs || 0,
                    orders: d.orders.created || 0,
                })));
            }
        } catch {
            setOverviewError(t('finance.errorLoadOverview', 'Failed to load financial overview.'));
        } finally {
            setLoadingOverview(false);
        }
    }, [token, period]); // eslint-disable-line react-hooks/exhaustive-deps

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
        return <TableSkeleton showKpis kpiCount={4} rows={6} cols={5} />;
    }

    // Dynamic KPIs from the backend
    const pipeline = overview?.pipeline || { expectedRevenue: 0, transitRevenue: 0, deliveredRevenue: 0, settledRevenue: 0 };
    const {
        cogs = 0, operatingExpenses = 0, manualExpenses = 0,
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
                                { key: 'thisMonth', label: t('finance.periodThisMonth', 'This Month') },
                                { key: 'lastMonth', label: t('finance.periodLastMonth', 'Last Month') },
                                { key: '3m',        label: t('finance.period3m', '3 Months') },
                                { key: 'ytd',       label: t('finance.periodYtd', 'YTD') },
                                { key: 'all',       label: t('finance.periodAll', 'All Time') },
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
                        <button onClick={fetchOverview} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/20" title={t('common.refresh', 'Refresh')}>
                            <RefreshCw className={`w-4 h-4 ${loadingOverview ? 'animate-spin' : ''}`} />
                        </button>
                        {hasPermission('finance.edit') && (
                            <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-700 font-bold rounded-xl transition-all shadow-lg active:scale-95 leading-none text-sm">
                                <Plus className="w-4 h-4" /> {t('finance.addManual', 'Add')}
                            </button>
                        )}
                    </div>
                }
            />

            {overviewError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{overviewError}</span>
                    <button onClick={() => setOverviewError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
                </div>
            )}
            {txError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{txError}</span>
                    <button onClick={fetchTransactions} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs font-bold">{t('common.retry', 'Retry')}</button>
                </div>
            )}

            {/* Tab Bar */}
            <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
                {[
                    { key: 'overview',     label: t('finance.tab.overview', 'Overview'),     icon: LayoutDashboard },
                    { key: 'settlements',  label: t('finance.tab.settlements', 'Settlements'), icon: Truck,
                      badge: overview?.totalPendingSettlements > 0 ? overview.totalPendingSettlements.toLocaleString() : null },
                    { key: 'ledger',       label: t('finance.tab.ledger', 'Ledger'),          icon: BookOpen,
                      badge: transactions.length > 0 ? transactions.length : null },
                ].map(({ key, label, icon, badge }) => {
                    const Icon = icon;
                    return (
                    <button
                        key={key}
                        onClick={() => { setActiveTab(key); setCurrentPage(1); }}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                            activeTab === key
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        )}
                    >
                        <Icon className="w-4 h-4 shrink-0" />
                        {label}
                        {badge && (
                            <span className={clsx(
                                'text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none',
                                key === 'settlements' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                            )}>{badge}</span>
                        )}
                    </button>
                    );
                })}
            </div>

            {/* Profitability Overview */}
            {activeTab === 'overview' && <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm col-span-1 sm:col-span-2 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('finance.trueNetProfit', 'True Net Profit')}</p>
                        <h3 className={clsx("text-4xl font-black tracking-tighter", netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                            {netProfit.toLocaleString()} {t('common.currency', 'DZ')}
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-medium">{t('finance.netProfitSub', 'Revenue (Delivered+Settled) - COGS - Expenses')}</p>
                    </div>
                    <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
                        <DollarSign className="w-8 h-8 text-emerald-600" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 truncate">{t('finance.profitMargin', 'Profit Margin')}</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-2 truncate">{profitMargin}%</h3>
                        <div className="w-full">
                            <ProgressBar progress={Math.max(0, Math.min(100, profitMargin))} color="bg-emerald-500" />
                        </div>
                    </div>
                    <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-800 shrink-0">
                        <Activity className="w-8 h-8 text-blue-600" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 truncate">{t('finance.recognizedRevenue', 'Recognized Revenue')}</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter truncate">
                            {totalRecognizedRevenue.toLocaleString()} <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{t('common.currency', 'DZ')}</span>
                        </h3>
                        <div className="flex items-center gap-1 mt-2 text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded w-fit truncate">
                            <ArrowUpRight className="w-3 h-3 shrink-0" /> <span className="truncate">{t('finance.includesSettled', 'Includes COD Settled')}</span>
                        </div>
                    </div>
                    <div className="h-16 w-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shrink-0">
                        <Wallet className="w-8 h-8 text-indigo-600" />
                    </div>
                </div>
            </div>

            {/* Cash Flow Pipelines */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

                {/* Visual Pipeline */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 sm:p-6 overflow-hidden">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" /> {t('finance.pipelineTitle', 'COD Cash Pipeline')}
                    </h3>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                        <PipelineNode label={t('finance.expected', 'Expected (Queued)')} value={pipeline.expectedRevenue} color="text-indigo-600" bg="bg-indigo-50" icon={Package} />
                        <PipelineNode label={t('finance.transit', 'Cash in Transit')} value={pipeline.transitRevenue} color="text-amber-600" bg="bg-amber-50" icon={Truck} />
                        <PipelineNode label={t('finance.delivered', 'Cash Delivered')} value={pipeline.deliveredRevenue} color="text-teal-600" bg="bg-teal-50" icon={TrendingUp} />
                        <PipelineNode label={t('finance.settled', 'Cash Settled')} value={pipeline.settledRevenue} color="text-emerald-600" bg="bg-emerald-50" icon={CheckCircle2} />
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 flex flex-col h-full">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-rose-500" /> {t('finance.costStructures', 'Cost Structures')}
                    </h3>
                    <div className="space-y-6 flex-1">
                        <CostItem label={t('finance.cogs', 'Cost of Goods (COGS)')} value={cogs} total={totalExpenses} color="bg-rose-500" />
                        <CostItem label={t('finance.fulfillment', 'Fulfillment & Gateway Fees')} value={operatingExpenses - manualExpenses} total={totalExpenses} color="bg-orange-500" />
                        <CostItem label={t('finance.manualExpenses', 'Manual Operating Expenses')} value={manualExpenses} total={totalExpenses} color="bg-purple-500" />

                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
                                <span className="font-bold text-gray-700 dark:text-gray-200">{t('finance.totalDeductions', 'Total Deductions')}</span>
                                <span className="font-black text-gray-900 dark:text-white text-lg tabular-nums">{totalExpenses.toLocaleString()} {t('common.currency', 'DZ')}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Revenue & Profit Trend */}
            {revenueTrend.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 sm:p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-500" /> {t('finance.revenueTrend', 'Revenue & Profit Trend')}
                    </h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={revenueTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
                                <Legend />
                                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} dot={false} name={t('finance.revenue', 'Revenue')} />
                                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} dot={false} name={t('finance.profit', 'Profit')} />
                                <Line type="monotone" dataKey="cogs" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="5 5" name={t('finance.cogs', 'COGS')} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
            </>}

            {/* Courier Settlement Panel */}
            {activeTab === 'settlements' && (overview?.courierSettlements?.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Truck className="w-5 h-5 text-amber-500" />
                            {t('finance.courierSettlements', 'Courier Settlements')}
                        </h3>
                        {overview.totalPendingSettlements > 0 && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-black">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {overview.totalPendingSettlements.toLocaleString()} DZ pending
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="cf-table min-w-[500px]">
                            <thead>
                                <tr>
                                    <th className="text-start">{t('finance.courier', 'Courier')}</th>
                                    <th className="text-end">{t('finance.cashCollected', 'Cash Collected')}</th>
                                    <th className="text-end">{t('finance.pendingRemittance', 'Pending Remittance')}</th>
                                    <th className="text-end">{t('finance.reliabilityScore', 'Score')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overview.courierSettlements.map(c => (
                                    <tr key={c._id}>
                                        <td className="py-3 pl-1 font-bold text-gray-900 dark:text-white">{c.name}</td>
                                        <td className="py-3 text-right font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                            {c.cashCollected.toLocaleString()} <span className="text-xs text-gray-400 dark:text-gray-500">DZ</span>
                                        </td>
                                        <td className="py-3 text-right tabular-nums">
                                            {c.pendingRemittance > 0 ? (
                                                <span className="inline-flex items-center gap-1 font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                                                    {c.pendingRemittance.toLocaleString()} <span className="text-[10px]">DZ</span>
                                                </span>
                                            ) : (
                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 justify-end">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 text-right">
                                            {c.reliabilityScore != null ? (
                                                <span className={clsx('text-xs font-black px-2 py-0.5 rounded-full', c.reliabilityScore >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : c.reliabilityScore >= 60 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300')}>
                                                    {c.reliabilityScore}%
                                                </span>
                                            ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-center">
                    <Truck className="w-10 h-10 text-gray-200 dark:text-gray-600 mb-3" />
                    <p className="font-bold text-gray-400 dark:text-gray-500">{t('finance.noSettlements', 'No courier settlements to display.')}</p>
                    <p className="text-sm text-gray-300 dark:text-gray-600 mt-1">{t('finance.noSettlementsSub', 'Settlements appear once orders reach Delivered status.')}</p>
                </div>
            ))}

            {/* Manual Ledger List */}
            {activeTab === 'ledger' && <>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 p-5 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('finance.manualLedger', 'Manual Operating Ledger')}</h3>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <span className="text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full">{filteredTransactions.length} {t('finance.totalTx', 'Total Tx')}</span>
                        {hasPermission('finance.edit') && (
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
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex-wrap">
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute start-3 top-1/2 -translate-y-1/2" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder={t('finance.searchPlaceholder', 'Search... (Press /)')}
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full ps-9 pe-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:border-blue-400 transition-colors font-bold dark:text-white"
                        />
                    </div>
                    <select
                        value={filterType}
                        onChange={e => { setFilterType(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
                        className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:border-blue-400 cursor-pointer appearance-none flex-1 min-w-[120px]"
                    >
                        <option value="all">{t('finance.filterAllTypes', 'All Types')}</option>
                        <option value="revenue">{t('finance.filterRevenue', 'Revenue')}</option>
                        <option value="expense">{t('finance.filterExpense', 'Expense')}</option>
                    </select>
                    <select
                        value={filterCategory}
                        onChange={e => { setFilterCategory(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
                        className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:border-blue-400 cursor-pointer appearance-none flex-1 min-w-[120px]"
                    >
                        <option value="all">{t('finance.filterAllCategories', 'All Categories')}</option>
                        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {(filterType !== 'all' || filterCategory !== 'all' || searchTerm) && (
                        <button
                            onClick={() => { setFilterType('all'); setFilterCategory('all'); setSearchTerm(''); setCurrentPage(1); }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            {t('finance.clearFilters', 'Clear Filters')}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            const rows = filteredTransactions.map(tx => ({
                                Date: toISODate(tx.date),
                                Type: tx.type,
                                Category: tx.category || '',
                                Description: tx.description || '',
                                Amount: tx.amount || 0,
                            }));
                            if (rows.length === 0) return;
                            const headers = Object.keys(rows[0]);
                            const csv = [
                                headers.join(','),
                                ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))
                            ].join('\n');
                            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `ledger_${toISODate()}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-1.5 ms-auto text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 rounded-lg px-3 py-2 transition-colors"
                        title={t('finance.exportCsv', 'Export to CSV')}
                    >
                        <Download className="w-3.5 h-3.5" />
                        {t('finance.exportCsv', 'Export CSV')}
                    </button>
                </div>

                {/* Batch Action Bar */}
                {selectedIds.size > 0 && hasPermission('finance.edit') && (
                    <div className="flex items-center justify-between px-5 py-3 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800">
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-200">{t('finance.selectedCount', '{{count}} selected', { count: selectedIds.size })}</span>
                        <button
                            onClick={handleBatchDelete}
                            disabled={batchDeleting}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {batchDeleting ? t('common.deleting', 'Deleting...') : t('finance.deleteBatch', 'Delete ({{count}})', { count: selectedIds.size })}
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-x-auto">
                    <table className="cf-table min-w-[750px]">
                        <thead>
                            <tr>
                                {hasPermission('finance.edit') && (
                                    <th className="w-10">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                                        />
                                    </th>
                                )}
                                <th className="w-32">{t('finance.date', 'Date')}</th>
                                <th className="w-28">{t('finance.type', 'Type')}</th>
                                <th className="w-36">{t('finance.category', 'Category')}</th>
                                <th>{t('finance.desc', 'Description')}</th>
                                <th className="text-end w-36">{t('finance.amount', 'Amount (DZ)')}</th>
                                {hasPermission('finance.edit') && <th className="text-center w-20">{t('finance.actions', 'Actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTransactions.map((tx) => {
                                const isEditing = (field) => editingTx?.id === tx._id && editingTx?.field === field;
                                return (
                                    <tr key={tx._id} className={clsx("group", selectedIds.has(tx._id) && "row-selected")}>
                                        {/* Checkbox */}
                                        {hasPermission('finance.edit') && (
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
                                        <td className="p-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                                            {fmtMediumDate(tx.date)}
                                        </td>

                                        {/* Type — click to edit */}
                                        <td className="p-4">
                                            {isEditing('type') && hasPermission('finance.edit') ? (
                                                <select
                                                    autoFocus
                                                    value={editingTx.value}
                                                    onChange={e => setEditingTx(prev => ({ ...prev, value: e.target.value }))}
                                                    onBlur={async (e) => { await saveTypeChange(tx, e.target.value); }}
                                                    className="text-xs font-bold px-2 py-1.5 rounded-lg border border-blue-400 appearance-none cursor-pointer outline-none w-full shadow-sm dark:bg-gray-700 dark:text-white dark:border-blue-500"
                                                >
                                                    <option value="revenue">{t('finance.filterRevenue', 'Revenue')}</option>
                                                    <option value="expense">{t('finance.filterExpense', 'Expense')}</option>
                                                </select>
                                            ) : (
                                                <span
                                                    onClick={() => hasPermission('finance.edit') && startEdit(tx, 'type')}
                                                    className={clsx(
                                                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-opacity',
                                                        hasPermission('finance.edit') && 'cursor-pointer hover:opacity-75',
                                                        tx.type === 'revenue' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                                    )}
                                                    title={hasPermission('finance.edit') ? t('finance.clickToChange', 'Click to change') : ""}
                                                    {...(hasPermission('finance.edit') && { role: 'button', tabIndex: 0, onKeyDown: e => e.key === 'Enter' && startEdit(tx, 'type') })}
                                                >
                                                    {tx.type === 'revenue' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                                                </span>
                                            )}
                                        </td>

                                        {/* Category — inline input */}
                                        <td className="p-4">
                                            {isEditing('category') && hasPermission('finance.edit') ? (
                                                <input
                                                    autoFocus
                                                    value={editingTx.value}
                                                    onChange={e => setEditingTx(prev => ({ ...prev, value: e.target.value }))}
                                                    onBlur={() => handleInlineSave(tx)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInlineSave(tx)}
                                                    className="w-full border border-blue-400 dark:border-blue-500 rounded-lg px-2 py-1 text-sm outline-none shadow-sm dark:bg-gray-700 dark:text-white"
                                                />
                                            ) : (
                                                <span
                                                    onClick={() => hasPermission('finance.edit') && startEdit(tx, 'category')}
                                                    className={clsx("font-semibold text-gray-700 dark:text-gray-200 block", hasPermission('finance.edit') && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2")}
                                                    title={hasPermission('finance.edit') ? t('finance.clickToEdit', 'Click to edit') : ""}
                                                    {...(hasPermission('finance.edit') && { role: 'button', tabIndex: 0, onKeyDown: e => e.key === 'Enter' && startEdit(tx, 'category') })}
                                                >{tx.category || <span className="text-gray-300 dark:text-gray-600">—</span>}</span>
                                            )}
                                        </td>

                                        {/* Description — inline input */}
                                        <td className="p-4">
                                            {isEditing('description') && hasPermission('finance.edit') ? (
                                                <input
                                                    autoFocus
                                                    value={editingTx.value}
                                                    onChange={e => setEditingTx(prev => ({ ...prev, value: e.target.value }))}
                                                    onBlur={() => handleInlineSave(tx)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInlineSave(tx)}
                                                    className="w-full border border-blue-400 dark:border-blue-500 rounded-lg px-2 py-1 text-sm outline-none shadow-sm dark:bg-gray-700 dark:text-white"
                                                />
                                            ) : (
                                                <span
                                                    onClick={() => hasPermission('finance.edit') && startEdit(tx, 'description')}
                                                    className={clsx("text-gray-500 dark:text-gray-400 block truncate max-w-[220px]", hasPermission('finance.edit') && "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2")}
                                                    title={hasPermission('finance.edit') ? t('finance.clickToEdit', 'Click to edit') : ""}
                                                    {...(hasPermission('finance.edit') && { role: 'button', tabIndex: 0, onKeyDown: e => e.key === 'Enter' && startEdit(tx, 'description') })}
                                                >{tx.description || <span className="text-gray-300 dark:text-gray-600 italic">Add description…</span>}</span>
                                            )}
                                        </td>

                                        {/* Amount — inline number input */}
                                        <td className="p-4 text-end">
                                            {isEditing('amount') && hasPermission('finance.edit') ? (
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    value={editingTx.value}
                                                    onChange={e => setEditingTx(prev => ({ ...prev, value: e.target.value }))}
                                                    onBlur={() => handleInlineSave(tx)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInlineSave(tx)}
                                                    className="w-28 border border-blue-400 dark:border-blue-500 rounded-lg px-2 py-1 text-sm text-end outline-none shadow-sm ml-auto block dark:bg-gray-700 dark:text-white"
                                                />
                                            ) : (
                                                <span
                                                    onClick={() => hasPermission('finance.edit') && startEdit(tx, 'amount')}
                                                    className={clsx(
                                                        'font-bold tabular-nums',
                                                        hasPermission('finance.edit') && 'cursor-pointer hover:underline underline-offset-2',
                                                        tx.type === 'revenue' ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'
                                                    )}
                                                    title={hasPermission('finance.edit') ? t('finance.clickToEdit', 'Click to edit') : ""}
                                                    {...(hasPermission('finance.edit') && { role: 'button', tabIndex: 0, onKeyDown: e => e.key === 'Enter' && startEdit(tx, 'amount') })}
                                                >
                                                    {tx.type === 'revenue' ? '+' : '-'}{Number(tx.amount).toLocaleString()} DZ
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        {hasPermission('finance.edit') && (
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => handleOpenModal(tx)} className="p-1.5 text-gray-400 hover:text-blue-600 bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 rounded-lg transition-colors">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleSingleDelete(tx._id)} className="p-1.5 text-gray-400 hover:text-rose-600 bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 rounded-lg transition-colors">
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
                                    <td colSpan="6" className="p-8 text-center border border-dashed dark:border-gray-600 rounded-xl m-4 text-gray-400 dark:text-gray-500 italic">
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
                        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/30 rounded-b-2xl flex-wrap gap-3">
                            {/* Left */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-400 dark:text-gray-500">
                                    Page <strong className="text-gray-700 dark:text-gray-200">{currentPage}</strong> of <strong className="text-gray-700 dark:text-gray-200">{totalPages}</strong>
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-400 dark:text-gray-500">Show</span>
                                    <select
                                        value={perPage}
                                        onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                        className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg py-1 px-2 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:border-blue-400 cursor-pointer"
                                    >
                                        {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">per page</span>
                                </div>
                            </div>
                            {/* Right */}
                            <div className="flex items-center gap-1">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    ‹ Prev
                                </button>
                                {range.map((p, i) =>
                                    p === '...' ? (
                                        <span key={`e-${i}`} className="px-2 py-1.5 text-sm text-gray-400 dark:text-gray-500">…</span>
                                    ) : (
                                        <button key={p} onClick={() => setCurrentPage(p)}
                                            className={clsx('min-w-[36px] px-2 py-1.5 text-sm font-bold rounded-lg border transition-all',
                                                p === currentPage ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                            )}>{p}</button>
                                    )
                                )}
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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

            {confirmDialogEl}
        </div>
    );
}

function PipelineNode({ label, value, color, bg, icon }) {
    const Icon = icon;
    return (
        <div className={clsx("p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col gap-2 sm:gap-3", bg)}>
            <div className="flex items-center gap-1.5 sm:gap-2">
                <Icon className={clsx("w-4 h-4 shrink-0", color)} />
                <span className={clsx("text-[10px] sm:text-xs font-bold uppercase tracking-wider line-clamp-1", color)} title={label}>{label}</span>
            </div>
            <span className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">{value.toLocaleString()}</span>
        </div>
    );
}

function CostItem({ label, value, total, color }) {
    const percent = total > 0 ? (value / total) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{label}</span>
                <span className="text-sm font-black text-gray-900 dark:text-white">{value.toLocaleString()} <span className="text-gray-400 dark:text-gray-500 font-medium ms-1">({percent.toFixed(1)}%)</span></span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                <div className={clsx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
}

function ProgressBar({ progress, color }) {
    return (
        <div className="w-full bg-gray-100 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden mt-3">
            <div className={clsx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${progress}%` }}></div>
        </div>
    );
}
