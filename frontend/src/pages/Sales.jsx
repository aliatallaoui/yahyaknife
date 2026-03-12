import React, { useState, useContext, useEffect, useRef } from 'react';
import { useHotkey } from '../hooks/useHotkey';
import { ShoppingCart, TrendingUp, Users, Search, Download, Plus, Pencil, Trash2, CheckCircle2, Clock, AlertCircle, Filter, CheckSquare, ChevronDown, ChevronUp, Package, MapPin, Tag, CreditCard, AlertTriangle, FileText, Wrench, Truck, ShoppingBag, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import axios from 'axios';
import clsx from 'clsx';
import moment from 'moment';
import { SalesContext } from '../context/SalesContext';
import { InventoryContext } from '../context/InventoryContext';
import { useCustomer } from '../context/CustomerContext';
import OrderModal from '../components/OrderModal';
import BatchDispatchModal from '../components/BatchDispatchModal';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';

const COLORS = ['#4361EE', '#111827', '#6B7280', '#D1D5DB', '#F87171', '#34D399'];

const COD_STATUSES = ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'];

const STATUS_STYLES = {
    'New': 'bg-gray-100 text-gray-700 border-gray-200',
    'Confirmed': 'bg-blue-50 text-blue-700 border-blue-200',
    'Preparing': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Ready for Pickup': 'bg-violet-50 text-violet-700 border-violet-200',
    'Dispatched': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'Shipped': 'bg-amber-50 text-amber-700 border-amber-200',
    'Out for Delivery': 'bg-orange-50 text-orange-700 border-orange-200',
    'Delivered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Paid': 'bg-green-50 text-green-700 border-green-200',
    'Refused': 'bg-red-50 text-red-700 border-red-200',
    'Returned': 'bg-rose-50 text-rose-700 border-rose-200',
    'Cancelled': 'bg-gray-50 text-gray-400 border-gray-200 line-through',
};

export default function Sales() {
    const { t } = useTranslation();
    const { hasPermission } = useContext(AuthContext);
    const {
        orders, performance, loading, fetchError, createOrder, updateOrder, deleteOrder,
        currentPage, totalPages, fetchSalesData
    } = useContext(SalesContext);
    const { products: inventoryProducts, refreshInventory } = useContext(InventoryContext);
    const { customers } = useCustomer();

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [selectedCourierFilter, setSelectedCourierFilter] = useState('');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
    const [selectedChannelFilter, setSelectedChannelFilter] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());    // Dependent Entities
    const [couriers, setCouriers] = useState([]);

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [isBatchDispatchOpen, setIsBatchDispatchOpen] = useState(false);

    // Rows per page
    const [perPage, setPerPage] = useState(10);

    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    // Inline status/channel update loading
    const [updatingOrderId, setUpdatingOrderId] = useState(null);

    // Inline field editing: { id, field, value }
    const [editingOrderField, setEditingOrderField] = useState(null);

    // Row expansion
    const [expandedOrderId, setExpandedOrderId] = useState(null);

    // In-app feedback — replaces alert() / window.confirm()
    const [confirmDialog, setConfirmDialog] = useState(null); // { title, body, danger, onConfirm }
    const [toast, setToast] = useState(null); // { type: 'success'|'error', text }
    const showToast = (type, text) => { setToast({ type, text }); setTimeout(() => setToast(null), 4000); };
    const [dispatchingOrderId, setDispatchingOrderId] = useState(null);
    const toggleExpand = (id) => setExpandedOrderId(prev => prev === id ? null : id);

    const startOrderEdit = (order, field) =>
        setEditingOrderField({ id: order._id, field, value: order[field] ?? '' });

    const handleOrderInlineSave = async (order) => {
        if (!editingOrderField || editingOrderField.id !== order._id) return;
        setUpdatingOrderId(order._id);
        try {
            await updateOrder(order._id, { [editingOrderField.field]: editingOrderField.value });
        } catch (err) {
            showToast('error', 'Inline save failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setUpdatingOrderId(null);
            setEditingOrderField(null);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/couriers`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => {
                if (!res.ok) throw new Error(`Failed to load couriers: ${res.status}`);
                return res.json();
            })
            .then(data => setCouriers(Array.isArray(data) ? data : []))
            .catch(() => showToast('error', 'Failed to load courier list for filters.'));
    }, []);

    const handleCreateClick = () => {
        setEditingOrder(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (order) => {
        setEditingOrder(order);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (id) => {
        setConfirmDialog({
            title: t('sales.deleteOrderTitle', 'Move order to Trash?'),
            body: t('sales.deleteOrderBody', 'The order will be soft-deleted and can be restored from the Trash tab.'),
            danger: false,
            onConfirm: async () => {
                try {
                    await deleteOrder(id);
                    if (refreshInventory) refreshInventory();
                } catch {
                    showToast('error', 'Failed to delete order.');
                }
            },
        });
    };

    const handleQuickDispatch = (orderId) => {
        setConfirmDialog({
            title: t('sales.dispatchConfirmTitle', 'Dispatch to Ecotrack now?'),
            body: t('sales.dispatchConfirmBody', 'This will create a shipment record and mark the order as Dispatched.'),
            danger: false,
            onConfirm: async () => {
                setDispatchingOrderId(orderId);
                try {
                    const token = localStorage.getItem('token');
                    await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/shipments/quick-dispatch/${orderId}`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    showToast('success', 'Order dispatched — tracking info saved.');
                    fetchSalesData(currentPage, perPage);
                } catch (err) {
                    showToast('error', 'Dispatch failed: ' + (err.response?.data?.message || err.message));
                } finally {
                    setDispatchingOrderId(null);
                }
            },
        });
    };

    const handleBatchVerify = async () => {
        if (selectedOrderIds.size === 0) return;
        setConfirmDialog({
            title: t('sales.batchVerifyTitle', 'Confirm {{count}} orders as Phone Verified?', { count: selectedOrderIds.size }),
            body: t('sales.batchVerifyBody', 'Status will be updated to Confirmed for all selected orders.'),
            danger: false,
            onConfirm: async () => {
                try {
                    const promises = Array.from(selectedOrderIds).map(id =>
                        updateOrder(id, { status: 'Confirmed', verificationStatus: 'Phone Confirmed' })
                    );
                    await Promise.all(promises);
                    setSelectedOrderIds(new Set());
                    fetchSalesData(currentPage, perPage);
                } catch (err) {
                    console.error(err);
                    showToast('error', 'Error batch verifying orders.');
                }
            },
        });
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

    const handlePrevPage = () => { if (currentPage > 1) fetchSalesData(currentPage - 1, perPage); };
    const handleNextPage = () => { if (currentPage < totalPages) fetchSalesData(currentPage + 1, perPage); };

    const handleInlineStatusChange = async (orderId, newStatus) => {
        setUpdatingOrderId(orderId);
        try {
            await updateOrder(orderId, { status: newStatus });
        } catch (err) {
            showToast('error', 'Status update failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setUpdatingOrderId(null);
        }
    };

    const handleInlineChannelChange = async (orderId, newChannel) => {
        setUpdatingOrderId(orderId);
        try {
            await updateOrder(orderId, { channel: newChannel });
        } catch (err) {
            showToast('error', 'Channel update failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setUpdatingOrderId(null);
        }
    };

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
            } catch { /* ignore parsing errors */ }
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

    // 3. Status Filter
    if (selectedStatusFilter) {
        displayOrders = displayOrders.filter(o => o.status === selectedStatusFilter);
    }

    // 4. Channel Filter
    if (selectedChannelFilter) {
        displayOrders = displayOrders.filter(o => o.channel === selectedChannelFilter);
    }

    // 5. Search Filter
    const filteredOrders = displayOrders.filter(o =>
        o.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.status && o.status.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const activeFilterCount = [selectedCourierFilter, selectedStatusFilter, selectedChannelFilter, searchTerm].filter(Boolean).length;

    return (
        <div className="flex flex-col gap-6">

            {/* Top Header */}
            <PageHeader
                title={t('sales.title', 'Sales Management')}
                subtitle={t('sales.subtitle', 'Full commercial lifecycle tracking and order fulfillment.')}
                variant="sales"
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-rose-500 absolute start-3 top-1/2 -translate-y-1/2" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={t('sales.searchOrders', 'Search orders... (Press /)')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ps-9 pe-4 py-2 bg-white border border-rose-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all w-48 sm:w-64 shadow-sm font-bold"
                            />
                        </div>
                        {hasPermission('orders.create') && (
                            <button onClick={handleCreateClick} className="flex items-center gap-2 px-6 py-2.5 bg-[#5D5DFF] hover:bg-[#4D4DFF] text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 leading-none">
                                <Plus className="w-5 h-5" /> {t('sales.createOrderBtn', 'Create Order')}
                            </button>
                        )}
                        {hasPermission('orders.export') && (
                            <button className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-all border border-gray-200 shadow-sm active:scale-95 leading-none">
                                <Download className="w-4 h-4 text-rose-500" /> {t('sales.exportBtn', 'Export')}
                            </button>
                        )}
                    </div>
                }
            />

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => fetchSalesData(currentPage)} className="text-red-400 hover:text-red-600 text-xs font-bold">{t('common.retry', 'Retry')}</button>
                </div>
            )}

            {/* Full-width Order Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center p-4 sm:p-6 border-b border-gray-100 gap-4">
                    <div className="flex flex-wrap gap-1 bg-gray-100/80 p-1.5 rounded-xl w-full xl:w-auto">
                        <button onClick={() => { setActiveTab('all'); setSelectedOrderIds(new Set()); }} className={clsx("flex-1 xl:flex-none px-4 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all text-center", activeTab === 'all' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                            {t('sales.allOrdersTab', 'All Orders')}
                        </button>
                        <button onClick={() => { setActiveTab('verification'); setSelectedOrderIds(new Set()); }} className={clsx("flex-1 xl:flex-none px-4 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2 whitespace-nowrap", activeTab === 'verification' ? "bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-200" : "text-gray-500 hover:text-gray-700")}>
                            <AlertCircle className="w-4 h-4 shrink-0" /> {t('sales.verificationTab', 'Verification Queue')}
                            {newOrderCount > 0 && (
                                <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">{newOrderCount}</span>
                            )}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                            {/* Status Filter */}
                            <select
                                value={selectedStatusFilter}
                                onChange={e => setSelectedStatusFilter(e.target.value)}
                                className={clsx("flex-1 min-w-[130px] bg-gray-50 border outline-none rounded-xl py-2 px-3 text-sm font-medium transition-colors appearance-none cursor-pointer",
                                    selectedStatusFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-600'
                                )}
                            >
                                <option value="">All Statuses</option>
                                {['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>

                            {/* Channel Filter */}
                            <select
                                value={selectedChannelFilter}
                                onChange={e => setSelectedChannelFilter(e.target.value)}
                                className={clsx("flex-1 min-w-[130px] bg-gray-50 border outline-none rounded-xl py-2 px-3 text-sm font-medium transition-colors appearance-none cursor-pointer",
                                    selectedChannelFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-600'
                                )}
                            >
                                <option value="">All Channels</option>
                                {['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Other'].map(ch => (
                                    <option key={ch} value={ch}>{ch}</option>
                                ))}
                            </select>

                            {/* Courier Filter */}
                            <select
                                value={selectedCourierFilter}
                                onChange={e => setSelectedCourierFilter(e.target.value)}
                                className={clsx("flex-1 min-w-[130px] bg-gray-50 border outline-none rounded-xl py-2 px-3 text-sm font-medium transition-colors appearance-none cursor-pointer",
                                    selectedCourierFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-600'
                                )}
                            >
                                <option value="">All Couriers</option>
                                {couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>

                            {/* Clear All button (only when filters are active) */}
                            {activeFilterCount > 0 && (
                                <button
                                    onClick={() => { setSelectedStatusFilter(''); setSelectedChannelFilter(''); setSelectedCourierFilter(''); setSearchTerm(''); }}
                                    className="flex-1 min-w-[100px] flex justify-center items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100 transition-colors whitespace-nowrap"
                                >
                                    ✕ Clear ({activeFilterCount})
                                </button>
                            )}
                        </div>
                    </div>

                    <>
                        {/* Batch Actions Bar (Only visible if items selected) */}
                        {
                            selectedOrderIds.size > 0 && (
                                <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center justify-between">
                                    <span className="text-sm font-bold text-blue-800">{selectedOrderIds.size} {t('sales.ordersSelected', 'Orders Selected')}</span>
                                    <div className="flex gap-2">
                                        {activeTab === 'verification' && hasPermission('orders.edit') && (
                                            <button onClick={handleBatchVerify} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm">
                                                <CheckSquare className="w-4 h-4" /> {t('sales.batchVerifyBtn', 'Batch Verify')}
                                            </button>
                                        )}
                                        {hasPermission('shipments.create') && (
                                            <button onClick={() => setIsBatchDispatchOpen(true)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm">
                                                <Truck className="w-4 h-4" /> Dispatch ({selectedOrderIds.size})
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        }

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-start border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 text-gray-400 text-[11px] uppercase tracking-widest border-b border-gray-100">
                                        <th className="px-4 py-3 w-10">
                                            <input type="checkbox" onChange={() => toggleSelectAll(filteredOrders)} checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                                        </th>
                                        <th className="px-4 py-3 font-semibold text-start">Order</th>
                                        <th className="px-4 py-3 font-semibold text-start">Customer</th>
                                        <th className="px-4 py-3 font-semibold text-start">Items</th>
                                        <th className="px-4 py-3 font-semibold text-start">Channel</th>
                                        <th className="px-4 py-3 font-semibold text-start">Courier</th>
                                        <th className="px-4 py-3 font-semibold text-end">Amount</th>
                                        <th className="px-4 py-3 font-semibold text-center">Status</th>
                                        <th className="px-4 py-3 font-semibold text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-sm">
                                    {filteredOrders.length === 0 ? (
                                        <tr><td colSpan="9" className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-3 text-gray-400">
                                                <ShoppingCart className="w-10 h-10 opacity-25" />
                                                <p className="font-medium">No orders found.</p>
                                            </div>
                                        </td></tr>
                                    ) : filteredOrders.map((order) => {
                                        const initials = (order.customer?.name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                                        const isVerified = order.verificationStatus === 'Phone Confirmed';
                                        const itemCount = (order.products || []).length;
                                        const firstItem = order.products?.[0];
                                        const isExpanded = expandedOrderId === order._id;
                                        return (
                                            <React.Fragment key={order._id}>
                                                <tr onClick={() => toggleExpand(order._id)} className={clsx("cursor-pointer group transition-colors", selectedOrderIds.has(order._id) ? "bg-blue-50" : "hover:bg-gray-50/60")}>

                                                    {/* Checkbox */}
                                                    <td className="px-4 py-3.5">
                                                        <input onClick={e => e.stopPropagation()} type="checkbox" checked={selectedOrderIds.has(order._id)} onChange={() => toggleOrderSelect(order._id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                                                    </td>

                                                    {/* Order ID + Date + Verification */}
                                                    <td className="px-4 py-3.5">
                                                        <p className="font-bold text-gray-800 text-sm">{order.orderId}</p>
                                                        <p className="text-xs text-gray-400">{moment(order.createdAt).format('MMM DD · HH:mm')}</p>
                                                        {isVerified && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full mt-1">
                                                                <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Customer avatar + name */}
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
                                                                <span className="text-[11px] font-black text-white">{initials}</span>
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-gray-900 text-sm leading-tight">{order.customer?.name || 'Unknown'}</p>
                                                                {order.customer?.city && <p className="text-xs text-gray-400">{order.customer.city}</p>}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Items */}
                                                    <td className="px-4 py-3.5">
                                                        {itemCount === 0 ? (
                                                            <span className="text-xs text-gray-300 italic">—</span>
                                                        ) : (
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-800 truncate max-w-[140px]">{firstItem?.name || 'Product'}</p>
                                                                {itemCount > 1 && <p className="text-xs text-gray-400">+{itemCount - 1} more item{itemCount > 2 ? 's' : ''}</p>}
                                                                <p className="text-xs text-gray-400">Qty: {order.products.reduce((s, p) => s + (p.quantity || 0), 0)}</p>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Channel — inline select */}
                                                    <td className="px-4 py-3.5">
                                                        <select
                                                            value={order.channel || ''}
                                                            onChange={e => handleInlineChannelChange(order._id, e.target.value)}
                                                            onClick={e => e.stopPropagation()}
                                                            disabled={!hasPermission('orders.edit')}
                                                            className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 appearance-none cursor-pointer outline-none w-full transition-colors hover:bg-blue-100 disabled:opacity-75 disabled:cursor-not-allowed"
                                                        >
                                                            {['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Other'].map(ch => (
                                                                <option key={ch} value={ch}>{ch}</option>
                                                            ))}
                                                        </select>
                                                    </td>

                                                    {/* Courier — inline select */}
                                                    <td className="px-4 py-3.5">
                                                        <select
                                                            value={order.courier?._id || order.courier || ''}
                                                            onChange={async e => {
                                                                e.stopPropagation();
                                                                setUpdatingOrderId(order._id);
                                                                try {
                                                                    await updateOrder(order._id, { courier: e.target.value || null });
                                                                } finally { setUpdatingOrderId(null); }
                                                            }}
                                                            onClick={e => e.stopPropagation()}
                                                            disabled={!hasPermission('orders.edit')}
                                                            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-amber-100 bg-amber-50 text-amber-700 appearance-none cursor-pointer outline-none w-full transition-colors hover:bg-amber-100 disabled:opacity-75 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="">Not assigned</option>
                                                            {couriers.map(c => (
                                                                <option key={c._id} value={c._id}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>

                                                    {/* Amount — click to edit */}
                                                    <td className="px-4 py-3.5 text-end">
                                                        {editingOrderField?.id === order._id && editingOrderField?.field === 'totalAmount' ? (
                                                            <input
                                                                autoFocus
                                                                type="number"
                                                                value={editingOrderField.value}
                                                                onChange={e => setEditingOrderField(prev => ({ ...prev, value: e.target.value }))}
                                                                onBlur={() => handleOrderInlineSave(order)}
                                                                onKeyDown={e => {
                                                                    e.stopPropagation();
                                                                    if (e.key === 'Enter') handleOrderInlineSave(order);
                                                                    if (e.key === 'Escape') setEditingOrderField(null);
                                                                }}
                                                                onClick={e => e.stopPropagation()}
                                                                className="w-28 border border-blue-400 rounded-lg px-2 py-1 text-sm font-bold text-end outline-none shadow-sm ml-auto block"
                                                            />
                                                        ) : (
                                                            <div
                                                                onClick={e => { e.stopPropagation(); if (hasPermission('orders.edit')) startOrderEdit(order, 'totalAmount'); }}
                                                                className={clsx("group/amt", hasPermission('orders.edit') ? "cursor-pointer" : "cursor-default")}
                                                                title={hasPermission('orders.edit') ? "Click to edit" : ""}
                                                            >
                                                                <p className={clsx("font-black text-gray-900 text-base tabular-nums transition-colors", hasPermission('orders.edit') && "group-hover/amt:text-blue-600")}>{order.totalAmount?.toLocaleString()}</p>
                                                                <p className="text-[10px] text-gray-400 font-medium">DZD</p>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Status — inline select */}
                                                    <td className="px-4 py-3.5">
                                                        <div className="relative">
                                                            {updatingOrderId === order._id ? (
                                                                <div className="flex items-center justify-center h-7">
                                                                    <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-blue-500 animate-spin" />
                                                                </div>
                                                            ) : (
                                                                <select
                                                                    value={order.status}
                                                                    onChange={e => handleInlineStatusChange(order._id, e.target.value)}
                                                                    onClick={e => e.stopPropagation()}
                                                                    disabled={!hasPermission('orders.status.change') && !hasPermission('orders.edit')}
                                                                    className={clsx(
                                                                        'text-xs font-bold px-2.5 py-1.5 rounded-xl border appearance-none outline-none w-full transition-colors',
                                                                        (hasPermission('orders.status.change') || hasPermission('orders.edit')) ? 'cursor-pointer' : 'cursor-not-allowed opacity-75',
                                                                        STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-600 border-gray-200'
                                                                    )}
                                                                >
                                                                    {COD_STATUSES.map(s => (
                                                                        <option key={s} value={s}>{s}</option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {['Confirmed', 'Preparing', 'Ready for Pickup'].includes(order.status) && hasPermission('shipments.create') && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleQuickDispatch(order._id); }}
                                                                    disabled={dispatchingOrderId === order._id}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 rounded-xl transition-colors border border-green-100 disabled:opacity-50"
                                                                >
                                                                    {dispatchingOrderId === order._id ? (
                                                                        <div className="w-3 h-3 rounded-full border-2 border-green-300 border-t-green-600 animate-spin" />
                                                                    ) : (
                                                                        <Truck className="w-3 h-3" />
                                                                    )}
                                                                    Dispatch
                                                                </button>
                                                            )}
                                                            {hasPermission('orders.edit') && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleEditClick(order); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-100">
                                                                    <Pencil className="w-3 h-3" /> Edit
                                                                </button>
                                                            )}
                                                            {hasPermission('orders.delete') && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(order._id); }} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* EXPANDED ROW */}
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={9} className="p-0 border-b border-gray-100 bg-gray-50/50 relative overflow-hidden">
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                                            <div className="p-5 pl-8 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">

                                                                {/* Order Products */}
                                                                <div className="space-y-3">
                                                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Package className="w-4 h-4 text-blue-400" /> Ordered Items</p>
                                                                    {order.products?.length === 0 ? (
                                                                        <p className="text-xs text-gray-400 italic bg-white p-3 rounded-xl border border-gray-100 shadow-sm">No products listed.</p>
                                                                    ) : (
                                                                        <div className="flex flex-col gap-2.5">
                                                                            {order.products.map((p, i) => (
                                                                                <div key={i} className="flex items-center justify-between bg-white rounded-xl shadow-sm p-3 border border-gray-100 hover:border-gray-200 transition-colors">
                                                                                    <div>
                                                                                        <p className="text-sm font-bold text-gray-900 leading-tight">{p.name || 'Product'}</p>
                                                                                        <div className="flex items-center gap-2 mt-1">
                                                                                            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">Qty: {p.quantity}</span>
                                                                                            <span className="text-[10px] text-gray-400 font-medium tracking-wide">{(p.unitPrice || 0).toLocaleString()} DZD / ea</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="font-black text-blue-600 tabular-nums text-sm">{((p.quantity || 1) * (p.unitPrice || 0)).toLocaleString()}</p>
                                                                                        <p className="text-[9px] font-bold text-blue-300 uppercase">DZD Total</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Delivery & Payment Setup */}
                                                                <div className="space-y-3">
                                                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-amber-400" /> Delivery &amp; Setup</p>

                                                                    <div className="bg-white rounded-xl shadow-sm p-3.5 border border-gray-100 space-y-4">
                                                                        <div>
                                                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">Destination</p>
                                                                            <p className="text-sm font-semibold text-gray-900">{order.shippingAddress?.street || order.customer?.address || 'No address provided'}</p>
                                                                            <p className="text-xs font-medium text-gray-500 mt-0.5">{order.shippingAddress?.city || order.customer?.city || ''}</p>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50">
                                                                            <div>
                                                                                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Route Channel</p>
                                                                                <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg inline-block">{order.channel || 'Direct'}</span>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Current Status</p>
                                                                                <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg inline-block whitespace-nowrap">{order.status || 'New'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100 flex items-center justify-between">
                                                                        <div>
                                                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Payment</p>
                                                                            <span className={clsx("text-xs font-bold",
                                                                                order.paymentStatus === 'Paid' ? 'text-emerald-600' :
                                                                                    order.paymentStatus === 'Pending' ? 'text-amber-600' : 'text-gray-500'
                                                                            )}>{order.paymentStatus || 'Unpaid'}</span>
                                                                        </div>
                                                                        {order.trackingInfo?.trackingNumber && (
                                                                            <div className="text-right">
                                                                                <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Tracking #</p>
                                                                                <p className="text-xs font-mono font-semibold text-gray-700">{order.trackingInfo.trackingNumber}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Notes & Risk Insights */}
                                                                <div className="space-y-3">
                                                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-purple-400" /> Notes &amp; Insights</p>

                                                                    {order.notes ? (
                                                                        <div className="bg-white rounded-xl shadow-sm p-3.5 border border-purple-100 flex gap-2.5 relative overflow-hidden">
                                                                            <div className="absolute top-0 left-0 w-1 h-full bg-purple-300"></div>
                                                                            <FileText className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                                                            <p className="text-xs font-medium text-gray-600 leading-relaxed italic">{order.notes}</p>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="bg-gray-50 rounded-xl p-3 border border-dashed border-gray-200">
                                                                            <p className="text-xs text-center text-gray-400 font-medium">No order notes attached.</p>
                                                                        </div>
                                                                    )}

                                                                    {order.fraudRiskScore > 0 && (
                                                                        <div className="flex items-center justify-between bg-amber-50 rounded-xl px-3.5 py-3 border border-amber-200 shadow-sm">
                                                                            <div className="flex items-center gap-2">
                                                                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                                                                <p className="text-xs font-bold text-amber-800">Fraud Risk Evaluation</p>
                                                                            </div>
                                                                            <span className="text-xs font-black text-amber-600 bg-white px-2 py-0.5 rounded-md border border-amber-100">{order.fraudRiskScore}% Risk</span>
                                                                        </div>
                                                                    )}

                                                                    {(order.financials?.shippingCosts > 0) && (
                                                                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex justify-between items-center mt-auto">
                                                                            <p className="text-xs font-bold text-gray-500">Logistics Cost</p>
                                                                            <p className="text-sm font-black text-gray-700">{order.financials.shippingCosts.toLocaleString()} <span className="text-[10px] text-gray-400 font-bold">DZD</span></p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {
                            totalPages >= 1 && (() => {
                                // Build page numbers with ellipsis: always show first, last, current ±2
                                const range = [];
                                const delta = 2;
                                const left = currentPage - delta;
                                const right = currentPage + delta;
                                let last = 0;
                                for (let i = 1; i <= totalPages; i++) {
                                    if (i === 1 || i === totalPages || (i >= left && i <= right)) {
                                        if (last && i - last > 1) range.push('...');
                                        range.push(i);
                                        last = i;
                                    }
                                }
                                return (
                                    <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/30 rounded-b-2xl flex-wrap gap-3">
                                        {/* Left: page info + rows per page */}
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-gray-400 font-medium">
                                                Page <strong className="text-gray-700">{currentPage}</strong> of <strong className="text-gray-700">{totalPages}</strong>
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-gray-400">Show</span>
                                                <select
                                                    value={perPage}
                                                    onChange={e => {
                                                        const val = Number(e.target.value);
                                                        setPerPage(val);
                                                        fetchSalesData(1, val);
                                                    }}
                                                    className="bg-white border border-gray-200 rounded-lg py-1 px-2 text-sm font-semibold text-gray-700 outline-none focus:border-blue-400 cursor-pointer"
                                                >
                                                    {[10, 25, 50, 100].map(n => (
                                                        <option key={n} value={n}>{n}</option>
                                                    ))}
                                                </select>
                                                <span className="text-xs text-gray-400">per page</span>
                                            </div>
                                        </div>

                                        {/* Right: page buttons */}
                                        <div className="flex items-center gap-1">
                                            {/* Prev */}
                                            <button
                                                onClick={handlePrevPage}
                                                disabled={currentPage === 1}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                ‹ Prev
                                            </button>

                                            {/* Page numbers */}
                                            {range.map((p, i) =>
                                                p === '...' ? (
                                                    <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-gray-400 select-none">…</span>
                                                ) : (
                                                    <button
                                                        key={p}
                                                        onClick={() => fetchSalesData(p, perPage)}
                                                        className={clsx(
                                                            'min-w-[36px] px-2 py-1.5 text-sm font-bold rounded-lg transition-all border',
                                                            p === currentPage
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20'
                                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                        )}
                                                    >
                                                        {p}
                                                    </button>
                                                )
                                            )}

                                            {/* Next */}
                                            <button
                                                onClick={handleNextPage}
                                                disabled={currentPage === totalPages}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Next ›
                                            </button>
                                        </div>
                            })()}
                    </>
            </div>

            {/* Revenue by Channel — full width below table */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-5">{t('sales.revenueByChannel', 'Revenue by Channel')}</h3>
                {
                    channelData.length === 0 ? (
                        <p className="text-sm text-gray-400">{t('sales.noChannelData', 'No channel data available.')}</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {channelData.map((ch, i) => {
                                const total = channelData.reduce((s, c) => s + c.value, 0);
                                const pct = total > 0 ? Math.round((ch.value / total) * 100) : 0;
                                return (
                                    <div key={i} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                                            <span className="text-xs font-bold text-gray-700 truncate">{ch.name}</span>
                                        </div>
                                        <p className="text-2xl font-black text-gray-900 tabular-nums">{pct}%</p>
                                        <p className="text-[11px] text-gray-400 tabular-nums mt-0.5">{ch.value.toLocaleString()} DZ</p>
                                        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-2">
                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                }
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

            <BatchDispatchModal
                isOpen={isBatchDispatchOpen}
                onClose={() => setIsBatchDispatchOpen(false)}
                orders={orders.filter(o => selectedOrderIds.has(o._id) && ['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(o.status))}
                onComplete={() => {
                    setSelectedOrderIds(new Set());
                    fetchSalesData(currentPage, perPage);
                }}
            />

            {/* Confirm dialog */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${confirmDialog.danger ? 'bg-red-100' : 'bg-amber-100'}`}>
                            <AlertTriangle className={`w-5 h-5 ${confirmDialog.danger ? 'text-red-600' : 'text-amber-600'}`} />
                        </div>
                        <h3 className="text-base font-black text-gray-900 mb-2">{confirmDialog.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed mb-6">{confirmDialog.body}</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">{t('sales.cancel', 'Cancel')}</button>
                            <button onClick={() => { setConfirmDialog(null); confirmDialog.onConfirm(); }} className={`px-4 py-2 text-sm font-bold text-white rounded-xl transition-colors ${confirmDialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{t('sales.confirm', 'Confirm')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-w-sm ${toast.type === 'error' ? 'bg-gray-900' : 'bg-emerald-700'}`}>
                    {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />}
                    <span className="leading-snug">{toast.text}</span>
                    <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100 transition-opacity shrink-0"><X className="w-4 h-4" /></button>
                </div>
            )}
        </div>
    );
}
