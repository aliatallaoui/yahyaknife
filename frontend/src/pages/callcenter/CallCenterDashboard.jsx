import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from 'react';
import { useHotkey } from '../../hooks/useHotkey';
import { useTranslation } from 'react-i18next';
import {
    PhoneCall, CheckCircle, Clock, AlertCircle, TrendingUp,
    Search, RefreshCw, Calendar, Shield, Zap, Target, Flame,
    Truck, MessageSquare, Send as SendIcon, Inbox, Hand
} from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import OrderActionDrawer from '../../components/callcenter/OrderActionDrawer';
import PhoneChip from '../../components/PhoneChip';
import { getOrderStatusLabel } from '../../constants/statusColors';
import MessagePanel from '../../components/callcenter/MessagePanel';
import { AuthContext } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const AssignmentBadge = ({ mode }) => {
    if (!mode) return null;
    const badge = ASSIGNMENT_MODE_BADGES[mode];
    if (!badge) return null;
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badge.cls}`}>
            {badge.label}
        </span>
    );
};

const KPICard = ({ title, value, icon: Icon, colorClass, suffix = '' }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 sm:p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${colorClass} bg-opacity-10 flex items-center justify-center mb-2 sm:mb-4`}>
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
        <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 truncate">{title}</p>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{value}{suffix}</h3>
        </div>
    </div>
);

const QUEUE_TABS = [
    { key: 'All', icon: null },
    { key: 'New', icon: null },
    { key: 'Unassigned', icon: Inbox },
    { key: 'Follow-Up', icon: PhoneCall },
    { key: 'Callbacks', icon: Calendar },
    { key: 'Delivery', icon: Truck },
];

