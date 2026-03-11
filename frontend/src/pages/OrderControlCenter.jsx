import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Search, Filter, SlidersHorizontal, ArrowDownCircle, CheckSquare, X, LayoutTemplate, Settings2, RefreshCw, PhoneCall, CheckCircle2, Truck, FileText, Ban, AlertTriangle, Tag, Calendar, MapPin, User, Activity, PackageOpen, ChevronUp, ChevronDown, Trash2, RotateCcw } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
    const defaultColumnOrder = ['index', 'orderId', 'customer', 'phone', 'location', 'products', 'total', 'courier', 'agent', 'date', 'status', 'tags', 'actions'];
    const [hiddenColumns, setHiddenColumns] = useState(() => {
        try {
            const saved = localStorage.getItem('orderControlHiddenColumns');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });
    
    const [orderedColumnIds, setOrderedColumnIds] = useState(() => {
        try {
            const saved = localStorage.getItem('orderControlOrderedColumns');
            if (!saved) return defaultColumnOrder;
            const parsed = JSON.parse(saved);
            // Merge: keep saved order but append any new columns from defaults that aren't saved
            const newCols = defaultColumnOrder.filter(id => !parsed.includes(id));
            return newCols.length > 0 ? [...parsed.slice(0, -1), ...newCols, parsed[parsed.length - 1]] : parsed;
        } catch {
            return defaultColumnOrder;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('orderControlHiddenColumns', JSON.stringify(Array.from(hiddenColumns)));
        } catch (e) { console.error('Failed to save hidden columns', e); }
    }, [hiddenColumns]);

    useEffect(() => {
        try {
            localStorage.setItem('orderControlOrderedColumns', JSON.stringify(orderedColumnIds));
        } catch (e) { console.error('Failed to save ordered columns', e); }
    }, [orderedColumnIds]);
    
    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [draggedColumnId, setDraggedColumnId] = useState(null);
    const [showKPIs, setShowKPIs] = useState(() => {
        try {
            const saved = localStorage.getItem('orderControlShowKPIs');
            return saved ? JSON.parse(saved) : false;
        } catch {
            return false;
        }
    }); // Hidden by default to save space
    
    useEffect(() => {
        try {
            localStorage.setItem('orderControlShowKPIs', JSON.stringify(showKPIs));
        } catch (e) { console.error('Failed to save KPI state', e); }
    }, [showKPIs]);

    // Filters and Pagination
    const [nextCursor, setNextCursor] = useState(null);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
    const [limit, setLimit] = useState(50);
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

    // CSV Export Background Queue State
    const [exportState, setExportState] = useState({ isExporting: false, progress: 0, jobId: null });

    // Virtualization Engine
    const parentRef = React.useRef(null);
    const rowVirtualizer = useVirtualizer({
        count: hasNextPage ? orders.length + 1 : orders.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 68, // Approximate height of a row
        overscan: 15, // High overscan for completely smooth rendering
    });

    const handleExportCSV = async () => {
        try {
            const token = localStorage.getItem('token');
            const params = {
                search: searchTerm, ...filters, stage: activeStage !== 'all' ? activeStage : undefined
            };

            // Trigger background job
            const res = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/exports/orders`, {}, {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.jobId) {
                setExportState({ isExporting: true, progress: 0, jobId: res.data.jobId });
                pollExportStatus(res.data.jobId);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to trigger export');
        }
    };

    const pollExportStatus = async (jobId) => {
        const token = localStorage.getItem('token');
        const interval = setInterval(async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/exports/${jobId}/status`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.status === 'completed') {
                    clearInterval(interval);
                    setExportState({ isExporting: false, progress: 100, jobId: null });
                    // Provide the download
                    const url = `${import.meta.env.VITE_API_URL || ''}${res.data.downloadUrl}`;
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = res.data.fileName || 'export.csv';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else if (res.data.status === 'failed') {
                    clearInterval(interval);
                    setExportState({ isExporting: false, progress: 0, jobId: null });
                    alert(`Export Failed: ${res.data.error}`);
                } else {
                    // Update progress
                    setExportState(prev => ({ ...prev, progress: res.data.progress || 0 }));
                }
            } catch (err) {
                clearInterval(interval);
                setExportState({ isExporting: false, progress: 0, jobId: null });
                console.error("Polling error:", err);
            }
        }, 1500); // Poll every 1.5 seconds
    };

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
    const fetchOrders = useCallback(async (loadMore = false) => {
        if (!loadMore) {
            setLoading(true);
        } else {
            setIsFetchingNextPage(true);
        }
        try {
            const token = localStorage.getItem('token');
            const params = {
                limit, sortField, sortOrder,
                search: searchTerm, ...filters, stage: activeStage !== 'all' ? activeStage : undefined
            };

            if (loadMore && nextCursor) {
                params.cursor = nextCursor;
            }

            // Clean empty strings from params
            Object.keys(params).forEach(k => params[k] === '' && delete params[k]);

            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/advanced`, {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });

            if (loadMore) {
                setOrders(prev => {
                    const existingIds = new Set(prev.map(o => o._id));
                    const newUnique = (res.data.orders || []).filter(o => !existingIds.has(o._id));
                    return [...prev, ...newUnique];
                });
            } else {
                setOrders(res.data.orders || []);
            }
            
            setNextCursor(res.data.nextCursor || null);
            setHasNextPage(res.data.hasNextPage || false);

            if (res.data.totalOrders !== null && res.data.totalOrders !== undefined) {
                setTotalOrders(res.data.totalOrders);
            }
            if (res.data.stageCounts) {
                setStageCounts(res.data.stageCounts);
            }

            setError(null);

            // No selection reset — preserve user's selections across fetches

        } catch (err) {
            console.error("Order Fetch Error", err);
            setError(err.response?.data?.message || "Failed to load orders");
        } finally {
            setLoading(false);
            setIsFetchingNextPage(false);
        }
    }, [limit, sortField, sortOrder, searchTerm, filters, activeStage, nextCursor]);

    // Infinite Scroll Intersection Trigger
    useEffect(() => {
        const [lastItem] = rowVirtualizer.getVirtualItems().slice(-1);
        if (!lastItem) return;

        // If we scrolled near the end of the array and there is a next page
        if (
            lastItem.index >= orders.length - 25 &&
            hasNextPage &&
            !isFetchingNextPage &&
            !loading
        ) {
            fetchOrders(true);
        }
    }, [
        hasNextPage,
        fetchOrders,
        orders.length,
        isFetchingNextPage,
        loading,
        rowVirtualizer.getVirtualItems(),
    ]);

    // Data Fetch Trigger
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchOrders();
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [limit, sortField, sortOrder, searchTerm, filters, activeStage]);

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

    // Handle update order from modal
    const handleUpdateOrder = async (orderData) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/${editOrderData._id}`, orderData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsOrderModalOpen(false);
            setEditOrderData(null);
            fetchOrders();
            setSyncMessage(t('ordersControl.orderUpdated', { defaultValue: 'Order updated successfully!' }));
            setTimeout(() => setSyncMessage(null), 3000);
            return { success: true };
        } catch (err) {
            console.error("Failed to update order", err);
            return { success: false, error: err.response?.data?.message || err.message };
        }
    };


    // Helpers
    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === orders.length && orders.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(orders.map(o => o._id)));
        }
    };

    const toggleSelect = useCallback((id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

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

    // Postpone order — opens date picker modal
    const [postponeOrderId, setPostponeOrderId] = useState(null);
    const [postponeDate, setPostponeDate] = useState('');

    const handlePostponeConfirm = useCallback(async () => {
        if (!postponeOrderId || !postponeDate) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/${postponeOrderId}`, {
                status: 'Postponed',
                postponedUntil: new Date(postponeDate).toISOString()
            }, { headers: { Authorization: `Bearer ${token}` } });
            setPostponeOrderId(null);
            setPostponeDate('');
            fetchOrders();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    }, [postponeOrderId, postponeDate, fetchOrders]);

    const handleTagUpdate = useCallback(async (orderId, newTags) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/${orderId}`, {
                tags: newTags
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchOrders();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    }, [fetchOrders]);

    const handlePriorityChange = useCallback(async (orderId, newPriority) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/${orderId}`, {
                priority: newPriority
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchOrders();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    }, [fetchOrders]);

    const handleBulkDelete = useCallback(async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Move ${selectedIds.size} order(s) to Trash?`)) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/bulk/delete`,
                { orderIds: Array.from(selectedIds) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedIds(new Set());
            fetchOrders();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    }, [selectedIds, fetchOrders]);

    const handleBulkRestore = useCallback(async () => {
        if (selectedIds.size === 0) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/bulk/restore`,
                { orderIds: Array.from(selectedIds) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedIds(new Set());
            fetchOrders();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    }, [selectedIds, fetchOrders]);

    const handleBulkPurge = useCallback(async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`PERMANENTLY delete ${selectedIds.size} order(s)? This cannot be undone.`)) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/bulk/purge`,
                { orderIds: Array.from(selectedIds) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedIds(new Set());
            fetchOrders();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    }, [selectedIds, fetchOrders]);

    const handleAgentChange = useCallback(async (orderId, agentId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/bulk/update`, {
                orderIds: [orderId],
                action: 'assign_agent',
                payload: { agentId: agentId === 'unassigned' ? null : agentId }
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchOrders();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    }, [fetchOrders]);

    const handleCourierChange = useCallback(async (orderId, courierId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/bulk/update`, {
                orderIds: [orderId],
                action: 'assign_courier',
                payload: { courierId: courierId === 'unassigned' ? null : courierId }
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

    const onBulkActionCancel = useCallback((orderId) => {
        setBulkActionType('status');
        setBulkActionValue('Cancelled');
        setSelectedIds(new Set([orderId]));
    }, []);

    const onQuickDispatch = useCallback((orderId) => {
        handleStatusChange(orderId, 'Dispatched');
    }, [handleStatusChange]);

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
    const columnDefinitions = useMemo(() => ({
        index: { id: 'index', label: '#' },
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
        tags: { id: 'tags', label: t('ordersControl.grid.tags', { defaultValue: 'Tags & Priority' }) },
        actions: { id: 'actions', label: t('ordersControl.expanded.actions', { defaultValue: 'Actions' }) },
    }), [t]);

    // Calculate currently visible ordered columns
    const visibleColumns = useMemo(() => {
        return orderedColumnIds
            .filter(id => !hiddenColumns.has(id))
            .map(id => columnDefinitions[id])
            .filter(Boolean);
    }, [orderedColumnIds, hiddenColumns, columnDefinitions]);

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

    // Touch-friendly column mover
    const moveColumn = (index, direction) => {
        if (direction === 'up' && index > 0) {
            const newOrder = [...orderedColumnIds];
            [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
            setOrderedColumnIds(newOrder);
        } else if (direction === 'down' && index < orderedColumnIds.length - 1) {
            const newOrder = [...orderedColumnIds];
            [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
            setOrderedColumnIds(newOrder);
        }
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
        <div className="flex flex-col h-[calc(100vh-72px)] w-auto overflow-hidden bg-gray-50/50 gap-4 -mx-4 sm:-mx-8 lg:-mx-10 xl:-mx-14 2xl:-mx-16 -mt-10 -mb-12">

            {/* Postpone Date Picker Modal */}
            {postponeOrderId && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => { setPostponeOrderId(null); setPostponeDate(''); }} />
                    <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-80 animate-in zoom-in-95 fade-in-0 duration-200">
                        <div className="mb-4">
                            <h3 className="text-sm font-black text-gray-900 mb-1">📅 تأجيل الطلبية</h3>
                            <p className="text-xs text-gray-500">اختر تاريخ العودة — ستظهر الطلبية في أعلى القائمة عند حلول هذا الموعد</p>
                        </div>
                        <input
                            type="datetime-local"
                            value={postponeDate}
                            onChange={(e) => setPostponeDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none mb-4 font-bold"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setPostponeOrderId(null); setPostponeDate(''); }}
                                className="flex-1 px-3 py-2 text-xs font-black uppercase rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handlePostponeConfirm}
                                disabled={!postponeDate}
                                className="flex-1 px-3 py-2 text-xs font-black uppercase rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                تأجيل ✓
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white px-4 xl:px-6 py-2 border-b border-gray-100 shrink-0 flex flex-col gap-2 shadow-sm z-30">
                
                {/* Top Row: Left: Search+Filter | Center: Column Settings (unclipped) | Right: Export+Add */}
                <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-y-2 gap-x-2">
                    
                    {/* Left: Search + Filter (scrollable) */}
                    <div className="flex items-center gap-1.5 xl:gap-2 shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <div className="relative shrink-0">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder={t('ordersControl.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); }}
                                className="bg-gray-50 border border-gray-200 text-xs font-bold rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-[140px] md:w-[150px] xl:w-[200px] ps-8 pe-2.5 py-1.5 xl:py-2 outline-none transition-all shadow-inner focus:bg-white placeholder:font-medium"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 xl:py-2 text-xs font-bold rounded-lg border transition-all h-[32px] xl:h-[36px] shrink-0", showFilters ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm")}
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" /> <span className="hidden lg:inline">{t('ordersControl.filtersBtn')}</span> {Object.values(filters).filter(Boolean).length > 0 && `(${Object.values(filters).filter(Boolean).length})`}
                        </button>
                    </div>{/* end left group */}

                    {/* Right: Export + Add Order + Refresh */}
                    <div className="flex items-center gap-1.5 xl:gap-2 shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <button
                            onClick={handleExportCSV}
                            disabled={exportState.isExporting}
                            className={clsx(
                                "flex items-center gap-1.5 px-2.5 py-1.5 xl:py-2 text-xs font-bold rounded-lg border shadow-sm transition-all whitespace-nowrap h-[32px] xl:h-[36px] shrink-0",
                                exportState.isExporting
                                    ? "bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed"
                                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                            )}
                        >
                            {exportState.isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{exportState.isExporting ? `${exportState.progress}%` : t('ordersControl.actions.exportCsv', { defaultValue: 'Export CSV' })}</span>
                        </button>

                        {/* Column Settings — beside Export CSV */}
                        <div className="relative shrink-0">
                            <button
                                onClick={() => setShowColumnSettings(!showColumnSettings)}
                                className={clsx(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 xl:py-2 rounded-lg border font-bold text-xs transition-colors h-[32px] xl:h-[36px] shrink-0",
                                    showColumnSettings ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
                                )}
                            >
                                <LayoutTemplate className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">{t('ordersControl.actions.manageColumns', { defaultValue: 'Columns' })}</span>
                            </button>
                            {showColumnSettings && (
                                <div
                                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                                    onClick={() => setShowColumnSettings(false)}
                                >
                                    {/* Backdrop */}
                                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                                    {/* Modal panel */}
                                    <div
                                        className="relative w-80 max-h-[80vh] bg-white rounded-2xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.35)] border border-gray-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="bg-gradient-to-r from-indigo-50 to-white px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                                            <div>
                                                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">{t('ordersControl.actions.manageColumns', { defaultValue: 'Manage Columns' })}</h3>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{t('ordersControl.actions.dragHint', { defaultValue: 'Drag to reorder • toggle to show/hide' })}</p>
                                            </div>
                                            <button onClick={() => setShowColumnSettings(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="p-3 overflow-y-auto flex-1">
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
                                                            "flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all mb-1 cursor-grab active:cursor-grabbing select-none",
                                                            isDragging ? "bg-indigo-50/60 border-indigo-200 shadow-sm scale-[1.01] opacity-80" : "bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200",
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-gray-300 shrink-0">
                                                                <svg width="10" height="14" viewBox="0 0 10 18" fill="currentColor"><circle cx="3" cy="3" r="1.5"/><circle cx="3" cy="9" r="1.5"/><circle cx="3" cy="15" r="1.5"/><circle cx="7" cy="3" r="1.5"/><circle cx="7" cy="9" r="1.5"/><circle cx="7" cy="15" r="1.5"/></svg>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <button className="text-gray-300 hover:text-indigo-500 disabled:opacity-20 transition-colors" disabled={index === 0} onClick={(e) => { e.stopPropagation(); moveColumn(index, 'up'); }}>
                                                                    <ChevronUp className="w-3 h-3" />
                                                                </button>
                                                                <button className="text-gray-300 hover:text-indigo-500 disabled:opacity-20 transition-colors" disabled={index === orderedColumnIds.length - 1} onClick={(e) => { e.stopPropagation(); moveColumn(index, 'down'); }}>
                                                                    <ChevronDown className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                            <span className={clsx("font-semibold text-sm", isHidden ? "text-gray-300 line-through" : "text-gray-700")}>
                                                                {colDef.label || colId}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className={clsx("w-9 h-5 rounded-full relative cursor-pointer transition-all duration-200 shrink-0", !isHidden ? "bg-indigo-500 shadow-sm shadow-indigo-200" : "bg-gray-200")}
                                                            onClick={(e) => { e.stopPropagation(); toggleColumn(colId); }}
                                                        >
                                                            <div className={clsx("absolute top-[3px] w-3.5 h-3.5 bg-white rounded-full transition-all duration-200 shadow-sm", !isHidden ? "left-[18px]" : "left-[3px]")} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between shrink-0">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-bold text-gray-600">{t('ordersControl.actions.showKPIs', { defaultValue: 'Show Statistics' })}</span>
                                                <div
                                                    className={clsx("w-9 h-5 rounded-full relative cursor-pointer transition-all duration-200 shrink-0", showKPIs ? "bg-indigo-500 shadow-sm shadow-indigo-200" : "bg-gray-200")}
                                                    onClick={() => setShowKPIs(!showKPIs)}
                                                >
                                                    <div className={clsx("absolute top-[3px] w-3.5 h-3.5 bg-white rounded-full transition-all duration-200 shadow-sm", showKPIs ? "left-[18px]" : "left-[3px]")} />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setOrderedColumnIds(defaultColumnOrder); setHiddenColumns(new Set()); localStorage.removeItem('orderControlHiddenColumns'); localStorage.removeItem('orderControlOrderedColumns'); }}
                                                className="text-[10px] uppercase tracking-widest font-black text-rose-500 hover:text-rose-600 transition-colors px-2 py-1 rounded hover:bg-rose-50"
                                            >
                                                {t('ordersControl.actions.reset', { defaultValue: 'Reset' })}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setIsOrderModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 xl:py-2 text-xs font-bold rounded-lg border bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:border-indigo-700 shadow-md shadow-indigo-600/20 transition-all whitespace-nowrap h-[32px] xl:h-[36px] shrink-0"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            {t('ordersControl.actions.newOrder', { defaultValue: 'Add Order' })}
                        </button>

                        <button onClick={() => fetchOrders()} className="p-1 px-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100 hidden sm:block shrink-0" title="Refresh Data Core">
                            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin text-indigo-500")} />
                        </button>
                    </div>
                </div>

                {/* Bottom Row: Elegant KPI Badges */}
                {kpis && showKPIs && (
                    <div className="flex items-center gap-1.5 xl:gap-2 overflow-x-auto flex-nowrap w-full justify-start [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pt-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-gray-100 bg-gray-50 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full relative bg-blue-500 animate-pulse"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('ordersControl.kpis.newToday')}</span>
                            <span className="text-xs xl:text-sm font-black text-gray-900 ml-1 rtl:mr-1">{kpis.newOrdersToday}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-orange-100 bg-orange-50 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-orange-600 uppercase tracking-wider">{t('ordersControl.kpis.pending')}</span>
                            <span className="text-xs xl:text-sm font-black text-orange-700 ml-1 rtl:mr-1">{kpis.pendingConfirmation}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-emerald-100 bg-emerald-50 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{t('ordersControl.kpis.confirmed')}</span>
                            <span className="text-xs xl:text-sm font-black text-emerald-700 ml-1 rtl:mr-1">{kpis.confirmedOrders}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-indigo-100 bg-indigo-50 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{t('ordersControl.kpis.dispatched', { defaultValue: 'Dispatched' })}</span>
                            <span className="text-xs xl:text-sm font-black text-indigo-700 ml-1 rtl:mr-1">{kpis.sentToCourier}</span>
                        </div>
                        <div className="w-px h-4 bg-gray-200 mx-0.5 shrink-0 hidden md:block"></div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-emerald-100 bg-emerald-50 shrink-0 hidden sm:flex">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-emerald-600 uppercase tracking-wider">DELIVERED</span>
                            <span className="text-xs xl:text-sm font-black text-emerald-700 ml-1 rtl:mr-1">{kpis.deliveredToday}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-rose-100 bg-rose-50 shrink-0 hidden sm:flex">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-rose-600 uppercase tracking-wider">RETURNS</span>
                            <span className="text-xs xl:text-sm font-black text-rose-700 ml-1 rtl:mr-1">{kpis.returnRate}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Stage Navigation Tabs & Post-Dispatch Actions */}
            <div className="bg-white border-b border-gray-100 flex items-center justify-between px-6 pt-2 z-20 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.05)] shrink-0">
                <div className="flex gap-6 overflow-x-auto scrollbar-none items-center">
                    {[
                        { id: 'pre-dispatch', label: t('ordersControl.stages.preDispatch'), count: stageCounts.preDispatch, color: 'text-blue-600', bg: 'bg-blue-600', icon: <PhoneCall className="w-3.5 h-3.5" /> },
                        { id: 'post-dispatch', label: t('ordersControl.stages.postDispatch'), count: stageCounts.postDispatch, color: 'text-indigo-600', bg: 'bg-indigo-600', icon: <Truck className="w-3.5 h-3.5" /> },
                        { id: 'returns', label: t('ordersControl.stages.returns'), count: stageCounts.returns, color: 'text-rose-600', bg: 'bg-rose-600', icon: <Ban className="w-3.5 h-3.5" /> },
                        { id: 'all', label: t('ordersControl.stages.all'), count: stageCounts.all, color: 'text-gray-600', bg: 'bg-gray-600', icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
                        { id: 'trash', label: 'Trash', count: stageCounts.trash || 0, color: 'text-red-600', bg: 'bg-red-500', icon: <Trash2 className="w-3.5 h-3.5" /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveStage(tab.id); }}
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

                {/* Bulk Action Buttons — shown when rows are selected */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 mb-2 animate-in fade-in slide-in-from-right-2">
                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">{selectedIds.size} selected</span>
                        {activeStage === 'trash' ? (
                            <>
                                <button
                                    onClick={handleBulkRestore}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 hover:border-emerald-600 rounded-lg transition-all shadow-sm"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                                </button>
                                <button
                                    onClick={handleBulkPurge}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-red-50 hover:bg-red-600 hover:text-white text-red-700 border border-red-200 hover:border-red-600 rounded-lg transition-all shadow-sm"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Forever
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-red-50 hover:bg-red-600 hover:text-white text-red-700 border border-red-200 hover:border-red-600 rounded-lg transition-all shadow-sm"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                            </button>
                        )}
                    </div>
                )}

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
                                <select value={filters.priority} onChange={e => handleFilterChange('priority', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-orange-200 bg-orange-50/60 text-orange-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 appearance-none cursor-pointer hover:bg-orange-100/80 transition-all shadow-sm">
                                    <option value="">{t('ordersControl.filters.priority')}</option>
                                    <option value="Normal">{t('ordersControl.filters.priorityNormal')}</option>
                                    <option value="High Priority">{t('ordersControl.filters.priorityHigh')}</option>
                                    <option value="Urgent">{t('ordersControl.filters.priorityUrgent')}</option>
                                </select>
                            </div>
                            <div className="relative flex items-center shrink-0">
                                <LayoutTemplate className="w-[14px] h-[14px] text-purple-500 absolute left-3 pointer-events-none" />
                                <select value={filters.channel} onChange={e => handleFilterChange('channel', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-purple-200 bg-purple-50/60 text-purple-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 appearance-none cursor-pointer hover:bg-purple-100/80 transition-all shadow-sm">
                                    <option value="">{t('ordersControl.filters.channel')}</option>
                                    {['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Manual Entry', 'Other'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
                                </select>
                            </div>
                            <div className="relative flex items-center shrink-0">
                                <MapPin className="w-[14px] h-[14px] text-teal-500 absolute left-3 pointer-events-none" />
                                <select value={filters.wilaya} onChange={e => handleFilterChange('wilaya', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-teal-200 bg-teal-50/60 text-teal-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 appearance-none cursor-pointer hover:bg-teal-100/80 transition-all shadow-sm">
                                    <option value="">{t('ordersControl.filters.wilayaHolder', { defaultValue: 'All Wilayas' })}</option>
                                    {['Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arreridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent', 'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès', 'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa'].map((w, i) => (
                                        <option key={w} value={w}>{`${i + 1} - ${w}`}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="h-6 w-px bg-gray-200 shrink-0 hidden sm:block"></div>

                            <div className="relative flex items-center shrink-0 shadow-sm rounded-full overflow-hidden border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400 transition-all hover:border-gray-300 w-auto bg-white/60">
                                <Calendar className="w-[14px] h-[14px] text-gray-500 absolute left-3 pointer-events-none z-10" />
                                <select 
                                    className="pl-9 pr-4 py-1.5 bg-transparent text-gray-700 text-[11px] font-bold outline-none appearance-none cursor-pointer hover:bg-gray-50 transition-colors border-r hover:border-gray-200 relative z-0"
                                    onChange={(e) => {
                                        const preset = e.target.value;
                                        if (!preset) return;
                                        let from = '';
                                        let to = moment().format('YYYY-MM-DD');
                                        
                                        if (preset === 'today') {
                                            from = to;
                                        } else if (preset === 'yesterday') {
                                            from = moment().subtract(1, 'days').format('YYYY-MM-DD');
                                            to = from;
                                        } else if (preset === 'last7') {
                                            from = moment().subtract(7, 'days').format('YYYY-MM-DD');
                                        } else if (preset === 'last30') {
                                            from = moment().subtract(30, 'days').format('YYYY-MM-DD');
                                        } else if (preset === 'thisMonth') {
                                            from = moment().startOf('month').format('YYYY-MM-DD');
                                        } else if (preset === 'lastMonth') {
                                            from = moment().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
                                            to = moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
                                        }
                                        
                                        setFilters(prev => ({ ...prev, dateFrom: from, dateTo: to }));
                                        e.target.value = ''; // Reset select after applying
                                    }}
                                    value=""
                                >
                                    <option value="" disabled>{t('ordersControl.filters.datePresets', { defaultValue: 'Date Presets' })}</option>
                                    <option value="today">{t('ordersControl.filters.today', { defaultValue: 'Today' })}</option>
                                    <option value="yesterday">{t('ordersControl.filters.yesterday', { defaultValue: 'Yesterday' })}</option>
                                    <option value="last7">{t('ordersControl.filters.last7Days', { defaultValue: 'Last 7 Days' })}</option>
                                    <option value="last30">{t('ordersControl.filters.last30Days', { defaultValue: 'Last 30 Days' })}</option>
                                    <option value="thisMonth">{t('ordersControl.filters.thisMonth', { defaultValue: 'This Month' })}</option>
                                    <option value="lastMonth">{t('ordersControl.filters.lastMonth', { defaultValue: 'Last Month' })}</option>
                                </select>
                                <input type="date" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} className="px-3 py-1.5 bg-transparent text-gray-700 text-[11px] font-bold outline-none w-[115px] hover:bg-gray-50 transition-colors cursor-pointer" />
                                <div className="bg-gray-50/50 py-1.5 px-2 text-[10px] text-gray-400 font-bold shrink-0 border-x border-gray-200">{t('ordersControl.filters.to')}</div>
                                <input type="date" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} className="px-3 py-1.5 bg-transparent text-gray-700 text-[11px] font-bold outline-none w-[115px] hover:bg-gray-50 transition-colors cursor-pointer" />
                            </div>

                            <div className="relative flex items-center shrink-0">
                                <Tag className="w-[14px] h-[14px] text-pink-500 absolute left-3 pointer-events-none" />
                                <input type="text" placeholder={t('ordersControl.filters.tagsHolder')} value={filters.tags} onChange={e => handleFilterChange('tags', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-pink-200 bg-pink-50/60 text-pink-700 text-[11px] font-bold outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 placeholder:text-pink-400/80 w-32 hover:bg-pink-100/80 transition-all shadow-sm" />
                            </div>

                            {/* Clear Filters Button */}
                            {Object.values(filters).some(val => val !== '') && (
                                <button 
                                    onClick={() => {
                                        setFilters({ status: '', priority: '', channel: '', wilaya: '', tags: '', dateFrom: '', dateTo: '', agent: '', courier: '' });
                                        setSearchTerm('');
                                    }}
                                    className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-full text-[11px] font-bold transition-colors group"
                                >
                                    <X className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                    {t('ordersControl.filters.clearAll', { defaultValue: 'Clear All Filters' })}
                                </button>
                            )}
                        </div>
                    </div>
                )
            }

            {/* High Performance DataGrid Container */}
            <div className="flex-1 bg-white border-y border-gray-200 shadow-sm flex flex-col relative overflow-hidden">

                {/* Scrollable Table Area */}
                <div ref={parentRef} className="flex-1 overflow-auto">
                    <table className="w-full text-start rtl:text-right border-collapse whitespace-nowrap">
                        <thead className="bg-gray-50/90 text-gray-500 text-[11px] uppercase tracking-wider sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-3 border-b border-gray-200 w-10 align-top pt-4">
                                    <input type="checkbox" checked={orders.length > 0 && selectedIds.size === orders.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer" />
                                </th>
                                {visibleColumns.map(col => (
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
                                                        if (activeStage === 'pre-dispatch') return ['New', 'Calling', 'No Answer', 'Out of Coverage', 'Postponed', 'Wrong Number', 'Cancelled by Customer', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Cancelled'].includes(s);
                                                        if (activeStage === 'post-dispatch') return ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(s);
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
                        {loading && orders.length === 0 ? (
                            <tbody className="divide-y divide-gray-100 text-sm">
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="py-24 text-center">
                                        <div className="inline-flex w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
                                        <p className="mt-4 text-sm font-bold text-gray-400">{t('ordersControl.grid.loading')}</p>
                                    </td>
                                </tr>
                            </tbody>
                        ) : orders.length === 0 ? (
                            <tbody className="divide-y divide-gray-100 text-sm">
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="py-24 text-center">
                                        <LayoutTemplate className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-gray-500">{t('ordersControl.grid.empty')}</p>
                                    </td>
                                </tr>
                            </tbody>
                        ) : (
                            <>
                                {rowVirtualizer.getVirtualItems().length > 0 && rowVirtualizer.getVirtualItems()[0].start > 0 && (
                                    <tbody className="border-none">
                                        <tr>
                                            <td colSpan={visibleColumns.length + 1} className="p-0 border-none">
                                                <div style={{ height: rowVirtualizer.getVirtualItems()[0].start, width: '1px' }} />
                                            </td>
                                        </tr>
                                    </tbody>
                                )}

                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const isLoaderRow = virtualRow.index > orders.length - 1;
                                    
                                    if (isLoaderRow) {
                                        return (
                                            <tbody key="loader-row" ref={virtualRow.measureElement} data-index={virtualRow.index}>
                                                <tr>
                                                    <td colSpan={visibleColumns.length + 1} className="py-8 text-center bg-gray-50/50 border-b border-gray-100">
                                                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600">
                                                            <RefreshCw className="w-5 h-5 animate-spin" /> Fetching more orders...
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        );
                                    }

                                    const order = orders[virtualRow.index];
                                    if (!order) return null;
                                    
                                    return (
                                        <OrderRow
                                            key={order._id}
                                            index={virtualRow.index + 1}
                                            order={order}
                                            isSelected={selectedIds.has(order._id)}
                                            isExpanded={expandedRows.has(order._id)}
                                            visibleColumns={visibleColumns}
                                            hiddenColumns={hiddenColumns}
                                            activeStage={activeStage}
                                            toggleSelect={toggleSelect}
                                            toggleRowExpansion={toggleRowExpansion}
                                            getAge={getAge}
                                            onStatusChange={handleStatusChange}
                                            onAgentChange={handleAgentChange}
                                            onCourierChange={handleCourierChange}
                                            onTagUpdate={handleTagUpdate}
                                            onPriorityChange={handlePriorityChange}
                                            agents={agents}
                                            couriers={couriers}
                                            setFocusedOrderId={setFocusedOrderId}
                                            onBulkActionConfirm={onBulkActionConfirm}
                                            onBulkActionCourier={onBulkActionCourier}
                                            onBulkActionCancel={onBulkActionCancel}
                                            onQuickDispatch={onQuickDispatch}
                                            onEditClick={(o) => { setEditOrderData(o); setIsOrderModalOpen(true); }}
                                            onDelete={async (orderId) => {
                                                try {
                                                    const token = localStorage.getItem('token');
                                                    await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/bulk/delete`,
                                                        { orderIds: [orderId] },
                                                        { headers: { Authorization: `Bearer ${token}` } }
                                                    );
                                                    fetchOrders();
                                                } catch (err) {
                                                    alert(err.response?.data?.message || err.message);
                                                }
                                            }}
                                            onRestore={async (orderId) => {
                                                try {
                                                    const token = localStorage.getItem('token');
                                                    await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/bulk/restore`,
                                                        { orderIds: [orderId] },
                                                        { headers: { Authorization: `Bearer ${token}` } }
                                                    );
                                                    fetchOrders();
                                                } catch (err) {
                                                    alert(err.response?.data?.message || err.message);
                                                }
                                            }}
                                            onPurge={async (orderId) => {
                                                try {
                                                    const token = localStorage.getItem('token');
                                                    await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/bulk/purge`,
                                                        { orderIds: [orderId] },
                                                        { headers: { Authorization: `Bearer ${token}` } }
                                                    );
                                                    fetchOrders();
                                                } catch (err) {
                                                    alert(err.response?.data?.message || err.message);
                                                }
                                            }}
                                            onPostpone={(orderId) => {
                                                setPostponeOrderId(orderId);
                                                setPostponeDate('');
                                            }}
                                            virtualMeasureRef={rowVirtualizer.measureElement}
                                            virtualIndex={virtualRow.index}
                                        />
                                    );
                                })}

                                {rowVirtualizer.getVirtualItems().length > 0 && rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end > 0 && (
                                    <tbody className="border-none">
                                        <tr>
                                            <td colSpan={visibleColumns.length + 1} className="p-0 border-none">
                                                <div style={{ height: rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end, width: '1px' }} />
                                            </td>
                                        </tr>
                                    </tbody>
                                )}
                            </>
                        )}
                    </table>
                </div>

                {/* Infinite Scroll Footer */}
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
                        {isFetchingNextPage && (
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching more...
                            </div>
                        )}
                        {!hasNextPage && orders.length > 0 && !loading && (
                            <span className="text-xs font-bold text-gray-400">End of results</span>
                        )}
                    </div>
                </div>

                {/* Loading overlay overlaying just the table during transition, but not blocking immediate clicks */}
                {loading && !isFetchingNextPage && orders.length > 0 && (
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
                                            if (activeStage === 'post-dispatch') return ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(s);
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
                onClose={() => { setIsOrderModalOpen(false); setEditOrderData(null); }}
                onSubmit={editOrderData ? handleUpdateOrder : handleCreateOrder}
                initialData={editOrderData}
                inventoryProducts={productsList}
                couriers={couriers}
            />
        </div >
    );
}
