import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Calendar, TrendingUp, TrendingDown, Package, ShoppingCart,
    CreditCard, Users, Truck, AlertCircle, RefreshCw, Download
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import InsightFeed from '../components/InsightFeed';

// No mock data needed anymore, dynamically fetching from API
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

export default function EcommerceAnalytics() {
    const { t } = useTranslation();
    const [dateRange, setDateRange] = useState('7d');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [dashData, setDashData] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [trendLoading, setTrendLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const fetchAnalytics = async () => {
        setIsRefreshing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/analytics/ecommerce?range=${dateRange}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDashData(data);
            }
        } catch (error) {
            setFetchError('Failed to load analytics data.');
        } finally {
            setIsRefreshing(false);
        }
    };

    const fetchTrendData = async () => {
        setTrendLoading(true);
        try {
            const token = localStorage.getItem('token');
            const to = new Date().toISOString().slice(0, 10);
            const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/analytics/daily?from=${from}&to=${to}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
        } catch (e) {
            setFetchError('Failed to load trend data.');
        } finally {
            setTrendLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [dateRange]);

    useEffect(() => {
        fetchTrendData();
    }, []);

    // --- COMPONENT HELPERS ---
    const KPICard = ({ title, value, prefix = '', suffix = '', trend, trendValue, icon: Icon, colorClass }) => (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                    <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend === 'up' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                        {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trendValue}
                    </div>
                )}
            </div>
            <div>
                <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-2xl font-black text-gray-900">
                    {prefix}{value.toLocaleString()}{suffix}
                </h3>
            </div>
        </div>
    );

    const ChartCard = ({ title, subtitle, children, className = "" }) => (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
            <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
            <div className="w-full h-[300px]">
                {children}
            </div>
        </div>
    );

    if (!dashData && isRefreshing) {
        return (
            <div className="max-w-[1600px] mx-auto pb-12 space-y-6 animate-pulse">
                <div className="h-20 bg-white rounded-2xl border border-gray-100" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-72 bg-white rounded-2xl border border-gray-100" />
                    <div className="h-72 bg-white rounded-2xl border border-gray-100" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="h-72 bg-white rounded-2xl border border-gray-100 lg:col-span-2" />
                    <div className="h-72 bg-white rounded-2xl border border-gray-100" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto pb-12 space-y-6">

            {/* 1. Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('analytics.title', 'Ecommerce Analytics')}</h1>
                    <p className="text-gray-500 text-sm">{t('analytics.subtitle', 'Real-time performance and COD logistics oversight.')}</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {['today', 'yesterday', '7d', '30d'].map(range => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${dateRange === range ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {t(`analytics.date_${range}`, range.toUpperCase())}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchAnalytics}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
                        title={t('analytics.refresh', 'Refresh Data')}
                    >
                        <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
                    </button>
                    <a
                        href={`${import.meta.env.VITE_API_URL || ''}/api/exports/orders?stage=all`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                        title={t('analytics.exportHint', 'Export all orders as CSV')}
                    >
                        <Download className="w-4 h-4" />
                        {t('analytics.export', 'Export')}
                    </a>
                </div>
            </div>

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600">✕</button>
                </div>
            )}

            {/* AI Insight Feed */}
            <InsightFeed />

            {/* 2. Top KPI Layer */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard
                    title={t('analytics.kpi.revenue', 'Total Revenue')}
                    value={dashData?.kpis?.revenue || 0} suffix=" DZD"
                    icon={CreditCard} colorClass="bg-blue-500"
                />
                <KPICard
                    title={t('analytics.kpi.orders', 'Total Orders')}
                    value={dashData?.kpis?.orders || 0}
                    icon={ShoppingCart} colorClass="bg-indigo-500"
                />
                <KPICard
                    title={t('analytics.kpi.aov', 'Avg Order Value')}
                    value={dashData?.kpis?.aov || 0} suffix=" DZD"
                    icon={Truck} colorClass="bg-emerald-500"
                />
                <KPICard
                    title={t('analytics.kpi.profit', 'Net Profit')}
                    value={dashData?.kpis?.profit || 0} suffix=" DZD"
                    icon={TrendingUp} colorClass="bg-amber-500"
                />
                <KPICard
                    title={t('analytics.kpi.margin', 'Profit Margin')}
                    value={dashData?.kpis?.margin || 0} suffix="%"
                    icon={PieChart} colorClass="bg-purple-500"
                />
            </div>

            {/* 3. Sales Trends (Charts) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title={t('analytics.charts.revenue_trend', 'Revenue Trend')}
                    subtitle={t('analytics.charts.revenue_subtitle', 'Daily revenue over the selected period')}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashData?.salesData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                            <YAxis tickFormatter={(val) => `${val / 1000}k`} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dx={-10} />
                            <RechartsTooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                    title={t('analytics.charts.orders_trend', 'Orders Volume')}
                    subtitle={t('analytics.charts.orders_subtitle', 'Daily order count')}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dashData?.salesData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dx={-10} />
                            <RechartsTooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Line type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* 4. Order Funnel & Product Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Funnel equivalent using a Bar Chart */}
                <ChartCard
                    title={t('analytics.charts.funnel', 'Order Funnel')}
                    className="lg:col-span-2"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashData?.orderStatusData || []} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="status" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 500, fill: '#4b5563' }} />
                            <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={32}>
                                {dashData?.orderStatusData?.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title={t('analytics.charts.categories', 'Sales by Category')}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={dashData?.categoryData || []}
                                cx="50%"
                                cy="45%"
                                innerRadius={70}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {dashData?.categoryData?.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* 5. Courier Analytics & Inventory Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title={t('analytics.charts.couriers', 'Courier Performance')} className="lg:col-span-2">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 font-semibold rounded-l-lg">{t('analytics.table.courier', 'Courier')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('analytics.table.orders', 'Orders')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('analytics.table.delivered', 'Delivered')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('analytics.table.returned', 'Returned')}</th>
                                    <th className="px-4 py-3 font-semibold rounded-r-lg">{t('analytics.table.success_rate', 'Success Rate')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashData?.courierData?.length > 0 ? dashData.courierData.map((c) => (
                                    <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{c.orders}</td>
                                        <td className="px-4 py-3 text-emerald-600 font-medium">{c.delivered}</td>
                                        <td className="px-4 py-3 text-red-600 font-medium">{c.returned}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-200 rounded-full h-1.5 flex-1 max-w-[60px]">
                                                    <div className={`h-1.5 rounded-full ${c.success >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${c.success}%` }}></div>
                                                </div>
                                                <span className="text-gray-700 font-medium text-xs">{c.success}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No courier data for this period</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>

                <ChartCard title={t('analytics.charts.stock_health', 'Global Stock Health')}>
                    <ResponsiveContainer width="100%" height="80%">
                        <PieChart>
                            <Pie
                                data={dashData?.stockHealthData || []}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {dashData?.stockHealthData?.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* 6. Product Performance & Customers Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title={t('analytics.tables.top_products', 'Top Selling Products')}>
                    <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                        <table className="w-full text-sm text-left relative">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 font-semibold rounded-l-lg bg-gray-50">{t('analytics.table.product', 'Product')}</th>
                                    <th className="px-4 py-3 font-semibold bg-gray-50">{t('analytics.table.units', 'Units')}</th>
                                    <th className="px-4 py-3 font-semibold bg-gray-50">{t('analytics.table.revenue', 'Revenue')}</th>
                                    <th className="px-4 py-3 font-semibold rounded-r-lg bg-gray-50">{t('analytics.table.conv', 'Conv. Rate')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 border-t border-gray-100">
                                {dashData?.topProductsData?.length > 0 ? dashData.topProductsData.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900">{p.name || 'Unknown'}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.units || 0}</td>
                                        <td className="px-4 py-3 text-gray-900 font-medium">{(p.revenue || 0).toLocaleString()} DZD</td>
                                        <td className="px-4 py-3 text-indigo-600 font-medium">{p.conv || 0}%</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">No sales data for this period</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>

                <ChartCard title={t('analytics.tables.top_customers', 'Top Customers (LTV)')}>
                    <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                        <table className="w-full text-sm text-left relative">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 font-semibold rounded-l-lg bg-gray-50">{t('analytics.table.customer', 'Customer')}</th>
                                    <th className="px-4 py-3 font-semibold bg-gray-50">{t('analytics.table.orders', 'Orders')}</th>
                                    <th className="px-4 py-3 font-semibold bg-gray-50">{t('analytics.table.revenue', 'LTV Revenue')}</th>
                                    <th className="px-4 py-3 font-semibold rounded-r-lg bg-gray-50">{t('analytics.table.aov', 'AOV')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 border-t border-gray-100">
                                {dashData?.customerData?.length > 0 ? dashData.customerData.map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                                                    {(c.name || 'U').charAt(0)}
                                                </div>
                                                <span className="font-medium text-gray-900">{c.name || 'Unknown Customer'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{c.orders || 0}</td>
                                        <td className="px-4 py-3 text-gray-900 font-medium">{(c.revenue || 0).toLocaleString()} DZD</td>
                                        <td className="px-4 py-3 text-gray-500">{(c.aov || 0).toLocaleString()} DZD</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">No customer data for this period</td></tr>
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
                >
                    {trendLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-6 h-6 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin" />
                        </div>
                    ) : trendData.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-sm text-gray-400">No historical data yet — runs nightly at 00:30</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
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
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dy={8} interval={4} />
                                <YAxis tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dx={-8} />
                                <RechartsTooltip
                                    formatter={(val, name) => [`${val.toLocaleString()} DZD`, name === 'revenue' ? 'Gross Revenue' : 'Net Profit']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#grad30Rev)" />
                                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#grad30Prof)" />
                                <Legend iconType="circle" iconSize={8} formatter={v => v === 'revenue' ? 'Gross Revenue' : 'Net Profit'} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <ChartCard
                    title={t('analytics.charts.orders_30d', '30-Day Order Flow')}
                    subtitle={t('analytics.charts.orders_30d_sub', 'Created vs. delivered vs. returned — last 30 days')}
                >
                    {trendLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-6 h-6 rounded-full border-4 border-gray-200 border-t-indigo-500 animate-spin" />
                        </div>
                    ) : trendData.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-sm text-gray-400">No historical data yet — runs nightly at 00:30</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dy={8} interval={4} />
                                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dx={-8} allowDecimals={false} />
                                <RechartsTooltip
                                    formatter={(val, name) => [val, name === 'orders' ? 'Created' : name === 'delivered' ? 'Delivered' : 'Returned']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="returned" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                                <Legend iconType="circle" iconSize={8} formatter={v => v === 'orders' ? 'Created' : v === 'delivered' ? 'Delivered' : 'Returned'} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>
        </div>
    );
}
