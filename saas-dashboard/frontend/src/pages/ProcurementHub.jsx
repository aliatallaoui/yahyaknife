import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Truck, PackageSearch, Users, Plus, CheckCircle2, Clock, AlertTriangle, FileText, Download } from 'lucide-react';
import moment from 'moment';

export default function ProcurementHub() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'suppliers'
    const [orders, setOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [ordersRes, suppliersRes] = await Promise.all([
                axios.get('/api/procurement/orders'),
                axios.get('/api/procurement/suppliers')
            ]);
            setOrders(ordersRes.data);
            setSuppliers(suppliersRes.data);
        } catch (error) {
            console.error('Error fetching procurement data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Helper: Count active pending items versus fully received ones
    const getOrderStatusColor = (status) => {
        const map = {
            'Draft': 'bg-gray-100 text-gray-800',
            'Sent': 'bg-blue-100 text-blue-800',
            'Partial': 'bg-purple-100 text-purple-800',
            'Received': 'bg-green-100 text-green-800',
            'Cancelled': 'bg-red-100 text-red-800'
        };
        return map[status] || 'bg-gray-100 text-gray-800';
    };

    const getSupplierScoreColor = (score) => {
        if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
        if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    return (
        <div className="p-8 pb-32">
            <div className="flex justify-between items-start mb-8 border-b border-gray-200 pb-5">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Truck className="w-8 h-8 text-indigo-600" />
                        {t('procurement.title')}
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">{t('procurement.subtitle')}</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-indigo-700 hover:border-indigo-300 px-4 py-2 rounded-lg font-bold shadow-sm transition-colors">
                        <Users className="w-4 h-4" /> {t('procurement.addSupplier')}
                    </button>
                    <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 transition-colors">
                        <Plus className="w-4 h-4" /> {t('procurement.newPo')}
                    </button>
                </div>
            </div>

            {/* KPI Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl">
                        <PackageSearch className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">{t('procurement.activePos')}</p>
                        <p className="text-2xl font-black text-gray-900">{orders.filter(o => ['Sent', 'Partial'].includes(o.status)).length}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-xl">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">{t('procurement.completedMonth')}</p>
                        <p className="text-2xl font-black text-gray-900">
                            {orders.filter(o => o.status === 'Received' && moment(o.actualDeliveryDate).isSame(moment(), 'month')).length}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl">
                        <Users className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">{t('procurement.activeSuppliers')}</p>
                        <p className="text-2xl font-black text-gray-900">{suppliers.filter(s => s.status === 'Active').length}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">{t('procurement.delayedShipments')}</p>
                        <p className="text-2xl font-black text-gray-900">
                            {orders.filter(o => ['Sent', 'Partial'].includes(o.status) && moment().isAfter(moment(o.expectedDeliveryDate))).length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Tabs */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex border-b border-gray-200 bg-gray-50/50">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'orders' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                        <FileText className="w-4 h-4" /> {t('procurement.tabActivePos')}
                    </button>
                    <button
                        onClick={() => setActiveTab('suppliers')}
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'suppliers' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                        <Users className="w-4 h-4" /> {t('procurement.tabVendorDir')}
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-500">{t('procurement.loadingData')}</div>
                ) : (
                    <div className="p-0">
                        {activeTab === 'orders' && (
                            <table className="w-full text-start text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="p-4">{t('procurement.colPoNumber')}</th>
                                        <th className="p-4">{t('procurement.colSupplier')}</th>
                                        <th className="p-4">{t('procurement.colExpectedTarget')}</th>
                                        <th className="p-4">{t('procurement.colTotalAmount')}</th>
                                        <th className="p-4">{t('procurement.colStatus')}</th>
                                        <th className="p-4">{t('procurement.colActions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.length === 0 ? (
                                        <tr><td colSpan="6" className="p-8 text-center text-gray-500">{t('procurement.noPosFound')}</td></tr>
                                    ) : orders.map(order => (
                                        <tr key={order._id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4 font-bold text-gray-900">{order.poNumber}</td>
                                            <td className="p-4">
                                                <div className="font-medium text-gray-900">{order.supplier?.name}</div>
                                                <div className="text-xs text-gray-500">{t('procurement.trustScore')}: {order.supplier?.performanceMetrics?.reliabilityScore}%</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-gray-400" />
                                                    <span className={moment().isAfter(moment(order.expectedDeliveryDate)) && ['Sent', 'Partial'].includes(order.status) ? 'text-red-600 font-bold' : 'text-gray-600'}>
                                                        {moment(order.expectedDeliveryDate).format('MMM Do, YYYY')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 font-bold text-gray-900">{order.totalAmount.toLocaleString()}</td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getOrderStatusColor(order.status)} border-opacity-20`}>
                                                    {order.status === 'Draft' ? t('procurement.statusDraft') : order.status === 'Sent' ? t('procurement.statusSent') : order.status === 'Partial' ? t('procurement.statusPartial') : order.status === 'Received' ? t('procurement.statusReceived') : t('procurement.statusCancelled')}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <button className="text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                                                    {t('procurement.manageDelivery')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'suppliers' && (
                            <table className="w-full text-start text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="p-4">{t('procurement.colVendorName')}</th>
                                        <th className="p-4">{t('procurement.colContactPerson')}</th>
                                        <th className="p-4">{t('procurement.colAvgLeadTime')}</th>
                                        <th className="p-4">{t('procurement.colReliabilityScore')}</th>
                                        <th className="p-4">{t('procurement.colStatus')}</th>
                                        <th className="p-4">{t('procurement.colActions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.length === 0 ? (
                                        <tr><td colSpan="6" className="p-8 text-center text-gray-500">{t('procurement.noSuppliersFound')}</td></tr>
                                    ) : suppliers.map(sup => (
                                        <tr key={sup._id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4 font-bold text-gray-900">
                                                {sup.name}
                                                <div className="text-xs text-gray-400 font-normal mt-0.5">{sup.address?.city}, {sup.address?.country}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-gray-900">{sup.contactPerson?.name || '-'}</div>
                                                <div className="text-gray-500 text-xs">{sup.contactPerson?.email || '-'}</div>
                                            </td>
                                            <td className="p-4 text-gray-600">{sup.performanceMetrics?.averageLeadTimeDays} {t('procurement.daysText')}</td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded border ${getSupplierScoreColor(sup.performanceMetrics?.reliabilityScore)}`}>
                                                    {sup.performanceMetrics?.reliabilityScore}%
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 text-xs font-bold rounded-full ${sup.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                    {sup.status === 'Active' ? t('warehouses.statusActive') : t('warehouses.statusInactive')}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <button className="text-gray-600 hover:text-gray-900 font-bold text-sm">{t('procurement.editProfile')}</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
