import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, User, PhoneCall, CheckCircle, XCircle, PackageCheck, DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import useModalDismiss from '../../hooks/useModalDismiss';
import { fmtShortDateTime } from '../../utils/dateUtils';

function StatCard({ label, value, icon, color }) {
    const Icon = icon;
    return (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xl font-black text-gray-900 dark:text-white leading-none mb-1">{value}</p>
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{label}</p>
            </div>
        </div>
    );
}

export default function AgentPerformanceModal({ agentId, onClose }) {
    const { t } = useTranslation();
    const { backdropProps, panelProps } = useModalDismiss(onClose);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!agentId) return;
        const controller = new AbortController();
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await apiFetch(`/api/call-center/agent-performance/${agentId}?period=30d`, { signal: controller.signal });
                if (!res.ok) throw new Error('Failed to load agent performance');
                const json = await res.json();
                if (!controller.signal.aborted) setData(json.data ?? json);
            } catch (err) {
                if (!controller.signal.aborted) setError(err.message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        fetchData();
        return () => controller.abort();
    }, [agentId]);

    if (!agentId) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in" {...backdropProps}>
            <div className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-4xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-4" {...panelProps}>
                {/* Header */}
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full flex items-center justify-center font-black">
                            {data?.agent?.name?.charAt(0) || <User className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{data?.agent?.name || t('common.loading', 'Loading...')}</h2>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t('callcenter.agentDeeper.title', 'Agent Performance Overview (Last 30 Days)')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-20 text-rose-500 font-medium bg-rose-50 dark:bg-rose-900/20 rounded-xl">{error}</div>
                    ) : (data &&
                        <>
                            {/* KPI Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <StatCard label={t('callcenter.leaderboard.assigned', 'Total Assigned')} value={data.stats.totalAssigned} icon={PhoneCall} color="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" />
                                <StatCard label={t('callcenter.leaderboard.confirmed', 'Confirm Rate')} value={`${data.stats.confirmRate}%`} icon={CheckCircle} color="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" />
                                <StatCard label={t('callcenter.leaderboard.returnRate', 'Return Rate')} value={`${data.stats.returnRate}%`} icon={XCircle} color="bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400" />
                                <StatCard label={t('callcenter.leaderboard.delivered', 'Total Delivered')} value={data.stats.totalDelivered} icon={PackageCheck} color="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" />
                            </div>

                            {/* Recent Confirmed Orders List */}
                            <div className="bg-white dark:bg-gray-800 border text-left border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t('callcenter.agentDeeper.recentConfirmed', 'Recent Confirmed Orders')}</h3>
                                </div>
                                <div className="overflow-x-auto max-h-[400px]">
                                    <table className="cf-table">
                                        <thead className="bg-white dark:bg-gray-800 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider sticky top-0 border-b border-gray-100 dark:border-gray-700">
                                            <tr>
                                                <th className="px-5 py-3">{t('datagrid.colOrder')}</th>
                                                <th className="px-5 py-3">{t('datagrid.colCustomer')}</th>
                                                <th className="px-5 py-3">{t('datagrid.colWilaya')}</th>
                                                <th className="px-5 py-3">{t('datagrid.colTotal')}</th>
                                                <th className="px-5 py-3">{t('datagrid.colStatus')}</th>
                                                <th className="px-5 py-3">{t('datagrid.colDate')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                            {data.recentConfirmedOrders?.length === 0 && (
                                                <tr><td colSpan="6" className="py-8 text-center text-gray-400 dark:text-gray-500">{t('general.no_data', 'No confirmed orders found.')}</td></tr>
                                            )}
                                            {data.recentConfirmedOrders?.map(order => (
                                                <tr key={order._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                                                    <td className="px-5 py-3 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{order.orderId || order._id.slice(-6)}</td>
                                                    <td className="px-5 py-3">
                                                        <p className="font-semibold text-gray-900 dark:text-white">{order.customer?.name}</p>
                                                        <p className="text-xs text-gray-400 dark:text-gray-500">{order.customer?.phone}</p>
                                                    </td>
                                                    <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-400">{order.shipping?.wilayaName || '—'}</td>
                                                    <td className="px-5 py-3 font-bold text-gray-900 dark:text-white">{order.totalAmount.toLocaleString()} {t('common.dzd', 'DZD')}</td>
                                                    <td className="px-5 py-3">
                                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                                                            order.status === 'Delivered' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                                            order.status === 'Returned' || order.status === 'Refused' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' :
                                                            'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                                                        }`}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtShortDateTime(order.updatedAt)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
