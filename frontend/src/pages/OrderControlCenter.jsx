import React, { useState, useEffect, useCallback, useMemo, useContext, useRef } from 'react';
import { useHotkey } from '../hooks/useHotkey';
import { apiFetch } from '../utils/apiFetch';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Search, Filter, SlidersHorizontal, ArrowDownCircle, CheckSquare, X, LayoutTemplate, Settings2, RefreshCw, PhoneCall, CheckCircle2, Truck, FileText, Ban, AlertTriangle, Tag, Calendar, MapPin, User, Activity, PackageOpen, ChevronUp, ChevronDown, Trash2, RotateCcw } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import PageHeader from '../components/PageHeader';
import OrderDetailsDrawer from '../components/orders/OrderDetailsDrawer';
import OrderModal from '../components/OrderModal';
import OrderRow from '../components/orders/OrderRow';
import clsx from 'clsx';
import { toISODate, subtract, startOfMonth, endOfMonth, formatDuration } from '../utils/dateUtils';
import { ORDER_STATUS_COLORS, COD_STATUSES, getOrderStatusLabel } from '../constants/statusColors';
import { useConfirmDialog } from '../components/ConfirmDialog';

const FILTER_KEYS = ['status', 'courier', 'agent', 'wilaya', 'channel', 'priority', 'tags', 'dateFrom', 'dateTo'];
const STATUS_STYLES = ORDER_STATUS_COLORS;

const PRIORITY_STYLES = {
    'Normal': '',
    'High Priority': 'border-l-4 border-l-orange-400 bg-orange-50/10 dark:bg-orange-900/10',
    'Urgent': 'border-l-4 border-l-red-500 bg-red-50/20 dark:bg-red-900/20'
};

