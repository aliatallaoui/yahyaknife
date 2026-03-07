import { useEffect, useState, useContext } from 'react';
import { Users, UserMinus, UserCheck, Star, ShieldAlert, BarChart3, ArrowRight, ArrowLeft, DollarSign, Target, Plus, Search, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCustomer } from '../context/CustomerContext';
import { AuthContext } from '../context/AuthContext';
import CustomerModal from '../components/modals/CustomerModal';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';

const COLORS = ['#4361EE', '#3B82F6', '#60A5FA', '#93C5FD', '#111827', '#6B7280'];
const LTV_COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#94a3b8'];

export default function CustomerInsight() {
    const { token } = useContext(AuthContext);
    const { t } = useTranslation();
    const { customers, loading: contextLoading, createCustomer, updateCustomer, deleteCustomer } = useCustomer();
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchCustomerData = async () => {
            if (!token) return;
            try {
                const metricsRes = await fetch('http://localhost:5000/api/customers/metrics', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = await metricsRes.json();
                setMetrics(Array.isArray(data) ? data : (data.error ? null : data));
            } catch (error) {
                console.error("Error fetching customer metrics:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCustomerData();
    }, [token]);

    if (loading || contextLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-indigo-600 animate-spin"></div>
            </div>
        );
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
        } catch (error) {
            alert("Failed to save customer.");
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

            {/* Top Control Bar */}
            <div className="flex justify-between items-center bg-indigo-900 text-white p-6 rounded-2xl shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t('crm.title', 'Customer Intelligence OS')}</h2>
                    <p className="text-indigo-200 mt-1 text-sm font-medium">{t('crm.subtitle', 'Segments, Retention, and COD Risk Management')}</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleCreateClick} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition-all shadow-sm">
                        <Plus className="w-4 h-4" /> {t('crm.addCustomerBtn', 'Add Customer')}
                    </button>
                </div>
            </div>

            {/* Macro KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-96">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-500" /> {t('crm.chartAcquisitionTitle', 'Acquisition ROI & Channels')}
                    </h3>
                    <div className="flex-1" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
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
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-96">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-pink-500" /> {t('crm.chartLtvTitle', 'Lifetime Value Segments')}
                    </h3>
                    <div className="flex h-full items-center">
                        <ResponsiveContainer width="100%" height="100%">
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[500px]">
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">{t('crm.dirTitle', 'CRM Directory')}</h3>
                    <div className="relative w-64">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('crm.searchPlaceholder', "Search name or email...")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full ps-9 pe-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-800"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-start border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider sticky top-0 z-10">
                                <th className="p-4 font-semibold rounded-tl-xl ps-6">{t('crm.colCustomer', 'Customer')}</th>
                                <th className="p-4 font-semibold">{t('crm.colSegment', 'Segment')}</th>
                                <th className="p-4 font-semibold">{t('crm.colOrders', 'Orders')}</th>
                                <th className="p-4 font-semibold">{t('crm.colLTV', 'Lifetime Value')}</th>
                                <th className="p-4 font-semibold">{t('crm.colRisk', 'COD Risk')}</th>
                                <th className="p-4 font-semibold text-center pe-6">{t('crm.colProfile', 'Profile')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {filteredCustomers.map(customer => (
                                <tr key={customer._id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="p-4 ps-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center font-bold text-indigo-700 shadow-sm border border-indigo-50">
                                                {customer.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{customer.name}</p>
                                                <p className="text-xs text-gray-500">{customer.email}</p>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{customer.acquisitionChannel}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={clsx(
                                            "inline-flex px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                                            customer.segment === 'Whale' ? 'bg-pink-50 text-pink-700 border-pink-100' :
                                                customer.segment === 'VIP' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                    customer.segment === 'Repeat Buyer' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        customer.segment === 'Dormant' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                            'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        )}>
                                            {customer.segment}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-900">{customer.totalOrders} {t('crm.ordersText', 'Orders')}</span>
                                            <span className="text-xs font-medium text-emerald-600">{customer.deliveredOrders} {t('crm.deliveredText', 'Delivered')}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <p className="font-black text-gray-900 tabular-nums">{(customer.lifetimeValue || 0).toLocaleString()} DZ</p>
                                        <p className="text-xs font-medium text-gray-500 mt-0.5">{t('crm.aovText', 'AOV')}: {Math.round(customer.averageOrderValue || 0).toLocaleString()} DZ</p>
                                    </td>
                                    <td className="p-4">
                                        {customer.blacklisted ? (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-md w-fit border border-rose-100">
                                                <ShieldAlert className="w-3.5 h-3.5" /> {t('crm.blacklisted', 'Blacklisted')}
                                            </div>
                                        ) : customer.isSuspicious ? (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md w-fit border border-amber-100">
                                                    <AlertCircle className="w-3.5 h-3.5" /> {t('crm.highRisk', 'High Risk')} ({Math.round(customer.refusalRate)}% {t('crm.refusalText', 'Refusal')})
                                                </div>
                                                {customer.requiresDeliveryVerification && (
                                                    <span className="text-[10px] font-bold text-amber-600 ms-1">{t('crm.requiresPhoneAuth', 'Requires Phone Auth')}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md w-fit border border-emerald-100">
                                                <UserCheck className="w-3.5 h-3.5" /> {t('crm.trusted', 'Trusted')}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center pe-6">
                                        <Link to={`/customers/${customer._id}`} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-sm border border-transparent hover:border-indigo-100 transition-all">
                                            <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {filteredCustomers.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center border-2 border-dashed border-gray-100 rounded-xl m-4 text-gray-500 font-medium bg-gray-50/50">
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
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleModalSubmit}
                    initialData={editingCustomer}
                />
            )}
        </div>
    );
}

function MacroCard({ title, value, icon: Icon, sub, color, bg }) {
    return (
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-current/10", bg, color)}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <div>
                <h3 className="text-3xl font-black text-gray-900 tabular-nums tracking-tight">{value}</h3>
                <p className="text-sm font-bold text-gray-500 mt-1">{title}</p>
                <p className="text-xs font-bold mt-3 inline-flex items-center gap-1 text-gray-400">
                    {sub}
                </p>
            </div>
        </div>
    );
}
