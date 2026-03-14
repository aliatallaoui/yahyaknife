import { useEffect, useState, useContext, useRef } from 'react';
import { useHotkey } from '../hooks/useHotkey';
import { Users, UserMinus, UserCheck, Star, ShieldAlert, BarChart3, ArrowRight, ArrowLeft, DollarSign, Target, Plus, Search, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCustomer } from '../context/CustomerContext';
import { AuthContext } from '../context/AuthContext';
import CustomerModal from '../components/modals/CustomerModal';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { apiFetch } from '../utils/apiFetch';
import PageHeader from '../components/PageHeader';
import TableSkeleton from '../components/TableSkeleton';

const COLORS = ['#4361EE', '#3B82F6', '#60A5FA', '#93C5FD', '#111827', '#6B7280'];
const LTV_COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#94a3b8'];

export default function CustomerInsight() {
    const { token, hasPermission } = useContext(AuthContext);
    const { t } = useTranslation();
    const { customers, loading: contextLoading, createCustomer, updateCustomer } = useCustomer();
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [saveError, setSaveError] = useState(null);
    const [metricsError, setMetricsError] = useState(null);
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    useEffect(() => {
        const fetchCustomerData = async () => {
            if (!token) return;
            try {
                const metricsRes = await apiFetch(`/api/customers/metrics`);
                if (!metricsRes.ok) throw new Error('Failed to load metrics');

                const data = await metricsRes.json();
                setMetrics(Array.isArray(data) ? data : (data.message && !data.data ? null : (data.data ?? data)));
            } catch {
                setMetricsError(t('crm.failedLoadMetrics', 'Failed to load customer metrics.'));
            } finally {
                setLoading(false);
            }
        };
        fetchCustomerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    if (loading || contextLoading) {
        return <TableSkeleton showKpis kpiCount={4} rows={8} cols={6} />;
    }

    const handleCreateClick = () => {
        setEditingCustomer(null);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (payload) => {
        try {
            if (editingCustomer) await updateCustomer(editingCustomer._id, payload);
            else await createCustomer(payload);
            setIsModalOpen(false);
            setSaveError(null);
            toast.success(editingCustomer ? t('crm.customerUpdated', 'Customer updated successfully') : t('crm.customerCreated', 'Customer created successfully'));
        } catch (error) {
            const errMsg = error?.response?.data?.message || error?.message || t('crm.failedSave', 'Failed to save customer.');
            setSaveError(errMsg);
            toast.error(errMsg);
        }
    };

    // Prepare Chart Data
    const acquisitionData = metrics?.acquisitionDistribution ? Object.keys(metrics.acquisitionDistribution).map((key) => ({
        name: key,
        count: metrics.acquisitionDistribution[key].count,
        revenue: metrics.acquisitionDistribution[key].revenue
    })).sort((a, b) => b.count - a.count) : [];

    const ltvData = metrics?.ltvDistribution ? [
        { name: t('crm.whale', 'Whales (>50k)'), value: metrics.ltvDistribution.whales },
        { name: t('crm.vip', 'VIP (>20k)'), value: metrics.ltvDistribution.vip },
        { name: t('crm.regular', 'Regular (>5k)'), value: metrics.ltvDistribution.regular },
        { name: t('crm.lowValue', 'Low Value'), value: metrics.ltvDistribution.lowValue }
    ] : [];

    // Filter customers for the table
    const filteredCustomers = customers.filter(c =>
        (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (c.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).slice(0, 15); // Show top 15

    return (
        <div className="flex flex-col gap-6 max-w-[1600px]">
            {metricsError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm font-semibold text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{metricsError} — {t('crm.analyticsUnavailable', 'analytics charts may be unavailable.')}</span>
                    <button onClick={() => setMetricsError(null)} className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300">✕</button>
                </div>
            )}
            <PageHeader
                title={t('crm.title', 'Customer Intelligence OS')}
                subtitle={t('crm.subtitle', 'Segments, Retention, and COD Risk Management')}
                variant="customers"
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-sky-500 absolute start-3 top-1/2 -translate-y-1/2" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={t('crm.searchPlaceholder', "Search name or email... (Press /)")}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ps-9 pe-4 py-2 bg-white dark:bg-gray-700 border border-sky-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all w-48 sm:w-64 shadow-sm font-bold"
                            />
                        </div>
                        {hasPermission('customers.edit') && (
                            <button
                                onClick={handleCreateClick}
                                className="flex items-center gap-2 px-6 py-2.5 bg-[#5D5DFF] hover:bg-[#4B4BFF] text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 leading-none"
                            >
                                <Plus className="w-5 h-5" /> {t('crm.addCustomerBtn', 'Add Customer')}
                            </button>
                        )}
                    </div>
                }
            />

            {/* Macro KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MacroCard
                    title={t('crm.macroTotalAudience', 'Total Audience')}
                    value={metrics?.totalCustomers || 0}
                    icon={Users}
                    sub={`${metrics?.newVsReturning?.returning || 0} ${t('crm.macroRepeatBuyers', 'Repeat Buyers')}`}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <MacroCard
                    title={t('crm.macroAverageLtv', 'Average LTV')}
                    value={`${Math.round(metrics?.averageLTV || 0).toLocaleString()} DZ`}
                    icon={DollarSign}
                    sub={t('crm.macroGrossRevenue', 'Gross revenue per user')}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <MacroCard
                    title={t('crm.macroActiveRetention', 'Active Retention')}
                    value={metrics?.retentionStatus?.active || 0}
                    icon={UserCheck}
                    sub={`${metrics?.retentionStatus?.churned || 0} ${t('crm.macroChurned', 'Churned (>120d)')}`}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                />
                <MacroCard
                    title={t('crm.macroHighRisk', 'High Risk Accounts')}
                    value={metrics?.highRiskCustomers || 0}
                    icon={ShieldAlert}
                    sub={t('crm.macroRefusalRate', '>30% Refusal Rate')}
                    color="text-rose-600"
                    bg="bg-rose-50"
                />
            </div>

            {/* Analytics Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Acquisition ROI */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-96">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-500" /> {t('crm.chartAcquisitionTitle', 'Acquisition ROI & Channels')}
                    </h3>
                    <div className="flex-1" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={acquisitionData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 500 }} width={100} />
                                <RechartsTooltip
                                    formatter={(value, name) => [name === 'revenue' ? `${value.toLocaleString()} DZ` : value, name === 'revenue' ? 'Gross LTV' : 'Customers']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="top" />
                                <Bar dataKey="count" name="Customers" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={12} />
                                <Bar dataKey="revenue" name="Total LTV (DZ)" fill="#34d399" radius={[0, 4, 4, 0]} barSize={12} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Lifetime Value Distribution */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-96">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-pink-500" /> {t('crm.chartLtvTitle', 'Lifetime Value Segments')}
                    </h3>
                    <div className="flex h-full items-center">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={ltvData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {ltvData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={LTV_COLORS[index % LTV_COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value) => [`${value} Customers`, 'Count']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* CRM Directory Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-[500px]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 gap-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('crm.dirTitle', 'CRM Directory')}</h3>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="cf-table min-w-[1000px]">
                        <thead>
                            <tr className="sticky top-0 z-10">
                                <th>{t('crm.colCustomer', 'Customer')}</th>
                                <th>{t('crm.colSegment', 'Segment')}</th>
                                <th>{t('crm.colOrders', 'Orders')}</th>
                                <th>{t('crm.colLTV', 'Lifetime Value')}</th>
                                <th>{t('crm.colRisk', 'COD Risk')}</th>
                                <th className="text-center">{t('crm.colProfile', 'Profile')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map(customer => (
                                <tr key={customer._id} className="group">
                                    <td className="p-4 ps-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300 shadow-sm border border-indigo-50 dark:border-indigo-800">
                                                {customer.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{customer.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{customer.email}</p>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{customer.acquisitionChannel}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={clsx(
                                            "inline-flex px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                                            customer.segment === 'Whale' ? 'bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800' :
                                                customer.segment === 'VIP' ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800' :
                                                    customer.segment === 'Repeat Buyer' ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' :
                                                        customer.segment === 'Dormant' ? 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600' :
                                                            'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
                                        )}>
                                            {customer.segment}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-900 dark:text-white">{customer.totalOrders} {t('crm.ordersText', 'Orders')}</span>
                                            <span className="text-xs font-medium text-emerald-600">{customer.deliveredOrders} {t('crm.deliveredText', 'Delivered')}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <p className="font-black text-gray-900 dark:text-white tabular-nums">{(customer.lifetimeValue || 0).toLocaleString()} DZ</p>
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{t('crm.aovText', 'AOV')}: {Math.round(customer.averageOrderValue || 0).toLocaleString()} DZ</p>
                                    </td>
                                    <td className="p-4">
                                        {customer.blacklisted ? (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-md w-fit border border-rose-100 dark:border-rose-800">
                                                <ShieldAlert className="w-3.5 h-3.5" /> {t('crm.blacklisted', 'Blacklisted')}
                                            </div>
                                        ) : customer.refusalRate > 30 ? (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md w-fit border border-amber-100 dark:border-amber-800">
                                                    <AlertCircle className="w-3.5 h-3.5" /> {t('crm.highRisk', 'High Risk')} ({Math.round(customer.refusalRate)}% {t('crm.refusalText', 'Refusal')})
                                                </div>
                                                {customer.requiresDeliveryVerification && (
                                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 ms-1">{t('crm.requiresPhoneAuth', 'Requires Phone Auth')}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md w-fit border border-emerald-100 dark:border-emerald-800">
                                                <UserCheck className="w-3.5 h-3.5" /> {t('crm.trusted', 'Trusted')}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center pe-6">
                                        <Link to={`/customers/${customer._id}`} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800 transition-all">
                                            <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {filteredCustomers.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl m-4 text-gray-500 dark:text-gray-400 font-medium bg-gray-50/50 dark:bg-gray-700/50">
                                        {t('crm.noCustomers', 'No customers found. They will appear here once orders are processed.')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <CustomerModal
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setSaveError(null); }}
                    onSubmit={handleModalSubmit}
                    initialData={editingCustomer}
                />
            )}

            {saveError && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-gray-900 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-2xl max-w-sm">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="flex-1 leading-snug">{saveError}</span>
                    <button onClick={() => setSaveError(null)} className="ml-2 text-gray-400 hover:text-white transition-colors shrink-0">✕</button>
                </div>
            )}
        </div>
    );
}

function MacroCard({ title, value, icon, sub, color, bg }) {
    const Icon = icon;
    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-current/10", bg, color)}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <div>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums tracking-tight">{value}</h3>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">{title}</p>
                <p className="text-xs font-bold mt-3 inline-flex items-center gap-1 text-gray-400 dark:text-gray-500">
                    {sub}
                </p>
            </div>
        </div>
    );
}