export default function OrderControlCenter() {
    const { t } = useTranslation();
    const { hasPermission } = useContext(AuthContext);

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
        } catch (e) { /* localStorage may be full or blocked */ }
    }, [hiddenColumns]);

    useEffect(() => {
        try {
            localStorage.setItem('orderControlOrderedColumns', JSON.stringify(orderedColumnIds));
        } catch (e) { /* localStorage may be full or blocked */ }
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
        } catch (e) { /* localStorage may be full or blocked */ }
    }, [showKPIs]);

    // Filters and Pagination
    const [nextCursor, setNextCursor] = useState(null);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
    const [limit, setLimit] = useState(50);
    const [sortField, setSortField] = useState('date');
    const [sortOrder, setSortOrder] = useState('desc');

    // Filters State — synced to URL so views are bookmarkable and shareable
    const [searchParams, setSearchParams] = useSearchParams();

    const searchTerm = searchParams.get('q') || '';
    const activeStage = searchParams.get('tab') || 'pre-dispatch';

    const filters = useMemo(() => Object.fromEntries(
        FILTER_KEYS.map(k => [k, searchParams.get(k) || ''])
    ), [searchParams]);

    const setSearchTerm = useCallback((val) => {
        setSearchParams(prev => { const n = new URLSearchParams(prev); val ? n.set('q', val) : n.delete('q'); return n; }, { replace: true });
    }, [setSearchParams]);

    const setActiveStage = useCallback((val) => {
        setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', val); n.delete('q'); FILTER_KEYS.forEach(k => n.delete(k)); return n; }, { replace: true });
    }, [setSearchParams]);

    const setFilters = useCallback((updaterOrValue) => {
        setSearchParams(prev => {
            const n = new URLSearchParams(prev);
            const next = typeof updaterOrValue === 'function'
                ? updaterOrValue(Object.fromEntries(FILTER_KEYS.map(k => [k, prev.get(k) || ''])))
                : updaterOrValue;
            FILTER_KEYS.forEach(k => next[k] ? n.set(k, next[k]) : n.delete(k));
            return n;
        }, { replace: true });
    }, [setSearchParams]);

    // Drawer / Modals
    const [focusedOrderId, setFocusedOrderId] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [editOrderData, setEditOrderData] = useState(null);

    // Auto-open new order modal when navigated from CustomerProfile (?newOrder=1)
    useEffect(() => {
        if (searchParams.get('newOrder') !== '1') return;
        const phone = searchParams.get('phone') || '';
        const name = searchParams.get('name') || '';
        if (phone || name) setEditOrderData({ _prefill: true, customerPhone: phone, customerName: name });
        setIsOrderModalOpen(true);
        // Remove the trigger params so refresh doesn't re-open
        setSearchParams(prev => {
            const n = new URLSearchParams(prev);
            n.delete('newOrder'); n.delete('phone'); n.delete('name');
            return n;
        }, { replace: true });
    }, []); // run once on mount

    // Bulk Actions
    const [bulkActionType, setBulkActionType] = useState(null); // 'status' | 'agent' | 'courier'
    const [bulkActionValue, setBulkActionValue] = useState('');

    // Shared confirm dialog hook
    const { dialog: confirmDialogEl, confirm: showConfirm } = useConfirmDialog();

    // Inline sync message (fixes alert suppression)
    const [syncMessage, setSyncMessage] = useState(null);

    // Error toast — replaces all window.alert() calls
    const showError = (msg) => {
        toast.error(msg, { duration: 5000 });
    };

    // CSV Export Background Queue State
    const [exportState, setExportState] = useState({ isExporting: false, progress: 0, jobId: null });

    // Search ref for keyboard focus shortcut
    const searchInputRef = useRef(null);
    const exportPollRef = useRef(null);
    const [focusedRowIndex, setFocusedRowIndex] = useState(-1);

    useHotkey('/', () => { searchInputRef.current?.focus(); searchInputRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => {
        if (document.activeElement === searchInputRef.current) { setSearchTerm(''); searchInputRef.current?.blur(); }
        else if (focusedRowIndex >= 0) { setFocusedRowIndex(-1); }
    });
    // j/k for row navigation, Enter to open drawer, x to toggle select
    useHotkey('j', () => setFocusedRowIndex(prev => {
        const next = Math.min(prev + 1, orders.length - 1);
        rowVirtualizer.scrollToIndex(next, { align: 'auto' });
        return next;
    }));
    useHotkey('k', () => setFocusedRowIndex(prev => {
        const next = Math.max(prev - 1, 0);
        rowVirtualizer.scrollToIndex(next, { align: 'auto' });
        return next;
    }));
    useHotkey('enter', () => {
        if (focusedRowIndex >= 0 && focusedRowIndex < orders.length) {
            setFocusedOrderId(orders[focusedRowIndex]._id);
        }
    });
    useHotkey('x', () => {
        if (focusedRowIndex >= 0 && focusedRowIndex < orders.length) {
            toggleSelect(orders[focusedRowIndex]._id);
        }
    });

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
            const params = {
                search: searchTerm, ...filters, stage: activeStage !== 'all' ? activeStage : undefined
            };

            // Trigger background job
            const qs = new URLSearchParams(params).toString();
            const res = await apiFetch(`/api/exports/orders${qs ? '?' + qs : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
            if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Export trigger failed'); }
            const json = await res.json();
            const data = json.data ?? json;

            if (data.jobId) {
                setExportState({ isExporting: true, progress: 0, jobId: data.jobId });
                pollExportStatus(data.jobId);
            }
        } catch (err) {
            showError(err.message || t('ordersControl.errorTriggerExport', 'Failed to trigger export'));
        }
    };

    const pollExportStatus = async (jobId) => {
        if (exportPollRef.current) clearInterval(exportPollRef.current);
        const interval = setInterval(async () => {
            try {
                const res = await apiFetch(`/api/exports/${jobId}/status`);
                if (!res.ok) throw new Error('Failed to check export status');
                const json = await res.json();
                const data = json.data ?? json;

                if (data.status === 'completed') {
                    clearInterval(interval);
                    exportPollRef.current = null;
                    setExportState({ isExporting: false, progress: 100, jobId: null });
                    // Provide the download
                    const url = `${import.meta.env.VITE_API_URL || ''}${data.downloadUrl}`;
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = data.fileName || 'export.csv';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    exportPollRef.current = null;
                    setExportState({ isExporting: false, progress: 0, jobId: null });
                    showError(`Export Failed: ${data.error}`);
                } else {
                    // Update progress
                    setExportState(prev => ({ ...prev, progress: data.progress || 0 }));
                }
            } catch (err) {
                clearInterval(interval);
                exportPollRef.current = null;
                setExportState({ isExporting: false, progress: 0, jobId: null });
                showError(err.message || t('ordersControl.errorExportFailed', 'Export failed. Please try again.'));
            }
        }, 1500);
        exportPollRef.current = interval;
    };

    // Cleanup export polling on unmount
    useEffect(() => {
        return () => { if (exportPollRef.current) clearInterval(exportPollRef.current); };
    }, []);

    // Fetch Dependencies & KPIs (with abort on unmount)
    useEffect(() => {
        const controller = new AbortController();
        const sig = controller.signal;

        const safeFetch = (url, setter, transform, errMsg) => {
            apiFetch(url, { signal: sig })
                .then(r => { if (!r.ok) throw new Error(); return r.json(); })
                .then(json => { if (!sig.aborted) setter(transform(json)); })
                .catch(err => { if (!sig.aborted && err.name !== 'AbortError' && errMsg) toast.error(errMsg); });
        };

        safeFetch('/api/couriers', setCouriers, j => (j.data ?? j) || [], t('ordersControl.errorLoadCouriers', 'Failed to load couriers list'));
        safeFetch('/api/call-center/agents', setAgents, j => (j.data ?? j) || [], t('ordersControl.errorLoadAgents', 'Failed to load agents list'));
        safeFetch('/api/sales/orders/operations-kpi', setKpis, j => j.data ?? j, null); // KPIs non-critical
        safeFetch('/api/inventory/products', setProductsList, j => { const d = j.data ?? j; return d.products || d || []; }, t('ordersControl.errorLoadProducts', 'Failed to load products list'));

        return () => controller.abort();
    }, []);

    // Main Fetch
    const fetchOrders = useCallback(async (loadMore = false) => {
        if (!loadMore) {
            setLoading(true);
        } else {
            setIsFetchingNextPage(true);
        }
        try {
            const params = {
                limit, sortField, sortOrder,
                search: searchTerm, ...filters, stage: activeStage !== 'all' ? activeStage : undefined
            };

            if (loadMore && nextCursor) {
                params.cursor = nextCursor;
            }

            // Clean empty strings from params
            Object.keys(params).forEach(k => params[k] === '' && delete params[k]);

            const qs = new URLSearchParams(params).toString();
            const res = await apiFetch(`/api/sales/orders/advanced${qs ? '?' + qs : ''}`);
            if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Failed to load orders'); }
            const json = await res.json();
            const data = json.data ?? json;

            if (loadMore) {
                setOrders(prev => {
                    const existingIds = new Set(prev.map(o => o._id));
                    const newUnique = (data.orders || []).filter(o => !existingIds.has(o._id));
                    return [...prev, ...newUnique];
                });
            } else {
                setOrders(data.orders || []);
            }

            setNextCursor(data.nextCursor || null);
            setHasNextPage(data.hasNextPage || false);

            if (data.totalOrders !== null && data.totalOrders !== undefined) {
                setTotalOrders(data.totalOrders);
            }
            if (data.stageCounts) {
                setStageCounts(data.stageCounts);
            }

            setError(null);

            // No selection reset — preserve user's selections across fetches

        } catch (err) {
            setError(err.message || t('ordersControl.errorLoadOrders', 'Failed to load orders'));
        } finally {
            setLoading(false);
            setIsFetchingNextPage(false);
        }
    }, [limit, sortField, sortOrder, searchTerm, filters, activeStage, nextCursor]);

    // Infinite Scroll Intersection Trigger
    const virtualItems = rowVirtualizer.getVirtualItems();
    const lastVirtualIndex = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;

    useEffect(() => {
        if (lastVirtualIndex < 0) return;

        // If we scrolled near the end of the array and there is a next page
        if (
            lastVirtualIndex >= orders.length - 25 &&
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
        lastVirtualIndex,
    ]);

    // Data Fetch Trigger — reset keyboard focus when query changes
    useEffect(() => {
        setFocusedRowIndex(-1);
        const delayDebounceFn = setTimeout(() => {
            fetchOrders();
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [limit, sortField, sortOrder, searchTerm, filters, activeStage]);

    // Handle create order from modal
    const handleCreateOrder = async (orderData) => {
        try {
            const res = await apiFetch(`/api/sales/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderData) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to create order'); }
            setIsOrderModalOpen(false);
            fetchOrders();
            setSyncMessage({ type: 'success', text: t('ordersControl.orderCreated', { defaultValue: 'Order created successfully!' }) });
            setTimeout(() => setSyncMessage(null), 3000);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    // Handle update order from modal
    const handleUpdateOrder = async (orderData) => {
        try {
            const res = await apiFetch(`/api/sales/orders/${editOrderData._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderData) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update order'); }
            const json = await res.json();
            const responseData = json.data ?? json;

            // Immediate UI update without waiting for fetchOrders network delay
            if (responseData && responseData._id) {
                setOrders(prev => prev.map(o => o._id === responseData._id ? responseData : o));
            }

            setIsOrderModalOpen(false);
            setEditOrderData(null);
            
            // Still run fetch in background to sync any total stats/KPIs
            fetchOrders();
            
            setSyncMessage({ type: 'success', text: t('ordersControl.orderUpdated', { defaultValue: 'Order updated successfully!' }) });
            setTimeout(() => setSyncMessage(null), 3000);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };


    // Helpers
    const handleSort = useCallback((field) => {
        setSortField(prev => {
            if (prev === field) {
                setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
                return prev;
            }
            setSortOrder('desc');
            return field;
        });
    }, []);

    const handleFilterChange = useCallback((key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, [setFilters]);

    const toggleSelectAll = useCallback(() => {
        setSelectedIds(prev => {
            if (prev.size === orders.length && orders.length > 0) return new Set();
            return new Set(orders.map(o => o._id));
        });
    }, [orders]);

    const toggleSelect = useCallback((id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const toggleRowExpansion = useCallback((id) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleStatusChange = useCallback(async (orderId, newStatus) => {
        // Optimistic update — instantly reflect in UI without loading overlay
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o));
        try {
            const res = await apiFetch(`/api/sales/orders/${orderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update status'); }
            fetchOrders(); // Sync full state from server
        } catch (err) {
            showError(err.message);
            fetchOrders(); // Revert optimistic update on error
        }
    }, [fetchOrders]);

    // Postpone order — opens date picker modal
    const [postponeOrderId, setPostponeOrderId] = useState(null);
    const [postponeDate, setPostponeDate] = useState('');

    // Escape key to close postpone modal or column settings
    useEffect(() => {
        if (!postponeOrderId && !showColumnSettings) return;
        const handler = (e) => {
            if (e.key === 'Escape') {
                if (postponeOrderId) { setPostponeOrderId(null); setPostponeDate(''); }
                else if (showColumnSettings) { setShowColumnSettings(false); }
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [postponeOrderId, showColumnSettings]);

    const handlePostponeConfirm = useCallback(async () => {
        if (!postponeOrderId || !postponeDate) return;
        try {

            const res = await apiFetch(`/api/sales/orders/${postponeOrderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Postponed', postponedUntil: new Date(postponeDate).toISOString() }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to postpone order'); }
            setPostponeOrderId(null);
            setPostponeDate('');
            fetchOrders();
        } catch (err) {
            showError(err.message);
        }
    }, [postponeOrderId, postponeDate, fetchOrders]);

    const handleTagUpdate = useCallback(async (orderId, newTags) => {
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, tags: newTags } : o));
        try {
            const res = await apiFetch(`/api/sales/orders/${orderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: newTags }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update tags'); }
            fetchOrders();
        } catch (err) {
            showError(err.message);
            fetchOrders();
        }
    }, [fetchOrders]);

    const handlePriorityChange = useCallback(async (orderId, newPriority) => {
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, priority: newPriority } : o));
        try {
            const res = await apiFetch(`/api/sales/orders/${orderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority: newPriority }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update priority'); }
            fetchOrders();
        } catch (err) {
            showError(err.message);
            fetchOrders();
        }
    }, [fetchOrders]);

    const handleBulkDelete = useCallback(() => {
        if (selectedIds.size === 0) return;
        showConfirm({
            title: t('ordersControl.messages.trashMoveTitle', { count: selectedIds.size, s: selectedIds.size > 1 ? 's' : '' }),
            body: t('ordersControl.messages.trashMoveBody'),
            danger: false,
            onConfirm: async () => {
                try {
        
                    const res = await apiFetch(`/api/sales/orders/bulk/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: Array.from(selectedIds) }) });
                    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Bulk delete failed'); }
                    setSelectedIds(new Set());
                    fetchOrders();
                } catch (err) {
                    showError(err.message);
                }
            },
        });
    }, [selectedIds, fetchOrders]);

    const handleBulkRestore = useCallback(async () => {
        if (selectedIds.size === 0) return;
        try {

            const res = await apiFetch(`/api/sales/orders/bulk/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: Array.from(selectedIds) }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Bulk restore failed'); }
            setSelectedIds(new Set());
            fetchOrders();
        } catch (err) {
            showError(err.message);
        }
    }, [selectedIds, fetchOrders]);

    const handleBulkPurge = useCallback(() => {
        if (selectedIds.size === 0) return;
        showConfirm({
            title: t('ordersControl.messages.purgeTitle', { count: selectedIds.size, s: selectedIds.size > 1 ? 's' : '' }),
            body: t('ordersControl.messages.purgeBody'),
            danger: true,
            onConfirm: async () => {
                try {
        
                    const res = await apiFetch(`/api/sales/orders/bulk/purge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: Array.from(selectedIds) }) });
                    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Bulk purge failed'); }
                    setSelectedIds(new Set());
                    fetchOrders();
                } catch (err) {
                    showError(err.message);
                }
            },
        });
    }, [selectedIds, fetchOrders]);

    const handleAgentChange = useCallback(async (orderId, agentId) => {
        // Optimistic update
        const resolvedAgent = agentId === 'unassigned' ? null : agents.find(a => a._id === agentId);
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, assignedAgent: resolvedAgent || null } : o));
        try {
            const res = await apiFetch(`/api/sales/orders/bulk/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: [orderId], action: 'assign_agent', payload: { agentId: agentId === 'unassigned' ? null : agentId } }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to assign agent'); }
            fetchOrders();
        } catch (err) {
            showError(err.message);
            fetchOrders();
        }
    }, [fetchOrders, agents]);

    const handleCourierChange = useCallback(async (orderId, courierId) => {
        // Optimistic update
        const resolvedCourier = courierId === 'unassigned' ? null : couriers.find(c => c._id === courierId);
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, courier: resolvedCourier || null } : o));
        try {
            const res = await apiFetch(`/api/sales/orders/bulk/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: [orderId], action: 'assign_courier', payload: { courierId: courierId === 'unassigned' ? null : courierId } }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to assign courier'); }
            fetchOrders();
        } catch (err) {
            showError(err.message);
            fetchOrders();
        }
    }, [fetchOrders, couriers]);

    const handleBulkConfirm = useCallback(async () => {
        if (!bulkActionType || !bulkActionValue || selectedIds.size === 0) return;

        try {
            setLoading(true);

            let action = '';
            let payload = {};

            if (bulkActionType === 'status') {
                action = 'update_status';
                payload = { status: bulkActionValue };
            } else if (bulkActionType === 'agent') {
                action = 'assign_agent';
                payload = { agentId: bulkActionValue === 'unassigned' ? null : bulkActionValue };
            } else if (bulkActionType === 'courier') {
                action = 'assign_courier';
                payload = { courierId: bulkActionValue === 'unassigned' ? null : bulkActionValue };
            }

            const res = await apiFetch(`/api/sales/orders/bulk/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: Array.from(selectedIds), action, payload }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Bulk update failed'); }

            setSelectedIds(new Set());
            setBulkActionType(null);
            setBulkActionValue('');
            fetchOrders();
        } catch (err) {
            showError(err.message);
        } finally {
            setLoading(false);
        }
    }, [bulkActionType, bulkActionValue, selectedIds, fetchOrders]);


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

    const handleSingleDelete = useCallback(async (orderId) => {
        try {
            const res = await apiFetch(`/api/sales/orders/bulk/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: [orderId] }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Delete failed'); }
            fetchOrders();
        } catch (err) {
            showError(err.message);
        }
    }, [fetchOrders]);

    const handleSingleRestore = useCallback(async (orderId) => {
        try {
            const res = await apiFetch(`/api/sales/orders/bulk/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: [orderId] }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Restore failed'); }
            fetchOrders();
        } catch (err) {
            showError(err.message);
        }
    }, [fetchOrders]);

    const handleSinglePurge = useCallback(async (orderId) => {
        try {
            const res = await apiFetch(`/api/sales/orders/bulk/purge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: [orderId] }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Purge failed'); }
            fetchOrders();
        } catch (err) {
            showError(err.message);
        }
    }, [fetchOrders]);

    const handlePostponeOpen = useCallback((orderId) => {
        setPostponeOrderId(orderId);
        setPostponeDate('');
    }, []);

    const handleEditClick = useCallback((o) => {
        setEditOrderData(o);
        setIsOrderModalOpen(true);
    }, []);

    const handleManifestExport = useCallback(async () => {
        const ids = Array.from(selectedIds).join(',');
        try {
            const res = await apiFetch(`/api/shipments/export/manifest?ids=${ids}`);
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const w = window.open(url, '_blank');
            if (w) w.onload = () => URL.revokeObjectURL(url);
        } catch { /* toast already handled by apiFetch on 401 */ }
    }, [selectedIds]);

    const handleEcotrackSync = useCallback(async () => {
        try {
            setLoading(true);
            setSyncMessage(null);
            const res = await apiFetch(`/api/sales/orders/sync-ecotrack`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const err = new Error(errData.message || errData.error || 'Sync failed');
                err.status = res.status;
                err.serverError = errData.error;
                throw err;
            }
            fetchOrders();
            setSyncMessage({ type: 'success', text: t('ordersControl.messages.syncSuccess', { defaultValue: 'ECOTRACK sequence manually fired and completed.' }) });
            setTimeout(() => setSyncMessage(null), 5000);
        } catch (err) {
            if (err.status === 429 && err.serverError) {
                const match = err.serverError.match(/wait (\d+) minutes/);
                if (match && match[1]) {
                    setSyncMessage({ type: 'error', text: t('ordersControl.messages.syncRateLimit', { minutes: match[1], defaultValue: err.serverError }) });
                } else {
                    setSyncMessage({ type: 'error', text: err.serverError });
                }
            } else {
                setSyncMessage({ type: 'error', text: err.serverError || err.message || t('ordersControl.messages.syncFailed', { defaultValue: 'Failed to sync with courier aggregator.' }) });
            }
            setTimeout(() => setSyncMessage(null), 8000);
        } finally {
            setLoading(false);
        }
    }, [fetchOrders, t]);

    const handleClosePostpone = useCallback(() => {
        setPostponeOrderId(null);
        setPostponeDate('');
    }, []);

    const handleCloseOrderModal = useCallback(() => {
        setIsOrderModalOpen(false);
        setEditOrderData(null);
    }, []);

    const handleClearBulkSelection = useCallback(() => {
        setSelectedIds(new Set());
        setBulkActionType(null);
    }, []);

    const handleCancelBulkAction = useCallback(() => {
        setBulkActionType(null);
        setBulkActionValue('');
    }, []);

    const toggleColumn = (colId) => {
        const next = new Set(hiddenColumns);
        if (next.has(colId)) next.delete(colId);
        else next.add(colId);
        setHiddenColumns(next);
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
    const getAge = useCallback((dateString) => {
        return formatDuration(Date.now() - new Date(dateString).getTime());
    }, []);

    return (
        <div className="flex flex-col h-[calc(100vh-72px)] w-auto overflow-hidden bg-gray-50/50 dark:bg-gray-900 gap-4 -mx-4 sm:-mx-8 lg:-mx-10 xl:-mx-14 2xl:-mx-16 -mt-10 -mb-12">

            {/* Postpone Date Picker Modal */}
            {postponeOrderId && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={handleClosePostpone} role="presentation" />
                    <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-6 w-80 animate-in zoom-in-95 fade-in-0 duration-200" role="dialog" aria-modal="true" aria-label="Postpone order">
                        <div className="mb-4">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-1">📅 تأجيل الطلبية</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">اختر تاريخ العودة — ستظهر الطلبية في أعلى القائمة عند حلول هذا الموعد</p>
                        </div>
                        <input
                            type="datetime-local"
                            value={postponeDate}
                            onChange={(e) => setPostponeDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none mb-4 font-bold dark:bg-gray-700 dark:text-white"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleClosePostpone}
                                className="flex-1 px-3 py-2 text-xs font-black uppercase rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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

            <div className="bg-white dark:bg-gray-800 px-4 xl:px-6 py-2 border-b border-gray-100 dark:border-gray-700 shrink-0 flex flex-col gap-2 shadow-sm z-30">
                
                {/* Top Row: Left: Search+Filter | Center: Column Settings (unclipped) | Right: Export+Add */}
                <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-y-2 gap-x-2">
                    
                    {/* Left: Search + Filter (scrollable) */}
                    <div className="flex items-center gap-1.5 xl:gap-2 shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <div className="relative shrink-0">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={t('ordersControl.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); }}
                                className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-bold rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-[140px] md:w-[150px] xl:w-[200px] ps-8 pe-2.5 py-1.5 xl:py-2 outline-none transition-all shadow-inner focus:bg-white dark:focus:bg-gray-600 dark:text-white placeholder:font-medium dark:placeholder:text-gray-400"
                                title={t('ordersControl.pressToFocus', 'Press / to focus')}
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Clear search">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 xl:py-2 text-xs font-bold rounded-lg border transition-all h-[32px] xl:h-[36px] shrink-0", showFilters ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-inner" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm")}
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">{t('ordersControl.filtersBtn')}</span>
                            {Object.values(filters).filter(Boolean).length > 0 && (
                                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-black leading-none">
                                    {Object.values(filters).filter(Boolean).length}
                                </span>
                            )}
                        </button>
                    </div>{/* end left group */}

                    {/* Right: Export + Add Order + Refresh */}
                    <div className="flex items-center gap-1.5 xl:gap-2 shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {hasPermission('orders.export') && (
                            <button
                                onClick={handleExportCSV}
                                disabled={exportState.isExporting}
                                className={clsx(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 xl:py-2 text-xs font-bold rounded-lg border shadow-sm transition-all whitespace-nowrap h-[32px] xl:h-[36px] shrink-0",
                                    exportState.isExporting
                                        ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 cursor-not-allowed"
                                        : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400"
                                )}
                            >
                                {exportState.isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                                <span className="hidden sm:inline">{exportState.isExporting ? `${exportState.progress}%` : t('ordersControl.actions.exportCsv', { defaultValue: 'Export CSV' })}</span>
                            </button>
                        )}

                        {hasPermission('orders.export') && selectedIds.size > 0 && (
                            <button
                                onClick={handleManifestExport}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 xl:py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all whitespace-nowrap h-[32px] xl:h-[36px] shrink-0"
                            >
                                <PackageOpen className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t('ordersControl.actions.printManifest', { defaultValue: 'Print Manifest' })} ({selectedIds.size})</span>
                            </button>
                        )}

                        {/* Column Settings — beside Export CSV */}
                        <div className="relative shrink-0">
                            <button
                                onClick={() => setShowColumnSettings(!showColumnSettings)}
                                className={clsx(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 xl:py-2 rounded-lg border font-bold text-xs transition-colors h-[32px] xl:h-[36px] shrink-0",
                                    showColumnSettings ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-inner" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm"
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
                                        className="relative w-80 max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.35)] border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/30 dark:to-gray-800 px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
                                            <div>
                                                <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-wider">{t('ordersControl.actions.manageColumns', { defaultValue: 'Manage Columns' })}</h3>
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{t('ordersControl.actions.dragHint', { defaultValue: 'Drag to reorder • toggle to show/hide' })}</p>
                                            </div>
                                            <button onClick={() => setShowColumnSettings(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
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
                                                            isDragging ? "bg-indigo-50/60 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 shadow-sm scale-[1.01] opacity-80" : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-200 dark:hover:border-gray-600",
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
                                                            <span className={clsx("font-semibold text-sm", isHidden ? "text-gray-300 dark:text-gray-500 line-through" : "text-gray-700 dark:text-gray-200")}>
                                                                {colDef.label || colId}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className={clsx("w-9 h-5 rounded-full relative cursor-pointer transition-all duration-200 shrink-0", !isHidden ? "bg-indigo-500 shadow-sm shadow-indigo-200" : "bg-gray-200 dark:bg-gray-600")}
                                                            onClick={(e) => { e.stopPropagation(); toggleColumn(colId); }}
                                                        >
                                                            <div className={clsx("absolute top-[3px] w-3.5 h-3.5 bg-white rounded-full transition-all duration-200 shadow-sm", !isHidden ? "left-[18px]" : "left-[3px]")} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/60 flex items-center justify-between shrink-0">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{t('ordersControl.actions.showKPIs', { defaultValue: 'Show Statistics' })}</span>
                                                <div
                                                    className={clsx("w-9 h-5 rounded-full relative cursor-pointer transition-all duration-200 shrink-0", showKPIs ? "bg-indigo-500 shadow-sm shadow-indigo-200" : "bg-gray-200 dark:bg-gray-600")}
                                                    onClick={() => setShowKPIs(!showKPIs)}
                                                >
                                                    <div className={clsx("absolute top-[3px] w-3.5 h-3.5 bg-white rounded-full transition-all duration-200 shadow-sm", showKPIs ? "left-[18px]" : "left-[3px]")} />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setOrderedColumnIds(defaultColumnOrder); setHiddenColumns(new Set()); localStorage.removeItem('orderControlHiddenColumns'); localStorage.removeItem('orderControlOrderedColumns'); }}
                                                className="text-[10px] uppercase tracking-widest font-black text-rose-500 hover:text-rose-600 transition-colors px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/30"
                                            >
                                                {t('ordersControl.actions.reset', { defaultValue: 'Reset' })}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {hasPermission('orders.create') && (
                            <button
                                onClick={() => setIsOrderModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 xl:py-2 text-xs font-bold rounded-lg border bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:border-indigo-700 shadow-md shadow-indigo-600/20 transition-all whitespace-nowrap h-[32px] xl:h-[36px] shrink-0"
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                {t('ordersControl.actions.newOrder', { defaultValue: 'Add Order' })}
                            </button>
                        )}

                        <button onClick={() => fetchOrders()} className="p-1 px-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800 hidden sm:block shrink-0" title={t('ordersControl.refreshDataCore', 'Refresh Data Core')} aria-label={t('ordersControl.refreshDataCore', 'Refresh Data Core')}>
                            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin text-indigo-500")} />
                        </button>
                    </div>
                </div>

                {/* Bottom Row: Elegant KPI Badges */}
                {kpis && showKPIs && (
                    <div className="flex items-center gap-1.5 xl:gap-2 overflow-x-auto flex-nowrap w-full justify-start [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pt-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full relative bg-blue-500 animate-pulse"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('ordersControl.kpis.newToday')}</span>
                            <span className="text-xs xl:text-sm font-black text-gray-900 dark:text-white ml-1 rtl:mr-1">{kpis.newOrdersToday}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-orange-100 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/30 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">{t('ordersControl.kpis.pending')}</span>
                            <span className="text-xs xl:text-sm font-black text-orange-700 dark:text-orange-300 ml-1 rtl:mr-1">{kpis.pendingConfirmation}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t('ordersControl.kpis.confirmed')}</span>
                            <span className="text-xs xl:text-sm font-black text-emerald-700 dark:text-emerald-300 ml-1 rtl:mr-1">{kpis.confirmedOrders}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{t('ordersControl.kpis.dispatched', { defaultValue: 'Dispatched' })}</span>
                            <span className="text-xs xl:text-sm font-black text-indigo-700 dark:text-indigo-300 ml-1 rtl:mr-1">{kpis.sentToCourier}</span>
                        </div>
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5 shrink-0 hidden md:block"></div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 shrink-0 hidden sm:flex">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t('ordersControl.kpis.delivered')}</span>
                            <span className="text-xs xl:text-sm font-black text-emerald-700 dark:text-emerald-300 ml-1 rtl:mr-1">{kpis.deliveredToday}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border border-rose-100 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 shrink-0 hidden sm:flex">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span className="text-[9px] xl:text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">{t('ordersControl.kpis.returns')}</span>
                            <span className="text-xs xl:text-sm font-black text-rose-700 dark:text-rose-300 ml-1 rtl:mr-1">{kpis.returnRate}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Stage Navigation Tabs & Post-Dispatch Actions */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between px-6 pt-2 z-20 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.05)] shrink-0">
                <div className="flex gap-6 overflow-x-auto scrollbar-none items-center">
                    {[
                        { id: 'pre-dispatch', label: t('ordersControl.stages.preDispatch'), count: stageCounts.preDispatch, color: 'text-blue-600', bg: 'bg-blue-600', icon: <PhoneCall className="w-3.5 h-3.5" /> },
                        { id: 'post-dispatch', label: t('ordersControl.stages.postDispatch'), count: stageCounts.postDispatch, color: 'text-indigo-600', bg: 'bg-indigo-600', icon: <Truck className="w-3.5 h-3.5" /> },
                        { id: 'returns', label: t('ordersControl.stages.returns'), count: stageCounts.returns, color: 'text-rose-600', bg: 'bg-rose-600', icon: <Ban className="w-3.5 h-3.5" /> },
                        { id: 'all', label: t('ordersControl.stages.all'), count: stageCounts.all, color: 'text-gray-600', bg: 'bg-gray-600', icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
                        { id: 'trash', label: t('ordersControl.stages.trash'), count: stageCounts.trash || 0, color: 'text-red-600', bg: 'bg-red-500', icon: <Trash2 className="w-3.5 h-3.5" /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveStage(tab.id); }}
                            className={clsx(
                                "group relative flex items-center gap-2 pb-3 px-1 border-b-2 transition-all font-bold whitespace-nowrap",
                                activeStage === tab.id
                                    ? `border-[${tab.bg.replace('bg-', '')}] ${tab.color}`
                                    : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-200 dark:hover:border-gray-600"
                            )}
                            style={activeStage === tab.id ? { borderColor: 'currentColor' } : {}}
                        >
                            <span className={clsx("transition-transform", activeStage === tab.id ? "scale-110" : "group-hover:scale-110")}>
                                {tab.icon}
                            </span>
                            <span>{tab.label}</span>
                            <span className={clsx(
                                "px-2 py-0.5 rounded-full text-[10px] font-black transition-colors",
                                activeStage === tab.id ? `${tab.bg} text-white` : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600"
                            )}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Bulk Action Buttons — shown when rows are selected */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 mb-2 animate-in fade-in slide-in-from-right-2">
                        <span className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('ordersControl.bulk.selected', { count: selectedIds.size })}</span>
                        {activeStage === 'trash' ? (
                            <>
                                {hasPermission('orders.restore') && (
                                    <button
                                        onClick={handleBulkRestore}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 hover:border-emerald-600 rounded-lg transition-all shadow-sm"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> {t('ordersControl.bulk.restore')}
                                    </button>
                                )}
                                {hasPermission('orders.purge') && (
                                    <button
                                        onClick={handleBulkPurge}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-red-50 dark:bg-red-900/30 hover:bg-red-600 hover:text-white text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 hover:border-red-600 rounded-lg transition-all shadow-sm"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> {t('ordersControl.bulk.deleteForever')}
                                    </button>
                                )}
                            </>
                        ) : (
                            hasPermission('orders.delete') && (
                                <button
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-red-50 dark:bg-red-900/30 hover:bg-red-600 hover:text-white text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 hover:border-red-600 rounded-lg transition-all shadow-sm"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> {t('ordersControl.bulk.moveToTrash')}
                                </button>
                            )
                        )}
                    </div>
                )}

                {/* Ecotrack Manual Sync Trigger */}
                {
                    activeStage === 'post-dispatch' && hasPermission('orders.bulk') && (
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
                                onClick={handleEcotrackSync}
                                disabled={loading}
                                className={clsx(
                                    "flex items-center gap-2 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all shadow-sm rounded-lg border focus:ring-2 focus:ring-offset-1 focus:outline-none",
                                    loading
                                        ? "bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 cursor-not-allowed"
                                        : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white border-indigo-200 dark:border-indigo-700 hover:border-indigo-600 focus:ring-indigo-500"
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
                    <div className="bg-white dark:bg-gray-800 border-y border-gray-100 dark:border-gray-700 shadow-sm shrink-0 z-10 py-3 px-6 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                            <div className="relative flex items-center shrink-0">
                                <AlertTriangle className="w-[14px] h-[14px] text-orange-500 absolute left-3 pointer-events-none" />
                                <select value={filters.priority} onChange={e => handleFilterChange('priority', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-orange-200 dark:border-orange-800 bg-orange-50/60 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-[11px] font-bold outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 appearance-none cursor-pointer hover:bg-orange-100/80 dark:hover:bg-orange-900/50 transition-all shadow-sm">
                                    <option value="">{t('ordersControl.filters.priority')}</option>
                                    <option value="Normal">{t('ordersControl.filters.priorityNormal')}</option>
                                    <option value="High Priority">{t('ordersControl.filters.priorityHigh')}</option>
                                    <option value="Urgent">{t('ordersControl.filters.priorityUrgent')}</option>
                                </select>
                            </div>
                            <div className="relative flex items-center shrink-0">
                                <LayoutTemplate className="w-[14px] h-[14px] text-purple-500 absolute left-3 pointer-events-none" />
                                <select value={filters.channel} onChange={e => handleFilterChange('channel', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-bold outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 appearance-none cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 transition-all shadow-sm">
                                    <option value="">{t('ordersControl.filters.channel')}</option>
                                    {['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Manual Entry', 'Other'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
                                </select>
                            </div>
                            <div className="relative flex items-center shrink-0">
                                <MapPin className="w-[14px] h-[14px] text-teal-500 absolute left-3 pointer-events-none" />
                                <select value={filters.wilaya} onChange={e => handleFilterChange('wilaya', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-[11px] font-bold outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 appearance-none cursor-pointer hover:bg-teal-100/80 dark:hover:bg-teal-900/50 transition-all shadow-sm">
                                    <option value="">{t('ordersControl.filters.wilayaHolder', { defaultValue: 'All Wilayas' })}</option>
                                    {['Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arreridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent', 'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès', 'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa'].map((w, i) => (
                                        <option key={w} value={w}>{`${i + 1} - ${w}`}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="h-6 w-px bg-gray-200 dark:bg-gray-600 shrink-0 hidden sm:block"></div>

                            <div className="relative flex items-center shrink-0 shadow-sm rounded-full overflow-hidden border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400 transition-all hover:border-gray-300 dark:hover:border-gray-500 w-auto bg-white/60 dark:bg-gray-700/60">
                                <Calendar className="w-[14px] h-[14px] text-gray-500 absolute left-3 pointer-events-none z-10" />
                                <select 
                                    className="pl-9 pr-4 py-1.5 bg-transparent text-gray-700 dark:text-gray-200 text-[11px] font-bold outline-none appearance-none cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border-r hover:border-gray-200 dark:hover:border-gray-600 relative z-0"
                                    onChange={(e) => {
                                        const preset = e.target.value;
                                        if (!preset) return;
                                        let from = '';
                                        let to = toISODate();

                                        if (preset === 'today') {
                                            from = to;
                                        } else if (preset === 'yesterday') {
                                            from = toISODate(subtract(new Date(), 1, 'days'));
                                            to = from;
                                        } else if (preset === 'last7') {
                                            from = toISODate(subtract(new Date(), 7, 'days'));
                                        } else if (preset === 'last30') {
                                            from = toISODate(subtract(new Date(), 30, 'days'));
                                        } else if (preset === 'thisMonth') {
                                            from = toISODate(startOfMonth());
                                        } else if (preset === 'lastMonth') {
                                            from = toISODate(startOfMonth(subtract(new Date(), 1, 'months')));
                                            to = toISODate(endOfMonth(subtract(new Date(), 1, 'months')));
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
                                <input type="date" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} className="px-3 py-1.5 bg-transparent text-gray-700 dark:text-gray-200 text-[11px] font-bold outline-none w-[115px] hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer" />
                                <div className="bg-gray-50/50 dark:bg-gray-600/50 py-1.5 px-2 text-[10px] text-gray-400 dark:text-gray-500 font-bold shrink-0 border-x border-gray-200 dark:border-gray-600">{t('ordersControl.filters.to')}</div>
                                <input type="date" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} className="px-3 py-1.5 bg-transparent text-gray-700 dark:text-gray-200 text-[11px] font-bold outline-none w-[115px] hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer" />
                            </div>

                            <div className="relative flex items-center shrink-0">
                                <Tag className="w-[14px] h-[14px] text-pink-500 absolute left-3 pointer-events-none" />
                                <input type="text" placeholder={t('ordersControl.filters.tagsHolder')} value={filters.tags} onChange={e => handleFilterChange('tags', e.target.value)} className="pl-9 pr-4 py-1.5 rounded-full border border-pink-200 dark:border-pink-800 bg-pink-50/60 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-[11px] font-bold outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400 placeholder:text-pink-400/80 dark:placeholder:text-pink-400/60 w-32 hover:bg-pink-100/80 dark:hover:bg-pink-900/50 transition-all shadow-sm" />
                            </div>

                            {/* Clear Filters Button */}
                            {Object.values(filters).some(val => val !== '') && (
                                <button 
                                    onClick={() => {
                                        setFilters({ status: '', priority: '', channel: '', wilaya: '', tags: '', dateFrom: '', dateTo: '', agent: '', courier: '' });
                                        setSearchTerm('');
                                    }}
                                    className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 rounded-full text-[11px] font-bold transition-colors group"
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
            <div className="flex-1 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 shadow-sm flex flex-col relative overflow-hidden">

                {/* Scrollable Table Area */}
                <div ref={parentRef} className="flex-1 overflow-auto">
                    <table className="cf-table whitespace-nowrap rtl:text-right">
                        <thead>
                            <tr>
                                <th className="w-10 align-top pt-4">
                                    <input type="checkbox" checked={orders.length > 0 && selectedIds.size === orders.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer" />
                                </th>
                                {visibleColumns.map(col => (
                                    <th key={col.id} className={clsx("hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors group select-none align-middle whitespace-nowrap", col.id !== 'actions' && "cursor-pointer")}>
                                        <div className="flex items-center justify-start gap-1">
                                            {/* Hide regular label if it has an integrated filter */}
                                            {!['products', 'status', 'agent', 'courier'].includes(col.id) && (
                                                <div className="flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => col.id !== 'actions' && handleSort(col.id)}>
                                                    {col.label}
                                                    {sortField === col.id && col.id !== 'actions' && (
                                                        <ArrowDownCircle className={clsx("w-3.5 h-3.5 text-blue-500 transition-transform", sortOrder === 'asc' && "rotate-180")} />
                                                    )}
                                                </div>
                                            )}

                                            {/* Integrated Column Filters serving as headers */}
                                            {col.id === 'products' && (
                                                <select value={filters.tags} onChange={e => handleFilterChange('tags', e.target.value)} onClick={e => e.stopPropagation()} className="max-w-[140px] min-w-[110px] px-1 py-1 rounded border-transparent hover:border-gray-200 dark:hover:border-gray-600 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold bg-transparent focus:bg-white dark:focus:bg-gray-700 cursor-pointer w-full uppercase tracking-wider">
                                                    <option value="">{col.label}</option>
                                                    {productsList.map(p => <option key={p._id} value={p.sku}>{p.sku}</option>)}
                                                </select>
                                            )}
                                            {col.id === 'status' && (
                                                <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} onClick={e => e.stopPropagation()} className="max-w-[140px] min-w-[110px] px-1 py-1 rounded border-transparent hover:border-gray-200 dark:hover:border-gray-600 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold bg-transparent focus:bg-white dark:focus:bg-gray-700 cursor-pointer w-full uppercase tracking-wider">
                                                    <option value="">{col.label}</option>
                                                    {COD_STATUSES.filter(s => {
                                                        if (activeStage === 'pre-dispatch') return ['New', 'Calling', 'No Answer', 'Out of Coverage', 'Postponed', 'Wrong Number', 'Cancelled by Customer', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Cancelled'].includes(s);
                                                        if (activeStage === 'post-dispatch') return ['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(s);
                                                        if (activeStage === 'returns') return ['Returned', 'Refused'].includes(s);
                                                        return true;
                                                    }).map(s => <option key={s} value={s}>{getOrderStatusLabel(t, s)}</option>)}
                                                </select>
                                            )}
                                            {col.id === 'agent' && (
                                                <select value={filters.agent} onChange={e => handleFilterChange('agent', e.target.value)} onClick={e => e.stopPropagation()} className="max-w-[130px] min-w-[100px] px-1 py-1 rounded border-transparent hover:border-gray-200 dark:hover:border-gray-600 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold bg-transparent focus:bg-white dark:focus:bg-gray-700 cursor-pointer w-full uppercase tracking-wider">
                                                    <option value="">{col.label}</option>
                                                    <option value="unassigned">{t('ordersControl.filters.unassigned', { defaultValue: 'Unassigned' })}</option>
                                                    {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                                                </select>
                                            )}
                                            {col.id === 'courier' && (
                                                <select value={filters.courier} onChange={e => handleFilterChange('courier', e.target.value)} onClick={e => e.stopPropagation()} className="max-w-[140px] min-w-[110px] px-1 py-1 rounded border-transparent hover:border-gray-200 dark:hover:border-gray-600 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold bg-transparent focus:bg-white dark:focus:bg-gray-700 cursor-pointer w-full uppercase tracking-wider">
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
                            <tbody>
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="py-24 text-center">
                                        <div className="inline-flex w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
                                        <p className="mt-4 text-sm font-bold text-gray-400 dark:text-gray-500">{t('ordersControl.grid.loading')}</p>
                                    </td>
                                </tr>
                            </tbody>
                        ) : orders.length === 0 ? (
                            <tbody>
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="py-24 text-center">
                                        {(searchTerm || FILTER_KEYS.some(k => filters[k])) ? (
                                            <>
                                                <Filter className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
                                                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{t('ordersControl.grid.emptyFiltered', 'No orders match your filters')}</p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('ordersControl.grid.emptyFilteredHint', 'Try adjusting or clearing your active filters.')}</p>
                                                <button
                                                    onClick={() => { setFilters({ status: '', priority: '', channel: '', wilaya: '', tags: '', dateFrom: '', dateTo: '', agent: '', courier: '' }); setSearchTerm(''); }}
                                                    className="mt-4 px-4 py-2 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg border border-indigo-200 dark:border-indigo-700 transition-colors"
                                                >
                                                    {t('ordersControl.grid.clearFilters', 'Clear Filters')}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <PackageOpen className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
                                                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{t('ordersControl.grid.empty')}</p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('ordersControl.grid.emptyHint', 'New orders will appear here once created.')}</p>
                                            </>
                                        )}
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
                                                    <td colSpan={visibleColumns.length + 1} className="py-8 text-center bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600">
                                                            <RefreshCw className="w-5 h-5 animate-spin" /> {t('ordersControl.messages.fetchingMore')}
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
                                            isFocused={focusedRowIndex === virtualRow.index}
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
                                            onEditClick={handleEditClick}
                                            onDelete={handleSingleDelete}
                                            onRestore={handleSingleRestore}
                                            onPurge={handleSinglePurge}
                                            onPostpone={handlePostponeOpen}
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
                <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-4 py-3 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-gray-500 dark:text-gray-400">
                            {t('ordersControl.pagination.showing')} <strong className="text-gray-900 dark:text-white">{orders.length}</strong> {t('ordersControl.pagination.of')} <strong className="text-gray-900 dark:text-white">{totalOrders}</strong> {t('ordersControl.pagination.records')}
                        </span>
                        {selectedIds.size > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-bold text-xs ring-1 ring-blue-300 dark:ring-blue-700">
                                {selectedIds.size} {t('ordersControl.pagination.selected')}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {isFetchingNextPage && (
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t('ordersControl.messages.fetchingMoreShort')}
                            </div>
                        )}
                        {!hasNextPage && orders.length > 0 && !loading && (
                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{t('ordersControl.messages.endOfResults')}</span>
                        )}
                    </div>
                </div>

                {/* Loading overlay overlaying just the table during transition, but not blocking immediate clicks */}
                {loading && !isFetchingNextPage && orders.length > 0 && (
                    <div className="absolute inset-0 bg-white/40 dark:bg-gray-800/40 backdrop-blur-[1px] z-50 pointer-events-none flex items-center justify-center">
                        <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg border border-blue-100 dark:border-blue-800 flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300 animate-pulse">
                            <RefreshCw className="w-4 h-4 animate-spin" /> {t('ordersControl.pagination.updating')}
                        </div>
                    </div>
                )}
            </div>

            {/* STICKY BULK ACTION HUD */}
            {
                selectedIds.size > 0 && hasPermission('orders.bulk') && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-950 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-[100] animate-in slide-in-from-bottom-5 border border-gray-700 dark:border-gray-600">
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
                                        }).map(s => <option key={s} value={s}>{getOrderStatusLabel(t, s)}</option>)
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
                                <button onClick={handleBulkConfirm} disabled={!bulkActionValue} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                                    {t('ordersControl.bulk.applyAll')}
                                </button>
                                <button onClick={handleCancelBulkAction} className="text-gray-400 hover:text-white text-xs font-bold px-2 uppercase">{t('ordersControl.bulk.cancel')}</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {hasPermission('orders.bulk') && (
                                    activeStage === 'post-dispatch' ? (
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
                                    )
                                )}
                            </div>
                        )}

                        <button onClick={handleClearBulkSelection} className="ml-2 p-1 text-gray-400 hover:text-rose-400 transition-colors" aria-label="Close bulk actions"><X className="w-5 h-5" /></button>
                    </div>
                )
            }

            {/* Focused Order Drawer */}
            {focusedOrderId && (
                <OrderDetailsDrawer
                    order={orders.find(o => o._id === focusedOrderId)}
                    onClose={() => setFocusedOrderId(null)}
                    onUpdate={fetchOrders}
                />
            )}

            {/* Create Order Modal */}
            <OrderModal
                isOpen={isOrderModalOpen}
                onClose={handleCloseOrderModal}
                onSubmit={editOrderData ? handleUpdateOrder : handleCreateOrder}
                initialData={editOrderData}
                inventoryProducts={productsList}
                couriers={couriers}
            />


            {confirmDialogEl}
        </div >
    );
}
