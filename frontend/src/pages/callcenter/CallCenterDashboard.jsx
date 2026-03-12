import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useHotkey } from '../../hooks/useHotkey';
import { useTranslation } from 'react-i18next';
import {
    PhoneCall, CheckCircle, Clock, AlertCircle, TrendingUp,
    Search, RefreshCw, Calendar
} from 'lucide-react';
import OrderActionDrawer from '../../components/callcenter/OrderActionDrawer';
import PhoneChip from '../../components/PhoneChip';

const KPICard = ({ title, value, icon: Icon, colorClass, suffix = '' }) => (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
        <div className={`w-9 h-9 rounded-lg ${colorClass} bg-opacity-10 flex items-center justify-center mb-4`}>
            <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
        <div>
            <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-black text-gray-900">{value}{suffix}</h3>
        </div>
    </div>
);

export default function CallCenterDashboard() {
    const { t } = useTranslation();
    const [stats, setStats] = useState({
        totalAssigned: 0, awaitingConfirmation: 0, confirmedToday: 0,
        deliveredTotal: 0, callsMadeToday: 0, commissionEarnedToday: 0
    });
    const [orders, setOrders] = useState([]);
    const [callbackOrders, setCallbackOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const searchInputRef = useRef(null);
    useHotkey('/', () => { searchInputRef.current?.focus(); searchInputRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchInputRef.current) { setSearch(''); searchInputRef.current?.blur(); } });

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/call-center/agent-dashboard`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const allOrders = data.orders || [];

            // Callbacks: postponed orders whose callback date is today or past due
            const today = new Date(); today.setHours(23, 59, 59, 999);
            const callbacks = allOrders.filter(o =>
                o.status === 'Postponed' && o.postponedUntil && new Date(o.postponedUntil) <= today
            );
            // Main queue: any status still requiring agent action
            const ACTIONABLE = new Set(['New', 'Call 1', 'Call 2', 'Call 3', 'No Answer']);
            const mainQueue = allOrders.filter(o => ACTIONABLE.has(o.status));

            setStats(data.metrics || stats);
            setOrders(mainQueue);
            setCallbackOrders(callbacks);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

    // Auto-advance: after an order is processed, open the next one in queue
    const handleSuccess = useCallback((processedOrderId) => {
        setIsDrawerOpen(false);
        setSelectedOrder(null);
        // Re-fetch then auto-open next order
        fetchDashboard().then(() => {
            setOrders(prev => {
                const remaining = prev.filter(o => o._id !== processedOrderId);
                if (remaining.length > 0) {
                    setSelectedOrder(remaining[0]);
                    setIsDrawerOpen(true);
                }
                return remaining;
            });
        });
    }, [fetchDashboard]);

    const handleClose = useCallback(() => {
        setIsDrawerOpen(false);
        setSelectedOrder(null);
        fetchDashboard();
    }, [fetchDashboard]);

    // Client-side search filter across main queue
    const filtered = orders.filter(o => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const name = o.customer?.name || `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`;
        return (
            (o.orderId || o.orderNumber || '').toLowerCase().includes(q) ||
            name.toLowerCase().includes(q) ||
            (o.customer?.phone || o.shipping?.phone1 || '').includes(q) ||
            (o.shipping?.wilayaName || o.wilaya || '').toLowerCase().includes(q)
        );
    });

    const OrderRow = ({ order, isCallback = false }) => {
        const waitHours = Math.floor((new Date() - new Date(order.createdAt)) / 3600000);
        const isUrgent = waitHours > 24;
        // Customer model uses `name` (single field); Order uses `orderId` not `orderNumber`
        const displayName  = order.customer?.name || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || '—';
        const displayId    = order.orderId || order.orderNumber || order._id?.slice(-6);
        const displayWilaya = order.shipping?.wilayaName || order.wilaya || '';
        const displayCommune = order.shipping?.commune || order.commune || '';
        return (
            <tr
                className={`hover:bg-indigo-50/30 transition-colors cursor-pointer group ${isUrgent && !isCallback ? 'bg-amber-50/40' : ''}`}
                onClick={() => { setSelectedOrder(order); setIsDrawerOpen(true); }}
            >
                <td className="px-5 py-3.5 font-mono text-xs font-bold text-indigo-600">{displayId}</td>
                <td className="px-5 py-3.5">
                    <p className="text-gray-900 font-semibold text-sm">{displayName}</p>
                    <PhoneChip phone={order.customer?.phone || order.shipping?.phone1} />
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{displayWilaya}{displayCommune ? `, ${displayCommune}` : ''}</td>
                <td className="px-5 py-3.5 font-bold text-gray-900 text-sm">{(order.totalAmount || 0).toLocaleString()} <span className="text-[10px] font-medium text-gray-400">DZD</span></td>
                <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                        {isCallback ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 w-fit">
                                <Calendar className="w-3 h-3" /> Due callback
                            </span>
                        ) : (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold w-fit ${isUrgent ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-500'}`}>
                                {waitHours}h {isUrgent && '⚠'}
                            </span>
                        )}
                        {order.status && order.status !== 'New' && (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded w-fit">
                                {order.status}
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-5 py-3.5 text-right">
                    <button
                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsDrawerOpen(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors font-bold text-xs"
                    >
                        <PhoneCall className="w-3.5 h-3.5" />
                        {t('callcenter.action.call', 'Process')}
                    </button>
                </td>
            </tr>
        );
    };

    const TableHeader = () => (
        <thead className="text-[11px] text-gray-400 uppercase bg-gray-50/80 sticky top-0 z-10">
            <tr>
                <th className="px-5 py-3 font-semibold text-start">{t('callcenter.queue.order', 'Order')}</th>
                <th className="px-5 py-3 font-semibold text-start">{t('callcenter.queue.customer', 'Customer')}</th>
                <th className="px-5 py-3 font-semibold text-start">{t('callcenter.queue.location', 'Location')}</th>
                <th className="px-5 py-3 font-semibold text-start">{t('callcenter.queue.amount', 'Amount')}</th>
                <th className="px-5 py-3 font-semibold text-start">{t('callcenter.queue.time', 'Wait')}</th>
                <th className="px-5 py-3 font-semibold text-end">{t('callcenter.queue.action', 'Action')}</th>
            </tr>
        </thead>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        {t('callcenter.agent_dashboard', 'Agent Workspace')}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {t('callcenter.agent_subtitle', 'Your queue · Click a row or Process to open order.')}
                    </p>
                </div>
                <button onClick={fetchDashboard} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" title="Refresh">
                    <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title={t('callcenter.kpi.awaiting', 'Awaiting Action')} value={stats.awaitingConfirmation} icon={Clock} colorClass="bg-amber-500" />
                <KPICard title={t('callcenter.kpi.confirmed_today', 'Confirmed Today')} value={stats.confirmedToday} icon={CheckCircle} colorClass="bg-emerald-500" />
                <KPICard title={t('callcenter.kpi.calls_today', 'Calls Made')} value={stats.callsMadeToday} icon={PhoneCall} colorClass="bg-blue-500" />
                <KPICard title={t('callcenter.kpi.commission', 'Est. Commission')} value={(stats.commissionEarnedToday || 0).toLocaleString()} suffix=" DZD" icon={TrendingUp} colorClass="bg-purple-500" />
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-700">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {t('callcenter.error', 'Failed to load queue. Check your connection and refresh.')}
                </div>
            )}

            {/* Callback Queue — postponed orders due today */}
            {callbackOrders.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-blue-100 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <h3 className="font-bold text-blue-800 text-sm">
                            {t('callcenter.callbacks.title', 'Callbacks Due Today')}
                            <span className="ms-2 px-2 py-0.5 bg-blue-500 text-white rounded-full text-[11px]">{callbackOrders.length}</span>
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <TableHeader />
                            <tbody className="divide-y divide-blue-100/50">
                                {callbackOrders.map(o => <OrderRow key={o._id} order={o} isCallback />)}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Main Queue */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col" style={{ minHeight: 400 }}>
                <div className="p-5 border-b border-gray-100 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{t('callcenter.queue.title', 'Active Queue')}</h3>
                        {!loading && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[11px] font-bold">{filtered.length}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t('callcenter.queue.search', 'Search by name, phone, wilaya…')}
                                className="w-56 ps-9 pe-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                title="Press / to focus"
                            />
                        </div>
                        {filtered.length > 0 && !isDrawerOpen && (
                            <button
                                onClick={() => { setSelectedOrder(filtered[0]); setIsDrawerOpen(true); }}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm shadow-indigo-500/20"
                            >
                                <PhoneCall className="w-4 h-4" />
                                {t('callcenter.queue.start', 'Start Processing')}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-7 h-7 rounded-full border-4 border-gray-200 border-t-indigo-500 animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                            <CheckCircle className="w-12 h-12 text-emerald-300 mb-3" />
                            <p className="font-bold text-gray-500">
                                {search ? t('callcenter.queue.no_match', 'No orders match your search.') : t('callcenter.queue.empty', 'Inbox zero! All orders processed.')}
                            </p>
                            {search && <button onClick={() => setSearch('')} className="mt-2 text-xs text-indigo-500 hover:underline">Clear search</button>}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <TableHeader />
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(o => <OrderRow key={o._id} order={o} />)}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {isDrawerOpen && selectedOrder && (
                <OrderActionDrawer
                    order={selectedOrder}
                    onClose={handleClose}
                    onSuccess={() => handleSuccess(selectedOrder._id)}
                />
            )}
        </div>
    );
}
