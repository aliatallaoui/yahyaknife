import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Search, Filter, SlidersHorizontal, ArrowDownCircle, CheckSquare, X, LayoutTemplate, Settings2, RefreshCw, PhoneCall, CheckCircle2, Truck, FileText, Ban, AlertTriangle, Tag, Calendar, MapPin, User, Activity } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OrderDetailsDrawer from '../components/orders/OrderDetailsDrawer';
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

    // Query State
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

    // Row Selection & Expansion
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [expandedRows, setExpandedRows] = useState(new Set());

    // Drawer / Modals
    const [focusedOrderId, setFocusedOrderId] = useState(null);
    const [showFilters, setShowFilters] = useState(false);

    // Column Management (Level 1)
    const [hiddenColumns, setHiddenColumns] = useState(new Set());
    const [showColumnManager, setShowColumnManager] = useState(false);

    // Bulk Actions
    const [bulkActionType, setBulkActionType] = useState(null); // 'status' | 'agent' | 'courier'
    const [bulkActionValue, setBulkActionValue] = useState('');

    // Fetch Dependencies & KPIs
    useEffect(() => {
        const fetchDeps = async () => {
            try {
                const token = localStorage.getItem('token');
                const [curRes, usrRes, kpiRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_URL || ''}/api/couriers`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`${import.meta.env.VITE_API_URL || ''}/api/users`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/operations-kpi`, { headers: { Authorization: `Bearer ${token}` } })
                ]);
                setCouriers(curRes.data || []);
                setAgents((usrRes.data || []).filter(u => ['Admin', 'Call Center Agent'].includes(u.role)));
                setKpis(kpiRes.data);
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
            if (res.data.stageCounts) setStageCounts(res.data.stageCounts);

            // Cleanup invalid selections
            setSelectedIds(prev => {
                const currentIds = new Set((res.data.orders || []).map(o => o._id));
                const next = new Set();
                prev.forEach(id => { if (currentIds.has(id)) next.add(id); });
                return next;
            });

        } catch (err) {
            console.error("Error fetching advanced orders:", err);
        } finally {
            setLoading(false);
        }
    }, [page, limit, sortField, sortOrder, searchTerm, filters, activeStage]);

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

    // Columns configuration
    const visibleColumns = [
        { id: 'orderId', label: 'Order ID' },
        { id: 'customer', label: 'Customer' },
        { id: 'phone', label: 'Mobile Phone' },
        { id: 'location', label: 'Location' },
        { id: 'products', label: 'Products' },
        { id: 'total', label: 'Total Value' },
        { id: 'courier', label: 'Courier' },
        { id: 'agent', label: 'CS Agent' },
        { id: 'date', label: 'Age' },
        { id: 'status', label: 'Status' },
        { id: 'actions', label: '' },
    ];

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
                    <h1 className="text-xl font-black text-gray-900 leading-none mb-1 tracking-tight">Orders Control Center</h1>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">High Volume Operations API</p>
                </div>

                <div className="flex items-center gap-6">
                    {kpis && (
                        <div className="hidden lg:flex items-center gap-4 mr-4 divide-x divide-gray-100">
                            <div className="flex flex-col pl-4 first:pl-0">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New Today</span>
                                <span className="text-sm font-black text-blue-600">{kpis.newOrdersToday}</span>
                            </div>
                            <div className="flex flex-col pl-4">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending</span>
                                <span className="text-sm font-black text-orange-500">{kpis.pendingConfirmation}</span>
                            </div>
                            <div className="flex flex-col pl-4">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirmed</span>
                                <span className="text-sm font-black text-emerald-600">{kpis.confirmedOrders}</span>
                            </div>
                            <div className="flex flex-col pl-4">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dispatched</span>
                                <span className="text-sm font-black text-indigo-600">{kpis.sentToCourier}</span>
                            </div>
                            <div className="flex flex-col pl-4">
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Return Rate</span>
                                <span className="text-sm font-black text-red-600">{kpis.returnRate}%</span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search ID, Phone, Name..."
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
                                onClick={() => setShowColumnManager(!showColumnManager)}
                                className={clsx("flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-lg border transition-all", showColumnManager ? "bg-blue-50 border-blue-200 text-blue-700 shadow-inner" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm")}
                            >
                                <LayoutTemplate className="w-4 h-4" /> Columns
                            </button>
                            {showColumnManager && (
                                <div className="absolute top-10 right-0 w-48 bg-white border border-gray-100 shadow-xl rounded-xl z-50 p-2 py-3 flex flex-col gap-1">
                                    <div className="text-[10px] uppercase font-black tracking-widest text-gray-400 px-3 pb-2 border-b border-gray-100 mb-1">Visible Columns</div>
                                    {visibleColumns.map(col => col.id !== 'actions' && (
                                        <label key={col.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded cursor-pointer select-none transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={!hiddenColumns.has(col.id)}
                                                onChange={() => toggleColumn(col.id)}
                                                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-gray-700">{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={clsx("flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-lg border transition-all", showFilters ? "bg-blue-50 border-blue-200 text-blue-700 shadow-inner" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm")}
                        >
                            <SlidersHorizontal className="w-4 h-4" /> Filters {Object.values(filters).filter(Boolean).length > 0 && `(${Object.values(filters).filter(Boolean).length})`}
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <button onClick={() => fetchOrders()} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Refresh Data Core">
                            <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin text-blue-500")} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Stage Navigation Tabs */}
            <div className="bg-white border-b border-gray-100 flex items-center px-6 gap-6 shrink-0 pt-2 z-20 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.05)] overflow-x-auto scrollbar-none">
                {[
                    { id: 'pre-dispatch', label: 'Pre Dispatch', count: stageCounts.preDispatch, color: 'text-blue-600', bg: 'bg-blue-600', icon: <PhoneCall className="w-3.5 h-3.5" /> },
                    { id: 'post-dispatch', label: 'Post Dispatch', count: stageCounts.postDispatch, color: 'text-indigo-600', bg: 'bg-indigo-600', icon: <Truck className="w-3.5 h-3.5" /> },
                    { id: 'returns', label: 'Returns & Refusals', count: stageCounts.returns, color: 'text-rose-600', bg: 'bg-rose-600', icon: <Ban className="w-3.5 h-3.5" /> },
                    { id: 'all', label: 'All Orders', count: stageCounts.all, color: 'text-gray-600', bg: 'bg-gray-600', icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
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

            {/* Expansive Collapsible Advanced Filters */}
            {showFilters && (
                <div className="bg-white border-y border-gray-100 shadow-sm shrink-0 z-10 py-3 px-6 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                        <div className="relative flex items-center shrink-0">
                            <AlertTriangle className="w-[14px] h-[14px] text-orange-500 absolute left-3 pointer-events-none" />
                            <select value={filters.priority} onChange={e => handleFilterChange('priority', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-orange-200 bg-orange-50 text-orange-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-orange-500/20 appearance-none cursor-pointer hover:bg-orange-100/70 transition-colors">
                                <option value="">All Priorities</option>
                                {['Normal', 'High Priority', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="relative flex items-center shrink-0">
                            <LayoutTemplate className="w-[14px] h-[14px] text-purple-500 absolute left-3 pointer-events-none" />
                            <select value={filters.channel} onChange={e => handleFilterChange('channel', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-purple-500/20 appearance-none cursor-pointer hover:bg-purple-100/70 transition-colors">
                                <option value="">All Channels</option>
                                {['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Manual Entry', 'Other'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
                            </select>
                        </div>
                        <div className="relative flex items-center shrink-0">
                            <MapPin className="w-[14px] h-[14px] text-teal-500 absolute left-3 pointer-events-none" />
                            <input type="text" placeholder="Wilaya (e.g. Alger)" value={filters.wilaya} onChange={e => handleFilterChange('wilaya', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-teal-500/20 placeholder:text-teal-400/70 w-36 hover:bg-teal-100/70 transition-colors" />
                        </div>
                        <div className="relative flex items-center shrink-0">
                            <User className="w-[14px] h-[14px] text-blue-500 absolute left-3 pointer-events-none" />
                            <select value={filters.agent} onChange={e => handleFilterChange('agent', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer hover:bg-blue-100/70 transition-colors">
                                <option value="">Any Agent</option>
                                <option value="unassigned">Unassigned</option>
                                {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div className="relative flex items-center shrink-0">
                            <Truck className="w-[14px] h-[14px] text-indigo-500 absolute left-3 pointer-events-none" />
                            <select value={filters.courier} onChange={e => handleFilterChange('courier', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer hover:bg-indigo-100/70 transition-colors">
                                <option value="">Any Courier</option>
                                <option value="unassigned">Unassigned</option>
                                {couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="relative flex items-center shrink-0">
                            <Activity className="w-[14px] h-[14px] text-emerald-500 absolute left-3 pointer-events-none" />
                            <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer hover:bg-emerald-100/70 transition-colors">
                                <option value="">All Statuses</option>
                                {COD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div className="h-6 w-px bg-gray-200 shrink-0 hidden sm:block"></div>

                        <div className="relative flex items-center shrink-0">
                            <Calendar className="w-[14px] h-[14px] text-gray-400 absolute left-3 pointer-events-none" />
                            <input type="date" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} className="pl-9 pr-3 py-1.5 rounded-l-full border border-gray-200 bg-gray-50 text-gray-600 text-[11px] font-bold outline-none focus:ring-1 focus:ring-gray-300 w-32 border-r-0 hover:bg-gray-100/50 transition-colors" />
                            <div className="bg-gray-50 border-y border-gray-200 py-1.5 px-1 text-[10px] text-gray-400 font-bold shrink-0">TO</div>
                            <input type="date" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} className="px-3 py-1.5 rounded-r-full border border-gray-200 bg-gray-50 text-gray-600 text-[11px] font-bold outline-none focus:ring-1 focus:ring-gray-300 w-28 hover:bg-gray-100/50 transition-colors" />
                        </div>

                        <div className="relative flex items-center shrink-0">
                            <Tag className="w-[14px] h-[14px] text-pink-500 absolute left-3 pointer-events-none" />
                            <input type="text" placeholder="Tags (e.g. VIP)" value={filters.tags} onChange={e => handleFilterChange('tags', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-pink-200 bg-pink-50 text-pink-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-pink-500/20 placeholder:text-pink-400/70 w-32 hover:bg-pink-100/70 transition-colors" />
                        </div>
                    </div>
                </div>
            )}

            {/* High Performance DataGrid Container */}
            <div className="flex-1 bg-white border-y border-gray-200 shadow-sm flex flex-col relative overflow-hidden">

                {/* Scrollable Table Area */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-gray-50/90 text-gray-500 text-[11px] uppercase tracking-wider sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-3 border-b border-gray-200 w-10">
                                    <input type="checkbox" checked={orders.length > 0 && selectedIds.size === orders.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer" />
                                </th>
                                {visibleColumns.filter(c => !hiddenColumns.has(c.id)).map(col => (
                                    <th key={col.id} onClick={() => col.id !== 'actions' && handleSort(col.id)} className={clsx("px-4 py-3 border-b border-gray-200 hover:bg-gray-100/50 hover:text-gray-900 transition-colors group select-none", col.id !== 'actions' && "cursor-pointer")}>
                                        <div className="flex items-center gap-1.5">
                                            {col.label}
                                            {sortField === col.id && col.id !== 'actions' && (
                                                <ArrowDownCircle className={clsx("w-3.5 h-3.5 text-blue-500 transition-transform", sortOrder === 'asc' && "rotate-180")} />
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
                                        <p className="mt-4 text-sm font-bold text-gray-400">Loading Order Grid...</p>
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="py-24 text-center">
                                        <LayoutTemplate className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-gray-500">No logical orders matched your strict filters.</p>
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

                                            {!hiddenColumns.has('orderId') && (
                                                <td className="px-4 py-2">
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
                                                        <div className="absolute left-0 top-full mt-2 w-56 bg-gray-900 rounded-xl shadow-xl border border-gray-700 p-4 opacity-0 invisible group-hover/timeline:opacity-100 group-hover/timeline:visible transition-all z-[60] text-white cursor-default" onClick={e => e.stopPropagation()}>
                                                            <div className="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest border-b border-gray-700 pb-2">Order Timeline</div>
                                                            <div className="flex flex-col gap-4 relative before:absolute before:inset-y-1 before:left-1.5 before:w-0.5 before:bg-gray-700">
                                                                <div className="flex items-start gap-4 relative">
                                                                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                                    <div className="flex flex-col text-xs leading-none">
                                                                        <span className="font-bold text-gray-100">Created</span>
                                                                        <span className="text-[10px] text-gray-400 font-mono mt-1">{moment(order.date).format('DD MMM, HH:mm')}</span>
                                                                    </div>
                                                                </div>
                                                                {order.status !== 'New' && (
                                                                    <div className="flex items-start gap-4 relative">
                                                                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                                        <div className="flex flex-col text-xs leading-none">
                                                                            <span className="font-bold text-gray-100">Confirmed</span>
                                                                            <span className="text-[10px] text-gray-400 font-mono mt-1">Processed</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned'].includes(order.status) && (
                                                                    <div className="flex items-start gap-4 relative">
                                                                        <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                                        <div className="flex flex-col text-xs leading-none">
                                                                            <span className="font-bold text-gray-100">Sent to Courier</span>
                                                                            <span className="text-[10px] text-gray-400 mt-1">{order.courier?.name || 'Assigned Courier'}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {['Delivered', 'Paid'].includes(order.status) && (
                                                                    <div className="flex items-start gap-4 relative">
                                                                        <div className="w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                                        <div className="flex flex-col text-xs leading-none">
                                                                            <span className="font-bold text-gray-100">{order.status}</span>
                                                                            <span className="text-[10px] text-emerald-400 mt-1">Successful Delivery</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {['Refused', 'Returned', 'Cancelled'].includes(order.status) && (
                                                                    <div className="flex items-start gap-4 relative">
                                                                        <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                                        <div className="flex flex-col text-xs leading-none">
                                                                            <span className="font-bold text-gray-100">Unsuccessful</span>
                                                                            <span className="text-[10px] text-rose-400 mt-1">{order.status}</span>
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
                                            )}

                                            {!hiddenColumns.has('customer') && (
                                                <td className="px-4 py-2">
                                                    <div className="flex flex-col relative group/customer">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-gray-900 truncate max-w-[150px]">{order.customer?.name || 'Unknown'}</span>
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
                                                                    {(order.customer?.name || 'U').charAt(0)}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="font-black text-gray-900 text-sm leading-none">{order.customer?.name || 'Unknown'}</span>
                                                                    <span className="font-mono text-[10px] text-gray-500 mt-1">{order.customer?.phone || '-'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                                                                <div className="flex flex-col">
                                                                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Lifetime Orders</span>
                                                                    <span className="font-black text-gray-800">{order.customer?.totalOrders || 0}</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Trust Score</span>
                                                                    <span className={clsx("font-black", (order.customer?.trustScore || 100) < 50 ? "text-rose-600" : "text-emerald-600")}>
                                                                        {order.customer?.trustScore || 100}/100
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Delivered</span>
                                                                    <span className="font-black text-emerald-600">{order.customer?.deliveredOrders || 0}</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Returned</span>
                                                                    <span className="font-black text-rose-600">{order.customer?.totalRefusals || 0}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            )}

                                            {!hiddenColumns.has('phone') && (
                                                <td className="px-4 py-2 font-mono text-xs font-semibold text-gray-600">
                                                    {order.customer?.phone || order.shipping?.phone1 || '-'}
                                                </td>
                                            )}

                                            {!hiddenColumns.has('location') && (
                                                <td className="px-4 py-2 text-xs">
                                                    <p className="font-bold text-gray-700 truncate max-w-[130px]">{order.wilaya || 'Unspecified Zone'}</p>
                                                    <p className="text-gray-400 truncate max-w-[130px]">{order.commune}</p>
                                                </td>
                                            )}

                                            {!hiddenColumns.has('products') && (
                                                <td className="px-4 py-2 text-xs">
                                                    {order.products?.length > 0 ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-800 truncate max-w-[160px]">{order.products[0].name || 'Product Item'}</span>
                                                            {order.products.length > 1 && <span className="text-[10px] text-gray-400 font-bold">+{order.products.length - 1} more types (Qty: {order.products.reduce((acc, p) => acc + p.quantity, 0)})</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic">No Items</span>
                                                    )}
                                                </td>
                                            )}

                                            {!hiddenColumns.has('total') && (
                                                <td className="px-4 py-2 text-right">
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
                                            )}

                                            {!hiddenColumns.has('courier') && (
                                                <td className="px-4 py-2">
                                                    {order.courier?.name ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-[11px] font-black tracking-wide truncate max-w-[100px]">
                                                            {order.courier.name}
                                                        </span>
                                                    ) : <span className="text-[11px] text-gray-400 font-medium">—</span>}
                                                </td>
                                            )}

                                            {!hiddenColumns.has('agent') && (
                                                <td className="px-4 py-2">
                                                    {order.assignedAgent?.name ? (
                                                        <span className="text-xs font-bold text-gray-700 truncate max-w-[100px] block">{order.assignedAgent.name}</span>
                                                    ) : <span className="text-[11px] text-gray-400 font-medium block">Unassigned</span>}
                                                </td>
                                            )}

                                            {!hiddenColumns.has('date') && (
                                                <td className="px-4 py-2 text-xs w-28 whitespace-nowrap overflow-hidden text-ellipsis">
                                                    <div className="flex flex-col">
                                                        <span className={clsx("font-bold", moment().diff(moment(order.date), 'hours') > 24 && order.status === 'New' ? "text-rose-600" : "text-gray-600")} title={moment(order.date).format('PPpp')}>
                                                            {getAge(order.date)} ago
                                                        </span>
                                                    </div>
                                                </td>
                                            )}

                                            {!hiddenColumns.has('status') && (
                                                <td className="px-4 py-2">
                                                    <div className="flex flex-col gap-1.5 items-start">
                                                        <span className={clsx("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide border", STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-600 border-gray-200')}>
                                                            {order.status}
                                                        </span>
                                                        {order.tags && order.tags.length > 0 && (
                                                            <div className="flex items-center gap-1 flex-wrap max-w-[120px]">
                                                                {order.tags.map(t => (
                                                                    <span key={t} className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600 truncate max-w-[80px]" title={t}>
                                                                        {t}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            )}

                                            <td className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { const phone = order.customer?.phone || order.shipping?.phone1; if (phone) window.open(`tel:${phone}`); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title="Call Customer">
                                                        <PhoneCall className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => { setBulkActionType('status'); setBulkActionValue('Confirmed'); setSelectedIds(new Set([order._id])); }} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title="Quick Confirm">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => { setBulkActionType('courier'); setSelectedIds(new Set([order._id])); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title="Assign Courier">
                                                        <Truck className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setFocusedOrderId(order._id)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded bg-white border border-gray-200 shadow-sm transition-colors" title="Open Details & Notes">
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => { setBulkActionType('status'); setBulkActionValue('Cancelled'); setSelectedIds(new Set([order._id])); }} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title="Cancel Order">
                                                        <Ban className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRows.has(order._id) && (
                                            <tr className="bg-gray-50/40 shadow-[inset_0_4px_6px_-1px_rgba(0,0,0,0.03)] border-b border-gray-200">
                                                <td colSpan={visibleColumns.filter(c => !hiddenColumns.has(c.id)).length + 1} className="p-0">
                                                    <div className="flex flex-col animate-in slide-in-from-top-1 px-8 py-5 gap-4">
                                                        <div className="grid grid-cols-4 gap-6">
                                                            {/* Customer Details Panel */}
                                                            <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">Customer Info</h4>
                                                                <div className="flex flex-col gap-1.5 text-xs">
                                                                    <div className="flex items-center justify-between"><span className="text-gray-500 font-medium whitespace-nowrap">Primary Phone:</span> <span className="font-mono font-bold text-gray-800">{order.customer?.phone || order.shipping?.phone1 || '-'}</span></div>
                                                                    <div className="flex items-center justify-between"><span className="text-gray-500 font-medium whitespace-nowrap">Secondary Phone:</span> <span className="font-mono font-bold text-gray-800">{order.shipping?.phone2 || '-'}</span></div>
                                                                    <div className="flex items-start justify-between mt-1 gap-2">
                                                                        <span className="text-gray-500 font-medium whitespace-nowrap leading-tight">Shipping Address:</span>
                                                                        <span className="font-semibold text-gray-800 leading-tight text-right line-clamp-2" title={order.shipping?.address}>{order.shipping?.address || order.commune}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Product Details Panel */}
                                                            <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">Product Info</h4>
                                                                <div className="flex flex-col gap-2 max-h-[100px] overflow-y-auto pr-1">
                                                                    {order.products?.map((prod, i) => (
                                                                        <div key={i} className="flex flex-col text-xs bg-gray-50/50 p-1.5 rounded border border-gray-100">
                                                                            <span className="font-bold text-gray-800 truncate" title={prod.name}>{prod.name}</span>
                                                                            <div className="flex items-center justify-between mt-1 text-[11px]">
                                                                                <span className="text-gray-500 font-mono">{prod.sku || 'NO-SKU'}</span>
                                                                                <span className="font-black text-gray-700">Qty: {prod.quantity}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Operational Intelligence Panel */}
                                                            <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">Customer Intelligence</h4>
                                                                <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-xs">
                                                                    <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">Total Orders</span><span className="font-black text-gray-800">{order.customer?.totalOrders || 0}</span></div>
                                                                    <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">Delivered</span><span className="font-black text-emerald-600">{order.customer?.deliveredOrders || 0}</span></div>
                                                                    <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">Returns</span><span className="font-black text-rose-600">{order.customer?.totalRefusals || 0}</span></div>
                                                                    <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">Return Rate</span><span className={clsx("font-black", (order.customer?.refusalRate || 0) > 30 ? "text-orange-500" : "text-gray-800")}>{Math.round(order.customer?.refusalRate || 0)}%</span></div>
                                                                </div>
                                                            </div>

                                                            {/* Logistics & Delivery Panel */}
                                                            <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">Delivery Track</h4>
                                                                <div className="flex flex-col gap-1.5 text-xs">
                                                                    <div className="flex items-center justify-between"><span className="text-gray-500 font-medium">Provider:</span> <span className="font-bold text-indigo-700">{order.courier?.name || 'Unassigned'}</span></div>
                                                                    <div className="flex items-center justify-between mt-0.5"><span className="text-gray-500 font-medium">Tracking Code:</span> <span className="font-mono font-bold text-gray-800">{order.trackingNumber || '-'}</span></div>
                                                                    <div className="flex items-center justify-between mt-2">
                                                                        <span className="text-gray-500 font-medium">Timeline Stage:</span>
                                                                        <span className="font-bold text-gray-800 mt-0.5">{order.status}</span>
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
                                                                <FileText className="w-3.5 h-3.5" /> View Full Order Details
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
                            Showing <strong className="text-gray-900">{orders.length}</strong> of <strong className="text-gray-900">{totalOrders}</strong> records
                        </span>
                        {selectedIds.size > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-xs ring-1 ring-blue-300">
                                {selectedIds.size} Selected
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-gray-50 border border-gray-200 rounded-lg outline-none cursor-pointer py-1.5 px-3 text-xs font-bold text-gray-700 hover:border-blue-400 transition-colors">
                            {[25, 50, 100, 250].map(v => <option key={v} value={v}>{v} / page</option>)}
                        </select>

                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r border-gray-200">
                                ‹ Prev
                            </button>
                            <span className="px-4 py-1.5 text-xs font-black text-gray-800 bg-white">
                                {page} / {totalPages || 1}
                            </span>
                            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-gray-200">
                                Next ›
                            </button>
                        </div>
                    </div>
                </div>

                {/* Loading overlay overlaying just the table during transition, but not blocking immediate clicks */}
                {loading && orders.length > 0 && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-50 pointer-events-none flex items-center justify-center">
                        <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-blue-100 flex items-center gap-2 text-sm font-bold text-blue-700 animate-pulse">
                            <RefreshCw className="w-4 h-4 animate-spin" /> Updating Grid
                        </div>
                    </div>
                )}
            </div>

            {/* STICKY BULK ACTION HUD */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-[100] animate-in slide-in-from-bottom-5 border border-gray-700">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 font-black text-xs">{selectedIds.size}</span>
                        <span className="text-sm font-bold text-gray-200 tracking-wide uppercase">Orders targeted</span>
                    </div>
                    <div className="w-px h-6 bg-gray-700"></div>

                    {bulkActionType ? (
                        <div className="flex items-center gap-3">
                            <select
                                value={bulkActionValue}
                                onChange={e => setBulkActionValue(e.target.value)}
                                className="bg-gray-800 border-none text-white text-sm font-bold rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="" disabled>Select {bulkActionType === 'status' ? 'Status' : bulkActionType === 'agent' ? 'Agent' : 'Courier'}...</option>
                                {bulkActionType === 'status' && (activeStage === 'post-dispatch'
                                    ? ['Delivered', 'Returned', 'Out for Delivery', 'Paid'].map(s => <option key={s} value={s}>{s}</option>)
                                    : COD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)
                                )}
                                {bulkActionType === 'agent' && [
                                    <option key="unassigned" value="unassigned">-- Unassign Agent --</option>,
                                    ...agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)
                                ]}
                                {bulkActionType === 'courier' && [
                                    <option key="unassigned" value="unassigned">-- Unassign Courier --</option>,
                                    ...couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)
                                ]}
                            </select>
                            <button onClick={executeBulkAction} disabled={!bulkActionValue} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                                Apply All
                            </button>
                            <button onClick={() => { setBulkActionType(null); setBulkActionValue(''); }} className="text-gray-400 hover:text-white text-xs font-bold px-2 uppercase">Cancel</button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            {activeStage === 'post-dispatch' ? (
                                <>
                                    <button onClick={() => setBulkActionType('status')} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold transition-colors">Update Delivery Status</button>
                                    <button onClick={() => setBulkActionType('courier')} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-bold transition-colors">Change Courier</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setBulkActionType('agent')} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-bold transition-colors">Assign CSR</button>
                                    <button onClick={() => setBulkActionType('status')} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold transition-colors">Change Status</button>
                                    <button onClick={() => setBulkActionType('courier')} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold transition-colors">Send to Courier</button>
                                </>
                            )}
                        </div>
                    )}

                    <button onClick={() => { setSelectedIds(new Set()); setBulkActionType(null); }} className="ml-2 p-1 text-gray-400 hover:text-rose-400 transition-colors"><X className="w-5 h-5" /></button>
                </div>
            )}

            {/* Slide-out details drawer */}
            {focusedOrderId && (
                <OrderDetailsDrawer
                    order={orders.find(o => o._id === focusedOrderId)}
                    onClose={() => setFocusedOrderId(null)}
                    onUpdate={(updatedOrder) => {
                        setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
                    }}
                />
            )}
        </div>
    );
}
