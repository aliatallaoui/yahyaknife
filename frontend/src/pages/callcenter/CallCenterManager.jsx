import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Users, PhoneCall, CheckCircle, PackageCheck,
    RefreshCw, Zap, DollarSign, AlertTriangle, X,
    Clock, XCircle, Inbox, Timer, BarChart3, Bell,
    TrendingUp, TrendingDown, MapPin, Activity,
    ShieldAlert, Undo2, Settings, Plus, Trash2, ToggleLeft, ToggleRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../utils/apiFetch';
import AgentPerformanceModal from '../../components/callcenter/AgentPerformanceModal';
import { AuthContext } from '../../context/AuthContext';

function formatMs(ms) {
    if (!ms || ms <= 0) return '—';
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
}

export default function CallCenterManager() {
    const { t } = useTranslation();
    const { hasPermission } = useContext(AuthContext);
    const canManage = hasPermission('callcenter.manage_assignments');
    const canViewReports = hasPermission('callcenter.view_reports');
    const canManageRules = hasPermission('callcenter.manage_rules');
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assignmentLoading, setAssignmentLoading] = useState(false);
    const [period, setPeriod] = useState('today');
    const [assignError, setAssignError] = useState(null);
    const [assignSuccess, setAssignSuccess] = useState(null);
    const [stats, setStats] = useState({
        totalCalls: 0,
        averageConfirmRate: 0,
        averageDeliveryRate: 0,
        totalCommissions: 0
    });
    const [ops, setOps] = useState(null);
    const [activeTab, setActiveTab] = useState('operations'); // 'operations' | 'analytics' | 'supervisor'
    const [analyticsData, setAnalyticsData] = useState(null);
    const [analyticsDays, setAnalyticsDays] = useState(7);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [supervisorQueue, setSupervisorQueue] = useState(null);
    const [supervisorLoading, setSupervisorLoading] = useState(false);
    const [selectedAgentForModal, setSelectedAgentForModal] = useState(null);

    const fetchDeepAnalytics = async (days = analyticsDays) => {
        setAnalyticsLoading(true);
        try {
            const res = await apiFetch(`/api/call-center/analytics?days=${days}`);
            const json = await res.json();
            setAnalyticsData(json.data ?? json);
        } catch {
            setAnalyticsData(null);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const fetchSupervisorQueue = async () => {
        setSupervisorLoading(true);
        try {
            const res = await apiFetch('/api/call-center/supervisor-queue');
            const json = await res.json();
            setSupervisorQueue(json.data ?? json);
        } catch {
            setSupervisorQueue(null);
        } finally {
            setSupervisorLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const response = await apiFetch(`/api/call-center/manager-analytics?range=${period}`);
            const responseData = await response.json();
            const data = responseData.leaderboard || [];

            let calls = 0, conf = 0, assigned = 0, deliv = 0, comm = 0;
            data.forEach(a => {
                calls += a.totalCalls;
                conf += a.totalConfirmed;
                assigned += a.totalAssigned;
                deliv += a.totalDelivered;
                comm += a.commissionEarned;
            });

            setStats({
                totalCalls: calls,
                averageConfirmRate: assigned > 0 ? ((conf / assigned) * 100).toFixed(1) : 0,
                averageDeliveryRate: assigned > 0 ? ((deliv / assigned) * 100).toFixed(1) : 0,
                totalCommissions: comm
            });
            setLeaderboard(data);
        } catch {
            setLeaderboard([]);
            setStats({ totalCalls: 0, averageConfirmRate: 0, averageDeliveryRate: 0, totalCommissions: 0 });
        } finally {
            setLoading(false);
        }
    };

    const fetchOperations = async () => {
        try {
            const res = await apiFetch('/api/call-center/manager-operations');
            const data = await res.json();
            setOps(data.data ?? data);
        } catch {
            setOps(null);
        }
    };

    useEffect(() => {
        fetchAnalytics();
        fetchOperations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period]);

    useEffect(() => {
        if (activeTab === 'analytics') fetchDeepAnalytics(analyticsDays);
        if (activeTab === 'supervisor') fetchSupervisorQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, analyticsDays]);

    const triggerAutoAssignment = async () => {
        setAssignmentLoading(true);
        setAssignError(null);
        setAssignSuccess(null);
        try {
            const res = await apiFetch(`/api/call-center/assign-orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'Auto_Distribute' })
            });
            const resData = await res.json();
            if (!res.ok) throw { response: { data: resData } };
            const count = resData?.assignedCount ?? resData?.count ?? '?';
            setAssignSuccess(t('callcenter.assignedCount', { count }, '{{count}} orders assigned successfully.'));
            fetchAnalytics();
            fetchOperations();
        } catch (error) {
            setAssignError(error.response?.data?.message || error.message || t('callcenter.autoAssignFailed', 'Auto-assignment failed.'));
        } finally {
            setAssignmentLoading(false);
        }
    };

    const refresh = () => {
        fetchAnalytics();
        fetchOperations();
        if (activeTab === 'analytics') fetchDeepAnalytics(analyticsDays);
        if (activeTab === 'supervisor') fetchSupervisorQueue();
    };

    // handleBulkAction removed — currently unused

    const KPICard = ({ title, value, icon, colorClass, suffix = '' }) => {
        const Icon = icon;
        return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                    <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
                </div>
            </div>
            <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">{value}{suffix}</h3>
            </div>
        </div>
        );
    };

    const maxWorkload = ops?.agentWorkload?.length ? Math.max(...ops.agentWorkload.map(a => a.count)) : 1;

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        {t('callcenter.manager_title', 'Call Center Hub')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('callcenter.manager_subtitle', 'Monitor agent performance and distribute workloads.')}</p>
                </div>
                <div className="flex items-center gap-2">
                    {canManage && (
                    <button
                        onClick={triggerAutoAssignment}
                        disabled={assignmentLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50"
                    >
                        {assignmentLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        <span className="hidden sm:inline">{t('callcenter.action.auto_assign', 'Auto-Assign Orders')}</span>
                        <span className="sm:hidden">{t('callcenter.action.auto_assign_short', 'Auto-Assign')}</span>
                    </button>
                    )}
                    <button onClick={refresh} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tab Switch */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
                {[
                    { key: 'operations', label: t('callcenter.tab.operations', 'Operations'), icon: Activity },
                    canManage && { key: 'supervisor', label: t('callcenter.tab.supervisor', 'Review Queue'), icon: ShieldAlert, badge: supervisorQueue?.counts?.total },
                    canViewReports && { key: 'analytics', label: t('callcenter.tab.analytics', 'Analytics'), icon: BarChart3 },
                    canManageRules && { key: 'rules', label: t('callcenter.tab.rules', 'Assignment Rules'), icon: Settings }
                ].filter(Boolean).map(({ key, label, icon, badge }) => {
                    const Icon = icon;
                    return (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === key ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                        {badge > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">{badge}</span>
                        )}
                    </button>
                    );
                })}
            </div>

            {/* Auto-assign feedback banners */}
            {assignSuccess && (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-300 animate-in fade-in">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{assignSuccess}</span>
                    <button onClick={() => setAssignSuccess(null)} className="text-emerald-500 hover:text-emerald-700"><X className="w-4 h-4" /></button>
                </div>
            )}
            {assignError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-700 dark:text-rose-300 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{assignError}</span>
                    <button onClick={() => setAssignError(null)} className="text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
                </div>
            )}

            {activeTab === 'operations' && (<>
            {/* Queue Alerts */}
            {ops && (ops.queueDepth > 50 || ops.queueAge?.over24h > 10 || ops.noAnswerTotal > 30) && (
                <div className="space-y-2 animate-in fade-in">
                    {ops.queueDepth > 50 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-300 font-medium">
                            <Bell className="w-4 h-4 shrink-0 text-amber-500" />
                            <span>{t('callcenter.alert.queueHigh', 'Queue depth is {{count}} orders — consider adding agents or auto-assigning.', { count: ops.queueDepth })}</span>
                        </div>
                    )}
                    {ops.queueAge?.over24h > 10 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300 font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                            <span>{t('callcenter.alert.staleOrders', '{{count}} orders have been waiting over 24 hours without resolution.', { count: ops.queueAge.over24h })}</span>
                        </div>
                    )}
                    {ops.noAnswerTotal > 30 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-700 dark:text-orange-300 font-medium">
                            <PhoneCall className="w-4 h-4 shrink-0 text-orange-500" />
                            <span>{t('callcenter.alert.noAnswer', '{{count}} orders stuck in No Answer status. Follow-up job runs every 2 hours.', { count: ops.noAnswerTotal })}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Operations Dashboard */}
            {ops && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                        <BarChart3 className="w-4 h-4 text-blue-600" />
                        {t('callcenter.ops.title', 'Live Operations')}
                    </h3>

                    {/* Row 1: Key Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {[
                            { bg: 'bg-amber-50 border-amber-100', icon: Inbox, iconColor: 'text-amber-500', labelColor: 'text-amber-700', value: ops.queueDepth, label: t('callcenter.ops.queueDepth', 'Queue Depth') },
                            { bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle, iconColor: 'text-emerald-500', labelColor: 'text-emerald-700', value: ops.confirmedToday, label: t('callcenter.ops.confirmedToday', 'Confirmed Today') },
                            { bg: 'bg-red-50 border-red-100', icon: XCircle, iconColor: 'text-red-500', labelColor: 'text-red-700', value: ops.cancelledToday, label: t('callcenter.ops.cancelledToday', 'Cancelled Today') },
                            { bg: 'bg-blue-50 border-blue-100', icon: Clock, iconColor: 'text-blue-500', labelColor: 'text-blue-700', value: ops.postponedWaiting, label: t('callcenter.ops.postponed', 'Postponed') },
                            { bg: 'bg-purple-50 border-purple-100', icon: Timer, iconColor: 'text-purple-500', labelColor: 'text-purple-700', value: formatMs(ops.avgTimeToConfirmMs), label: t('callcenter.ops.avgConfirmTime', 'Avg Confirm Time') },
                        ].map((m, i) => (
                            <div key={i} className={`${m.bg} border rounded-xl p-3 text-center`}>
                                <m.icon className={`w-4 h-4 ${m.iconColor} mx-auto mb-1`} />
                                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{m.value}</p>
                                <p className={`text-[10px] font-semibold ${m.labelColor} uppercase`}>{m.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Row 2: Queue Age + Workload */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Queue Age */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-xl p-4">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 text-xs uppercase mb-3">{t('callcenter.ops.queueAge', 'Queue Aging')}</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {[
                                    { label: '>1h', val: ops.queueAge?.over1h || 0, color: 'text-gray-600' },
                                    { label: '>4h', val: ops.queueAge?.over4h || 0, color: 'text-amber-600' },
                                    { label: '>12h', val: ops.queueAge?.over12h || 0, color: 'text-orange-600' },
                                    { label: '>24h', val: ops.queueAge?.over24h || 0, color: 'text-red-600' },
                                ].map(a => (
                                    <div key={a.label} className="text-center">
                                        <p className={`text-xl font-black ${a.color}`}>{a.val}</p>
                                        <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">{a.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Agent Workload */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-xl p-4">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 text-xs uppercase mb-3">{t('callcenter.ops.agentWorkload', 'Agent Workload')}</h4>
                            {ops.agentWorkload?.length > 0 ? (
                                <div className="space-y-2">
                                    {ops.agentWorkload.map(a => (
                                        <div key={a.agentId} className="flex items-center gap-2 sm:gap-3">
                                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-16 sm:w-24 truncate">{a.name}</span>
                                            <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                                    style={{ width: `${Math.round((a.count / maxWorkload) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-black text-gray-900 dark:text-white w-8 text-right">{a.count}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">{t('callcenter.ops.noWorkload', 'No active assignments')}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Global KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title={t('callcenter.kpi.global_calls', 'Global Calls Made')} value={stats.totalCalls} icon={PhoneCall} colorClass="bg-blue-500" />
                <KPICard title={t('callcenter.kpi.avg_confirm', 'Avg. Confirm Rate')} value={stats.averageConfirmRate} suffix="%" icon={CheckCircle} colorClass="bg-indigo-500" />
                <KPICard title={t('callcenter.kpi.avg_delivery', 'Avg. Delivery Success')} value={stats.averageDeliveryRate} suffix="%" icon={PackageCheck} colorClass="bg-emerald-500" />
                <KPICard title={t('callcenter.kpi.total_commissions', 'Accrued Commissions')} value={stats.totalCommissions.toLocaleString()} suffix=" DZD" icon={DollarSign} colorClass="bg-amber-500" />
            </div>

            {/* Leaderboard */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-gray-50/50 dark:bg-gray-800/50">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
                        <Users className="w-5 h-5 text-indigo-600 shrink-0" />
                        {t('callcenter.leaderboard.title', 'Agent Performance Leaderboard')}
                    </h3>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 self-start sm:self-auto">
                        {[
                            { key: 'today', label: t('callcenter.period.today', 'Today') },
                            { key: '7d', label: t('callcenter.period.7d', '7 Days') },
                            { key: '30d', label: t('callcenter.period.30d', '30 Days') },
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setPeriod(key)}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${period === key ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="cf-table">
                        <thead>
                            <tr>
                                <th>{t('callcenter.leaderboard.agent', 'Agent')}</th>
                                <th>{t('callcenter.leaderboard.assigned', 'Assigned')}</th>
                                <th>{t('callcenter.leaderboard.calls', 'Calls')}</th>
                                <th>{t('callcenter.leaderboard.confirmed', 'Confirm %')}</th>
                                <th>{t('callcenter.leaderboard.cancelRate', 'Cancel %')}</th>
                                <th>{t('callcenter.leaderboard.returnRate', 'Return %')}</th>
                                <th>{t('callcenter.leaderboard.delivered', 'Delivered')}</th>
                                <th className="text-right">{t('callcenter.leaderboard.commission', 'Commission')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        {t('general.no_data', 'No data available.')}
                                    </td>
                                </tr>
                            )}
                            {leaderboard.map((agent) => {
                                const cancelColor = agent.cancellationRate > 30 ? 'text-red-600 bg-red-50' : agent.cancellationRate > 15 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50';
                                return (
                                    <tr key={agent.agentId} onClick={() => setSelectedAgentForModal(agent.agentId)} className="cursor-pointer group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                                                    {agent.name.charAt(0)}
                                                </div>
                                                <span className="font-semibold text-gray-900 dark:text-white">{agent.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">{agent.totalAssigned}</td>
                                        <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">{agent.totalCalls}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 dark:text-white">{agent.confirmedRate}%</span>
                                                <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${agent.confirmedRate > 70 ? 'bg-emerald-500' : agent.confirmedRate > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: `${agent.confirmedRate}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cancelColor}`}>
                                                {agent.cancellationRate ?? 0}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${(agent.returnRate ?? 0) > 20 ? 'text-red-600 bg-red-50' : (agent.returnRate ?? 0) > 10 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                                {agent.returnRate ?? 0}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">
                                            {agent.totalDelivered}
                                            <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">
                                                ({agent.totalAssigned > 0 ? ((agent.totalDelivered / agent.totalAssigned) * 100).toFixed(0) : 0}%)
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-right">{agent.commissionEarned?.toLocaleString()} {t('common.dzd', 'DZD')}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            </>)}

            {/* ─── SUPERVISOR REVIEW QUEUE TAB ─── */}
            {activeTab === 'supervisor' && (
                <SupervisorQueueView
                    data={supervisorQueue}
                    loading={supervisorLoading}
                    t={t}
                    onRefresh={fetchSupervisorQueue}
                />
            )}

            {/* ─── ANALYTICS TAB ─── */}
            {activeTab === 'analytics' && (
                <AnalyticsView
                    data={analyticsData}
                    loading={analyticsLoading}
                    days={analyticsDays}
                    setDays={setAnalyticsDays}
                    t={t}
                />
            )}

            {/* ─── ASSIGNMENT RULES TAB ─── */}
            {activeTab === 'rules' && canManageRules && (
                <AssignmentRulesView t={t} />
            )}

            {/* Agent Performance Drill-down Modal */}
            {selectedAgentForModal && (
                <AgentPerformanceModal 
                    agentId={selectedAgentForModal}
                    onClose={() => setSelectedAgentForModal(null)}
                />
            )}
        </div>
    );
}

// ─── Supervisor Queue View ─────────────────────────────────────────
function SupervisorQueueView({ data, loading, t }) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!data || data.counts?.total === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-12 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="font-bold text-gray-500 dark:text-gray-400">{t('callcenter.supervisor.allClear', 'All clear — no orders need supervisor attention.')}</p>
            </div>
        );
    }

    const sections = [
        { key: 'escalated', title: t('callcenter.supervisor.escalated', 'Escalated (3+ Failed Calls)'), items: data.escalated, color: 'border-red-200 bg-red-50', icon: AlertTriangle, iconColor: 'text-red-500' },
        { key: 'overdueCallbacks', title: t('callcenter.supervisor.overdue', 'Overdue Callbacks (24h+)'), items: data.overdueCallbacks, color: 'border-amber-200 bg-amber-50', icon: Clock, iconColor: 'text-amber-500' },
        { key: 'blacklistedOrders', title: t('callcenter.supervisor.blacklisted', 'Blacklisted Customer Orders'), items: data.blacklistedOrders, color: 'border-gray-300 bg-gray-50', icon: ShieldAlert, iconColor: 'text-gray-600' },
        { key: 'highValueStuck', title: t('callcenter.supervisor.highValue', 'High-Value No Answer (10,000+ DZD)'), items: data.highValueStuck, color: 'border-purple-200 bg-purple-50', icon: DollarSign, iconColor: 'text-purple-500' },
    ];

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sections.map(s => (
                    <div key={s.key} className={`rounded-xl border p-4 text-center ${s.color}`}>
                        <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.iconColor}`} />
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{s.items?.length || 0}</p>
                        <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase">{s.key.replace(/([A-Z])/g, ' $1')}</p>
                    </div>
                ))}
            </div>

            {/* Detail Sections */}
            {sections.map(s => s.items?.length > 0 && (
                <div key={s.key} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className={`px-5 py-3 border-b flex items-center gap-2 ${s.color}`}>
                        <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{s.title}</h3>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">{s.items.length}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="cf-table">
                            <thead>
                                <tr>
                                    <th>{t('callcenter.supervisor.orderId', 'Order')}</th>
                                    <th>{t('callcenter.supervisor.customer', 'Customer')}</th>
                                    <th>{t('callcenter.supervisor.wilaya', 'Wilaya')}</th>
                                    <th>{t('callcenter.supervisor.amount', 'Amount')}</th>
                                    <th>{t('callcenter.supervisor.status', 'Status')}</th>
                                    <th>{t('callcenter.supervisor.agent', 'Assigned To')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {s.items.map(order => (
                                    <tr key={order._id}>
                                        <td className="px-5 py-2.5 font-mono text-xs font-bold text-indigo-600">{order.orderId || order._id?.slice(-6)}</td>
                                        <td className="px-5 py-2.5">
                                            <div>
                                                <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs">{order.customer?.name || '—'}</p>
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500">{order.customer?.phone || ''}</p>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5 text-xs text-gray-600 dark:text-gray-400">{order.wilaya || '—'}</td>
                                        <td className="px-5 py-2.5 text-xs font-bold text-gray-900 dark:text-white">{(order.totalAmount || 0).toLocaleString()} DZD</td>
                                        <td className="px-5 py-2.5">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{order.status}</span>
                                        </td>
                                        <td className="px-5 py-2.5 text-xs text-gray-600 dark:text-gray-400">{order.assignedAgent?.name || t('callcenter.supervisor.unassigned', 'Unassigned')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Heatmap Cell Color ────────────────────────────────────────────
function heatColor(value, max) {
    if (!max || !value) return 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500';
    const ratio = value / max;
    if (ratio > 0.75) return 'bg-indigo-600 text-white';
    if (ratio > 0.5) return 'bg-indigo-400 text-white';
    if (ratio > 0.25) return 'bg-indigo-200 text-indigo-800';
    return 'bg-indigo-50 text-indigo-600';
}

// ─── Funnel Bar ────────────────────────────────────────────────────
function FunnelBar({ label, value, total, color }) {
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
    const width = total > 0 ? Math.max((value / total) * 100, 2) : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-24 text-right">{label}</span>
            <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
                <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${width}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700 dark:text-gray-300">
                    {value.toLocaleString()} ({pct}%)
                </span>
            </div>
        </div>
    );
}

// ─── Analytics View Component ──────────────────────────────────────
function AnalyticsView({ data, loading, days, setDays, t }) {
    const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heatmapData = data?.heatmap;

    const heatmapMax = useMemo(() => {
        if (!heatmapData) return 1;
        return Math.max(1, ...heatmapData.flat());
    }, [heatmapData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-20 text-gray-400 dark:text-gray-500 text-sm">
                {t('callcenter.analytics.noData', 'No analytics data available.')}
            </div>
        );
    }

    const { funnel, wilayaBreakdown, agentRankings, dailyTrend, heatmap } = data;

    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('callcenter.analytics.period', 'Period')}:</span>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    {[
                        { d: 7, label: '7d' },
                        { d: 14, label: '14d' },
                        { d: 30, label: '30d' },
                        { d: 90, label: '90d' },
                    ].map(({ d, label }) => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${days === d ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Row 1: Funnel + Daily Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Confirmation Funnel */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-3">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        {t('callcenter.analytics.funnel', 'Confirmation Funnel')}
                    </h3>
                    <div className="space-y-2">
                        <FunnelBar label={t('callcenter.analytics.total', 'Total Orders')} value={funnel.total} total={funnel.total} color="bg-gray-400" />
                        <FunnelBar label={t('callcenter.analytics.contacted', 'Contacted')} value={funnel.contacted} total={funnel.total} color="bg-blue-400" />
                        <FunnelBar label={t('callcenter.analytics.confirmed', 'Confirmed')} value={funnel.confirmed} total={funnel.total} color="bg-indigo-500" />
                        <FunnelBar label={t('callcenter.analytics.dispatched', 'Dispatched')} value={funnel.dispatched} total={funnel.total} color="bg-purple-500" />
                        <FunnelBar label={t('callcenter.analytics.delivered', 'Delivered')} value={funnel.delivered} total={funnel.total} color="bg-emerald-500" />
                        <FunnelBar label={t('callcenter.analytics.cancelled', 'Cancelled')} value={funnel.cancelled} total={funnel.total} color="bg-red-400" />
                        <FunnelBar label={t('callcenter.analytics.refused', 'Refused')} value={funnel.refused} total={funnel.total} color="bg-amber-400" />
                    </div>
                </div>

                {/* Daily Trend */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-3">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        {t('callcenter.analytics.dailyTrend', 'Daily Call Activity')}
                    </h3>
                    {dailyTrend?.length > 0 ? (
                        <div className="space-y-1.5 max-h-72 overflow-y-auto">
                            {dailyTrend.map(day => {
                                const maxCalls = Math.max(1, ...dailyTrend.map(d => d.totalCalls));
                                return (
                                    <div key={day._id} className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 w-20 shrink-0">{day._id}</span>
                                        <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
                                            <div
                                                className="h-full bg-blue-400 rounded-full"
                                                style={{ width: `${(day.totalCalls / maxCalls) * 100}%` }}
                                            />
                                            <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                                {day.totalCalls} calls · {day.confirmed} confirmed · {day.noAnswer} NA
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">{t('general.no_data', 'No data available.')}</p>
                    )}
                </div>
            </div>

            {/* Row 2: Heatmap */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-amber-600" />
                    {t('callcenter.analytics.heatmap', 'Call Activity Heatmap (Hour × Day)')}
                </h3>
                <div className="overflow-x-auto -mx-2 px-2">
                    <table className="text-[10px]" style={{ minWidth: '600px', width: '100%' }}>
                        <thead>
                            <tr>
                                <th className="w-10 sm:w-12" />
                                {Array.from({ length: 24 }, (_, i) => (
                                    <th key={i} className="px-0.5 py-1 text-gray-400 dark:text-gray-500 font-medium text-center">{i}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {heatmap?.map((row, dow) => (
                                <tr key={dow}>
                                    <td className="font-semibold text-gray-600 dark:text-gray-400 pe-2 text-end whitespace-nowrap">{DOW_LABELS[dow]}</td>
                                    {row.map((val, hour) => (
                                        <td key={hour} className="px-0.5 py-0.5">
                                            <div
                                                className={`w-full aspect-square rounded-sm flex items-center justify-center font-bold ${heatColor(val, heatmapMax)}`}
                                                title={`${DOW_LABELS[dow]} ${hour}:00 — ${val} calls`}
                                            >
                                                {val > 0 ? val : ''}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Row 3: Wilaya Breakdown + Agent Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Wilaya Breakdown */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-3">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        {t('callcenter.analytics.wilaya', 'Wilaya Performance')}
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="cf-table">
                            <thead>
                                <tr>
                                    <th>{t('callcenter.analytics.wilayaName', 'Wilaya')}</th>
                                    <th className="text-center">{t('callcenter.analytics.orders', 'Orders')}</th>
                                    <th className="text-center">{t('callcenter.analytics.answerRate', 'Answer %')}</th>
                                    <th className="text-center">{t('callcenter.analytics.confirmRate', 'Confirm %')}</th>
                                    <th className="text-center">{t('callcenter.analytics.refuseRate', 'Refused')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {wilayaBreakdown?.map(w => (
                                    <tr key={w._id}>
                                        <td className="py-1.5 font-semibold text-gray-800 dark:text-gray-200">{w._id || '—'}</td>
                                        <td className="py-1.5 text-center text-gray-600 dark:text-gray-400">{w.total}</td>
                                        <td className="py-1.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded-full font-bold ${w.answerRate >= 80 ? 'text-emerald-700 bg-emerald-50' : w.answerRate >= 50 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'}`}>
                                                {w.answerRate}%
                                            </span>
                                        </td>
                                        <td className="py-1.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded-full font-bold ${w.confirmRate >= 60 ? 'text-emerald-700 bg-emerald-50' : w.confirmRate >= 30 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'}`}>
                                                {w.confirmRate}%
                                            </span>
                                        </td>
                                        <td className="py-1.5 text-center text-gray-500 dark:text-gray-400">{w.refused}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Agent Rankings */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-indigo-600" />
                        {t('callcenter.analytics.agentRankings', 'Agent Rankings')}
                    </h3>

                    {/* Best Agents */}
                    <div>
                        <h4 className="text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {t('callcenter.analytics.bestAgents', 'Top Performers')}
                        </h4>
                        <div className="space-y-1.5">
                            {agentRankings?.best?.map((a, i) => (
                                <div key={a.agentId} className="flex items-center gap-2 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                    <span className="font-semibold text-gray-800 dark:text-gray-200 flex-1 truncate">{a.name}</span>
                                    <span className="font-bold text-emerald-600">{a.confirmRate}%</span>
                                    <span className="text-gray-400 dark:text-gray-500">{a.total} orders</span>
                                </div>
                            ))}
                            {(!agentRankings?.best?.length) && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">{t('callcenter.analytics.notEnoughData', 'Not enough data (min 5 orders)')}</p>
                            )}
                        </div>
                    </div>

                    {/* Worst Agents */}
                    <div>
                        <h4 className="text-[10px] font-bold text-red-600 uppercase mb-2 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
                            {t('callcenter.analytics.worstAgents', 'Needs Improvement')}
                        </h4>
                        <div className="space-y-1.5">
                            {agentRankings?.worst?.map((a, i) => (
                                <div key={a.agentId} className="flex items-center gap-2 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                    <span className="font-semibold text-gray-800 dark:text-gray-200 flex-1 truncate">{a.name}</span>
                                    <span className="font-bold text-red-600">{a.confirmRate}%</span>
                                    <span className="text-gray-400 dark:text-gray-500 text-[10px]">cancel: {a.cancelRate}%</span>
                                </div>
                            ))}
                            {(!agentRankings?.worst?.length) && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">{t('callcenter.analytics.notEnoughData', 'Not enough data (min 5 orders)')}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Assignment Rules View ────────────────────────────────────────
function AssignmentRulesView({ t }) {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ type: 'product', sourceId: '', agent: '' });
    const [products, setProducts] = useState([]);
    const [agents, setAgents] = useState([]);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/call-center/assignment-rules');
            const json = await res.json();
            setRules((json.data ?? json) || []);
        } catch {
            setRules([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const [prodRes, usersRes] = await Promise.all([
                apiFetch('/api/inventory/products'),
                apiFetch('/api/call-center/agents'),
            ]);
            const prodJson = await prodRes.json();
            const usersJson = await usersRes.json();
            setProducts((prodJson.data ?? prodJson)?.products || prodJson.data || []);
            setAgents((usersJson.data ?? usersJson) || []);
        } catch { /* ignore */ }
    };

    useEffect(() => {
        fetchRules();
        fetchOptions();
    }, []);

    const handleCreate = async () => {
        if (!form.sourceId || !form.agent) {
            toast.error(t('callcenter.rules.fillAll', 'Please fill all fields'));
            return;
        }
        setSaving(true);
        try {
            const res = await apiFetch('/api/call-center/assignment-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${res.status}`);
            }
            toast.success(t('callcenter.rules.created', 'Rule created'));
            setShowForm(false);
            setForm({ type: 'product', sourceId: '', agent: '' });
            fetchRules();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (rule) => {
        try {
            const res = await apiFetch(`/api/call-center/assignment-rules/${rule._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !rule.isActive }),
            });
            if (!res.ok) throw new Error('Failed');
            fetchRules();
        } catch {
            toast.error(t('callcenter.rules.toggleFailed', 'Failed to toggle rule'));
        }
    };

    const handleDelete = async (ruleId) => {
        try {
            const res = await apiFetch(`/api/call-center/assignment-rules/${ruleId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
            toast.success(t('callcenter.rules.deleted', 'Rule deleted'));
            fetchRules();
        } catch {
            toast.error(t('callcenter.rules.deleteFailed', 'Failed to delete rule'));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
                            <Settings className="w-4 h-4 text-indigo-600" />
                            {t('callcenter.rules.title', 'Assignment Rules')}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('callcenter.rules.desc', 'Map products or stores to specific agents. Priority: Manual > Product > Store > Round-Robin.')}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold text-xs"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {t('callcenter.rules.add', 'Add Rule')}
                    </button>
                </div>

                {/* Create Form */}
                {showForm && (
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                    {t('callcenter.rules.type', 'Type')}
                                </label>
                                <select
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value, sourceId: '' })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                >
                                    <option value="product">{t('callcenter.rules.typeProduct', 'Product')}</option>
                                    <option value="store">{t('callcenter.rules.typeStore', 'Store / Sales Channel')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                    {form.type === 'product' ? t('callcenter.rules.product', 'Product') : t('callcenter.rules.store', 'Store')}
                                </label>
                                <select
                                    value={form.sourceId}
                                    onChange={e => setForm({ ...form, sourceId: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                >
                                    <option value="">{t('callcenter.rules.select', '-- Select --')}</option>
                                    {form.type === 'product' && products.map(p => (
                                        <option key={p._id} value={p._id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                    {t('callcenter.rules.agent', 'Assign To Agent')}
                                </label>
                                <select
                                    value={form.agent}
                                    onChange={e => setForm({ ...form, agent: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                >
                                    <option value="">{t('callcenter.rules.select', '-- Select --')}</option>
                                    {agents.map(a => (
                                        <option key={a._id} value={a._id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                            <button
                                onClick={() => { setShowForm(false); setForm({ type: 'product', sourceId: '', agent: '' }); }}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={saving}
                                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {saving ? t('common.saving', 'Saving...') : t('callcenter.rules.save', 'Save Rule')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Rules Table */}
                {rules.length === 0 ? (
                    <div className="text-center py-12">
                        <Inbox className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            {t('callcenter.rules.empty', 'No assignment rules yet. Orders will use round-robin by default.')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="cf-table">
                            <thead>
                                <tr>
                                    <th>{t('callcenter.rules.type', 'Type')}</th>
                                    <th>{t('callcenter.rules.source', 'Source')}</th>
                                    <th>{t('callcenter.rules.agent', 'Agent')}</th>
                                    <th>{t('callcenter.rules.status', 'Status')}</th>
                                    <th className="text-end">{t('callcenter.rules.actions', 'Actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rules.map(rule => (
                                    <tr key={rule._id}>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                rule.type === 'product'
                                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                    : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                                            }`}>
                                                {rule.type === 'product' ? t('callcenter.rules.typeProduct', 'Product') : t('callcenter.rules.typeStore', 'Store')}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {rule.sourceName || (typeof rule.sourceId === 'object' ? rule.sourceId?.name : rule.sourceId) || '—'}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300">
                                            {rule.agentName || (typeof rule.agent === 'object' ? rule.agent?.name : rule.agent) || '—'}
                                        </td>
                                        <td className="px-5 py-3">
                                            <button onClick={() => handleToggle(rule)} className="focus:outline-none">
                                                {rule.isActive ? (
                                                    <ToggleRight className="w-6 h-6 text-emerald-500" />
                                                ) : (
                                                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 text-end">
                                            <button
                                                onClick={() => handleDelete(rule._id)}
                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title={t('common.delete', 'Delete')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Priority Explanation */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4">
                <h4 className="font-bold text-indigo-800 dark:text-indigo-300 text-xs mb-2">
                    {t('callcenter.rules.priorityTitle', 'Assignment Priority Order')}
                </h4>
                <div className="flex flex-wrap gap-2">
                    {[
                        { n: '1', label: t('callcenter.rules.p1', 'Manual (manager sets agent)'), cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
                        { n: '2', label: t('callcenter.rules.p2', 'Product Rule'), cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
                        { n: '3', label: t('callcenter.rules.p3', 'Store Rule'), cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
                        { n: '4', label: t('callcenter.rules.p4', 'Round-Robin (default)'), cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
                    ].map(p => (
                        <span key={p.n} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${p.cls}`}>
                            <span className="w-4 h-4 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center text-[10px] font-black">{p.n}</span>
                            {p.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