const ASSIGNMENT_MODE_BADGES = {
    manual:    { label: 'Manual',      cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300' },
    product:   { label: 'Product',     cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300' },
    store:     { label: 'Store',       cls: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300' },
    round_robin: { label: 'Round Robin', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300' },
    claim:     { label: 'Claimed',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300' },
    auto_least_loaded: { label: 'Auto', cls: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300' },
};

const FOLLOW_UP_STATUSES = new Set(['Call 1', 'Call 2', 'Call 3', 'No Answer']);

const RISK_DOT = { Low: 'bg-emerald-400', Medium: 'bg-amber-400', High: 'bg-red-500' };

const ADMIN_ROLES = new Set(['Super Admin', 'Owner / Founder']);

export default function CallCenterDashboard() {
    const { t } = useTranslation();
    const { hasPermission, user } = useContext(AuthContext);
    const isAdmin = ADMIN_ROLES.has(user?.roleObject?.name) || ADMIN_ROLES.has(user?.role);
    const canViewUnassigned = hasPermission('callcenter.view_unassigned');
    const canClaimOrders = hasPermission('callcenter.claim_orders');

    const [stats, setStats] = useState({
        totalAssigned: 0, awaitingAction: 0, confirmedToday: 0,
        deliveredTotal: 0, callsMadeToday: 0, commissionEarnedToday: 0,
        callsPerHour: 0, confirmRateToday: 0, streak: 0
    });
    const [allOrders, setAllOrders] = useState([]);
    const [deliveryOrders, setDeliveryOrders] = useState([]);
    const [unassignedOrders, setUnassignedOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [queueTab, setQueueTab] = useState('All');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [quickMsgOrder, setQuickMsgOrder] = useState(null);
    const [claimingId, setClaimingId] = useState(null);
    const searchInputRef = useRef(null);
    useHotkey('/', () => { searchInputRef.current?.focus(); searchInputRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchInputRef.current) { setSearch(''); searchInputRef.current?.blur(); } });

    const fetchDashboard = useCallback(async (signal) => {
        setLoading(true);
        setError(null);
        try {
            const opts = signal ? { signal } : {};
            const fetches = [
                apiFetch('/api/call-center/agent-dashboard', opts),
                apiFetch('/api/call-center/follow-up-queue', opts),
            ];
            if (canViewUnassigned) {
                fetches.push(apiFetch('/api/call-center/unassigned-queue', opts));
            }

            const results = await Promise.all(fetches);
            const [dashRes, followUpRes] = results;

            if (!dashRes.ok) throw new Error(`HTTP ${dashRes.status}`);
            const data = await dashRes.json();
            setStats(data.metrics || stats);
            setAllOrders(data.orders || []);

            if (followUpRes.ok) {
                const fuData = await followUpRes.json();
                setDeliveryOrders((fuData.data ?? fuData) || []);
            }

            if (canViewUnassigned && results[2]?.ok) {
                const uData = await results[2].json();
                setUnassignedOrders((uData.data ?? uData) || []);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [canViewUnassigned]);

    const handleClaimOrder = useCallback(async (orderId) => {
        setClaimingId(orderId);
        try {
            const res = await apiFetch(`/api/call-center/claim/${orderId}`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${res.status}`);
            }
            toast.success(t('callcenter.claimSuccess', 'Order claimed successfully'));
            fetchDashboard();
        } catch (err) {
            toast.error(err.message || t('callcenter.claimFailed', 'Failed to claim order'));
        } finally {
            setClaimingId(null);
        }
    }, [fetchDashboard, t]);

    useEffect(() => {
        const controller = new AbortController();
        fetchDashboard(controller.signal);
        return () => controller.abort();
    }, [fetchDashboard]);

    // Tab filtering
    const now = useMemo(() => new Date(), [allOrders]);
    const tabOrders = useMemo(() => {
        switch (queueTab) {
            case 'New':        return allOrders.filter(o => o.status === 'New');
            case 'Unassigned': return unassignedOrders;
            case 'Follow-Up':  return allOrders.filter(o => FOLLOW_UP_STATUSES.has(o.status));
            case 'Callbacks':  return allOrders.filter(o => o.status === 'Postponed' && o.postponedUntil && new Date(o.postponedUntil) <= now);
            case 'Delivery':   return deliveryOrders;
            default:           return allOrders;
        }
    }, [allOrders, unassignedOrders, deliveryOrders, queueTab, now]);

    // Tab counts
    const tabCounts = useMemo(() => ({
        All: allOrders.length,
        New: allOrders.filter(o => o.status === 'New').length,
        Unassigned: unassignedOrders.length,
        'Follow-Up': allOrders.filter(o => FOLLOW_UP_STATUSES.has(o.status)).length,
        Callbacks: allOrders.filter(o => o.status === 'Postponed' && o.postponedUntil && new Date(o.postponedUntil) <= now).length,
        Delivery: deliveryOrders.length,
    }), [allOrders, unassignedOrders, deliveryOrders, now]);

    // Filter out the Unassigned tab if agent lacks permission
    const visibleTabs = useMemo(() => {
        return QUEUE_TABS.filter(tab => tab.key !== 'Unassigned' || canViewUnassigned);
    }, [canViewUnassigned]);

    // Client-side search filter
    const filtered = tabOrders.filter(o => {
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

    // Auto-advance: after an order is processed, open the next one in queue
    const handleSuccess = useCallback((processedOrderId) => {
        setIsDrawerOpen(false);
        setSelectedOrder(null);
        fetchDashboard().then(() => {
            setAllOrders(prev => {
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

    const OrderRow = ({ order }) => {
        const waitHours = Math.floor((new Date() - new Date(order.createdAt)) / 3600000);
        const isUrgent = waitHours > 24;
        const isCallback = order.status === 'Postponed' && order.postponedUntil && new Date(order.postponedUntil) <= now;
        
        // SLA Breach: Unattended orders sitting in New or No Answer for more than 2 hours
        const isSlaBreach = (order.status === 'New' || order.status === 'No Answer') && waitHours >= 2 && !isCallback;

        const displayName  = order.customer?.name || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || '—';
        const displayId    = order.orderId || order.orderNumber || order._id?.slice(-6);
        const displayWilaya = order.shipping?.wilayaName || order.wilaya || '';
        const displayCommune = order.shipping?.commune || order.commune || '';
        const riskLevel = order.customer?.riskLevel;
        const riskDot = riskLevel ? RISK_DOT[riskLevel] : null;

        const statusBadge = isCallback ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-fit">
                <Calendar className="w-3 h-3" /> {t('callcenter.dueCallback', 'Due callback')}
            </span>
        ) : isSlaBreach ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 w-fit border border-red-200 dark:border-red-800 shadow-sm animate-pulse">
                <AlertCircle className="w-3 h-3" /> {t('callcenter.slaBreach', 'SLA Breach')} ({waitHours}h)
            </span>
        ) : (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold w-fit ${isUrgent ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                {waitHours}h
            </span>
        );

        const orderStatusBadge = order.status && order.status !== 'New' ? (
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded w-fit border border-amber-100/50 dark:border-amber-800/50">
                {getOrderStatusLabel(t, order.status)}
            </span>
        ) : null;

        // Mobile card layout
        const MobileCard = () => (
            <div
                className={`p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer active:bg-indigo-50/50 dark:active:bg-indigo-900/30 transition-colors ${isSlaBreach ? 'bg-red-50/40 dark:bg-red-900/20 border-s-2 border-s-red-500' : isUrgent && !isCallback ? 'bg-amber-50/40 dark:bg-amber-900/20' : ''} ${isCallback ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`}
                onClick={() => { setSelectedOrder(order); setIsDrawerOpen(true); }}
            >
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {riskDot && <span className={`w-2 h-2 rounded-full ${riskDot} shrink-0`} title={`${riskLevel} risk`} />}
                        <div className="min-w-0">
                            <p className="text-gray-900 dark:text-white font-semibold text-sm truncate">{displayName}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{displayId}</p>
                        </div>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm shrink-0">{(order.totalAmount || 0).toLocaleString()} <span className="text-[10px] text-gray-400 dark:text-gray-500">{t('common.dzd', 'DZD')}</span></p>
                </div>
                {isAdmin && order.assignedAgentName && (
                    <p className="text-[11px] text-indigo-600 font-semibold mb-1">{order.assignedAgentName}</p>
                )}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge}
                        {orderStatusBadge}
                        <AssignmentBadge mode={order.assignmentMode} />
                        {displayWilaya && <span className="text-[11px] text-gray-500 dark:text-gray-400">{displayWilaya}</span>}
                    </div>
                    {queueTab === 'Unassigned' && canClaimOrders ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleClaimOrder(order._id); }}
                            disabled={claimingId === order._id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors font-bold text-xs shrink-0 disabled:opacity-50"
                        >
                            <Hand className="w-3.5 h-3.5" />
                            {claimingId === order._id ? '...' : t('callcenter.claim', 'Claim')}
                        </button>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsDrawerOpen(true); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors font-bold text-xs shrink-0"
                        >
                            <PhoneCall className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        );

        // Desktop table row
        const DesktopRow = () => (
            <tr
                className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer group ${isSlaBreach ? 'bg-red-50/40 dark:bg-red-900/20 border-s-2 border-s-red-500' : isUrgent && !isCallback ? 'bg-amber-50/40 dark:bg-amber-900/20' : ''} ${isCallback ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`}
                onClick={() => { setSelectedOrder(order); setIsDrawerOpen(true); }}
            >
                <td className="px-5 py-3.5 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{displayId}</td>
                <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                        {riskDot && <span className={`w-2 h-2 rounded-full ${riskDot} shrink-0`} title={`${riskLevel} risk`} />}
                        <div className="min-w-0">
                            <p className="text-gray-900 dark:text-white font-semibold text-sm truncate">{displayName}</p>
                            <PhoneChip phone={order.customer?.phone || order.shipping?.phone1} />
                        </div>
                    </div>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-400">{displayWilaya}{displayCommune ? `, ${displayCommune}` : ''}</td>
                <td className="px-5 py-3.5 text-sm text-gray-800 dark:text-gray-200">
                    {order.products?.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                            {order.products.slice(0, 2).map((p, i) => (
                                <span key={i} className="truncate max-w-[180px]" title={p.name}>
                                    <span className="font-bold text-indigo-400">{p.quantity}x</span> {p.name || 'Product'}
                                </span>
                            ))}
                            {order.products.length > 2 && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium bg-gray-50 dark:bg-gray-700/50 px-1 py-0.5 rounded w-fit mt-0.5 border border-gray-100 dark:border-gray-600">
                                    +{order.products.length - 2} {t('common.more', 'more')}
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-gray-400 dark:text-gray-500 italic text-[11px]">{t('common.noItems', 'No items')}</span>
                    )}
                </td>
                <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white text-sm">{(order.totalAmount || 0).toLocaleString()} <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{t('common.dzd', 'DZD')}</span></td>
                <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1 items-start">
                        {statusBadge}
                        {orderStatusBadge}
                    </div>
                </td>
                <td className="px-5 py-3.5 text-end">
                    <button
                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsDrawerOpen(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors font-bold text-xs"
                    >
                        <PhoneCall className="w-3.5 h-3.5" />
                        {t('callcenter.action.call', 'Process')}
                    </button>
                </td>
            </tr>
        );

        return (
            <>
                {/* Mobile: card layout */}
                <div className="md:hidden"><MobileCard /></div>
                {/* Desktop: table row (rendered inside tbody) */}
            </>
        );
    };

    const TableHeader = () => (
        <thead className="hidden md:table-header-group">
            <tr>
                <th>{t('callcenter.queue.order', 'Order')}</th>
                <th>{t('callcenter.queue.customer', 'Customer')}</th>
                <th>{t('callcenter.queue.location', 'Location')}</th>
                <th>{t('callcenter.queue.products', 'Products')}</th>
                <th>{t('callcenter.queue.amount', 'Amount')}</th>
                {isAdmin && <th>{t('callcenter.queue.agent', 'Assigned To')}</th>}
                <th>{t('callcenter.queue.time', 'Wait')}</th>
                <th className="text-end">{t('callcenter.queue.action', 'Action')}</th>
            </tr>
        </thead>
    );

    return (
        <div className="w-full h-[calc(100vh-theme(spacing.16))] flex flex-col space-y-6 px-4 py-6">

            {/* Header */}
            <div className="flex justify-between items-start sm:items-end shrink-0 gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        {t('callcenter.agent_dashboard', 'Agent Workspace')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1 hidden sm:block">
                        {t('callcenter.agent_subtitle', 'Your queue · Click a row or Process to open order.')}
                    </p>
                </div>
                <button onClick={fetchDashboard} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0" title={t('common.refresh', 'Refresh')}>
                    <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
                <KPICard title={t('callcenter.kpi.awaiting', 'Awaiting Action')} value={stats.awaitingAction} icon={Clock} colorClass="bg-amber-500" />
                <KPICard title={t('callcenter.kpi.confirmed_today', 'Confirmed Today')} value={stats.confirmedToday} icon={CheckCircle} colorClass="bg-emerald-500" />
                <KPICard title={t('callcenter.kpi.calls_today', 'Calls Made')} value={stats.callsMadeToday} icon={PhoneCall} colorClass="bg-blue-500" />
                <KPICard title={t('callcenter.kpi.commission', 'Est. Commission')} value={(stats.commissionEarnedToday || 0).toLocaleString()} suffix={` ${t('common.dzd', 'DZD')}`} icon={TrendingUp} colorClass="bg-purple-500" />
                <KPICard title={t('callcenter.kpi.calls_per_hour', 'Calls/Hour')} value={stats.callsPerHour || 0} icon={Zap} colorClass="bg-indigo-500" />
                <KPICard title={t('callcenter.kpi.confirm_rate', 'Confirm Rate')} value={stats.confirmRateToday || 0} suffix="%" icon={Target} colorClass="bg-teal-500" />
                <KPICard title={t('callcenter.kpi.streak', 'Confirm Streak')} value={stats.streak || 0} icon={Flame} colorClass="bg-orange-500" />
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 rounded-xl text-sm text-rose-700 dark:text-rose-300">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {t('callcenter.error', 'Failed to load queue. Check your connection and refresh.')}
                </div>
            )}

            {/* Main Queue with Tabs - takes remaining height */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col flex-1 min-h-[400px]">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 space-y-3 shrink-0">
                    {/* Tab Bar */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
                        {visibleTabs.map(tab => {
                            const count = tabCounts[tab.key];
                            const active = queueTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setQueueTab(tab.key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                        active
                                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                                    {t(`callcenter.tab.${tab.key}`, tab.key)}
                                    {count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            active ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                                        }`}>{count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search + Start Processing */}
                    <div className="flex flex-wrap justify-between items-center gap-3">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white">{t('callcenter.queue.title', 'Active Queue')}</h3>
                            {!loading && (
                                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full text-[11px] font-bold">{filtered.length}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative">
                                <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute start-3 top-1/2 -translate-y-1/2" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={t('callcenter.queue.search', 'Search by name, phone, wilaya…')}
                                    className="w-full sm:w-56 ps-9 pe-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                    title={t('common.slashToFocus', 'Press / to focus')}
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
                </div>

                <div className="flex-1 overflow-auto min-h-0 relative">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-7 h-7 rounded-full border-4 border-gray-200 dark:border-gray-600 border-t-indigo-500 animate-spin" />
                        </div>
                    ) : queueTab === 'Delivery' ? (
                        /* ─── Delivery Follow-Up Tab ─── */
                        filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                <Truck className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                                <p className="font-bold text-gray-500 dark:text-gray-400">{t('callcenter.delivery.empty', 'No orders in delivery follow-up.')}</p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile cards */}
                                <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                                    {filtered.map(o => {
                                        const name = o.customer?.name || o.shipping?.recipientName || '—';
                                        const phone = o.customer?.phone || o.shipping?.phone1 || '';
                                        const shipment = o.shipment;
                                        const STATUS_COLORS = {
                                            'Dispatched': 'bg-indigo-50 text-indigo-700',
                                            'Shipped': 'bg-blue-50 text-blue-700',
                                            'Out for Delivery': 'bg-amber-50 text-amber-700',
                                            'Failed Attempt': 'bg-red-50 text-red-700',
                                        };
                                        return (
                                            <div key={o._id} className="p-3 space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
                                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{o.orderId || o._id?.slice(-6)}</p>
                                                    </div>
                                                    <span className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-bold ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                                                        {getOrderStatusLabel(t, o.status)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                        {shipment?.externalTrackingId && (
                                                            <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[10px]">{shipment.externalTrackingId}</span>
                                                        )}
                                                        <span>{o.shipping?.wilayaName || o.wilaya}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <a href={`tel:${phone}`} className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50">
                                                            <PhoneCall className="w-3.5 h-3.5" />
                                                        </a>
                                                        <button
                                                            onClick={() => setQuickMsgOrder(quickMsgOrder?._id === o._id ? null : o)}
                                                            className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                                        >
                                                            <SendIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => { setSelectedOrder(o); setIsDrawerOpen(true); }}
                                                            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                                                        >
                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {quickMsgOrder?._id === o._id && (
                                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                                                        <MessagePanel orderId={o._id} isOpen onMessageSent={() => setQuickMsgOrder(null)} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Desktop table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="cf-table min-w-[700px]">
                                        <thead>
                                            <tr>
                                                <th>{t('callcenter.queue.order', 'Order')}</th>
                                                <th>{t('callcenter.queue.customer', 'Customer')}</th>
                                                <th>{t('callcenter.queue.location', 'Location')}</th>
                                                <th>{t('callcenter.delivery.status', 'Delivery Status')}</th>
                                                <th>{t('callcenter.delivery.tracking', 'Tracking')}</th>
                                                <th>{t('callcenter.queue.amount', 'Amount')}</th>
                                                <th className="text-end">{t('callcenter.delivery.actions', 'Actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(o => {
                                                const name = o.customer?.name || o.shipping?.recipientName || '—';
                                                const phone = o.customer?.phone || o.shipping?.phone1 || '';
                                                const shipment = o.shipment;
                                                const STATUS_COLORS = {
                                                    'Dispatched': 'bg-indigo-50 text-indigo-700 border-indigo-200',
                                                    'Shipped': 'bg-blue-50 text-blue-700 border-blue-200',
                                                    'Out for Delivery': 'bg-amber-50 text-amber-700 border-amber-200',
                                                    'Failed Attempt': 'bg-red-50 text-red-700 border-red-200',
                                                };
                                                return (
                                                    <React.Fragment key={o._id}>
                                                        <tr className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer" onClick={() => { setSelectedOrder(o); setIsDrawerOpen(true); }}>
                                                            <td className="px-5 py-3.5 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{o.orderId || o._id?.slice(-6)}</td>
                                                            <td className="px-5 py-3.5">
                                                                <p className="text-gray-900 dark:text-white font-semibold text-sm truncate">{name}</p>
                                                                <PhoneChip phone={phone} />
                                                            </td>
                                                            <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-400">{o.shipping?.wilayaName || o.wilaya}{o.shipping?.commune ? `, ${o.shipping.commune}` : ''}</td>
                                                            <td className="px-5 py-3.5">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                                    <Truck className="w-3 h-3" />
                                                                    {getOrderStatusLabel(t, o.status)}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3.5">
                                                                {shipment?.externalTrackingId ? (
                                                                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md text-gray-700 dark:text-gray-300">{shipment.externalTrackingId}</span>
                                                                ) : (
                                                                    <span className="text-xs text-gray-400 dark:text-gray-500 italic">{t('callcenter.delivery.noTracking', 'No tracking')}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white text-sm">{(o.totalAmount || 0).toLocaleString()} <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{t('common.dzd', 'DZD')}</span></td>
                                                            <td className="px-5 py-3.5">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors" title={t('callcenter.delivery.callCustomer', 'Call customer')}>
                                                                        <PhoneCall className="w-3.5 h-3.5" />
                                                                    </a>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setQuickMsgOrder(quickMsgOrder?._id === o._id ? null : o); }}
                                                                        className={`p-1.5 rounded-lg transition-colors ${quickMsgOrder?._id === o._id ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white'}`}
                                                                        title={t('callcenter.delivery.sendMessage', 'Send message')}
                                                                    >
                                                                        <SendIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(o); setIsDrawerOpen(true); }}
                                                                        className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors"
                                                                        title={t('callcenter.delivery.viewDetails', 'View details')}
                                                                    >
                                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {quickMsgOrder?._id === o._id && (
                                                            <tr>
                                                                <td colSpan={7} className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                                                                    <MessagePanel orderId={o._id} isOpen onMessageSent={() => setQuickMsgOrder(null)} />
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                            <CheckCircle className="w-12 h-12 text-emerald-300 dark:text-emerald-600 mb-3" />
                            <p className="font-bold text-gray-500 dark:text-gray-400">
                                {search ? t('callcenter.queue.no_match', 'No orders match your search.') : t('callcenter.queue.empty', 'Inbox zero! All orders processed.')}
                            </p>
                            {search && <button onClick={() => setSearch('')} className="mt-2 text-xs text-indigo-500 hover:underline">{t('callcenter.clearSearch', 'Clear search')}</button>}
                        </div>
                    ) : (
                        <>
                            {/* Mobile card list */}
                            <div className="md:hidden">
                                {filtered.map(o => <OrderRow key={o._id} order={o} />)}
                            </div>
                            {/* Desktop table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="cf-table min-w-[640px]">
                                    <TableHeader />
                                    <tbody>
                                        {filtered.map(o => {
                                            const waitHours = Math.floor((new Date() - new Date(o.createdAt)) / 3600000);
                                            const isUrgentRow = waitHours > 24;
                                            const isCallbackRow = o.status === 'Postponed' && o.postponedUntil && new Date(o.postponedUntil) <= now;
                                            const isSlaBreachRow = (o.status === 'New' || o.status === 'No Answer') && waitHours >= 2 && !isCallbackRow;
                                            const displayNameRow = o.customer?.name || `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim() || '—';
                                            const displayIdRow = o.orderId || o.orderNumber || o._id?.slice(-6);
                                            const displayWilayaRow = o.shipping?.wilayaName || o.wilaya || '';
                                            const displayCommuneRow = o.shipping?.commune || o.commune || '';
                                            const riskLevelRow = o.customer?.riskLevel;
                                            const riskDotRow = riskLevelRow ? RISK_DOT[riskLevelRow] : null;

                                            const statusBadge = isCallbackRow ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-fit">
                                                    <Calendar className="w-3 h-3" /> {t('callcenter.dueCallback', 'Due callback')}
                                                </span>
                                            ) : isSlaBreachRow ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 w-fit border border-red-200 dark:border-red-800 shadow-sm animate-pulse">
                                                    <AlertCircle className="w-3 h-3" /> {t('callcenter.slaBreach', 'SLA Breach')} ({waitHours}h)
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold w-fit ${isUrgentRow ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                                    {waitHours}h
                                                </span>
                                            );

                                            return (
                                                <tr
                                                    key={o._id}
                                                    className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer group ${isSlaBreachRow ? 'bg-red-50/40 dark:bg-red-900/20 border-s-2 border-s-red-500' : isUrgentRow && !isCallbackRow ? 'bg-amber-50/40 dark:bg-amber-900/20' : ''} ${isCallbackRow ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`}
                                                    onClick={() => { setSelectedOrder(o); setIsDrawerOpen(true); }}
                                                >
                                                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{displayIdRow}</td>
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-2">
                                                            {riskDotRow && <span className={`w-2 h-2 rounded-full ${riskDotRow} shrink-0`} title={`${riskLevelRow} risk`} />}
                                                            <div className="min-w-0">
                                                                <p className="text-gray-900 dark:text-white font-semibold text-sm truncate">{displayNameRow}</p>
                                                                <PhoneChip phone={o.customer?.phone || o.shipping?.phone1} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-400">{displayWilayaRow}{displayCommuneRow ? `, ${displayCommuneRow}` : ''}</td>
                                                    <td className="px-5 py-3.5 text-sm text-gray-800 dark:text-gray-200">
                                                        {o.products?.length > 0 ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                {o.products.slice(0, 2).map((p, i) => (
                                                                    <span key={i} className="truncate max-w-[180px]" title={p.name}>
                                                                        <span className="font-bold text-indigo-400">{p.quantity}x</span> {p.name || 'Product'}
                                                                    </span>
                                                                ))}
                                                                {o.products.length > 2 && (
                                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium bg-gray-50 dark:bg-gray-700/50 px-1 py-0.5 rounded w-fit mt-0.5 border border-gray-100 dark:border-gray-600">
                                                                        +{o.products.length - 2} {t('common.more', 'more')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 dark:text-gray-500 italic text-[11px]">{t('common.noItems', 'No items')}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white text-sm">{(o.totalAmount || 0).toLocaleString()} <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{t('common.dzd', 'DZD')}</span></td>
                                                    {isAdmin && (
                                                        <td className="px-5 py-3.5">
                                                            {o.assignedAgentName ? (
                                                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{o.assignedAgentName}</span>
                                                            ) : (
                                                                <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">{t('callcenter.unassigned', 'Unassigned')}</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            {statusBadge}
                                                            {o.status && o.status !== 'New' && (
                                                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded w-fit border border-amber-100/50 dark:border-amber-800/50">
                                                                    {getOrderStatusLabel(t, o.status)}
                                                                </span>
                                                            )}
                                                            <AssignmentBadge mode={o.assignmentMode} />
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-end">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {queueTab === 'Unassigned' && canClaimOrders ? (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleClaimOrder(o._id); }}
                                                                    disabled={claimingId === o._id}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors font-bold text-xs disabled:opacity-50"
                                                                >
                                                                    <Hand className="w-3.5 h-3.5" />
                                                                    {claimingId === o._id ? t('common.loading', '...') : t('callcenter.claim', 'Claim')}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedOrder(o); setIsDrawerOpen(true); }}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors font-bold text-xs"
                                                                >
                                                                    <PhoneCall className="w-3.5 h-3.5" />
                                                                    {t('callcenter.action.call', 'Process')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {isDrawerOpen && selectedOrder && (
                <OrderActionDrawer
                    order={selectedOrder}
                    onClose={handleClose}
                    onSuccess={() => handleSuccess(selectedOrder._id)}
                    orderIndex={filtered.findIndex(o => o._id === selectedOrder._id)}
                    totalOrders={filtered.length}
                    onNavigate={(dir) => {
                        const idx = filtered.findIndex(o => o._id === selectedOrder._id);
                        const next = filtered[idx + dir];
                        if (next) setSelectedOrder(next);
                    }}
                />
            )}
        </div>
    );
}
