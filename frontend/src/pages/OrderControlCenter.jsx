import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Search, Filter, SlidersHorizontal, ArrowDownCircle, CheckSquare, X, LayoutTemplate, Settings2, RefreshCw, PhoneCall, CheckCircle2, Truck, FileText, Ban, AlertTriangle, Tag, Calendar, MapPin, User, Activity } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OrderDetailsDrawer from '../components/orders/OrderDetailsDrawer';
import OrderModal from '../components/OrderModal';
import OrderRow from '../components/orders/OrderRow';
import clsx from 'clsx';
import moment from 'moment';

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

const PRIORITY_STYLES = {
    'Normal': '',
    'High Priority': 'border-l-4 border-l-orange-400 bg-orange-50/10',
    'Urgent': 'border-l-4 border-l-red-500 bg-red-50/20'
};

export default function OrderControlCenter() {
    const { t } = useTranslation();

    // Data State
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalOrders, setTotalOrders] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [kpis, setKpis] = useState(null);
    const [stageCounts, setStageCounts] = useState({ preDispatch: 0, postDispatch: 0, returns: 0, all: 0 });

    // Dependencies (Dropdown options)
    const [couriers, setCouriers] = useState([]);
    const [agents, setAgents] = useState([]);
    const [productsList, setProductsList] = useState([]); // Added for product filter

    // Query State
    const [error, setError] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [expandedRows, setExpandedRows] = useState(new Set());

    // Column Visibility and Ordering
    const defaultColumnOrder = ['orderId', 'customer', 'phone', 'location', 'products', 'total', 'courier', 'agent', 'date', 'status', 'actions'];
    const [hiddenColumns, setHiddenColumns] = useState(new Set());
    const [orderedColumnIds, setOrderedColumnIds] = useState(defaultColumnOrder);
    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [draggedColumnId, setDraggedColumnId] = useState(null);

    // Filters and Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [sortField, setSortField] = useState('date');
    const [sortOrder, setSortOrder] = useState('desc');

    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        status: '',
        courier: '',
        agent: '',
        wilaya: '',
        channel: '',
        priority: '',
        tags: '',
        dateFrom: '',
        dateTo: ''
    });

    const [activeStage, setActiveStage] = useState('pre-dispatch'); // 'all', 'pre-dispatch', 'post-dispatch', 'returns'

    // Drawer / Modals
    const [focusedOrderId, setFocusedOrderId] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [editOrderData, setEditOrderData] = useState(null);

    // Bulk Actions
    const [bulkActionType, setBulkActionType] = useState(null); // 'status' | 'agent' | 'courier'
    const [bulkActionValue, setBulkActionValue] = useState('');

    // Inline sync message (fixes alert suppression)
    const [syncMessage, setSyncMessage] = useState(null);

    // Fetch Dependencies & KPIs
    useEffect(() => {
        const fetchDeps = async () => {
            try {
                const token = localStorage.getItem('token');
                const [curRes, usrRes, kpiRes, prodRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_URL || ''}/api/couriers`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`${import.meta.env.VITE_API_URL || ''}/api/users`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/operations-kpi`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`${import.meta.env.VITE_API_URL || ''}/api/inventory/products`, { headers: { Authorization: `Bearer ${token}` } })
                ]);
                setCouriers(curRes.data || []);
                setAgents((usrRes.data || []).filter(u => {
                    const roleName = u.role?.name || u.role;
                    // Temporarily allow all users or specific roles until RBAC is fully seeded
                    return !roleName || ['Admin', 'Call Center Agent', 'Agent'].includes(roleName);
                }));
                setKpis(kpiRes.data);
                setProductsList(prodRes.data.products || prodRes.data || []);

            } catch (err) {
                console.error("Failed fetching dependencies:", err);
            }
        };
        fetchDeps();
    }, []);

    // Main Fetch
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params = {
                page, targetLimit: limit, limit, sortField, sortOrder,
                search: searchTerm, ...filters, stage: activeStage !== 'all' ? activeStage : undefined
            };

            // Clean empty strings from params
            Object.keys(params).forEach(k => params[k] === '' && delete params[k]);

            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/advanced`, {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });

            setOrders(res.data.orders || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalOrders(res.data.totalOrders || 0);
            setStageCounts(res.data.stageCounts || { preDispatch: 0, postDispatch: 0, returns: 0, all: 0 });

            setError(null);

            // Cleanup invalid selections
            setSelectedIds(prev => {
                const currentIds = new Set((res.data.orders || []).map(o => o._id));
                const next = new Set();
                prev.forEach(id => { if (currentIds.has(id)) next.add(id); });
                return next;
            });

        } catch (err) {
            console.error("Order Fetch Error", err);
            setError(err.response?.data?.message || "Failed to load orders");
        } finally {
            setLoading(false);
        }
    }, [page, limit, sortField, sortOrder, searchTerm, filters, activeStage]);

    // Handle create order from modal
    const handleCreateOrder = async (orderData) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders`, orderData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsOrderModalOpen(false);
            fetchOrders();
            setSyncMessage(t('ordersControl.orderCreated', { defaultValue: 'Order created successfully!' }));
            setTimeout(() => setSyncMessage(null), 3000);
            return { success: true };
        } catch (err) {
            console.error("Failed to create order", err);
            return { success: false, error: err.response?.data?.message || err.message };
        }
    };

    useEffect(() => {
        const debounce = setTimeout(fetchOrders, 400); // 400ms debounce on search typing
        return () => clearTimeout(debounce);
    }, [fetchOrders]);

    // Helpers
    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
        setPage(1);
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === orders.length && orders.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(orders.map(o => o._id)));
        }
    };

    const toggleSelect = (id) => {
        const current = new Set(selectedIds);
        current.has(id) ? current.delete(id) : current.add(id);
        setSelectedIds(current);
    };

    const toggleRowExpansion = (id) => {
        const next = new Set(expandedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedRows(next);
    };

    const handleStatusChange = useCallback(async (orderId, newStatus) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/${orderId}`, {
                status: newStatus
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchOrders();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    }, [fetchOrders]);

    const onBulkActionConfirm = useCallback((orderId) => {
        setBulkActionType('status');
        setBulkActionValue('Confirmed');
        setSelectedIds(new Set([orderId]));
    }, []);

    const onBulkActionCourier = useCallback((orderId) => {
        setBulkActionType('courier');
        setSelectedIds(new Set([orderId]));
    }, []);

    const toggleColumn = (colId) => {
        const next = new Set(hiddenColumns);
        if (next.has(colId)) next.delete(colId);
        else next.add(colId);
        setHiddenColumns(next);
    };

    const executeBulkAction = async () => {
        if (!bulkActionValue) return;
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const payload = {};
            let action = '';

            if (bulkActionType === 'status') { action = 'change_status'; payload.status = bulkActionValue; }
            else if (bulkActionType === 'agent') { action = 'assign_agent'; payload.agentId = bulkActionValue; }
            else if (bulkActionType === 'courier') { action = 'assign_courier'; payload.courierId = bulkActionValue; }

            const res = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/bulk/update`, {
                orderIds: Array.from(selectedIds),
                action,
                payload
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert(res.data.message);
            setSelectedIds(new Set());
            setBulkActionType(null);
            setBulkActionValue('');
            fetchOrders();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    // Columns configuration (Static Definitions)
    const columnDefinitions = {
        orderId: { id: 'orderId', label: t('ordersControl.grid.orderId') },
        customer: { id: 'customer', label: t('ordersControl.grid.customer') },
        phone: { id: 'phone', label: t('ordersControl.grid.phone') },
        location: { id: 'location', label: t('ordersControl.grid.location') },
        products: { id: 'products', label: t('ordersControl.grid.products') },
        total: { id: 'total', label: t('ordersControl.grid.total') },
        courier: { id: 'courier', label: t('ordersControl.grid.courier') },
        agent: { id: 'agent', label: t('ordersControl.grid.agent') },
        date: { id: 'date', label: t('ordersControl.grid.age') },
        status: { id: 'status', label: t('ordersControl.grid.status') },
        actions: { id: 'actions', label: t('ordersControl.expanded.actions', { defaultValue: 'Actions' }) },
    };

    // Calculate currently visible ordered columns
    const visibleColumns = orderedColumnIds
        .filter(id => !hiddenColumns.has(id))
        .map(id => columnDefinitions[id])
        .filter(Boolean);

    // Column Drag and Drop Handlers
    const handleDragStart = (e, id) => {
        setDraggedColumnId(id);
        e.dataTransfer.effectAllowed = 'move';
        // Transparent image for drag ghost
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (!draggedColumnId) return;

        const draggedIndex = orderedColumnIds.indexOf(draggedColumnId);
        if (draggedIndex === index) return;

        const newOrder = [...orderedColumnIds];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(index, 0, draggedColumnId);
        setOrderedColumnIds(newOrder);
    };

    const handleDragEnd = () => {
        setDraggedColumnId(null);
    };

    // Helper to calculate age string (e.g. "2d 4h ago", "5h ago")
    const getAge = (dateString) => {
        const diff = moment().diff(moment(dateString));
        const duration = moment.duration(diff);
        const days = Math.floor(duration.asDays());
        const hours = duration.hours();
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${duration.minutes()}m`;
        return `${duration.minutes()}m`;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-gray-50/50 gap-4 -mx-4 sm:-mx-8 lg:-mx-10 xl:-mx-14 2xl:-mx-16 -mt-6">
            {/* Extremely compact header optimized for operation */}
            <div className="flex items-center justify-between bg-white px-6 py-3 border-b border-gray-100 shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-xl font-black text-gray-900 leading-none mb-1 tracking-tight">{t('ordersControl.title')}</h1>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">{t('ordersControl.subtitle')}</p>
                </div>

                <div className="flex items-center gap-6">
                    {kpis && (
                        <div className="hidden lg:flex items-center gap-4 mr-4 divide-x divide-gray-100">
                            <div className="flex flex-col pl-4 first:pl-0">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ordersControl.kpis.newToday')}</span>
                                <span className="text-sm font-black text-blue-600">{kpis.newOrdersToday}</span>
                            </div>
                            <div className="flex flex-col pl-4">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ordersControl.kpis.pending')}</span>
                                <span className="text-sm font-black text-orange-500">{kpis.pendingConfirmation}</span>
                            </div>
                            <div className="flex flex-col pl-4">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ordersControl.kpis.confirmed')}</span>
                                <span className="text-sm font-black text-emerald-600">{kpis.confirmedOrders}</span>
                            </div>
                            <div className="flex flex-col pl-4">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ordersControl.kpis.dispatched', { defaultValue: 'Dispatched' })}</span>
                                <span className="text-sm font-black text-indigo-600">{kpis.sentToCourier}</span>
                            </div>
                            <div className="flex flex-col pl-4">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ordersControl.kpis.deliveredToday', { defaultValue: 'Delivered (Today)' })}</span>
                                <span className="text-sm font-black text-emerald-500">{kpis.deliveredToday}</span>
                            </div>
                            <div className="flex flex-col pl-4">
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{t('ordersControl.kpis.returnRate')}</span>
                                <span className="text-sm font-black text-red-600">{kpis.returnRate}%</span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder={t('ordersControl.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                className="bg-gray-50 border border-gray-200 text-sm font-bold rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[240px] ps-9 pe-3 py-1.5 outline-none transition-all shadow-inner focus:bg-white placeholder:font-medium"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setShowColumnSettings(!showColumnSettings)}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-xs transition-colors h-[34px]",
                                    showColumnSettings ? "bg-blue-50 border-blue-200 text-blue-700 shadow-inner" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
                                )}
                            >
                                <LayoutTemplate className="w-4 h-4" />
                                <span className="hidden sm:inline">{t('ordersControl.actions.columns', { defaultValue: 'Columns' })}</span>
                            </button>

                            {/* Column Settings Popover */}
                            {showColumnSettings && (
                                <div className="absolute top-full rtl:left-0 ltr:right-0 mt-2 w-64 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-gray-100 z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2">
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">{t('ordersControl.actions.manageColumns', { defaultValue: 'Manage Columns' })}</h3>
                                        <button onClick={() => setShowColumnSettings(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="p-2 max-h-[300px] overflow-y-auto">
                                        <p className="text-[10px] text-gray-500 mb-2 px-2 italic">{t('ordersControl.actions.dragHint', { defaultValue: 'Drag to reorder' })}</p>
                                        {orderedColumnIds.map((colId, index) => {
                                            const colDef = columnDefinitions[colId];
                                            if (!colDef) return null;
                                            const isHidden = hiddenColumns.has(colId);
                                            const isDragging = draggedColumnId === colId;

                                            return (
                                                <div
                                                    key={colId}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, colId)}
                                                    onDragOver={(e) => handleDragOver(e, index)}
                                                    onDragEnd={handleDragEnd}
                                                    className={clsx(
                                                        "flex items-center justify-between p-2 rounded-lg cursor-grab active:cursor-grabbing border text-sm transition-all",
                                                        isDragging ? "bg-blue-50/50 border-blue-200 shadow-sm scale-[1.02] opacity-80" : "bg-white border-transparent hover:bg-gray-50",
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-gray-300">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                                                        </div>
                                                        <span className={clsx("font-semibold text-xs", isHidden ? "text-gray-400 line-through" : "text-gray-700")}>
                                                            {colDef.label || colId}
                                                        </span>
                                                    </div>
                                                    <div
                                                        className={clsx(
                                                            "w-7 h-4 rounded-full relative cursor-pointer outline-none transition-colors",
                                                            !isHidden ? "bg-blue-500" : "bg-gray-200"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleColumn(colId);
                                                        }}
                                                    >
                                                        <div className={clsx(
                                                            "absolute top-[2px] w-3 h-3 bg-white rounded-full transition-transform shadow-sm",
                                                            !isHidden ? "left-[14px]" : "left-[2px]"
                                                        )}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 flex justify-end">
                                        <button
                                            onClick={() => {
                                                setOrderedColumnIds(defaultColumnOrder);
                                                setHiddenColumns(defaultHiddenColumns);
                                            }}
                                            className="text-[10px] uppercase tracking-widest font-black text-rose-500 hover:text-rose-600 transition-colors"
                                        >
                                            {t('ordersControl.actions.reset', { defaultValue: 'Reset Default' })}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={clsx("flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-lg border transition-all", showFilters ? "bg-blue-50 border-blue-200 text-blue-700 shadow-inner" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm")}
                        >
                            <SlidersHorizontal className="w-4 h-4" /> {t('ordersControl.filtersBtn')} {Object.values(filters).filter(Boolean).length > 0 && `(${Object.values(filters).filter(Boolean).length})`}
                        </button>

                        <button
                            onClick={() => setIsOrderModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm transition-all whitespace-nowrap"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            {t('ordersControl.actions.newOrder', { defaultValue: 'Add Order' })}
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <button onClick={() => fetchOrders()} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Refresh Data Core">
                            <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin text-blue-500")} />
                        </button>
                    </div>
                </div >
            </div >

            {/* Stage Navigation Tabs & Post-Dispatch Actions */}
            < div className="bg-white border-b border-gray-100 flex items-center justify-between px-6 pt-2 z-20 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.05)] shrink-0" >
                <div className="flex gap-6 overflow-x-auto scrollbar-none items-center">
                    {[
                        { id: 'pre-dispatch', label: t('ordersControl.stages.preDispatch'), count: stageCounts.preDispatch, color: 'text-blue-600', bg: 'bg-blue-600', icon: <PhoneCall className="w-3.5 h-3.5" /> },
                        { id: 'post-dispatch', label: t('ordersControl.stages.postDispatch'), count: stageCounts.postDispatch, color: 'text-indigo-600', bg: 'bg-indigo-600', icon: <Truck className="w-3.5 h-3.5" /> },
                        { id: 'returns', label: t('ordersControl.stages.returns'), count: stageCounts.returns, color: 'text-rose-600', bg: 'bg-rose-600', icon: <Ban className="w-3.5 h-3.5" /> },
                        { id: 'all', label: t('ordersControl.stages.all'), count: stageCounts.all, color: 'text-gray-600', bg: 'bg-gray-600', icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveStage(tab.id); setPage(1); }}
                            className={clsx(
                                "group relative flex items-center gap-2 pb-3 px-1 border-b-2 transition-all font-bold whitespace-nowrap",
                                activeStage === tab.id
                                    ? `border-[${tab.bg.replace('bg-', '')}] ${tab.color}`
                                    : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200"
                            )}
                            style={activeStage === tab.id ? { borderColor: 'currentColor' } : {}}
                        >
                            <span className={clsx("transition-transform", activeStage === tab.id ? "scale-110" : "group-hover:scale-110")}>
                                {tab.icon}
                            </span>
                            <span>{tab.label}</span>
                            <span className={clsx(
                                "px-2 py-0.5 rounded-full text-[10px] font-black transition-colors",
                                activeStage === tab.id ? `${tab.bg} text-white` : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                            )}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Ecotrack Manual Sync Trigger */}
                {
                    activeStage === 'post-dispatch' && (
                        <div className="flex items-center gap-3 mb-2">
                            {syncMessage && (
                                <div className="animate-in fade-in slide-in-from-right-4">
                                    <span className={clsx(
                                        "flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg border shadow-sm",
                                        syncMessage.type === 'error' ? "bg-red-50 text-red-600 border-red-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
                                    )}>
                                        {syncMessage.type === 'error' ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                        {syncMessage.text}
                                    </span>
                                </div>
                            )}
                            <button
                                onClick={async () => {
                                    try {
                                        setLoading(true);
                                        setSyncMessage(null);
                                        const token = localStorage.getItem('token');
                                        await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/sync-ecotrack`, {}, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        fetchOrders();
                                        setSyncMessage({ type: 'success', text: t('ordersControl.messages.syncSuccess', { defaultValue: 'ECOTRACK sequence manually fired and completed.' }) });
                                        setTimeout(() => setSyncMessage(null), 5000);
                                    } catch (err) {
                                        if (err.response?.status === 429 && err.response?.data?.error) {
                                            // Try to extract minutes left for translation parameters
                                            const match = err.response.data.error.match(/wait (\d+) minutes/);
                                            if (match && match[1]) {
                                                setSyncMessage({ type: 'error', text: t('ordersControl.messages.syncRateLimit', { minutes: match[1], defaultValue: err.response.data.error }) });
                                            } else {
                                                setSyncMessage({ type: 'error', text: err.response.data.error });
                                            }
                                        } else {
                                            setSyncMessage({ type: 'error', text: err.response?.data?.error || t('ordersControl.messages.syncFailed', { defaultValue: 'Failed to sync with courier aggregator.' }) });
                                        }
                                        setTimeout(() => setSyncMessage(null), 8000);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className={clsx(
                                    "flex items-center gap-2 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all shadow-sm rounded-lg border focus:ring-2 focus:ring-offset-1 focus:outline-none",
                                    loading
                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border-indigo-200 hover:border-indigo-600 focus:ring-indigo-500"
                                )}
                            >
                                <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
                                {t('ordersControl.grid.syncCouriers', { defaultValue: 'Sync Ecotrack' })}
                            </button>
                        </div>
                    )
                }
            </div >

            {/* Expansive Collapsible Advanced Filters */}
            {
                showFilters && (
                    <div className="bg-white border-y border-gray-100 shadow-sm shrink-0 z-10 py-3 px-6 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                            <div className="relative flex items-center shrink-0">
                                <AlertTriangle className="w-[14px] h-[14px] text-orange-500 absolute left-3 pointer-events-none" />
                                <select value={filters.priority} onChange={e => handleFilterChange('priority', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-orange-200 bg-orange-50 text-orange-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-orange-500/20 appearance-none cursor-pointer hover:bg-orange-100/70 transition-colors">
                                    <option value="">{t('ordersControl.filters.priority')}</option>
                                    <option value="Normal">{t('ordersControl.filters.priorityNormal')}</option>
                                    <option value="High Priority">{t('ordersControl.filters.priorityHigh')}</option>
                                    <option value="Urgent">{t('ordersControl.filters.priorityUrgent')}</option>
                                </select>
                            </div>
                            <div className="relative flex items-center shrink-0">
                                <LayoutTemplate className="w-[14px] h-[14px] text-purple-500 absolute left-3 pointer-events-none" />
                                <select value={filters.channel} onChange={e => handleFilterChange('channel', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-purple-500/20 appearance-none cursor-pointer hover:bg-purple-100/70 transition-colors">
                                    <option value="">{t('ordersControl.filters.channel')}</option>
                                    {['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Manual Entry', 'Other'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
                                </select>
                            </div>
                            <div className="relative flex items-center shrink-0">
                                <MapPin className="w-[14px] h-[14px] text-teal-500 absolute left-3 pointer-events-none" />
                                <input type="text" placeholder={t('ordersControl.filters.wilayaHolder')} value={filters.wilaya} onChange={e => handleFilterChange('wilaya', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-teal-500/20 placeholder:text-teal-400/70 w-36 hover:bg-teal-100/70 transition-colors" />
                            </div>
                            <div className="relative flex items-center shrink-0">
                                <User className="w-[14px] h-[14px] text-blue-500 absolute left-3 pointer-events-none" />
                                <select value={filters.agent} onChange={e => handleFilterChange('agent', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer hover:bg-blue-100/70 transition-colors">
                                    <option value="">{t('ordersControl.filters.anyAgent')}</option>
                                    <option value="unassigned">{t('ordersControl.filters.unassigned')}</option>
                                    {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="relative flex items-center shrink-0">
                                <Truck className="w-[14px] h-[14px] text-indigo-500 absolute left-3 pointer-events-none" />
                                <select value={filters.courier} onChange={e => handleFilterChange('courier', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer hover:bg-indigo-100/70 transition-colors">
                                    <option value="">{t('ordersControl.filters.anyCourier')}</option>
                                    <option value="unassigned">{t('ordersControl.filters.unassigned')}</option>
                                    {couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="relative flex items-center shrink-0">
                                <Activity className="w-[14px] h-[14px] text-emerald-500 absolute left-3 pointer-events-none" />
                                <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer hover:bg-emerald-100/70 transition-colors">
                                    <option value="">{t('ordersControl.filters.status')}</option>
                                    {COD_STATUSES.map(s => <option key={s} value={s}>{s === 'Delivered' || s === 'Refused' || s === 'Returned' || s === 'Cancelled' ? (t(`sales.status${s}`) || s) : s}</option>)}
                                </select>
                            </div>

                            <div className="h-6 w-px bg-gray-200 shrink-0 hidden sm:block"></div>

                            <div className="relative flex items-center shrink-0">
                                <Calendar className="w-[14px] h-[14px] text-gray-400 absolute left-3 pointer-events-none" />
                                <input type="date" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} className="pl-9 pr-3 py-1.5 rounded-l-full border border-gray-200 bg-gray-50 text-gray-600 text-[11px] font-bold outline-none focus:ring-1 focus:ring-gray-300 w-32 border-r-0 hover:bg-gray-100/50 transition-colors" />
                                <div className="bg-gray-50 border-y border-gray-200 py-1.5 px-1 text-[10px] text-gray-400 font-bold shrink-0">{t('ordersControl.filters.to')}</div>
                                <input type="date" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} className="px-3 py-1.5 rounded-r-full border border-gray-200 bg-gray-50 text-gray-600 text-[11px] font-bold outline-none focus:ring-1 focus:ring-gray-300 w-28 hover:bg-gray-100/50 transition-colors" />
                            </div>

                            <div className="relative flex items-center shrink-0">
                                <Tag className="w-[14px] h-[14px] text-pink-500 absolute left-3 pointer-events-none" />
                                <input type="text" placeholder={t('ordersControl.filters.tagsHolder')} value={filters.tags} onChange={e => handleFilterChange('tags', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-pink-200 bg-pink-50 text-pink-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-pink-500/20 placeholder:text-pink-400/70 w-32 hover:bg-pink-100/70 transition-colors" />
                            </div>
                        </div>
                    </div>
                )
            }

            {/* High Performance DataGrid Container */}
            <div className="flex-1 bg-white border-y border-gray-200 shadow-sm flex flex-col relative overflow-hidden">

                {/* Scrollable Table Area */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-start rtl:text-right border-collapse whitespace-nowrap">
                        <thead className="bg-gray-50/90 text-gray-500 text-[11px] uppercase tracking-wider sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-3 border-b border-gray-200 w-10 align-top pt-4">
                                    <input type="checkbox" checked={orders.length > 0 && selectedIds.size === orders.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer" />
                                </th>
                                {visibleColumns.filter(c => !hiddenColumns.has(c.id)).map(col => (
                                    <th key={col.id} className={clsx("px-4 py-3 border-b border-gray-200 hover:bg-gray-100/50 transition-colors group select-none align-middle whitespace-nowrap", col.id !== 'actions' && "cursor-pointer")}>
                                        <div className="flex items-center justify-start gap-1">
                                            {/* Hide regular label if it has an integrated filter */}
                                            {!['products', 'status', 'agent', 'courier'].includes(col.id) && (
                                                <div className="flex items-center gap-1.5 hover:text-gray-900 transition-colors" onClick={() => col.id !== 'actions' && handleSort(col.id)}>
                                                    {col.label}
                                                    {sortField === col.id && col.id !== 'actions' && (
                                                        <ArrowDownCircle className={clsx("w-3.5 h-3.5 text-blue-500 transition-transform", sortOrder === 'asc' && "rotate-180")} />
                                                    )}
                                                </div>
                                            )}

                                            {/* Integrated Column Filters serving as headers */}
                                            {col.id === 'products' && (
                                                <select value={filters.tags} onChange={e => handleFilterChange('tags', e.target.value)} onClick={e => e.stopPropagation()} className="max-w-[140px] min-w-[110px] px-1 py-1 rounded border-transparent hover:border-gray-200 text-[11px] text-gray-500 hover:text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold bg-transparent focus:bg-white cursor-pointer w-full uppercase tracking-wider">
                                                    <option value="">{col.label}</option>
                                                    {productsList.map(p => <option key={p._id} value={p.sku}>{p.sku}</option>)}
                                                </select>
                                            )}
                                            {col.id === 'status' && (
                                                <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} onClick={e => e.stopPropagation()} className="max-w-[140px] min-w-[110px] px-1 py-1 rounded border-transparent hover:border-gray-200 text-[11px] text-gray-500 hover:text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold bg-transparent focus:bg-white cursor-pointer w-full uppercase tracking-wider">
                                                    <option value="">{col.label}</option>
                                                    {COD_STATUSES.filter(s => {
                                                        if (activeStage === 'pre-dispatch') return ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Refused', 'Cancelled'].includes(s);
                                                        if (activeStage === 'post-dispatch') return ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned'].includes(s);
                                                        if (activeStage === 'returns') return ['Returned', 'Refused'].includes(s);
                                                        return true;
                                                    }).map(s => <option key={s} value={s}>{s === 'Delivered' || s === 'Refused' || s === 'Returned' || s === 'Cancelled' ? (t(`sales.status${s}`) || s) : s}</option>)}
                                                </select>
                                            )}
                                            {col.id === 'agent' && (
                                                <select value={filters.agent} onChange={e => handleFilterChange('agent', e.target.value)} onClick={e => e.stopPropagation()} className="max-w-[130px] min-w-[100px] px-1 py-1 rounded border-transparent hover:border-gray-200 text-[11px] text-gray-500 hover:text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold bg-transparent focus:bg-white cursor-pointer w-full uppercase tracking-wider">
                                                    <option value="">{col.label}</option>
                                                    <option value="unassigned">{t('ordersControl.filters.unassigned', { defaultValue: 'Unassigned' })}</option>
                                                    {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                                                </select>
                                            )}
                                            {col.id === 'courier' && (
                                                <select value={filters.courier} onChange={e => handleFilterChange('courier', e.target.value)} onClick={e => e.stopPropagation()} className="max-w-[140px] min-w-[110px] px-1 py-1 rounded border-transparent hover:border-gray-200 text-[11px] text-gray-500 hover:text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold bg-transparent focus:bg-white cursor-pointer w-full uppercase tracking-wider">
                                                    <option value="">{col.label}</option>
                                                    <option value="unassigned">{t('ordersControl.filters.unassigned', { defaultValue: 'Unassigned' })}</option>
                                                    {couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                                </select>
                                            )}
                                            {/* Keep sort indicator even when label is hidden for filter columns */}
                                            {['products', 'status', 'agent', 'courier'].includes(col.id) && sortField === col.id && (
                                                <ArrowDownCircle className={clsx("w-3.5 h-3.5 text-blue-500 transition-transform shrink-0", sortOrder === 'asc' && "rotate-180")} onClick={() => handleSort(col.id)} />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {loading && orders.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="py-24 text-center">
                                        <div className="inline-flex w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
                                        <p className="mt-4 text-sm font-bold text-gray-400">{t('ordersControl.grid.loading')}</p>
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="py-24 text-center">
                                        <LayoutTemplate className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-gray-500">{t('ordersControl.grid.empty')}</p>
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order, idx) => (
                                    <React.Fragment key={order._id}>
                                        <tr
                                            onClick={() => toggleRowExpansion(order._id)}
                                            className={clsx(
                                                "group cursor-pointer transition-all",
                                                selectedIds.has(order._id) ? "bg-blue-50 hover:bg-blue-100" : (expandedRows.has(order._id) ? "bg-gray-50/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]" : "hover:bg-gray-50/80 bg-white"),
                                                PRIORITY_STYLES[order.priority] || ''
                                            )}
                                        >
                                            <td className="px-4 py-2 border-r border-transparent group-hover:border-blue-100 transition-colors" onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" checked={selectedIds.has(order._id)} onChange={() => toggleSelect(order._id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                            </td>

                                            {/* Dynamic Columns Rendering based on order */}
                                            {visibleColumns.map((col) => {
                                                switch (col.id) {
                                                    case 'orderId':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2">
                                                                <div className="flex flex-col gap-1 items-start relative group/timeline">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="font-black text-gray-800 tracking-tight text-[13px] border-b border-dashed border-gray-400 hover:text-blue-600 transition-colors cursor-help">{order.orderId}</span>
                                                                        {['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(order.status) && activeStage === 'all' && (
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Pre Dispatch Stage"></span>
                                                                        )}
                                                                        {['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(order.status) && activeStage === 'all' && (
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Post Dispatch Stage"></span>
                                                                        )}
                                                                    </div>

                                                                    {/* Timeline Hover Card */}
                                                                    <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 rounded-xl shadow-xl border border-gray-700 p-4 opacity-0 invisible group-hover/timeline:opacity-100 group-hover/timeline:visible transition-all z-[60] text-white cursor-default" onClick={e => e.stopPropagation()}>
                                                                        <div className="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest border-b border-gray-700 pb-2">{t('ordersControl.timeline.title')}</div>
                                                                        <div className="flex flex-col gap-4 relative before:absolute before:inset-y-1 before:left-1.5 before:w-0.5 before:bg-gray-700">
                                                                            <div className="flex items-start gap-4 relative">
                                                                                <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                                                <div className="flex flex-col text-xs leading-none">
                                                                                    <span className="font-bold text-gray-100">{t('ordersControl.timeline.created')}</span>
                                                                                    <span className="text-[10px] text-gray-400 font-mono mt-1">{moment(order.date).format('DD MMM, HH:mm')}</span>
                                                                                </div>
                                                                            </div>
                                                                            {order.status !== 'New' && (
                                                                                <div className="flex items-start gap-4 relative">
                                                                                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                                                    <div className="flex flex-col text-xs leading-none">
                                                                                        <span className="font-bold text-gray-100">{t(`sales.statusConfirmed`) || 'Confirmed'}</span>
                                                                                        <span className="text-[10px] text-gray-400 font-mono mt-1">{t('ordersControl.timeline.processed')}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned'].includes(order.status) && (
                                                                                <div className="flex items-start gap-4 relative">
                                                                                    <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                                                    <div className="flex flex-col text-xs leading-none">
                                                                                        <span className="font-bold text-gray-100">{t('ordersControl.timeline.sentToCourier')}</span>
                                                                                        <span className="text-[10px] text-gray-400 mt-1">{order.courier?.name || t('ordersControl.timeline.assignedCourier')}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {['Delivered', 'Paid'].includes(order.status) && (
                                                                                <div className="flex items-start gap-4 relative">
                                                                                    <div className="w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                                                    <div className="flex flex-col text-xs leading-none">
                                                                                        <span className="font-bold text-gray-100">{t(`sales.status${order.status.replace(/\s+/g, '')}`) || order.status}</span>
                                                                                        <span className="text-[10px] text-emerald-400 mt-1">{t('ordersControl.timeline.successfulDelivery')}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {['Refused', 'Returned', 'Cancelled'].includes(order.status) && (
                                                                                <div className="flex items-start gap-4 relative">
                                                                                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                                                    <div className="flex flex-col text-xs leading-none">
                                                                                        <span className="font-bold text-gray-100">{t('ordersControl.timeline.unsuccessful')}</span>
                                                                                        <span className="text-[10px] text-rose-400 mt-1">{t(`sales.status${order.status.replace(/\s+/g, '')}`) || order.status}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {order.priority && order.priority !== 'Normal' && (
                                                                        <span className={clsx("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded animate-pulse mt-1", order.priority === 'Urgent' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700")}>
                                                                            {order.priority}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    case 'status':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2" onClick={e => e.stopPropagation()}>
                                                                <div className="flex flex-col gap-1.5 items-start">
                                                                    {['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(order.status) ? (
                                                                        <select
                                                                            value={order.status}
                                                                            onChange={async (e) => {
                                                                                const newStatus = e.target.value;
                                                                                try {
                                                                                    setLoading(true);
                                                                                    const token = localStorage.getItem('token');
                                                                                    await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/${order._id}`, {
                                                                                        status: newStatus
                                                                                    }, { headers: { Authorization: `Bearer ${token}` } });
                                                                                    fetchOrders();
                                                                                } catch (err) {
                                                                                    alert(err.response?.data?.message || err.message);
                                                                                } finally {
                                                                                    setLoading(false);
                                                                                }
                                                                            }}
                                                                            className={clsx(
                                                                                "appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 rounded-full text-[11px] font-black uppercase tracking-wide border px-2.5 py-1 transition-colors pr-6 relative",
                                                                                STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-600 border-gray-200 focus:ring-gray-300'
                                                                            )}
                                                                            style={{
                                                                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'/%3e%3c/svg%3e")`,
                                                                                backgroundPosition: `right 0.2rem center`,
                                                                                backgroundRepeat: `no-repeat`,
                                                                                backgroundSize: `1.2em 1.2em`,
                                                                            }}
                                                                        >
                                                                            {COD_STATUSES.filter(s => {
                                                                                if (activeStage === 'pre-dispatch') return ['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(s);
                                                                                return ['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(s);
                                                                            }).map(s => (
                                                                                <option key={s} value={s} className="bg-white text-gray-900 font-bold max-w-full">
                                                                                    {t(`sales.status${s.replace(/\s+/g, '')}`) || s}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    ) : (
                                                                        <span
                                                                            className={clsx("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide border cursor-not-allowed opacity-90", STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-600 border-gray-200')}
                                                                            title={t('ordersControl.messages.syncOnly', { defaultValue: 'Status controlled by Courier Sync' })}
                                                                        >
                                                                            {t(`sales.status${order.status.replace(/\s+/g, '')}`) || order.status}
                                                                        </span>
                                                                    )}
                                                                    {order.tags && order.tags.length > 0 && (
                                                                        <div className="flex items-center gap-1 flex-wrap max-w-[120px]">
                                                                            {order.tags.map(tag_item => (
                                                                                <span key={tag_item} className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600 truncate max-w-[80px]" title={tag_item}>
                                                                                    {tag_item}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    case 'actions':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => { const phone = order.customer?.phone || order.shipping?.phone1; if (phone) window.open(`tel:${phone}`); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.call')}>
                                                                        <PhoneCall className="w-4 h-4" />
                                                                    </button>
                                                                    <button onClick={() => { setBulkActionType('status'); setBulkActionValue('Confirmed'); setSelectedIds(new Set([order._id])); }} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.confirm')}>
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                    </button>
                                                                    <button onClick={() => { setBulkActionType('courier'); setSelectedIds(new Set([order._id])); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.assignCourier')}>
                                                                        <Truck className="w-4 h-4" />
                                                                    </button>
                                                                    <button onClick={() => setFocusedOrderId(order._id)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.details')}>
                                                                        <FileText className="w-4 h-4" />
                                                                    </button>
                                                                    <button onClick={() => { setBulkActionType('status'); setBulkActionValue('Cancelled'); setSelectedIds(new Set([order._id])); }} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.cancel')}>
                                                                        <Ban className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        );
                                                    case 'customer':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2">
                                                                <div className="flex flex-col relative group/customer">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="font-bold text-gray-900 truncate max-w-[150px]">{order.customer?.name || t('ordersControl.customerCard.unknown')}</span>
                                                                        {order.customer?.fraudProbability > 60 && (
                                                                            <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" title="High Fraud Probability" />
                                                                        )}
                                                                        {order.customer?.refusalRate > 25 && (
                                                                            <span className="flex w-2 h-2 rounded-full bg-orange-500" title="High Return Rate"></span>
                                                                        )}
                                                                    </div>

                                                                    {/* Customer Hover Card */}
                                                                    <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 opacity-0 invisible group-hover/customer:opacity-100 group-hover/customer:visible transition-all z-50">
                                                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-3 mb-3">
                                                                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-lg">
                                                                                {(order.customer?.name || t('ordersControl.customerCard.unknown')).charAt(0)}
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="font-black text-gray-900 text-sm leading-none">{order.customer?.name || t('ordersControl.customerCard.unknown')}</span>
                                                                                <span className="font-mono text-[10px] text-gray-500 mt-1">{order.customer?.phone || '-'}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">{t('ordersControl.customerCard.lifetimeOrders')}</span>
                                                                                <span className="font-black text-gray-800">{order.customer?.totalOrders || 0}</span>
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">{t('ordersControl.customerCard.trustScore')}</span>
                                                                                <span className={clsx("font-black", (order.customer?.trustScore || 100) < 50 ? "text-rose-600" : "text-emerald-600")}>
                                                                                    {order.customer?.trustScore || 100}/100
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">{t('ordersControl.customerCard.delivered')}</span>
                                                                                <span className="font-black text-emerald-600">{order.customer?.deliveredOrders || 0}</span>
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">{t('ordersControl.customerCard.returned')}</span>
                                                                                <span className="font-black text-rose-600">{order.customer?.totalRefusals || 0}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        );
                                                    case 'phone':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2 font-mono" onClick={e => e.stopPropagation()}>
                                                                <a
                                                                    href={`tel:${order.customer?.phone || order.shipping?.phone1 || ''}`}
                                                                    className="flex items-center gap-1.5 w-fit px-2 py-1 bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-md border border-emerald-100/50 cursor-pointer"
                                                                    title={t('ordersControl.grid.callCustomer', { defaultValue: 'Call Customer' })}
                                                                >
                                                                    <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                                                                    <span className="font-bold text-emerald-800 text-[13px] tracking-wider">{order.customer?.phone || order.shipping?.phone1 || '-'}</span>
                                                                </a>
                                                            </td>
                                                        );
                                                    case 'location':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2 text-xs">
                                                                <p className="font-bold text-gray-700 truncate max-w-[130px]" title={order.wilaya || order.shipping?.wilayaName || ''}>{order.wilaya || order.shipping?.wilayaName || t('ordersControl.grid.unspecifiedZone', { defaultValue: 'Unspecified Zone' })}</p>
                                                                <p className="text-gray-400 truncate max-w-[130px]">{order.commune || order.shipping?.commune || ''}</p>
                                                            </td>
                                                        );
                                                    case 'products':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2 text-xs">
                                                                {order.products?.length > 0 ? (
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-gray-800 truncate max-w-[160px]">{order.products[0].name || 'Product Item'}</span>
                                                                        {order.products.length > 1 && <span className="text-[10px] text-gray-400 font-bold">+{order.products.length - 1} {t('ordersControl.grid.moreTypes')} ({t('ordersControl.grid.qty')}: {order.products.reduce((acc, p) => acc + p.quantity, 0)})</span>}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-400 italic">{t('ordersControl.grid.noItems')}</span>
                                                                )}
                                                            </td>
                                                        );
                                                    case 'total':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2 text-right">
                                                                {order.totalAmount >= 100000 ? (
                                                                    <div className="inline-flex items-center bg-gradient-to-r from-amber-100 to-yellow-200 text-amber-900 px-2 py-1 rounded shadow-sm border border-amber-300 transform hover:scale-105 transition-transform" title="Gold Highlight: Over 100k DZD">
                                                                        <span className="font-black mr-1 text-[13px]">{order.totalAmount.toLocaleString()}</span>
                                                                        <span className="text-[9px] font-black uppercase">DZD</span>
                                                                    </div>
                                                                ) : order.totalAmount >= 50000 ? (
                                                                    <div className="inline-flex items-center bg-purple-100 text-purple-900 px-2 py-1 rounded shadow-sm border border-purple-200 transform hover:scale-105 transition-transform" title="Purple Highlight: Over 50k DZD">
                                                                        <span className="font-black mr-1 text-[13px]">{order.totalAmount.toLocaleString()}</span>
                                                                        <span className="text-[9px] font-black uppercase">DZD</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="inline-flex items-center">
                                                                        <span className="font-black text-gray-900 mr-1">{(order.totalAmount || 0).toLocaleString()}</span>
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">DZD</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    case 'courier':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2">
                                                                {order.courier?.name ? (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-[11px] font-black tracking-wide truncate max-w-[100px]">
                                                                        {order.courier.name}
                                                                    </span>
                                                                ) : <span className="text-[11px] text-gray-400 font-medium">—</span>}
                                                            </td>
                                                        );
                                                    case 'agent':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2">
                                                                {order.assignedAgent?.name ? (
                                                                    <span className="text-xs font-bold text-gray-700 truncate max-w-[100px] block">{order.assignedAgent.name}</span>
                                                                ) : <span className="text-[11px] text-gray-400 font-medium block">Unassigned</span>}
                                                            </td>
                                                        );
                                                    case 'date':
                                                        return (
                                                            <td key={col.id} className="px-4 py-2 text-xs w-28 whitespace-nowrap overflow-hidden text-ellipsis">
                                                                <div className="flex flex-col">
                                                                    <span className={clsx("font-bold", moment().diff(moment(order.date), 'hours') > 24 && order.status === 'New' ? "text-rose-600" : "text-gray-600")} title={moment(order.date).format('PPpp')}>
                                                                        {getAge(order.date)} {t('ordersControl.grid.ago')}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    default:
                                                        return null;
                                                }
                                            })}
                                        </tr>
                                        {expandedRows.has(order._id) && (
                                            <tr className="bg-gray-50/40 shadow-[inset_0_4px_6px_-1px_rgba(0,0,0,0.03)] border-b border-gray-200">
                                                <td colSpan={visibleColumns.filter(c => !hiddenColumns.has(c.id)).length + 1} className="p-0">
                                                    <div className="flex flex-col animate-in slide-in-from-top-1 px-8 py-5 gap-4">
                                                        <div className="grid grid-cols-4 gap-6">
                                                            {/* Customer Details Panel */}
                                                            <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">{t('ordersControl.expanded.customerInfo')}</h4>
                                                                <div className="flex flex-col gap-1.5 text-xs">
                                                                    <div className="flex items-center justify-between"><span className="text-gray-500 font-medium whitespace-nowrap">{t('ordersControl.expanded.primaryPhone')}</span> <span className="font-mono font-bold text-gray-800">{order.customer?.phone || order.shipping?.phone1 || '-'}</span></div>
                                                                    <div className="flex items-center justify-between"><span className="text-gray-500 font-medium whitespace-nowrap">{t('ordersControl.expanded.secondaryPhone')}</span> <span className="font-mono font-bold text-gray-800">{order.shipping?.phone2 || '-'}</span></div>
                                                                    <div className="flex items-start justify-between mt-1 gap-2">
                                                                        <span className="text-gray-500 font-medium whitespace-nowrap leading-tight">{t('ordersControl.expanded.shippingAddress')}</span>
                                                                        <span className="font-semibold text-gray-800 leading-tight text-right line-clamp-2" title={order.shipping?.address}>{order.shipping?.address || order.commune}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Product Details Panel */}
                                                            <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">{t('ordersControl.expanded.productInfo')}</h4>
                                                                <div className="flex flex-col gap-2 max-h-[100px] overflow-y-auto pr-1">
                                                                    {order.products?.map((prod, i) => (
                                                                        <div key={i} className="flex flex-col text-xs bg-gray-50/50 p-1.5 rounded border border-gray-100">
                                                                            <span className="font-bold text-gray-800 truncate" title={prod.name}>{prod.name}</span>
                                                                            <div className="flex items-center justify-between mt-1 text-[11px]">
                                                                                <span className="text-gray-500 font-mono">{prod.sku || t('ordersControl.expanded.noSku')}</span>
                                                                                <span className="font-black text-gray-700">{t('ordersControl.expanded.qty')} {prod.quantity}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Operational Intelligence Panel */}
                                                            <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">{t('ordersControl.expanded.customerIntelligence')}</h4>
                                                                <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-xs">
                                                                    <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">{t('ordersControl.expanded.totalOrders')}</span><span className="font-black text-gray-800">{order.customer?.totalOrders || 0}</span></div>
                                                                    <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">{t('ordersControl.expanded.delivered')}</span><span className="font-black text-emerald-600">{order.customer?.deliveredOrders || 0}</span></div>
                                                                    <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">{t('ordersControl.expanded.returns')}</span><span className="font-black text-rose-600">{order.customer?.totalRefusals || 0}</span></div>
                                                                    <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">{t('ordersControl.expanded.returnRate')}</span><span className={clsx("font-black", (order.customer?.refusalRate || 0) > 30 ? "text-orange-500" : "text-gray-800")}>{Math.round(order.customer?.refusalRate || 0)}%</span></div>
                                                                </div>
                                                            </div>

                                                            {/* Logistics & Delivery Panel */}
                                                            <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">{t('ordersControl.expanded.deliveryTrack')}</h4>
                                                                <div className="flex flex-col gap-1.5 text-xs">
                                                                    <div className="flex items-center justify-between"><span className="text-gray-500 font-medium">{t('ordersControl.expanded.provider')}</span> <span className="font-bold text-indigo-700">{order.courier?.name || t('ordersControl.filters.unassigned')}</span></div>
                                                                    <div className="flex items-center justify-between mt-0.5"><span className="text-gray-500 font-medium">{t('ordersControl.expanded.trackingCode')}</span> <span className="font-mono font-bold text-gray-800">{order.trackingNumber || '-'}</span></div>
                                                                    <div className="flex items-center justify-between mt-2">
                                                                        <span className="text-gray-500 font-medium">{t('ordersControl.expanded.timelineStage')}</span>
                                                                        <span className="font-bold text-gray-800 mt-0.5">{t(`sales.status${order.status.replace(/\s+/g, '')}`) || order.status}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Level 3 action trigger */}
                                                        <div className="flex items-center justify-end border-t border-gray-100 pt-3">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setFocusedOrderId(order._id); }}
                                                                className="flex items-center gap-2 px-4 py-1.5 bg-gray-900 text-white text-[11px] font-black tracking-wider uppercase rounded hover:bg-gray-800 transition-colors shadow-sm"
                                                            >
                                                                <FileText className="w-3.5 h-3.5" /> {t('ordersControl.expanded.viewFull')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Pagination Bar */}
                <div className="bg-white border-t border-gray-100 px-4 py-3 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-gray-500">
                            {t('ordersControl.pagination.showing')} <strong className="text-gray-900">{orders.length}</strong> {t('ordersControl.pagination.of')} <strong className="text-gray-900">{totalOrders}</strong> {t('ordersControl.pagination.records')}
                        </span>
                        {selectedIds.size > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-xs ring-1 ring-blue-300">
                                {selectedIds.size} {t('ordersControl.pagination.selected')}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-gray-50 border border-gray-200 rounded-lg outline-none cursor-pointer py-1.5 px-3 text-xs font-bold text-gray-700 hover:border-blue-400 transition-colors">
                            {[25, 50, 100, 250].map(v => <option key={v} value={v}>{v} {t('ordersControl.pagination.perPage')}</option>)}
                        </select>

                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r border-gray-200">
                                ‹ {t('ordersControl.pagination.prev')}
                            </button>
                            <span className="px-4 py-1.5 text-xs font-black text-gray-800 bg-white">
                                {page} / {totalPages || 1}
                            </span>
                            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-gray-200">
                                {t('ordersControl.pagination.next')} ›
                            </button>
                        </div>
                    </div>
                </div>

                {/* Loading overlay overlaying just the table during transition, but not blocking immediate clicks */}
                {loading && orders.length > 0 && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-50 pointer-events-none flex items-center justify-center">
                        <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-blue-100 flex items-center gap-2 text-sm font-bold text-blue-700 animate-pulse">
                            <RefreshCw className="w-4 h-4 animate-spin" /> {t('ordersControl.pagination.updating')}
                        </div>
                    </div>
                )}
            </div>

            {/* STICKY BULK ACTION HUD */}
            {
                selectedIds.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-[100] animate-in slide-in-from-bottom-5 border border-gray-700">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 font-black text-xs">{selectedIds.size}</span>
                            <span className="text-sm font-bold text-gray-200 tracking-wide uppercase">{t('ordersControl.bulk.targeted')}</span>
                        </div>
                        <div className="w-px h-6 bg-gray-700"></div>

                        {bulkActionType ? (
                            <div className="flex items-center gap-3">
                                <select
                                    value={bulkActionValue}
                                    onChange={e => setBulkActionValue(e.target.value)}
                                    className="bg-gray-800 border-none text-white text-sm font-bold rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="" disabled>{bulkActionType === 'status' ? t('ordersControl.bulk.selectStatus') : bulkActionType === 'agent' ? t('ordersControl.bulk.selectAgent') : t('ordersControl.bulk.selectCourier')}</option>
                                    {bulkActionType === 'status' && (
                                        COD_STATUSES.filter(s => {
                                            if (activeStage === 'pre-dispatch') return ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Refused', 'Cancelled'].includes(s);
                                            if (activeStage === 'post-dispatch') return ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Returned'].includes(s);
                                            if (activeStage === 'returns') return ['Returned', 'Refused'].includes(s);
                                            return true;
                                        }).map(s => <option key={s} value={s}>{s === 'Delivered' || s === 'Refused' || s === 'Returned' || s === 'Cancelled' ? (t(`sales.status${s}`) || s) : s}</option>)
                                    )}
                                    {bulkActionType === 'agent' && [
                                        <option key="unassigned" value="unassigned">{t('ordersControl.bulk.unassignAgent')}</option>,
                                        ...agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)
                                    ]}
                                    {bulkActionType === 'courier' && [
                                        <option key="unassigned" value="unassigned">{t('ordersControl.bulk.unassignCourier')}</option>,
                                        ...couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)
                                    ]}
                                </select>
                                <button onClick={executeBulkAction} disabled={!bulkActionValue} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                                    {t('ordersControl.bulk.applyAll')}
                                </button>
                                <button onClick={() => { setBulkActionType(null); setBulkActionValue(''); }} className="text-gray-400 hover:text-white text-xs font-bold px-2 uppercase">{t('ordersControl.bulk.cancel')}</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {activeStage === 'post-dispatch' ? (
                                    <>
                                        <button onClick={() => setBulkActionType('status')} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold transition-colors">{t('ordersControl.bulk.updateStatus')}</button>
                                        <button onClick={() => setBulkActionType('courier')} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-bold transition-colors">{t('ordersControl.bulk.changeCourier')}</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => setBulkActionType('agent')} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-bold transition-colors">{t('ordersControl.bulk.assignCsr')}</button>
                                        <button onClick={() => setBulkActionType('status')} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold transition-colors">{t('ordersControl.bulk.changeStatus')}</button>
                                        <button onClick={() => setBulkActionType('courier')} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold transition-colors">{t('ordersControl.bulk.sendToCourier')}</button>
                                    </>
                                )}
                            </div>
                        )}

                        <button onClick={() => { setSelectedIds(new Set()); setBulkActionType(null); }} className="ml-2 p-1 text-gray-400 hover:text-rose-400 transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                )
            }

            {/* Focused Order Drawer */}
            <OrderDetailsDrawer
                orderId={focusedOrderId}
                isOpen={!!focusedOrderId}
                onClose={() => setFocusedOrderId(null)}
                onUpdate={fetchOrders}
            />

            {/* Create Order Modal */}
            <OrderModal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
                onSubmit={handleCreateOrder}
                inventoryProducts={productsList}
                couriers={couriers}
            />
        </div >
    );
}
