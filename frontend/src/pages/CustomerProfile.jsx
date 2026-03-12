import { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCustomer } from '../context/CustomerContext';
import { ArrowLeft, ArrowRight, User, Phone, MapPin, Mail, Calendar, ShieldAlert, CheckCircle2, Package, TrendingUp, AlertCircle, RefreshCw, MessageSquare, Plus } from 'lucide-react';
import clsx from 'clsx';
import moment from 'moment';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell } from 'recharts';
import { useTranslation } from 'react-i18next';
import PageHeader from '../components/PageHeader';
import { AuthContext } from '../context/AuthContext';

export default function CustomerProfile() {
    const { id } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { customers, deleteCustomer, updateCustomer } = useCustomer();
    const { hasPermission, token } = useContext(AuthContext);
    const [customer, setCustomer] = useState(null);
    const [orders, setOrders] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [activeTab, setActiveTab] = useState('orders');
    const [loading, setLoading] = useState(true);
    const [blacklistConfirm, setBlacklistConfirm] = useState(false);
    const [blacklistError, setBlacklistError] = useState(null);

    useEffect(() => {
        const loadCustomerData = async () => {
            // Priority: Find in context first for instant load
            const existingCustomer = customers.find(c => c._id === id);

            try {
                // Fetch fresh profile and orders and tickets
                const authHeader = { headers: { Authorization: `Bearer ${token}` } };
                const [ordersRes, profilesRes, ticketsRes] = await Promise.all([
                    fetch(`${import.meta.env.VITE_API_URL || ''}/api/customers/${id}/orders`, authHeader),
                    fetch(`${import.meta.env.VITE_API_URL || ''}/api/customers`, authHeader), // Refresh full list to get newest metrics for this ID
                    fetch(`${import.meta.env.VITE_API_URL || ''}/api/support?customerId=${id}`, authHeader)
                ]);

                if (ordersRes.ok) setOrders(await ordersRes.json());
                if (ticketsRes.ok) { const tj = await ticketsRes.json(); setTickets(tj.data ?? (Array.isArray(tj) ? tj : [])); }

                if (profilesRes.ok) {
                    const allCustomers = await profilesRes.json();
                    const freshData = allCustomers.find(c => c._id === id);
                    if (freshData) setCustomer(freshData);
                    else if (existingCustomer) setCustomer(existingCustomer);
                }

            } catch (error) {
                console.error("Failed to fetch profile:", error);
                if (existingCustomer) setCustomer(existingCustomer);
            } finally {
                setLoading(false);
            }
        };

        if (id) loadCustomerData();
    }, [id, customers]);

    const handleToggleBlacklist = () => {
        if (!customer) return;
        setBlacklistConfirm(true);
    };

    const confirmToggleBlacklist = async () => {
        setBlacklistConfirm(false);
        try {
            await updateCustomer(id, { blacklisted: !customer.blacklisted });
            setCustomer({ ...customer, blacklisted: !customer.blacklisted });
        } catch (error) {
            setBlacklistError("Failed to update blacklist status.");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-indigo-600 animate-spin"></div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-gray-900">{t('crm.customerNotFound', 'Customer Not Found')}</h2>
                <Link to="/customers" className="text-indigo-600 font-medium hover:underline mt-4 inline-block">{t('crm.returnDir', 'Return to Directory')}</Link>
            </div>
        );
    }

    // Process Orders for Chart
    const orderVolumeData = [...orders].reverse().map(o => ({
        date: moment(o.createdAt).format('MMM DD'),
        amount: o.totalAmount || 0,
        status: o.status
    }));

    return (
        <>
        <div className="flex flex-col gap-6 max-w-[1400px]">
            <PageHeader
                title={customer.name}
                subtitle={`${t('crm.customerProfileSubtitle', 'Intelligence profile for')} ${customer.email || customer.name}`}
                variant="customers"
                actions={
                    <div className="flex items-center gap-2">
                        {hasPermission('orders.create') && customer && (
                            <button
                                onClick={() => navigate(`/sales?newOrder=1&phone=${encodeURIComponent(customer.phone || '')}&name=${encodeURIComponent(customer.name || '')}`)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-700 font-bold rounded-xl transition-all border border-white/30 active:scale-95 leading-none text-xs hover:bg-white/90 shadow-sm"
                            >
                                <Plus className="w-4 h-4" /> {t('crm.newOrder', 'New Order')}
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/customers')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 backdrop-blur-md active:scale-95 leading-none text-xs"
                        >
                            <ArrowLeft className="w-4 h-4 ltr:scale-x-100 rtl:-scale-x-100" /> {t('crm.directory', 'Directory')}
                        </button>
                    </div>
                }
            />

            {/* Profile Header Card */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 end-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-bl-full -z-10 opacity-50 rtl:rounded-bl-none rtl:rounded-br-full"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center font-bold text-3xl text-indigo-700 shadow-sm border border-indigo-50 shrink-0">
                            {customer.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{customer.name}</h1>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
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
                                <span className="text-xs font-semibold text-gray-400">{t('crm.cohort', 'Cohort')}: {customer.cohortMonth || 'Unknown'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {hasPermission('customers.blacklist') && (
                            <button
                                onClick={handleToggleBlacklist}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition-all shadow-sm text-sm border",
                                customer.blacklisted
                                    ? "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                                    : "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100"
                            )}>
                            <ShieldAlert className="w-4 h-4" />
                            {customer.blacklisted ? t('crm.removeBlacklist', 'Remove Blacklist') : t('crm.addBlacklist', 'Blacklist Customer')}
                        </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-8 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400"><Mail className="w-5 h-5" /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">{t('crm.emailText', 'Email')}</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">{customer.email || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400"><TrendingUp className="w-5 h-5" /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">{t('crm.channelText', 'Channel')}</p>
                            <p className="text-sm font-semibold text-gray-900">{customer.acquisitionChannel || 'Unknown'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400"><Calendar className="w-5 h-5" /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">{t('crm.joinedText', 'Joined')}</p>
                            <p className="text-sm font-semibold text-gray-900">{moment(customer.joinDate).format('MMM DD, YYYY')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400"><RefreshCw className="w-5 h-5" /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">{t('crm.lastActiveText', 'Last Active')}</p>
                            <p className="text-sm font-semibold text-gray-900">{customer.lastInteractionDate ? moment(customer.lastInteractionDate).fromNow() : t('crm.neverActive', 'Never')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. Value & Revenue Metrics */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm col-span-1 lg:col-span-2 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Package className="w-5 h-5 text-indigo-500" /> {t('crm.opValueTitle', 'Operational & Value Footprint')}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">{t('crm.colLTV', 'Lifetime Value')}</p>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tighter truncate">{(customer.lifetimeValue || 0).toLocaleString()} <span className="text-sm">DZ</span></h3>
                            </div>
                            <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 shrink-0">
                                <TrendingUp className="w-6 h-6 text-gray-600" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">{t('crm.avgOrderValue', 'Avg Order Value')}</p>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tighter truncate">{Math.round(customer.averageOrderValue || 0).toLocaleString()} <span className="text-sm">DZ</span></h3>
                            </div>
                            <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 shrink-0">
                                <Package className="w-6 h-6 text-gray-600" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between gap-4 bg-emerald-50/50">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 truncate">{t('crm.deliveredText', 'Delivered')}</p>
                                <h3 className="text-2xl font-black text-emerald-700 tracking-tighter truncate">{customer.deliveredOrders || 0}</h3>
                            </div>
                            <div className="h-12 w-12 bg-emerald-100 rounded-2xl flex items-center justify-center border border-emerald-200 shrink-0">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex items-center justify-between gap-4 bg-indigo-50/50">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1 truncate">{t('crm.ordersText', 'Total Orders')}</p>
                                <h3 className="text-2xl font-black text-indigo-700 tracking-tighter truncate">{customer.totalOrders || 0}</h3>
                            </div>
                            <div className="h-12 w-12 bg-indigo-100 rounded-2xl flex items-center justify-center border border-indigo-200 shrink-0">
                                <Package className="w-6 h-6 text-indigo-600" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 mt-4 min-h-[200px]" dir="ltr">
                        {orders.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={orderVolumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                    <RechartsTooltip
                                        formatter={(value, name, props) => [`${value.toLocaleString()} DZ`, props.payload.status]}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                        {orderVolumeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['Delivered', 'Paid'].includes(entry.status) ? '#10b981' : ['Refused', 'Returned'].includes(entry.status) ? '#f43f5e' : '#818cf8'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm font-medium">{t('crm.noOrdersHistory', 'No order history available to graph.')}</div>
                        )}
                    </div>
                </div>

                {/* 2. Flow & COD Risk Profile */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-500" /> {t('crm.codRiskAnalysis', 'COD Risk Analysis')}
                    </h3>

                    <div className="flex flex-col gap-5">
                        {/* Status Flags */}
                        <div className="flex gap-2 mb-2">
                            {customer.blacklisted && (
                                <span className="px-3 py-1.5 bg-rose-50 text-rose-700 font-bold text-xs rounded-lg border border-rose-100 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" /> {t('crm.blacklisted', 'Blacklisted')}
                                </span>
                            )}
                            {customer.requiresDeliveryVerification && !customer.blacklisted && (
                                <span className="px-3 py-1.5 bg-amber-50 text-amber-700 font-bold text-xs rounded-lg border border-amber-100 flex items-center gap-1">
                                    <Phone className="w-3.5 h-3.5" /> {t('crm.requiresPhoneAuth', 'Requires Phone Auth')}
                                </span>
                            )}
                            {customer.refusalRate <= 30 && !customer.blacklisted && (
                                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-100 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('crm.trusted', 'Trusted')} Account
                                </span>
                            )}
                        </div>

                        {/* Success Rate */}
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-gray-500">{t('crm.deliverySuccess', 'Delivery Success')}</span>
                                <span className="text-xl font-black text-emerald-600">{Math.round(customer.deliverySuccessRate || 0)}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${customer.deliverySuccessRate || 0}%` }}></div>
                            </div>
                        </div>

                        {/* Refusal Rate */}
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-gray-500">{t('crm.refusalRateText', 'Refusal Rate')}</span>
                                <span className="text-xl font-black text-rose-600">{Math.round(customer.refusalRate || 0)}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${customer.refusalRate || 0}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-400 font-medium mt-2">{customer.totalRefusals} {t('crm.totalRefusals', 'total absolute refusals recorded.')}</p>
                        </div>

                        {/* Churn Risk */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-gray-500">{t('crm.churnRiskScore', 'Churn Risk Score')}</span>
                                <span className="text-xl font-black text-indigo-600">{Math.round(customer.churnRiskScore || 0)}/100</span>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${customer.churnRiskScore || 0}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-400 font-medium mt-2">{t('crm.churnRiskDesc', 'Predicted risk of customer abandonment.')}</p>
                        </div>
                    </div>
                </div>

            </div>

            {/* 3. Detailed History Tabs */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="flex border-b border-gray-100 bg-gray-50/50">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={clsx(
                            "px-6 py-4 text-sm font-bold flex items-center gap-2 transition-colors border-b-2",
                            activeTab === 'orders' ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-900"
                        )}
                    >
                        <Package className="w-4 h-4" /> {t('crm.tabOrderHistory', 'Order History')}
                        {orders.length > 0 && (
                            <span className={clsx('text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none', activeTab === 'orders' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500')}>{orders.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('support')}
                        className={clsx(
                            "px-6 py-4 text-sm font-bold flex items-center gap-2 transition-colors border-b-2",
                            activeTab === 'support' ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-900"
                        )}
                    >
                        <MessageSquare className="w-4 h-4" /> {t('crm.tabSupportTickets', 'Support Tickets')}
                        {tickets.length > 0 && (
                            <span className={clsx('text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none', activeTab === 'support' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500')}>{tickets.length}</span>
                        )}
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'orders' ? (
                        orders.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <p className="text-gray-500 font-medium">{t('crm.noCompletedOrders', 'No completed orders found for this customer.')}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-start border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                                            <th className="p-4 font-semibold rounded-tl-xl ps-6">{t('crm.colOrderId', 'Order ID')}</th>
                                            <th className="p-4 font-semibold">{t('crm.colDate', 'Date')}</th>
                                            <th className="p-4 font-semibold">{t('crm.colItems', 'Items')}</th>
                                            <th className="p-4 font-semibold">{t('crm.colAmount', 'Amount')}</th>
                                            <th className="p-4 font-semibold rounded-tr-xl">{t('crm.colResult', 'Result')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 text-sm">
                                        {orders.map(order => (
                                            <tr key={order._id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 ps-6 font-medium text-gray-900">
                                                    {order.orderNumber || order._id.toString().substring(18)}
                                                </td>
                                                <td className="p-4 text-gray-500">
                                                    {moment(order.createdAt).format('MMM DD, YYYY - HH:mm')}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-gray-700">{order.products.reduce((acc, p) => acc + p.quantity, 0)} {t('crm.itemsText', 'items')}</span>
                                                        <span className="text-xs text-gray-400 truncate max-w-[200px]">{order.products.map(p => p.variantId?.productId?.name || 'Unknown').join(', ')}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 font-black text-gray-900">
                                                    {order.totalAmount.toLocaleString()} DZ
                                                </td>
                                                <td className="p-4">
                                                    <span className={clsx(
                                                        "inline-flex px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                                                        ['Delivered', 'Paid'].includes(order.status) ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            ['Refused', 'Returned'].includes(order.status) ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                                ['Cancelled'].includes(order.status) ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                                    'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                    )}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : (
                        tickets.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <p className="text-gray-500 font-medium">{t('crm.noTickets', 'No support tickets generated for this customer.')}</p>
                                <button className="mt-3 px-4 py-2 bg-indigo-50 text-indigo-600 font-bold text-sm rounded-lg hover:bg-indigo-100 transition-colors">
                                    {t('crm.btnOpenTicket', 'Open New Ticket')}
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-start border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                                            <th className="p-4 font-semibold rounded-tl-xl ps-6">{t('crm.colTicketNo', 'Ticket No.')}</th>
                                            <th className="p-4 font-semibold">{t('crm.colOpened', 'Date Opened')}</th>
                                            <th className="p-4 font-semibold">{t('crm.colSubject', 'Subject')}</th>
                                            <th className="p-4 font-semibold">{t('crm.colStatus', 'Status')}</th>
                                            <th className="p-4 font-semibold rounded-tr-xl">{t('crm.colPriority', 'Priority')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 text-sm">
                                        {tickets.map(ticket => (
                                            <tr key={ticket._id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/support'}>
                                                <td className="p-4 ps-6 font-medium text-gray-900">
                                                    {ticket.ticketNumber}
                                                </td>
                                                <td className="p-4 text-gray-500">
                                                    {moment(ticket.createdAt).format('MMM DD, YYYY')}
                                                </td>
                                                <td className="p-4">
                                                    <span className="font-semibold text-gray-700 block truncate max-w-[250px]">{ticket.subject}</span>
                                                    <span className="text-xs text-gray-400">{ticket.type}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={clsx(
                                                        "inline-flex px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                                                        ticket.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            ticket.status === 'Closed' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                                'bg-amber-50 text-amber-700 border-amber-100'
                                                    )}>
                                                        {ticket.status}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={clsx(
                                                        "inline-flex px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                                                        ticket.priority === 'High' || ticket.priority === 'Urgent' ? 'text-rose-600 bg-rose-50 border-rose-200' :
                                                            'text-indigo-600 bg-indigo-50 border-indigo-200'
                                                    )}>
                                                        {ticket.priority}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>

        {/* Blacklist confirm dialog */}
        {blacklistConfirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center mb-4">
                        <ShieldAlert className="w-5 h-5 text-rose-600" />
                    </div>
                    <h3 className="text-base font-black text-gray-900 mb-2">
                        {customer?.blacklisted ? t('crm.confirmPardon', 'Remove blacklist?') : t('crm.confirmBlacklist', 'Blacklist this customer?')}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed mb-6">
                        {customer?.blacklisted
                            ? t('crm.confirmPardonDesc', 'This customer will be allowed to place orders again.')
                            : t('crm.confirmBlacklistDesc', 'Future orders from this customer will be auto-flagged for review.')}
                    </p>
                    {blacklistError && <p className="text-xs text-red-600 font-semibold mb-3">{blacklistError}</p>}
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setBlacklistConfirm(false)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button onClick={confirmToggleBlacklist} className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors">
                            {customer?.blacklisted ? t('crm.removeBlacklist', 'Remove Blacklist') : t('crm.addBlacklist', 'Blacklist')}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
