import { useState, useContext, useEffect } from 'react';
import { ShoppingCart, TrendingUp, Users, Search, Download, Plus, Pencil, Trash2, CheckCircle2, Clock, AlertCircle, Filter, CheckSquare } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import clsx from 'clsx';
import moment from 'moment';
import { SalesContext } from '../context/SalesContext';
import { InventoryContext } from '../context/InventoryContext';
import { useCustomer } from '../context/CustomerContext';
import OrderModal from '../components/OrderModal';
import { useTranslation } from 'react-i18next';

const COLORS = ['#4361EE', '#111827', '#6B7280', '#D1D5DB', '#F87171', '#34D399'];

export default function Sales() {
    const { t } = useTranslation();
    const {
        orders, performance, loading, createOrder, updateOrder, deleteOrder,
        currentPage, totalPages, fetchSalesData
    } = useContext(SalesContext);
    const { products: inventoryProducts, refreshInventory } = useContext(InventoryContext);
    const { customers } = useCustomer();

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all' or 'verification'
    const [selectedCourierFilter, setSelectedCourierFilter] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());

    // Dependent Entities
    const [couriers, setCouriers] = useState([]);

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);

    useEffect(() => {
        fetch('/api/couriers')
            .then(res => res.json())
            .then(data => setCouriers(data))
            .catch(err => console.error("Error fetching couriers:", err));
    }, []);

    const handleCreateClick = () => {
        setEditingOrder(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (order) => {
        setEditingOrder(order);
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (id) => {
        if (window.confirm("Are you sure you want to cancel and remove this order?")) {
            try {
                await deleteOrder(id);
                if (refreshInventory) refreshInventory();
            } catch (error) {
                alert("Failed to delete order. See console limit.");
            }
        }
    };

    const handleBatchVerify = async () => {
        if (selectedOrderIds.size === 0) return;
        if (!window.confirm(`Verify ${selectedOrderIds.size} orders as Phone Confirmed?`)) return;

        try {
            // Note: In a real app we'd have a batch update endpoint, 
            // but for now we'll do promise all for simplicity.
            const promises = Array.from(selectedOrderIds).map(id =>
                updateOrder(id, { status: 'Confirmed', verificationStatus: 'Phone Confirmed' })
            );
            await Promise.all(promises);
            setSelectedOrderIds(new Set());
            fetchSalesData(currentPage);
        } catch (err) {
            console.error(err);
            alert("Error batch verifying orders.");
        }
    };

    const toggleOrderSelect = (id) => {
        const newSet = new Set(selectedOrderIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedOrderIds(newSet);
    };

    const toggleSelectAll = (filteredList) => {
        if (selectedOrderIds.size === filteredList.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(filteredList.map(o => o._id)));
        }
    };

    const handlePrevPage = () => { if (currentPage > 1) fetchSalesData(currentPage - 1); };
    const handleNextPage = () => { if (currentPage < totalPages) fetchSalesData(currentPage + 1); };

    const handleModalSubmit = async (payload) => {
        try {
            if (editingOrder) await updateOrder(editingOrder._id, payload);
            else await createOrder(payload);

            if (refreshInventory) refreshInventory();
            setIsModalOpen(false);
            return { success: true };
        } catch (error) {
            let msg = error.message || "Failed to save order.";
            try {
                const parsed = JSON.parse(msg);
                msg = parsed.message || msg;
            } catch (e) { }
            return { success: false, error: msg };
        }
    };

    if (loading && !orders.length) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    const channelData = performance?.channelDistribution ? Object.keys(performance.channelDistribution).map((key) => ({
        name: key,
        value: Number(performance.channelDistribution[key].revenue) || 0 // Fix: Recharts Pie needs pure Numbers, not strings!
    })).sort((a, b) => b.value - a.value) : [];

    // Count of orders needing verification
    const newOrderCount = orders.filter(o => o.status === 'New').length;

    // Advanced Filtering
    let displayOrders = orders;

    // 1. Tab Filter
    if (activeTab === 'verification') {
        displayOrders = displayOrders.filter(o => o.status === 'New');
    }

    // 2. Courier Filter
    if (selectedCourierFilter) {
        displayOrders = displayOrders.filter(o => o.courier === selectedCourierFilter || (o.courier && o.courier._id === selectedCourierFilter));
    }

    // 3. Search Filter
    const filteredOrders = displayOrders.filter(o =>
        o.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.status && o.status.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex flex-col gap-6">

            {/* Top Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('sales.title', 'Sales Management')}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t('sales.subtitle', 'Full commercial lifecycle tracking and order fulfillment.')}</p>
                </div>
                <div className="flex gap-3">
                    {/* Add CSV Export button later */}
                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-200 text-sm transition-colors hover:bg-gray-100">
                        <Download className="w-4 h-4" /> {t('sales.exportBtn', 'Export')}
                    </button>
                    <button onClick={handleCreateClick} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl text-sm transition-all hover:bg-blue-700 shadow-sm shadow-blue-600/20">
                        <Plus className="w-4 h-4" /> {t('sales.createOrderBtn', 'Create Order')}
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SalesCard
                    title={t('sales.totalVolume', 'Total Sales Volume')}
                    value={`${(performance?.totalSalesVolume || 0).toLocaleString()} DZ`}
                    icon={TrendingUp}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <SalesCard
                    title={t('sales.avgOrderValue', 'Average Order Value')}
                    value={`${(performance?.averageOrderValue || 0).toLocaleString()} DZ`}
                    icon={ShoppingCart}
                    color="text-purple-600"
                    bg="bg-purple-50"
                />
                <SalesCard
                    title={t('sales.totalOrdersCount', 'Total Orders Count')}
                    value={(performance?.totalOrders || 0).toLocaleString()}
                    icon={Users}
                    color="text-green-600"
                    bg="bg-green-50"
                />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Transaction History Table */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-6 border-b border-gray-100 gap-4">
                        <div className="flex bg-gray-100/80 p-1.5 rounded-xl">
                            <button onClick={() => { setActiveTab('all'); setSelectedOrderIds(new Set()); }} className={clsx("px-4 py-1.5 text-sm font-bold rounded-lg transition-all", activeTab === 'all' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                                {t('sales.allOrdersTab', 'All Orders')}
                            </button>
                            <button onClick={() => { setActiveTab('verification'); setSelectedOrderIds(new Set()); }} className={clsx("px-4 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2", activeTab === 'verification' ? "bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-200" : "text-gray-500 hover:text-gray-700")}>
                                <AlertCircle className="w-4 h-4" /> {t('sales.verificationTab', 'Verification Queue')}
                                {newOrderCount > 0 && (
                                    <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">{newOrderCount}</span>
                                )}
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Courier Filter */}
                            <div className="relative">
                                <Filter className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <select
                                    value={selectedCourierFilter}
                                    onChange={e => setSelectedCourierFilter(e.target.value)}
                                    className="bg-gray-50 border border-gray-200 outline-none rounded-lg py-2 ps-9 pe-6 text-sm focus:border-blue-500 transition-colors appearance-none font-medium text-gray-700"
                                >
                                    <option value="">{t('sales.filterAllCouriers', 'All Couriers')}</option>
                                    {couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="relative">
                                <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={t('sales.searchOrders', 'Search orders...')}
                                    className="bg-gray-50 border border-gray-200 outline-none rounded-lg py-2 ps-9 pe-4 text-sm focus:border-blue-500 w-48 transition-colors"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Batch Actions Bar (Only visible if items selected) */}
                    {selectedOrderIds.size > 0 && (
                        <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center justify-between">
                            <span className="text-sm font-bold text-blue-800">{selectedOrderIds.size} {t('sales.ordersSelected', 'Orders Selected')}</span>
                            <div className="flex gap-2">
                                {activeTab === 'verification' && (
                                    <button onClick={handleBatchVerify} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm">
                                        <CheckSquare className="w-4 h-4" /> {t('sales.batchVerifyBtn', 'Batch Verify')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-start border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="p-4 w-12 text-center">
                                        <input type="checkbox" onChange={() => toggleSelectAll(filteredOrders)} checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                                    </th>
                                    <th className="p-4 font-semibold">{t('sales.colOrder', 'Order ID')}</th>
                                    <th className="p-4 font-semibold">{t('sales.colDate', 'Date')}</th>
                                    <th className="p-4 font-semibold">{t('sales.colCustomer', 'Customer')}</th>
                                    <th className="p-4 font-semibold text-end">{t('sales.colAmount', 'Amount')}</th>
                                    <th className="p-4 font-semibold">{t('sales.colPipeline', 'Fulfillment Pipeline')}</th>
                                    <th className="p-4 font-semibold">{t('sales.colActions', 'Actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {filteredOrders.length === 0 ? (
                                    <tr><td colSpan="7" className="p-8 text-center text-gray-500">{t('sales.noOrders', 'No orders found matching that criteria.')}</td></tr>
                                ) : filteredOrders.map((order) => (
                                    <tr key={order._id} className={clsx("transition-colors", selectedOrderIds.has(order._id) ? "bg-blue-50/50" : "hover:bg-gray-50/50")}>
                                        <td className="p-4 text-center">
                                            <input type="checkbox" checked={selectedOrderIds.has(order._id)} onChange={() => toggleOrderSelect(order._id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                                        </td>
                                        <td className="p-4">
                                            <p className="font-medium text-gray-900 font-mono text-xs">{order.orderId}</p>
                                            <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                                order.verificationStatus === 'Phone Confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                                            )}>
                                                {order.verificationStatus || 'Unverified'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-500 whitespace-nowrap text-xs">{moment(order.date).format('MMM DD, HH:mm')}</td>
                                        <td className="p-4">
                                            <span className="text-gray-900 font-medium block">{order.customer?.name || t('sales.unknownCustomer', 'Unknown')}</span>
                                            {order.customer?.city && <span className="text-xs text-gray-400 block">{order.customer.city}</span>}
                                        </td>
                                        <td className="p-4 text-end font-bold tabular-nums text-gray-900">{order.totalAmount?.toLocaleString()} <span className="text-xs font-medium text-gray-400">DZ</span></td>
                                        <td className="p-4">
                                            {renderCodBadge(order.status, t)}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5">
                                                <button onClick={() => handleEditClick(order)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100">
                                                    <Pencil className="w-3 h-3" /> Edit
                                                </button>
                                                <button onClick={() => handleDeleteClick(order._id)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100">
                                                    <Trash2 className="w-3 h-3" /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/30 rounded-b-2xl">
                            <span className="text-sm font-medium text-gray-500">
                                {t('sales.page', 'Page')} {currentPage} {t('sales.of', 'of')} {totalPages}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 1}
                                    className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    {t('sales.prev', 'Previous')}
                                </button>
                                <button
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    {t('sales.next', 'Next')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Channels Breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-fit sticky top-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">{t('sales.revenueByChannel', 'Revenue by Channel')}</h3>
                    {channelData.length === 0 ? (
                        <div className="flex-1 min-h-[300px] flex items-center justify-center text-gray-400 text-sm">{t('sales.noChannelData', 'No channel data available.')}</div>
                    ) : (
                        <>
                            <div className="min-h-[250px] flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={channelData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={2}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {channelData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => [`${value.toLocaleString()} DZ`, t('sales.revenueText', 'Revenue')]}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                                {channelData.map((ch, i) => {
                                    const total = channelData.reduce((s, c) => s + c.value, 0);
                                    const pct = total > 0 ? Math.round((ch.value / total) * 100) : 0;
                                    return (
                                        <div key={i}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                                                    {ch.name}
                                                </span>
                                                <span className="text-xs font-bold text-gray-900 tabular-nums">{pct}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums text-right">{ch.value.toLocaleString()} DZ</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <OrderModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleModalSubmit}
                    initialData={editingOrder}
                    inventoryProducts={inventoryProducts}
                    customers={customers}
                    couriers={couriers}
                />
            )}
        </div>
    );
}

function renderCodBadge(status, t) {
    if (!t) return <Badge text={status || 'Unknown'} color="text-gray-700" bg="bg-gray-100" />
    switch (status) {
        case 'New': return <Badge text={t('sales.statusNew', 'New')} color="text-gray-700" bg="bg-gray-100" />;
        case 'Confirmed': return <Badge icon={CheckCircle2} text={t('sales.statusConfirmed', 'Confirmed')} color="text-blue-700" bg="bg-blue-50" />;
        case 'Preparing': return <Badge icon={Clock} text={t('sales.statusPreparing', 'Preparing')} color="text-orange-700" bg="bg-orange-50" />;
        case 'Ready for Pickup': return <Badge icon={ShoppingCart} text={t('sales.statusReady', 'Ready for Pickup')} color="text-yellow-700" bg="bg-yellow-50" />;
        case 'Shipped': return <Badge icon={TrendingUp} text={t('sales.statusShipped', 'Shipped')} color="text-indigo-700" bg="bg-indigo-50" />;
        case 'Out for Delivery': return <Badge icon={Users} text={t('sales.statusOutForDelivery', 'Out for Delivery')} color="text-emerald-700" bg="bg-emerald-50" />;
        case 'Delivered': return <Badge icon={CheckCircle2} text={t('sales.statusDelivered', 'Delivered')} color="text-green-700" bg="bg-green-50" />;
        case 'Paid': return <Badge icon={CheckCircle2} text={t('sales.statusPaid', 'Paid (Settled)')} color="text-teal-700" bg="bg-teal-50" />;
        case 'Refused': return <Badge icon={AlertCircle} text={t('sales.statusRefused', 'Refused')} color="text-red-700" bg="bg-red-50" />;
        case 'Returned': return <Badge icon={AlertCircle} text={t('sales.statusReturned', 'Returned')} color="text-rose-700" bg="bg-rose-50" />;
        case 'Cancelled': return <Badge icon={Trash2} text={t('sales.statusCancelled', 'Cancelled')} color="text-gray-500" bg="bg-gray-100" />;
        default: return <Badge text={status || 'Unknown'} color="text-gray-700" bg="bg-gray-100" />;
    }
}

function Badge({ icon: Icon, text, color, bg }) {
    return (
        <span className={clsx("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold", bg, color)}>
            {Icon && <Icon className="w-3.5 h-3.5" />} {text}
        </span>
    );
}

function SalesCard({ title, value, icon: Icon, color, bg }) {
    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className={clsx("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", bg, color)}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs font-semibold text-gray-500 mb-0.5">{title}</p>
                <h3 className="text-xl font-black text-gray-900 tabular-nums tracking-tight">{value}</h3>
            </div>
        </div>
    );
}
