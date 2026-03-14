import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Calendar, TrendingUp, TrendingDown, Package, ShoppingCart,
    CreditCard, Users, Truck, AlertCircle, RefreshCw, Download,
    MapPin, Megaphone, CheckCircle2, BarChart3, Activity
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import InsightFeed from '../components/InsightFeed';
import { apiFetch } from '../utils/apiFetch';
import clsx from 'clsx';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

// Check dark mode for chart theming
const useIsDark = () => {
    const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
    useEffect(() => {
        const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return dark;
};

export default function EcommerceAnalytics({ hideTitle = false }) {
    const { t } = useTranslation();
    const isDark = useIsDark();
    const [dateRange, setDateRange] = useState('7d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [dashData, setDashData] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [trendLoading, setTrendLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    // Chart theme colors
    const gridColor = isDark ? '#334155' : '#f3f4f6';
    const tickColor = isDark ? '#64748b' : '#6b7280';
    const tooltipBg = isDark ? '#1e293b' : '#ffffff';
    const tooltipBorder = isDark ? '#334155' : '#f3f4f6';
    const tooltipStyle = {
        borderRadius: '12px',
        border: `1px solid ${tooltipBorder}`,
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)',
        backgroundColor: tooltipBg,
        color: isDark ? '#e2e8f0' : '#1f2937',
    };
    const cursorStyle = { stroke: isDark ? '#475569' : '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' };

    const fetchAnalytics = async (signal) => {
        setIsRefreshing(true);
        try {
            const params = dateRange === 'custom' && customStart && customEnd
                ? `startDate=${customStart}&endDate=${customEnd}`
                : `range=${dateRange}`;
            const res = await apiFetch(`/api/analytics/ecommerce?${params}`, { signal });
            if (res.ok) {
                const data = await res.json();
                setDashData(data);
            }
        } catch {
            setFetchError(t('analytics.errorLoadData', 'Failed to load analytics data.'));
        } finally {
            setIsRefreshing(false);
        }
    };

    const fetchTrendData = async (signal) => {
        setTrendLoading(true);
        try {
            const to = new Date().toISOString().slice(0, 10);
            const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const res = await apiFetch(`/api/analytics/daily?from=${from}&to=${to}`, { signal });
            if (res.ok) {
                const json = await res.json();
                setTrendData((json.data?.rollups ?? []).map(d => ({
                    date: d.date.slice(5),
                    revenue: d.revenue.gross,
                    profit: d.revenue.netProfit,
                    orders: d.orders.created,
                    delivered: d.orders.delivered,
                    returned: d.orders.returned,
                    present: d.hr.present,
                    absent: d.hr.absent,
                })));
            }
        } catch {
            setFetchError(t('analytics.errorLoadTrend', 'Failed to load trend data.'));
        } finally {
            setTrendLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchAnalytics(controller.signal);
        return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange]);

    useEffect(() => {
        const controller = new AbortController();
        fetchTrendData(controller.signal);
        return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- KPI Card ---
    const KPICard = ({ title, value, prefix = '', suffix = '', trend, trendValue, icon, gradient }) => {
        const Icon = icon;
        return (
        <div className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden">
            {/* Subtle gradient accent */}
            <div className={clsx("absolute top-0 inset-x-0 h-1 rounded-t-2xl", gradient)} />
            <div className="flex justify-between items-start mb-3">
                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", gradient)}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                {trend && (
                    <div className={clsx(
                        "flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full",
                        trend === 'up' ? 'text-emerald-700 bg-emerald-50 border border-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800' : 'text-red-700 bg-red-50 border border-red-100 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800'
                    )}>
                        {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trendValue}
                    </div>
                )}
            </div>
            <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                    {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
                </h3>
            </div>
        </div>
        );
    };

    // --- Chart Card ---
    const ChartCard = ({ title, subtitle, icon: ChartIcon, children, className = "" }) => (
        <div className={clsx("bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden", className)}>
            <div className="px-5 pt-5 pb-1 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        {ChartIcon && <ChartIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
                    </div>
                    {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div className="w-full h-[220px] sm:h-[300px] px-2 pb-4">
                {children}
            </div>
        </div>
    );

    // --- Loading Skeleton ---
    if (!dashData && isRefreshing) {
        return (
            <div className="max-w-[1600px] mx-auto pb-12 space-y-6 animate-pulse">
                <div className="h-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700" />
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl mb-3" />
                            <div className="h-3 w-16 bg-gray-100 dark:bg-gray-700 rounded mb-2" />
                            <div className="h-7 w-24 bg-gray-200 dark:bg-gray-600 rounded" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-80 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700" />
                    <div className="h-80 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto pb-12 space-y-6">

            {/* 1. Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div>
                    {!hideTitle && (
                        <>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                    <BarChart3 className="w-4 h-4 text-white" />
                                </div>
                                <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{t('analytics.title', 'Ecommerce Analytics')}</h1>
                            </div>
                            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 ml-[42px]">{t('analytics.subtitle', 'Real-time performance and COD logistics oversight.')}</p>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Date Range Pills */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl border border-gray-200/50 dark:border-gray-600">
                        {['today', 'yesterday', '7d', '30d', '90d', 'ytd'].map(r => (
                            <button
                                key={r}
                                onClick={() => setDateRange(r)}
                                className={clsx(
                                    "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200",
                                    dateRange === r
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-500'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                )}
                            >
                                {t(`analytics.date_${r}`, r === 'ytd' ? 'YTD' : r.toUpperCase())}
                            </button>
                        ))}
                    </div>
                    {/* Custom Date Range */}
                    <div className="flex items-center gap-1.5">
                        <input
                            type="date"
                            value={customStart}
                            onChange={e => { setCustomStart(e.target.value); if (customEnd && e.target.value) setDateRange('custom'); }}
                            className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        />
                        <span className="text-gray-400 text-xs">—</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={e => { setCustomEnd(e.target.value); if (customStart && e.target.value) setDateRange('custom'); }}
                            className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        />
                    </div>
                    <button
                        onClick={fetchAnalytics}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200/50 dark:border-gray-600 bg-white dark:bg-gray-800"
                        title={t('analytics.refresh', 'Refresh Data')}
                    >
                        <RefreshCw className={clsx("w-4 h-4", isRefreshing && "animate-spin text-indigo-500")} />
                    </button>
                    <a
                        href={`${import.meta.env.VITE_API_URL || ''}/api/exports/orders?stage=all`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                        title={t('analytics.exportHint', 'Export all orders as CSV')}
                    >
                        <Download className="w-3.5 h-3.5" />
                        {t('analytics.export', 'Export')}
                    </a>
                </div>
            </div>

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-lg leading-none">&times;</button>
                </div>
            )}

            {/* AI Insight Feed */}
            <InsightFeed />

            {/* 2. Top KPI Layer */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <KPICard
                    title={t('analytics.kpi.revenue', 'Total Revenue')}
                    value={dashData?.kpis?.revenue || 0} suffix={` ${t('common.dzd', 'DZD')}`}
                    icon={CreditCard} gradient="bg-gradient-to-br from-blue-500 to-blue-600"
                    trend={dashData?.trends?.revenue?.direction}
                    trendValue={dashData?.trends?.revenue?.label}
                />
                <KPICard
                    title={t('analytics.kpi.orders', 'Total Orders')}
                    value={dashData?.kpis?.orders || 0}
                    icon={ShoppingCart} gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
                    trend={dashData?.trends?.orders?.direction}
                    trendValue={dashData?.trends?.orders?.label}
                />
                <KPICard
                    title={t('analytics.kpi.aov', 'Avg Order Value')}
                    value={dashData?.kpis?.aov || 0} suffix={` ${t('common.dzd', 'DZD')}`}
                    icon={Truck} gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
                />
                <KPICard
                    title={t('analytics.kpi.profit', 'Net Profit')}
                    value={dashData?.kpis?.profit || 0} suffix={` ${t('common.dzd', 'DZD')}`}
                    icon={TrendingUp} gradient="bg-gradient-to-br from-amber-500 to-orange-500"
                    trend={dashData?.trends?.profit?.direction}
                    trendValue={dashData?.trends?.profit?.label}
                />
                <KPICard
                    title={t('analytics.kpi.margin', 'Profit Margin')}
                    value={dashData?.kpis?.margin || 0} suffix="%"
                    icon={Activity} gradient="bg-gradient-to-br from-purple-500 to-purple-600"
                />
                <KPICard
                    title={t('analytics.kpi.confirmationRate', 'Confirmation Rate')}
                    value={dashData?.kpis?.confirmationRate || 0} suffix="%"
                    icon={CheckCircle2} gradient="bg-gradient-to-br from-teal-500 to-teal-600"
                    trend={dashData?.trends?.confirmationRate?.direction}
                    trendValue={dashData?.trends?.confirmationRate?.label}
                />
            </div>

            {/* 3. Sales Trends (Charts) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title={t('analytics.charts.revenue_trend', 'Revenue Trend')}
                    subtitle={t('analytics.charts.revenue_subtitle', 'Daily revenue over the selected period')}
                    icon={TrendingUp}
                >
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <AreaChart data={dashData?.salesData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: tickColor }} dy={10} />
                            <YAxis tickFormatter={(val) => `${val / 1000}k`} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: tickColor }} dx={-10} />
                            <RechartsTooltip contentStyle={tooltipStyle} cursor={cursorStyle} />
                            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                    title={t('analytics.charts.orders_trend', 'Orders Volume')}
                    subtitle={t('analytics.charts.orders_subtitle', 'Daily order count')}
                    icon={ShoppingCart}
                >
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={dashData?.salesData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: tickColor }} dy={10} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: tickColor }} dx={-10} />
                            <RechartsTooltip contentStyle={tooltipStyle} />
                            <Line type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: isDark ? '#1e293b' : '#fff' }} activeDot={{ r: 5 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* 4. Order Funnel & Product Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard
                    title={t('analytics.charts.funnel', 'Order Funnel')}
                    icon={BarChart3}
                    className="lg:col-span-2"
                >
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={dashData?.orderStatusData || []} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="status" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 500, fill: tickColor }} />
                            <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={tooltipStyle} />
                            <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={28}>
                                {dashData?.orderStatusData?.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title={t('analytics.charts.categories', 'Sales by Category')} icon={Package}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie
                                data={dashData?.categoryData || []}
                                cx="50%"
                                cy="45%"
                                innerRadius={65}
                                outerRadius={95}
                                paddingAngle={4}
                                dataKey="value"
                                strokeWidth={0}
                            >
                                {dashData?.categoryData?.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip contentStyle={tooltipStyle} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8}
                                formatter={(value) => <span style={{ color: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }}>{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* 4b. Wilaya Breakdown & Channel Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard
                    title={t('analytics.charts.wilaya', 'Top Wilayas')}
                    subtitle={t('analytics.charts.wilaya_sub', 'Orders & delivery success by region')}
                    icon={MapPin}
                    className="lg:col-span-2"
                >
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto -mx-2">
                        <table className="cf-table">
                            <thead>
                                <tr>
                                    <th><MapPin className="w-3.5 h-3.5 inline mr-1" />{t('analytics.table.wilaya', 'Wilaya')}</th>
                                    <th>{t('analytics.table.orders', 'Orders')}</th>
                                    <th>{t('analytics.table.revenue', 'Revenue')}</th>
                                    <th>{t('analytics.table.delivered', 'Delivered')}</th>
                                    <th>{t('analytics.table.returned', 'Returned')}</th>
                                    <th>{t('analytics.table.success_rate', 'Success')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashData?.wilayaData?.length > 0 ? dashData.wilayaData.map((w) => (
                                    <tr key={w.name}>
                                        <td className="font-medium text-gray-900 dark:text-white">{w.name}</td>
                                        <td className="text-gray-600 dark:text-gray-300 tabular-nums">{w.orders}</td>
                                        <td className="text-gray-900 dark:text-white font-medium tabular-nums">{w.revenue.toLocaleString()} {t('common.dzd', 'DZD')}</td>
                                        <td className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">{w.delivered}</td>
                                        <td className="text-red-600 dark:text-red-400 font-medium tabular-nums">{w.returned}</td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 flex-1 max-w-[60px]">
                                                    <div className={clsx("h-1.5 rounded-full transition-all", w.successRate >= 80 ? 'bg-emerald-500' : w.successRate >= 50 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${w.successRate}%` }} />
                                                </div>
                                                <span className="text-gray-600 dark:text-gray-300 font-bold text-xs tabular-nums">{w.successRate}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="empty-state"><td colSpan={6}>{t('analytics.noWilayaData', 'No regional data for this period')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>

                <ChartCard
                    title={t('analytics.charts.channels', 'Acquisition Channels')}
                    subtitle={t('analytics.charts.channels_sub', 'Orders by source')}
                    icon={Megaphone}
                >
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={dashData?.channelData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: tickColor }} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: tickColor }} allowDecimals={false} />
                            <RechartsTooltip
                                contentStyle={tooltipStyle}
                                formatter={(val, name) => [name === 'revenue' ? `${val.toLocaleString()} ${t('common.dzd', 'DZD')}` : val, name === 'revenue' ? t('analytics.table.revenue', 'Revenue') : t('analytics.table.orders', 'Orders')]}
                            />
                            <Bar dataKey="orders" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* 5. Courier Analytics & Inventory Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title={t('analytics.charts.couriers', 'Courier Performance')} icon={Truck} className="lg:col-span-2">
                    <div className="overflow-x-auto -mx-2">
                        <table className="cf-table">
                            <thead>
                                <tr>
                                    <th>{t('analytics.table.courier', 'Courier')}</th>
                                    <th>{t('analytics.table.orders', 'Orders')}</th>
                                    <th>{t('analytics.table.delivered', 'Delivered')}</th>
                                    <th>{t('analytics.table.returned', 'Returned')}</th>
                                    <th>{t('analytics.table.success_rate', 'Success Rate')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashData?.courierData?.length > 0 ? dashData.courierData.map((c) => (
                                    <tr key={c.id}>
                                        <td className="font-medium text-gray-900 dark:text-white">{c.name}</td>
                                        <td className="text-gray-600 dark:text-gray-300 tabular-nums">{c.orders}</td>
                                        <td className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">{c.delivered}</td>
                                        <td className="text-red-600 dark:text-red-400 font-medium tabular-nums">{c.returned}</td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 flex-1 max-w-[60px]">
                                                    <div className={clsx("h-1.5 rounded-full transition-all", c.success >= 90 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${c.success}%` }} />
                                                </div>
                                                <span className="text-gray-600 dark:text-gray-300 font-bold text-xs tabular-nums">{c.success}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="empty-state"><td colSpan={5}>{t('analytics.noCourierData', 'No courier data for this period')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>

                <ChartCard title={t('analytics.charts.stock_health', 'Global Stock Health')} icon={Package}>
                    <ResponsiveContainer width="100%" height="80%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie
                                data={dashData?.stockHealthData || []}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={85}
                                paddingAngle={4}
                                dataKey="value"
                                strokeWidth={0}
                            >
                                {dashData?.stockHealthData?.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip contentStyle={tooltipStyle} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8}
                                formatter={(value) => <span style={{ color: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }}>{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* 6. Product Performance & Customers Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title={t('analytics.tables.top_products', 'Top Selling Products')} icon={Package}>
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto -mx-2">
                        <table className="cf-table">
                            <thead>
                                <tr>
                                    <th>{t('analytics.table.product', 'Product')}</th>
                                    <th>{t('analytics.table.units', 'Units')}</th>
                                    <th>{t('analytics.table.revenue', 'Revenue')}</th>
                                    <th>{t('analytics.table.conv', 'Conv. Rate')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashData?.topProductsData?.length > 0 ? dashData.topProductsData.map((p) => (
                                    <tr key={p.id}>
                                        <td className="font-medium text-gray-900 dark:text-white">{p.name || 'Unknown'}</td>
                                        <td className="text-gray-600 dark:text-gray-300 tabular-nums">{p.units || 0}</td>
                                        <td className="text-gray-900 dark:text-white font-medium tabular-nums">{(p.revenue || 0).toLocaleString()} {t('common.dzd', 'DZD')}</td>
                                        <td>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                                {p.conv || 0}%
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="empty-state"><td colSpan={4}>{t('analytics.noSalesData', 'No sales data for this period')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>

                <ChartCard title={t('analytics.tables.top_customers', 'Top Customers (LTV)')} icon={Users}>
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto -mx-2">
                        <table className="cf-table">
                            <thead>
                                <tr>
                                    <th>{t('analytics.table.customer', 'Customer')}</th>
                                    <th>{t('analytics.table.orders', 'Orders')}</th>
                                    <th>{t('analytics.table.revenue', 'LTV Revenue')}</th>
                                    <th>{t('analytics.table.aov', 'AOV')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashData?.customerData?.length > 0 ? dashData.customerData.map((c) => (
                                    <tr key={c.id}>
                                        <td>
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                                                    {(c.name || 'U').charAt(0)}
                                                </div>
                                                <span className="font-medium text-gray-900 dark:text-white">{c.name || 'Unknown Customer'}</span>
                                            </div>
                                        </td>
                                        <td className="text-gray-600 dark:text-gray-300 tabular-nums">{c.orders || 0}</td>
                                        <td className="text-gray-900 dark:text-white font-medium tabular-nums">{(c.revenue || 0).toLocaleString()} {t('common.dzd', 'DZD')}</td>
                                        <td className="text-gray-500 dark:text-gray-400 tabular-nums">{(c.aov || 0).toLocaleString()} {t('common.dzd', 'DZD')}</td>
                                    </tr>
                                )) : (
                                    <tr className="empty-state"><td colSpan={4}>{t('analytics.noCustomerData', 'No customer data for this period')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>
            </div>

            {/* 7. 30-Day Historical Trends (DailyRollup) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title={t('analytics.charts.revenue_30d', '30-Day Revenue & Profit')}
                    subtitle={t('analytics.charts.revenue_30d_sub', 'Gross revenue vs. net profit — last 30 days')}
                    icon={TrendingUp}
                >
                    {trendLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-7 h-7 rounded-full border-[3px] border-gray-200 dark:border-gray-600 border-t-blue-500 animate-spin" />
                        </div>
                    ) : trendData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2">
                            <Activity className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                            <span className="text-sm text-gray-400 dark:text-gray-500">{t('analytics.noHistoricalData', 'No historical data yet — runs nightly at 00:30')}</span>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="grad30Rev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="grad30Prof" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} dy={8} interval={4} />
                                <YAxis tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} dx={-8} />
                                <RechartsTooltip
                                    formatter={(val, name) => [`${val.toLocaleString()} ${t('common.dzd', 'DZD')}`, name === 'revenue' ? t('analytics.grossRevenue', 'Gross Revenue') : t('analytics.netProfit', 'Net Profit')]}
                                    contentStyle={tooltipStyle}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#grad30Rev)" />
                                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#grad30Prof)" />
                                <Legend iconType="circle" iconSize={8}
                                    formatter={v => <span style={{ color: tickColor, fontSize: 12 }}>{v === 'revenue' ? 'Gross Revenue' : 'Net Profit'}</span>}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <ChartCard
                    title={t('analytics.charts.orders_30d', '30-Day Order Flow')}
                    subtitle={t('analytics.charts.orders_30d_sub', 'Created vs. delivered vs. returned — last 30 days')}
                    icon={Activity}
                >
                    {trendLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-7 h-7 rounded-full border-[3px] border-gray-200 dark:border-gray-600 border-t-indigo-500 animate-spin" />
                        </div>
                    ) : trendData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2">
                            <Activity className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                            <span className="text-sm text-gray-400 dark:text-gray-500">{t('analytics.noHistoricalData', 'No historical data yet — runs nightly at 00:30')}</span>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} dy={8} interval={4} />
                                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} dx={-8} allowDecimals={false} />
                                <RechartsTooltip
                                    formatter={(val, name) => [val, name === 'orders' ? 'Created' : name === 'delivered' ? 'Delivered' : 'Returned']}
                                    contentStyle={tooltipStyle}
                                />
                                <Line type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="returned" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                                <Legend iconType="circle" iconSize={8}
                                    formatter={v => <span style={{ color: tickColor, fontSize: 12 }}>{v === 'orders' ? 'Created' : v === 'delivered' ? 'Delivered' : 'Returned'}</span>}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>
        </div>
    );
}
