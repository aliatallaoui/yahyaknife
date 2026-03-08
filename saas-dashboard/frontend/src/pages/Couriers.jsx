import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Truck, TrendingUp, PackageX, DollarSign, Clock, Map } from 'lucide-react';
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
                axios.get('/api/couriers/analytics/kpis?dateRange=30', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/couriers/analytics/regions?dateRange=30', { headers: { Authorization: `Bearer ${token}` } })
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Truck className="w-7 h-7 mr-3 text-indigo-600" />
                        {t('couriers.dashboardTitle', 'Delivery & Logistics Analytics')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {t('couriers.dashboardSubtitle', 'Monitor fleet performance, ECOTRACK synchronization, and pending COD settlements (Past 30 Days).')}
                    </p>
                </div>
            </div>

            {/* Top KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">{t('couriers.successRate', 'Delivery Success Rate')}</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.kpis.successRate}%</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-gray-500">
                        {stats.kpis.delivered} Delivered out of {stats.kpis.totalShipments} Total
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">{t('couriers.returnRate', 'Return Rate')}</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.kpis.returnRate}%</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                            <PackageX className="w-5 h-5 text-red-600" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-red-500 border-t border-red-50 pt-2 font-medium">
                        {stats.kpis.returned} Packages Failed / Returned
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">{t('couriers.avgTime', 'Avg Delivery Speed')}</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.kpis.avgDeliveryTimeDays} <span className="text-lg font-normal text-gray-400">Days</span></p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-gray-500">
                        From Verification to Client Handshake
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">{t('couriers.pendingCash', 'Pending Courier Clearance')}</p>
                            <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{stats.financials.pendingCourierClearance.toLocaleString()} DZD</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center shrink-0">
                            <DollarSign className="w-5 h-5 text-yellow-600" />
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <span className="text-xs bg-green-50 text-green-700 font-medium px-2 py-1 rounded">Settled: {stats.financials.settledToBank.toLocaleString()}</span>
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
