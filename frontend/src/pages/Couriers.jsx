import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Truck, TrendingUp, PackageX, DollarSign, Clock, Map, Settings } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Couriers() {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState({
        kpis: { totalShipments: 0, delivered: 0, returned: 0, inTransit: 0, successRate: 0, returnRate: 0, avgDeliveryTimeDays: 0 },
        financials: { totalDeliveredCOD: 0, pendingCourierClearance: 0, settledToBank: 0, uncollectedFromCustomer: 0 }
    });

    const [regionalData, setRegionalData] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [kpiRes, regionRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL || ''}/api/couriers/analytics/kpis?dateRange=30`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${import.meta.env.VITE_API_URL || ''}/api/couriers/analytics/regions?dateRange=30`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setStats(kpiRes.data);
            setRegionalData(regionRes.data);
        } catch (error) {
            console.error('Error fetching delivery analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading Logistic Metrics...</div>;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('couriers.dashboardTitle', 'Delivery Analytics')}
                subtitle={t('couriers.dashboardSubtitle', 'Monitor fleet performance and ECOTRACK synchronization.')}
                actions={
                    <button className="flex items-center gap-2 px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20 active:scale-95 leading-none">
                        <Settings className="w-5 h-5" /> {t('common.settings', 'Logistics Settings')}
                    </button>
                }
            />

            {/* Top KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{t('couriers.successRate', 'Delivery Success Rate')}</p>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tighter truncate">{stats.kpis.successRate}%</h3>
                        <p className="mt-1 text-xs text-gray-400 font-medium truncate">
                            {stats.kpis.delivered} Delivered out of {stats.kpis.totalShipments} Total
                        </p>
                    </div>
                    <div className="h-16 w-16 bg-green-50 rounded-2xl flex items-center justify-center border border-green-100 shrink-0">
                        <TrendingUp className="w-8 h-8 text-green-600" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{t('couriers.returnRate', 'Return Rate')}</p>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tighter truncate">{stats.kpis.returnRate}%</h3>
                        <p className="mt-1 text-xs text-red-500 font-medium truncate">
                            {stats.kpis.returned} Packages Failed / Returned
                        </p>
                    </div>
                    <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center border border-red-100 shrink-0">
                        <PackageX className="w-8 h-8 text-red-600" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{t('couriers.avgTime', 'Avg Delivery Speed')}</p>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tighter truncate">{stats.kpis.avgDeliveryTimeDays} <span className="text-sm font-medium text-gray-400">Days</span></h3>
                        <p className="mt-1 text-xs text-gray-400 font-medium truncate">
                            From Verification to Client Handshake
                        </p>
                    </div>
                    <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shrink-0">
                        <Clock className="w-8 h-8 text-blue-600" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{t('couriers.pendingCash', 'Pending Courier Clearance')}</p>
                        <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter truncate">
                            {stats.financials.pendingCourierClearance.toLocaleString()} <span className="text-sm font-medium text-gray-400">DZD</span>
                        </h3>
                        <div className="mt-2 text-[10px] sm:text-xs bg-green-50 text-green-700 font-bold px-2 py-1 rounded w-fit truncate">
                            Settled: {stats.financials.settledToBank.toLocaleString()}
                        </div>
                    </div>
                    <div className="h-16 w-16 bg-yellow-50 rounded-2xl flex items-center justify-center border border-yellow-100 shrink-0">
                        <DollarSign className="w-8 h-8 text-yellow-600" />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Regional Bar Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 lg:col-span-2 p-5">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                        <Map className="w-5 h-5 mr-2 text-indigo-500" />
                        Regional Success Distribution
                    </h3>
                    <div className="h-80 w-full" dir="ltr">
                        <ResponsiveContainer>
                            <BarChart data={regionalData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="wilaya"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="delivered" name="Successful" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} barSize={32} />
                                <Bar dataKey="returned" name="Failed/Return" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* COD Ledger Overview */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Live Form COD Pipeline</h3>
                    <div className="space-y-6">
                        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-center">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Delivered Package Value</p>
                                <p className="text-xl font-bold text-gray-900 mt-1">{stats.financials.totalDeliveredCOD.toLocaleString()} DZD</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-sm font-medium text-yellow-700">Pending Clearance</span>
                                    <span className="text-sm font-bold text-gray-900">{stats.financials.pendingCourierClearance.toLocaleString()} DZD</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${stats.financials.totalDeliveredCOD > 0 ? (stats.financials.pendingCourierClearance / stats.financials.totalDeliveredCOD) * 100 : 0}%` }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-sm font-medium text-green-700">Settled to Bank</span>
                                    <span className="text-sm font-bold text-gray-900">{stats.financials.settledToBank.toLocaleString()} DZD</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats.financials.totalDeliveredCOD > 0 ? (stats.financials.settledToBank / stats.financials.totalDeliveredCOD) * 100 : 0}%` }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-sm font-medium text-orange-700">Delivered, No Money</span>
                                    <span className="text-sm font-bold text-gray-900">{stats.financials.uncollectedFromCustomer.toLocaleString()} DZD</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${stats.financials.totalDeliveredCOD > 0 ? (stats.financials.uncollectedFromCustomer / stats.financials.totalDeliveredCOD) * 100 : 0}%` }}></div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
