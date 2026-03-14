import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../utils/apiFetch';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Truck, TrendingUp, PackageX, DollarSign, Clock, Map, Settings, Plus, LayoutGrid, CheckCircle, XCircle, Search, AlertTriangle } from 'lucide-react';
import { useHotkey } from '../hooks/useHotkey';
import PageHeader from '../components/PageHeader';
import PhoneChip from '../components/PhoneChip';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';

export default function Couriers() {
    const { t } = useTranslation();
    const { hasPermission } = React.useContext(AuthContext);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [couriers, setCouriers] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'analytics'
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    const [stats, setStats] = useState({
        kpis: { totalShipments: 0, delivered: 0, returned: 0, inTransit: 0, successRate: 0, returnRate: 0, avgDeliveryTimeDays: 0 },
        financials: { totalDeliveredCOD: 0, pendingCourierClearance: 0, settledToBank: 0, uncollectedFromCustomer: 0 }
    });
    const [regionalData, setRegionalData] = useState([]);

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchData = async () => {
        try {
            const [kpiRes, regionRes, couriersRes] = await Promise.all([
                apiFetch(`/api/couriers/analytics/kpis?dateRange=30`),
                apiFetch(`/api/couriers/analytics/regions?dateRange=30`),
                apiFetch(`/api/couriers`)
            ]);
            const kpiData = await kpiRes.json();
            const regionData = await regionRes.json();
            const couriersData = await couriersRes.json();
            if (!kpiRes.ok) throw { response: { data: kpiData } };
            setStats(kpiData);
            setRegionalData(regionData);
            setCouriers(couriersData);
        } catch (error) {
            setFetchError(error.response?.data?.message || error.message || t('couriers.errorLoadData', 'Failed to load courier data.'));
        } finally {
            setLoading(false);
        }
    };

    const filteredCouriers = useMemo(() => couriers.filter(c => {
        if (filterStatus !== 'All' && c.status !== filterStatus) return false;
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            if (!c.name?.toLowerCase().includes(q) && !c.phone?.toLowerCase().includes(q)) return false;
        }
        return true;
    }), [couriers, filterStatus, searchTerm]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 dark:text-gray-500">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 dark:border-gray-600 border-t-indigo-600 animate-spin" />
                <span className="text-sm font-medium">{t('common.loading', 'Loading...')}</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('couriers.dashboardTitle', 'Fleet & Courier Operations')}
                subtitle={t('couriers.dashboardSubtitle', 'Manage logistics partners and monitor unified fleet performance.')}
                variant="sales"
                actions={
                    <div className="flex gap-3">
                        <button
                            onClick={() => setViewMode(viewMode === 'list' ? 'analytics' : 'list')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium rounded-xl border border-gray-200 dark:border-gray-600 transition-all shadow-sm active:scale-95 leading-none"
                        >
                            {viewMode === 'list' ? <TrendingUp className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                            {viewMode === 'list' ? t('couriers.viewAnalytics', 'Performance Metrics') : t('couriers.viewList', 'Couriers List')}
                        </button>
                        {hasPermission('couriers.create') && (
                            <button
                                onClick={() => navigate('/couriers/new')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20 active:scale-95 leading-none"
                            >
                                <Plus className="w-5 h-5" /> {t('couriers.addCourier', 'Add Courier')}
                            </button>
                        )}
                    </div>
                }
            />

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
                </div>
            )}

            {viewMode === 'analytics' ? (
                <>
                    {/* Top KPI Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-white dark:bg-gray-800 p-3 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 sm:gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 truncate">{t('couriers.successRate', 'Delivery Success Rate')}</p>
                                <h3 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tighter truncate">{stats.kpis.successRate}%</h3>
                                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 font-medium truncate hidden sm:block">
                                    {stats.kpis.delivered} {t('couriers.delivered_out_of', 'Delivered out of')} {stats.kpis.totalShipments} {t('couriers.total_lowercase', 'Total')}
                                </p>
                            </div>
                            <div className="h-10 w-10 sm:h-16 sm:w-16 bg-green-50 dark:bg-green-900/20 rounded-xl sm:rounded-2xl flex items-center justify-center border border-green-100 dark:border-green-800 shrink-0">
                                <TrendingUp className="w-5 h-5 sm:w-8 sm:h-8 text-green-600 dark:text-green-400" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-3 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 sm:gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 truncate">{t('couriers.returnRate', 'Return Rate')}</p>
                                <h3 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tighter truncate">{stats.kpis.returnRate}%</h3>
                                <p className="mt-1 text-xs text-red-500 dark:text-red-400 font-medium truncate hidden sm:block">
                                    {t('couriers.packages_failed', 'Packages Failed / Returned')}
                                </p>
                            </div>
                            <div className="h-10 w-10 sm:h-16 sm:w-16 bg-red-50 dark:bg-red-900/20 rounded-xl sm:rounded-2xl flex items-center justify-center border border-red-100 dark:border-red-800 shrink-0">
                                <PackageX className="w-5 h-5 sm:w-8 sm:h-8 text-red-600 dark:text-red-400" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-3 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 sm:gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 truncate">{t('couriers.avgTime', 'Avg Delivery Speed')}</p>
                                <h3 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tighter truncate">{stats.kpis.avgDeliveryTimeDays} <span className="text-xs sm:text-sm font-medium text-gray-400 dark:text-gray-500">{t('couriers.days', 'Days')}</span></h3>
                                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 font-medium truncate hidden sm:block">
                                    {t('couriers.from_verification', 'From Verification to Client Handshake')}
                                </p>
                            </div>
                            <div className="h-10 w-10 sm:h-16 sm:w-16 bg-blue-50 dark:bg-blue-900/20 rounded-xl sm:rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-800 shrink-0">
                                <Clock className="w-5 h-5 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-3 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 sm:gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 truncate">{t('couriers.pendingCash', 'Pending Courier Clearance')}</p>
                                <h3 className="text-lg sm:text-3xl font-black text-gray-900 dark:text-white tracking-tighter truncate">
                                    {stats.financials.pendingCourierClearance.toLocaleString()} <span className="text-xs sm:text-sm font-medium text-gray-400 dark:text-gray-500">{t('common.dzd', 'DZD')}</span>
                                </h3>
                                <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold px-2 py-0.5 sm:py-1 rounded w-fit truncate">
                                    {t('couriers.settled', 'Settled:')} {stats.financials.settledToBank.toLocaleString()}
                                </div>
                            </div>
                            <div className="h-10 w-10 sm:h-16 sm:w-16 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl sm:rounded-2xl flex items-center justify-center border border-yellow-100 dark:border-yellow-800 shrink-0">
                                <DollarSign className="w-5 h-5 sm:w-8 sm:h-8 text-yellow-600 dark:text-yellow-400" />
                            </div>
                        </div>
                    </div>

                    {/* Regional & Pipeline Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 lg:col-span-2 p-5">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                                <Map className="w-5 h-5 mr-2 text-indigo-500 dark:text-indigo-400" />
                                {t('couriers.regional_success', 'Regional Success Distribution')}
                            </h3>
                            <div className="h-80 w-full" dir="ltr">
                                <ResponsiveContainer>
                                    <BarChart data={regionalData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="wilaya" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                        <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="delivered" name={t('couriers.successful', 'Successful')} stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} barSize={32} />
                                        <Bar dataKey="returned" name={t('couriers.failed_return', 'Failed/Return')} stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">{t('couriers.cod_pipeline', 'Live Form COD Pipeline')}</h3>
                            <div className="space-y-6">
                                <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('couriers.total_delivered_value', 'Total Delivered Package Value')}</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stats.financials.totalDeliveredCOD.toLocaleString()} {t('common.dzd', 'DZD')}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">{t('couriers.pending_clearance', 'Pending Clearance')}</span>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.financials.pendingCourierClearance.toLocaleString()} {t('common.dzd', 'DZD')}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${stats.financials.totalDeliveredCOD > 0 ? (stats.financials.pendingCourierClearance / stats.financials.totalDeliveredCOD) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-sm font-medium text-green-700 dark:text-green-400">{t('couriers.settled_to_bank', 'Settled to Bank')}</span>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.financials.settledToBank.toLocaleString()} {t('common.dzd', 'DZD')}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats.financials.totalDeliveredCOD > 0 ? (stats.financials.settledToBank / stats.financials.totalDeliveredCOD) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">{t('couriers.delivered_no_money', 'Delivered, No Money')}</span>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.financials.uncollectedFromCustomer.toLocaleString()} {t('common.dzd', 'DZD')}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${stats.financials.totalDeliveredCOD > 0 ? (stats.financials.uncollectedFromCustomer / stats.financials.totalDeliveredCOD) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {/* Filter bar */}
                    {couriers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-700/30">
                            <div className="relative">
                                <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    placeholder={t('couriers.searchPlaceholder', 'Search couriers... (Press /)')}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all w-40 sm:w-52 shadow-sm font-bold"
                                />
                            </div>
                            <div className="flex gap-1.5">
                                {['All', 'Active', 'Inactive'].map(s => {
                                    const count = s === 'All' ? couriers.length : couriers.filter(c => c.status === s).length;
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => setFilterStatus(s)}
                                            className={clsx(
                                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                                filterStatus === s ? 'bg-purple-600 text-white shadow-sm' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700'
                                            )}
                                        >
                                            {s === 'All' ? t('common.all', 'All') : s === 'Active' ? t('couriers.statusActive', 'Active') : t('couriers.statusInactive', 'Inactive')}
                                            <span className={clsx('text-[10px] font-black px-1 py-0.5 rounded-full leading-none', filterStatus === s ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400')}>{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="overflow-x-auto">
                        <table className="cf-table">
                            <thead>
                                <tr>
                                    <th>{t('couriers.name', 'Courier')}</th>
                                    <th>{t('couriers.integration', 'Mode')}</th>
                                    <th>{t('couriers.deliveries', 'Deliveries')}</th>
                                    <th>{t('couriers.successRate', 'Success Rate')}</th>
                                    <th>{t('couriers.status', 'Status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {couriers.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                            {t('couriers.empty', 'No couriers mapped yet.')}
                                        </td>
                                    </tr>
                                ) : filteredCouriers.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-400 dark:text-gray-500 font-medium">
                                            {t('common.noMatch', 'No couriers match your search.')}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCouriers.map((c) => (
                                        <tr
                                            key={c._id}
                                            onClick={() => navigate(`/couriers/${c._id}`)}
                                            className="cursor-pointer group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shrink-0">
                                                        <Truck className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{c.name}</p>
                                                        <PhoneChip phone={c.phone} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={clsx(
                                                    "inline-flex items-center px-2 py-1 rounded-md text-xs font-bold",
                                                    c.integrationType === 'API' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800" : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                                                )}>
                                                    {c.integrationType === 'API' ? t('couriers.apiConnected', '⚡ API Connected') : t('couriers.manual', 'Manual')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-gray-900 dark:text-white">{c.totalDeliveries?.toLocaleString() || 0}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={clsx("font-bold", (c.successRate || 0) > 80 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400")}>
                                                    {(c.successRate || 0).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {c.status === 'Active' ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800"><CheckCircle className="w-3.5 h-3.5" /> {t('couriers.statusActive', 'Active')}</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-800"><XCircle className="w-3.5 h-3.5" /> {c.status}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
