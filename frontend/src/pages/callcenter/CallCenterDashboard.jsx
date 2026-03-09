import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PhoneCall, CheckCircle, Clock, AlertCircle, TrendingUp,
    Search, Filter, Eye, Phone, RefreshCw
} from 'lucide-react';
import OrderActionDrawer from '../../components/callcenter/OrderActionDrawer';

export default function CallCenterDashboard() {
    const { t } = useTranslation();
    const [stats, setStats] = useState({
        totalAssigned: 0,
        awaitingConfirmation: 0,
        confirmedToday: 0,
        deliveredTotal: 0,
        callsMadeToday: 0,
        commissionEarnedToday: 0
    });
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            // Note: In a real environment, this hits the backend with auth token
            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/call-center/agent-dashboard`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data.metrics || stats);
                setOrders(data.orders || []);
            } else {
                // Mock data fallback if API is not fully hooked up or authenticated yet
                setStats({
                    totalAssigned: 45, awaitingConfirmation: 12, confirmedToday: 30,
                    deliveredTotal: 150, callsMadeToday: 35, commissionEarnedToday: 3000
                });
                setOrders([
                    { _id: '1', orderNumber: 'ORD-1001', customer: { firstName: 'Ahmed', lastName: 'Benali', phone: '0555123456' }, wilaya: 'Algiers', commune: 'Bab Ezzouar', totalAmount: 4500, status: 'New', createdAt: new Date().toISOString() },
                    { _id: '2', orderNumber: 'ORD-1002', customer: { firstName: 'Sarah', lastName: 'Toumi', phone: '0666987654' }, wilaya: 'Oran', commune: 'Es Senia', totalAmount: 12500, status: 'New', createdAt: new Date(Date.now() - 3600000).toISOString() }
                ]);
            }
        } catch (error) {
            console.error("Dashboard Fetch Error", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    const openActionDrawer = (order) => {
        setSelectedOrder(order);
        setIsDrawerOpen(true);
    };

    const handleDrawerClose = (refresh = false) => {
        setIsDrawerOpen(false);
        setSelectedOrder(null);
        if (refresh) fetchDashboard();
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

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        {t('callcenter.agent_dashboard', 'Agent Workspace')}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">{t('callcenter.agent_subtitle', 'Manage your assigned orders and call logs.')}</p>
                </div>
                <button onClick={fetchDashboard} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title={t('callcenter.kpi.awaiting', 'Awaiting Action')} value={stats.awaitingConfirmation} icon={Clock} colorClass="bg-amber-500" />
                <KPICard title={t('callcenter.kpi.confirmed_today', 'Confirmed Today')} value={stats.confirmedToday} icon={CheckCircle} colorClass="bg-emerald-500" />
                <KPICard title={t('callcenter.kpi.calls_today', 'Calls Made')} value={stats.callsMadeToday} icon={PhoneCall} colorClass="bg-blue-500" />
                <KPICard title={t('callcenter.kpi.commission', 'Est. Commission')} value={stats.commissionEarnedToday.toLocaleString()} suffix=" DZD" icon={TrendingUp} colorClass="bg-purple-500" />
            </div>

            {/* Queue */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[600px]">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">{t('callcenter.queue.title', 'Active Queue')}</h3>
                    <div className="flex gap-2">
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder={t('general.search', 'Search orders...')}
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-semibold">{t('callcenter.queue.order', 'Order #')}</th>
                                <th className="px-6 py-4 font-semibold">{t('callcenter.queue.customer', 'Customer')}</th>
                                <th className="px-6 py-4 font-semibold">{t('callcenter.queue.location', 'Location')}</th>
                                <th className="px-6 py-4 font-semibold">{t('callcenter.queue.amount', 'Amount')}</th>
                                <th className="px-6 py-4 font-semibold">{t('callcenter.queue.time', 'Time Waiting')}</th>
                                <th className="px-6 py-4 font-semibold text-right">{t('callcenter.queue.action', 'Action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                        <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p>{t('callcenter.queue.empty', 'Inbox zero! You have processed all assigned orders.')}</p>
                                    </td>
                                </tr>
                            )}
                            {orders.map((order) => {
                                const waitHours = Math.floor((new Date() - new Date(order.createdAt)) / 3600000);
                                return (
                                    <tr key={order._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-gray-900">{order.orderNumber}</td>
                                        <td className="px-6 py-4">
                                            <p className="text-gray-900 font-medium">{order.customer?.firstName} {order.customer?.lastName}</p>
                                            <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                                                <Phone className="w-3 h-3" /> {order.customer?.phone || 'N/A'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{order.wilaya}, {order.commune}</td>
                                        <td className="px-6 py-4 font-bold text-gray-900">{order.totalAmount?.toLocaleString()} DZD</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${waitHours > 24 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {waitHours} {t('time.hours', 'hrs')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openActionDrawer(order)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors font-medium text-xs"
                                            >
                                                <PhoneCall className="w-3.5 h-3.5" />
                                                {t('callcenter.action.call', 'Process')}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {isDrawerOpen && (
                <OrderActionDrawer
                    order={selectedOrder}
                    onClose={() => handleDrawerClose()}
                    onSuccess={() => handleDrawerClose(true)}
                />
            )}
        </div>
    );
}
