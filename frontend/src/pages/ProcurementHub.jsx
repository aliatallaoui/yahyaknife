import React, { useState, useEffect, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Truck, PackageSearch, Users, Plus, CheckCircle2, Clock, AlertTriangle, FileText, Download, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import moment from 'moment';
import NewPOModal from '../components/NewPOModal';
import NewSupplierModal from '../components/NewSupplierModal';
import { AuthContext } from '../context/AuthContext';
import { useHotkey } from '../hooks/useHotkey';

export default function ProcurementHub() {
    const { t } = useTranslation();
    const { hasPermission, token } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'suppliers'
    const [orders, setOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [isPOModalOpen, setIsPOModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    const fetchData = async () => {
        try {
            setLoading(true);
            const authHeader = { headers: { Authorization: `Bearer ${token}` } };
            const [ordersRes, suppliersRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL || ''}/api/procurement/orders`, authHeader),
                axios.get(`${import.meta.env.VITE_API_URL || ''}/api/procurement/suppliers`, authHeader)
            ]);
            setOrders(ordersRes.data?.data ?? ordersRes.data);
            setSuppliers(suppliersRes.data?.data ?? suppliersRes.data);
        } catch (error) {
            setFetchError(error.response?.data?.error || error.message || 'Failed to load procurement data.');
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

    const term = searchTerm.toLowerCase();
    const filteredOrders = orders.filter(o =>
        o.poNumber?.toLowerCase().includes(term) ||
        o.supplier?.name?.toLowerCase().includes(term)
    );
    const filteredSuppliers = suppliers.filter(s =>
        s.name?.toLowerCase().includes(term) ||
        s.contactPerson?.name?.toLowerCase().includes(term)
    );

    return (
        <div className="p-8 pb-32">
            <PageHeader
                title={t('procurement.title', 'Procurement Hub')}
                subtitle={t('procurement.subtitle', 'Strategic sourcing, purchase orders, and supplier relationship management.')}
                variant="procurement"
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-purple-500 absolute start-3 top-1/2 -translate-y-1/2" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={t('procurement.searchPlaceholder', 'Search... (Press /)')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ps-9 pe-4 py-2 bg-white border border-purple-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all w-48 sm:w-64 shadow-sm font-bold"
                            />
                        </div>
                        {hasPermission('procurement.create_po') && (
                            <button
                                onClick={() => setIsPOModalOpen(true)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-[#5D5DFF] hover:bg-[#4D4DFF] text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 leading-none"
                            >
                                <Plus className="w-5 h-5" /> {t('procurement.newPo', 'New Purchase Order')}
                            </button>
                        )}
                        {(hasPermission('procurement.create_po') || hasPermission('inventory.create_product')) && (
                            <button
                                onClick={() => setIsSupplierModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-all shadow-sm active:scale-95 leading-none"
                            >
                                <Users className="w-4 h-4" /> {t('procurement.addSupplier')}
                            </button>
                        )}
                    </div>
                }
            />

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 mb-6 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600">✕</button>
                </div>
            )}

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
                        {filteredOrders.length > 0 && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${activeTab === 'orders' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>{filteredOrders.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('suppliers')}
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'suppliers' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                        <Users className="w-4 h-4" /> {t('procurement.tabVendorDir')}
                        {filteredSuppliers.length > 0 && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${activeTab === 'suppliers' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>{filteredSuppliers.length}</span>
                        )}
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex flex-col items-center gap-3 text-gray-400">
                        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-indigo-600 animate-spin" />
                        <span className="text-sm font-medium">{t('procurement.loadingData', 'Loading...')}</span>
                    </div>
                ) : (
                    <div className="p-0">
                        {activeTab === 'orders' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-start text-sm min-w-[900px]">
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
                                        {filteredOrders.length === 0 ? (
                                            <tr><td colSpan="6" className="p-8 text-center text-gray-500">{t('procurement.noPosFound')}</td></tr>
                                        ) : filteredOrders.map(order => (
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
                                                    {hasPermission('procurement.receive_goods') && (
                                                        <button className="text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                                                            {t('procurement.manageDelivery')}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'suppliers' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-start text-sm min-w-[900px]">
                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                        <tr>
                                            <th className="p-4">{t('procurement.colVendorName')}</th>
                                            <th className="p-4">{t('procurement.category', 'Category')}</th>
                                            <th className="p-4">{t('procurement.colContactPerson')}</th>
                                            <th className="p-4">{t('procurement.colAvgLeadTime')}</th>
                                            <th className="p-4">{t('procurement.colReliabilityScore')}</th>
                                            <th className="p-4">{t('procurement.colStatus')}</th>
                                            <th className="p-4">{t('procurement.colActions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSuppliers.length === 0 ? (
                                            <tr><td colSpan="6" className="p-8 text-center text-gray-500">{t('procurement.noSuppliersFound')}</td></tr>
                                        ) : filteredSuppliers.map(sup => (
                                            <tr key={sup._id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 font-bold text-gray-900">
                                                    {sup.name}
                                                    <div className="text-xs text-gray-400 font-normal mt-0.5">{sup.address?.city}, {sup.address?.country}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-sm font-bold text-gray-800">{sup.supplierCategory || 'General Hardware'}</div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {(sup.materialsSupplied || []).map(mat => (
                                                            <span key={mat} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded">{mat}</span>
                                                        ))}
                                                    </div>
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
                                                    {(hasPermission('procurement.create_po') || hasPermission('inventory.update_product')) && (
                                                        <button className="text-gray-600 hover:text-gray-900 font-bold text-sm">{t('procurement.editProfile')}</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <NewPOModal
                isOpen={isPOModalOpen}
                onClose={() => setIsPOModalOpen(false)}
                suppliers={suppliers}
                onSuccess={() => {
                    fetchData();
                    setIsPOModalOpen(false);
                }}
            />
            <NewSupplierModal
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                onSuccess={() => {
                    fetchData();
                    setIsSupplierModalOpen(false);
                }}
            />
        </div>
    );
}
