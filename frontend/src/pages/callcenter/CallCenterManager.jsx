import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Users, PhoneCall, CheckCircle, PackageCheck,
    RefreshCw, Zap, DollarSign, AlertTriangle, X,
    Clock, XCircle, Inbox, Timer, BarChart3, Bell,
    TrendingUp, TrendingDown, MapPin, Activity,
    ShieldAlert, Undo2
} from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import AgentPerformanceModal from '../../components/callcenter/AgentPerformanceModal';

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
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assignmentLoading, setAssignmentLoading] = useState(false);
    const [period, setPeriod] = useState('today');
    const [assignError, setAssignError] = useState(null);
    const [assignSuccess, setAssignSuccess] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
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
        } catch (error) {
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
    }, [period]);

    useEffect(() => {
        if (activeTab === 'analytics') fetchDeepAnalytics(analyticsDays);
        if (activeTab === 'supervisor') fetchSupervisorQueue();
    }, [activeTab, analyticsDays]);

    const triggerAutoAssignment = async () => {
        setAssignmentLoading(true);
        setAssignError(null);
        setAssignSuccess(null);
        try {
            const res = await apiFetch(`/api/call-center/assign-orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'Auto_RoundRobin' })
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

    const handleBulkAction = async (action, targetAgentId) => {
        setBulkLoading(true);
        setAssignError(null);
        setAssignSuccess(null);
        try {
            // First get unassigned orders
            const res = await apiFetch('/api/call-center/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: [], action, targetAgentId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Bulk action failed');
            setAssignSuccess(`Bulk ${action}: ${data.data?.modifiedCount || 0} orders updated.`);
            refresh();
        } catch (err) {
            setAssignError(err.message);
        } finally {
            setBulkLoading(false);
        }
    };

    const KPICard = ({ title, value, icon: Icon, colorClass, suffix = '' }) => (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                    <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
                </div>
            </div>
            <div>
                <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-2xl font-black text-gray-900">{value}{suffix}</h3>
            </div>
        </div>
    );

    const maxWorkload = ops?.agentWorkload?.length ? Math.max(...ops.agentWorkload.map(a => a.count)) : 1;

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        {t('callcenter.manager_title', 'Call Center Hub')}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">{t('callcenter.manager_subtitle', 'Monitor agent performance and distribute workloads.')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={triggerAutoAssignment}
                        disabled={assignmentLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50"
                    >
                        {assignmentLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        <span className="hidden sm:inline">{t('callcenter.action.auto_assign', 'Auto-Assign Orders')}</span>
                        <span className="sm:hidden">{t('callcenter.action.auto_assign_short', 'Auto-Assign')}</span>
                    </button>
                    <button onClick={refresh} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tab Switch */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
                {[
                    { key: 'operations', label: t('callcenter.tab.operations', 'Operations'), icon: Activity },
                    { key: 'supervisor', label: t('callcenter.tab.supervisor', 'Review Queue'), icon: ShieldAlert, badge: supervisorQueue?.counts?.total },
                    { key: 'analytics', label: t('callcenter.tab.analytics', 'Analytics'), icon: BarChart3 }
                ].map(({ key, label, icon: Icon, badge }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                        {badge > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{badge}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Auto-assign feedback banners */}
            {assignSuccess && (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 animate-in fade-in">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{assignSuccess}</span>
                    <button onClick={() => setAssignSuccess(null)} className="text-emerald-500 hover:text-emerald-700"><X className="w-4 h-4" /></button>
                </div>
            )}
            {assignError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 animate-in fade-in">
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
                        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium">
                            <Bell className="w-4 h-4 shrink-0 text-amber-500" />
                            <span>{t('callcenter.alert.queueHigh', 'Queue depth is {{count}} orders — consider adding agents or auto-assigning.', { count: ops.queueDepth })}</span>
                        </div>
                    )}
                    {ops.queueAge?.over24h > 10 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                            <span>{t('callcenter.alert.staleOrders', '{{count}} orders have been waiting over 24 hours without resolution.', { count: ops.queueAge.over24h })}</span>
                        </div>
                    )}
                    {ops.noAnswerTotal > 30 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700 font-medium">
                            <PhoneCall className="w-4 h-4 shrink-0 text-orange-500" />
                            <span>{t('callcenter.alert.noAnswer', '{{count}} orders stuck in No Answer status. Follow-up job runs every 2 hours.', { count: ops.noAnswerTotal })}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Operations Dashboard */}
            {ops && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
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
                                <p className="text-xl sm:text-2xl font-black text-gray-900">{m.value}</p>
                                <p className={`text-[10px] font-semibold ${m.labelColor} uppercase`}>{m.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Row 2: Queue Age + Workload */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Queue Age */}
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                            <h4 className="font-bold text-gray-700 text-xs uppercase mb-3">{t('callcenter.ops.queueAge', 'Queue Aging')}</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {[
                                    { label: '>1h', val: ops.queueAge?.over1h || 0, color: 'text-gray-600' },
                                    { label: '>4h', val: ops.queueAge?.over4h || 0, color: 'text-amber-600' },
                                    { label: '>12h', val: ops.queueAge?.over12h || 0, color: 'text-orange-600' },
                                    { label: '>24h', val: ops.queueAge?.over24h || 0, color: 'text-red-600' },
                                ].map(a => (
                                    <div key={a.label} className="text-center">
                                        <p className={`text-xl font-black ${a.color}`}>{a.val}</p>
                                        <p className="text-[10px] font-semibold text-gray-500 uppercase">{a.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Agent Workload */}
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                            <h4 className="font-bold text-gray-700 text-xs uppercase mb-3">{t('callcenter.ops.agentWorkload', 'Agent Workload')}</h4>
                            {ops.agentWorkload?.length > 0 ? (
                                <div className="space-y-2">
                                    {ops.agentWorkload.map(a => (
                                        <div key={a.agentId} className="flex items-center gap-2 sm:gap-3">
                                            <span className="text-xs font-semibold text-gray-700 w-16 sm:w-24 truncate">{a.name}</span>
                                            <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                                    style={{ width: `${Math.round((a.count / maxWorkload) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-black text-gray-900 w-8 text-right">{a.count}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 text-center py-2">{t('callcenter.ops.noWorkload', 'No active assignments')}</p>
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-gray-50/50">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                        <Users className="w-5 h-5 text-indigo-600 shrink-0" />
                        {t('callcenter.leaderboard.title', 'Agent Performance Leaderboard')}
                    </h3>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 self-start sm:self-auto">
                        {[
                            { key: 'today', label: t('callcenter.period.today', 'Today') },
                            { key: '7d', label: t('callcenter.period.7d', '7 Days') },
                            { key: '30d', label: t('callcenter.period.30d', '30 Days') },
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setPeriod(key)}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${period === key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
                                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
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
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                                    {agent.name.charAt(0)}
                                                </div>
                                                <span className="font-semibold text-gray-900">{agent.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-700">{agent.totalAssigned}</td>
                                        <td className="px-6 py-4 font-medium text-gray-700">{agent.totalCalls}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900">{agent.confirmedRate}%</span>
                                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
                                        <td className="px-6 py-4 font-medium text-gray-700">
                                            {agent.totalDelivered}
                                            <span className="text-gray-400 text-xs ml-1">
                                                ({agent.totalAssigned > 0 ? ((agent.totalDelivered / agent.totalAssigned) * 100).toFixed(0) : 0}%)
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900 text-right">{agent.commissionEarned?.toLocaleString()} {t('common.dzd', 'DZD')}</td>
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
function SupervisorQueueView({ data, loading, t, onRefresh }) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!data || data.counts?.total === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="font-bold text-gray-500">{t('callcenter.supervisor.allClear', 'All clear — no orders need supervisor attention.')}</p>
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
                        <p className="text-2xl font-black text-gray-900">{s.items?.length || 0}</p>
                        <p className="text-[10px] font-semibold text-gray-600 uppercase">{s.key.replace(/([A-Z])/g, ' $1')}</p>
                    </div>
                ))}
            </div>

            {/* Detail Sections */}
            {sections.map(s => s.items?.length > 0 && (
                <div key={s.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className={`px-5 py-3 border-b flex items-center gap-2 ${s.color}`}>
                        <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                        <h3 className="font-bold text-gray-900 text-sm">{s.title}</h3>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-gray-700">{s.items.length}</span>
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
                                                <p className="font-semibold text-gray-800 text-xs">{order.customer?.name || '—'}</p>
                                                <p className="text-[10px] text-gray-400">{order.customer?.phone || ''}</p>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5 text-xs text-gray-600">{order.wilaya || '—'}</td>
                                        <td className="px-5 py-2.5 text-xs font-bold text-gray-900">{(order.totalAmount || 0).toLocaleString()} DZD</td>
                                        <td className="px-5 py-2.5">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{order.status}</span>
                                        </td>
                                        <td className="px-5 py-2.5 text-xs text-gray-600">{order.assignedAgent?.name || t('callcenter.supervisor.unassigned', 'Unassigned')}</td>
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
    if (!max || !value) return 'bg-gray-100 text-gray-400';
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
            <span className="text-xs font-semibold text-gray-600 w-24 text-right">{label}</span>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${width}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                    {value.toLocaleString()} ({pct}%)
                </span>
            </div>
        </div>
    );
}

// ─── Analytics View Component ──────────────────────────────────────
function AnalyticsView({ data, loading, days, setDays, t }) {
    const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const heatmapMax = useMemo(() => {
        if (!data?.heatmap) return 1;
        return Math.max(1, ...data.heatmap.flat());
    }, [data?.heatmap]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-20 text-gray-400 text-sm">
                {t('callcenter.analytics.noData', 'No analytics data available.')}
            </div>
        );
    }

    const { funnel, wilayaBreakdown, agentRankings, dailyTrend, heatmap } = data;

    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">{t('callcenter.analytics.period', 'Period')}:</span>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    {[
                        { d: 7, label: '7d' },
                        { d: 14, label: '14d' },
                        { d: 30, label: '30d' },
                        { d: 90, label: '90d' },
                    ].map(({ d, label }) => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${days === d ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Row 1: Funnel + Daily Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Confirmation Funnel */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
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
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        {t('callcenter.analytics.dailyTrend', 'Daily Call Activity')}
                    </h3>
                    {dailyTrend?.length > 0 ? (
                        <div className="space-y-1.5 max-h-72 overflow-y-auto">
                            {dailyTrend.map(day => {
                                const maxCalls = Math.max(1, ...dailyTrend.map(d => d.totalCalls));
                                return (
                                    <div key={day._id} className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-gray-500 w-20 shrink-0">{day._id}</span>
                                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                                            <div
                                                className="h-full bg-blue-400 rounded-full"
                                                style={{ width: `${(day.totalCalls / maxCalls) * 100}%` }}
                                            />
                                            <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-gray-700">
                                                {day.totalCalls} calls · {day.confirmed} confirmed · {day.noAnswer} NA
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 text-center py-4">{t('general.no_data', 'No data available.')}</p>
                    )}
                </div>
            </div>

            {/* Row 2: Heatmap */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-amber-600" />
                    {t('callcenter.analytics.heatmap', 'Call Activity Heatmap (Hour × Day)')}
                </h3>
                <div className="overflow-x-auto -mx-2 px-2">
                    <table className="text-[10px]" style={{ minWidth: '600px', width: '100%' }}>
                        <thead>
                            <tr>
                                <th className="w-10 sm:w-12" />
                                {Array.from({ length: 24 }, (_, i) => (
                                    <th key={i} className="px-0.5 py-1 text-gray-400 font-medium text-center">{i}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {heatmap?.map((row, dow) => (
                                <tr key={dow}>
                                    <td className="font-semibold text-gray-600 pe-2 text-end whitespace-nowrap">{DOW_LABELS[dow]}</td>
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
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
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
                                        <td className="py-1.5 font-semibold text-gray-800">{w._id || '—'}</td>
                                        <td className="py-1.5 text-center text-gray-600">{w.total}</td>
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
                                        <td className="py-1.5 text-center text-gray-500">{w.refused}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Agent Rankings */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
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
                                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                    <span className="font-semibold text-gray-800 flex-1 truncate">{a.name}</span>
                                    <span className="font-bold text-emerald-600">{a.confirmRate}%</span>
                                    <span className="text-gray-400">{a.total} orders</span>
                                </div>
                            ))}
                            {(!agentRankings?.best?.length) && (
                                <p className="text-xs text-gray-400">{t('callcenter.analytics.notEnoughData', 'Not enough data (min 5 orders)')}</p>
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
                                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                    <span className="font-semibold text-gray-800 flex-1 truncate">{a.name}</span>
                                    <span className="font-bold text-red-600">{a.confirmRate}%</span>
                                    <span className="text-gray-400 text-[10px]">cancel: {a.cancelRate}%</span>
                                </div>
                            ))}
                            {(!agentRankings?.worst?.length) && (
                                <p className="text-xs text-gray-400">{t('callcenter.analytics.notEnoughData', 'Not enough data (min 5 orders)')}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
