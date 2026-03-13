import React, { useState, useEffect, useRef } from 'react';
import { useHotkey } from '../hooks/useHotkey';
import { apiFetch } from '../utils/apiFetch';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConfirmDialog } from '../components/ConfirmDialog';
import TableSkeleton from '../components/TableSkeleton';
import { useToast } from '../components/Toast';
import RequireAction from '../components/Guards/RequireAction';
import { Truck, Search, Plus, Archive, FileText, CheckCircle, Clock, AlertTriangle, XCircle, ArrowRight, CheckSquare, Trash2, Printer, MapPin, Package } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';
import { fmtShortDateTime } from '../utils/dateUtils';
import CreateShipmentModal from '../components/CreateShipmentModal';
import PhoneChip from '../components/PhoneChip';

// Module-level i18n key map — single source of truth for all shipment status labels
const SHIPMENT_STATUS_I18N = {
    'All':                 'common.all',
    'Created in Courier':  'dispatch.statusCreatedInCourier',
    'Validated':           'dispatch.statusValidated',
    'In Transit':          'dispatch.statusInTransit',
    'Out for Delivery':    'dispatch.statusOutForDelivery',
    'Delivered':           'dispatch.statusDelivered',
    'Return Initiated':    'dispatch.statusReturnInitiated',
    'Failed Attempt':      'dispatch.statusFailedAttempt',
    'Returned':            'dispatch.statusReturned',
    'Cancelled':           'dispatch.statusCancelled',
};
const getShipmentStatusLabel = (status, t) => {
    const key = SHIPMENT_STATUS_I18N[status];
    return key ? t(key, status) : status;
};

const FILTER_STATUSES = ['All', 'Created in Courier', 'Validated', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned'];

export default function DispatchCenter() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const { dialog: confirmDialogEl, confirm: showConfirm } = useConfirmDialog();
    const notify = useToast();
    const showError = (msg) => notify.error(msg);
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    useEffect(() => {
        fetchShipments();
    }, []);

    const fetchShipments = async () => {
        try {
            const res = await apiFetch('/api/shipments');
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || 'Failed to load shipments');
            setShipments(json.data ?? json);
            setLoading(false);
        } catch (error) {
            showError(error.message || t('dispatch.errorLoadShipments', 'Failed to load shipments.'));
            setLoading(false);
        }
    };

    const handleValidate = async (id) => {
        try {
            const res = await apiFetch(`/api/shipments/${id}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ask_collection: 1 }) });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to validate shipment');
            fetchShipments();
        } catch (error) {
            showError(error.message || t('dispatch.errorValidate', 'Failed to validate shipment.'));
        }
    };

    const [bulkValidating, setBulkValidating] = useState(false);
    const pendingValidation = shipments.filter(s => ['Created in Courier', 'Draft'].includes(s.shipmentStatus));
    const handleBulkValidate = async () => {
        if (pendingValidation.length === 0) return;
        setBulkValidating(true);
        let failed = 0;
        for (const s of pendingValidation) {
            try {
                const res = await apiFetch(`/api/shipments/${s._id}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ask_collection: 1 }) });
                if (!res.ok) throw new Error('validate failed');
            } catch { failed++; }
        }
        setBulkValidating(false);
        if (failed > 0) showError(t('dispatch.bulkValidatePartialFail', `${failed} shipment(s) failed to validate.`));
        fetchShipments();
    };

    const handleDelete = (id) => {
        showConfirm({
            title: t('dispatch.deleteConfirmTitle', 'Delete this shipment?'),
            body: t('dispatch.deleteConfirmBody', 'This will cancel the dispatch request. The linked order will revert to Confirmed status.'),
            danger: true,
            onConfirm: async () => {
                try {
                    const res = await apiFetch(`/api/shipments/${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to delete shipment');
                    fetchShipments();
                } catch (error) {
                    showError(error.message || t('dispatch.errorDelete', 'Failed to delete shipment.'));
                }
            },
        });
    };

    const handlePrintLabel = async (id) => {
        try {
            const res = await apiFetch(`/api/shipments/${id}/label`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || 'Failed to fetch printing label');
            const data = json.data ?? json;
            if (data.url) {
                window.open(data.url, '_blank');
            }
        } catch (error) {
            showError(error.message || t('dispatch.errorLabel', 'Failed to fetch printing label.'));
        }
    };

    const handleExport = async () => {
        try {
            const res = await apiFetch('/api/shipments/export/csv');
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'dispatch_shipments.csv');
            document.body.appendChild(link);
            link.click();
        } catch (error) {
            showError(error.message || t('dispatch.errorExport', 'Export failed. Please try again.'));
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Created in Courier': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'Validated': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
            case 'In Transit': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Out for Delivery': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
            case 'Delivered': return 'bg-green-100 text-green-800 border-green-200';
            case 'Return Initiated':
            case 'Failed Attempt': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'Returned':
            case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Delivered': return <CheckCircle className="w-4 h-4 mr-1.5" />;
            case 'In Transit':
            case 'Out for Delivery': return <ArrowRight className="w-4 h-4 mr-1.5" />;
            case 'Created in Courier': return <Clock className="w-4 h-4 mr-1.5" />;
            case 'Returned':
            case 'Cancelled': return <XCircle className="w-4 h-4 mr-1.5" />;
            default: return <Clock className="w-4 h-4 mr-1.5" />;
        }
    };

    const filteredShipments = shipments.filter(s => {
        const matchesSearch = s.externalTrackingId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.customerName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (s.internalOrderId?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || s.shipmentStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // KPI Calculations
    const totalActive = shipments.filter(s => ['Created in Courier', 'Validated', 'In Transit', 'Out for Delivery'].includes(s.shipmentStatus)).length;
    const totalDelivered = shipments.filter(s => s.shipmentStatus === 'Delivered').length;
    const totalReturns = shipments.filter(s => ['Return Initiated', 'Returned', 'Failed Attempt'].includes(s.shipmentStatus)).length;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('dispatch.title', 'Dispatch & Logistics Center')}
                subtitle={t('dispatch.subtitle', 'Manage outbound ECOTRACK shipments, tracking statuses, and returns.')}
                variant="sales"
                actions={
                    <div className="flex flex-wrap gap-3">
                        <RequireAction permission="shipments.export">
                            <button onClick={handleExport} className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-all active:scale-95">
                                <FileText className="w-4 h-4 mr-2" />
                                {t('dispatch.exportList', 'Export List')}
                            </button>
                        </RequireAction>
                        <RequireAction permission="shipments.create">
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="flex items-center gap-2 bg-blue-600 outline-none text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all"
                            >
                                <Plus className="w-5 h-5 font-black" />
                                {t('dispatch.createShipment', 'New Shipment')}
                            </button>
                        </RequireAction>
                    </div>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{t('dispatch.kpi.total', 'Total Shipments')}</p>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tighter truncate">{shipments.length}</h3>
                    </div>
                    <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 shrink-0">
                        <Package className="w-8 h-8 text-gray-600" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-1 truncate">{t('dispatch.kpi.active', 'Active & In Transit')}</p>
                        <h3 className="text-3xl font-black text-blue-700 tracking-tighter truncate">{totalActive}</h3>
                    </div>
                    <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shrink-0">
                        <Truck className="w-8 h-8 text-blue-600" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-green-600 uppercase tracking-wider mb-1 truncate">{t('dispatch.kpi.delivered', 'Successfully Delivered')}</p>
                        <h3 className="text-3xl font-black text-green-700 tracking-tighter truncate">{totalDelivered}</h3>
                    </div>
                    <div className="h-16 w-16 bg-green-50 rounded-2xl flex items-center justify-center border border-green-100 shrink-0">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-orange-600 uppercase tracking-wider mb-1 truncate">{t('dispatch.kpi.returns', 'Returns & Exceptions')}</p>
                        <h3 className="text-3xl font-black text-orange-700 tracking-tighter truncate">{totalReturns}</h3>
                    </div>
                    <div className="h-16 w-16 bg-orange-50 rounded-2xl flex items-center justify-center border border-orange-100 shrink-0">
                        <AlertTriangle className="w-8 h-8 text-orange-600" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="w-full md:w-96 relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder={t('dispatch.search', 'Search tracking ID, customer, order... (Press /)')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                </div>
                <div className="w-full md:w-auto flex gap-2 overflow-x-auto pb-2 md:pb-0 custom-scrollbar items-center">
                    {FILTER_STATUSES.map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={clsx(
                                "whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                statusFilter === status ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                        >
                            {getShipmentStatusLabel(status, t)}
                        </button>
                    ))}
                    {pendingValidation.length > 0 && (
                        <button
                            onClick={handleBulkValidate}
                            disabled={bulkValidating}
                            className="whitespace-nowrap flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-60"
                        >
                            {bulkValidating ? t('dispatch.validating', 'Validating...') : t('dispatch.btnValidateAll', `Validate All (${pendingValidation.length})`)}
                        </button>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <div className="cf-table-wrap">
                <div className="overflow-x-auto">
                    <table className="cf-table min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dispatch.table.tracking', 'Tracking / Ref')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dispatch.table.recipient', 'Recipient')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dispatch.table.destination', 'Destination')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dispatch.table.status', 'Courier Status')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dispatch.table.cod', 'COD Amount')}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dispatch.table.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan="6" className="p-0">
                                    <TableSkeleton rows={6} cols={6} showHeader={false} />
                                </td></tr>
                            ) : filteredShipments.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                        <Archive className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                        <p className="text-lg font-medium text-gray-900">{t('dispatch.empty.title', 'No shipments found')}</p>
                                        <p className="text-sm mt-1">{t('dispatch.empty.subtitle', 'Adjust filters or create a new dispatch order.')}</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredShipments.map((shipment) => (
                                    <tr key={shipment._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900">{shipment.externalTrackingId || t('dispatch.pendingTrackingId', 'Pending...')}</span>
                                                <span className="text-xs text-gray-500 font-mono mt-0.5">{shipment.internalOrderId}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{shipment.customerName}</div>
                                            <PhoneChip phone={shipment.phone1} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{shipment.wilayaName}</div>
                                            <div className="text-xs text-gray-500">{shipment.commune}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={clsx("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border", getStatusStyle(shipment.shipmentStatus))}>
                                                {getStatusIcon(shipment.shipmentStatus)}
                                                {getShipmentStatusLabel(shipment.shipmentStatus, t)}
                                            </span>
                                            <div className="text-[10px] text-gray-400 mt-1">{fmtShortDateTime(shipment.createdAt)}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-900">{(shipment.codAmount || 0).toLocaleString()} {t('common.dzd', 'DZD')}</div>
                                            <div className="text-[10px] text-gray-500 border border-gray-200 bg-gray-50 rounded px-1.5 py-0.5 inline-block mt-1">
                                                {shipment.paymentStatus?.replace(/_/g, ' ') || '—'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2 items-center">
                                            {/* Pre-validation Actions */}
                                            {['Created in Courier', 'Draft'].includes(shipment.shipmentStatus) && (
                                                <>
                                                    <RequireAction permission="shipments.create">
                                                        <button onClick={() => handleValidate(shipment._id)} title="Validate & Dispatch" className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded-lg transition-colors">
                                                            <CheckSquare className="w-4 h-4" />
                                                        </button>
                                                    </RequireAction>
                                                    <RequireAction permission="shipments.cancel">
                                                        <button onClick={() => handleDelete(shipment._id)} title="Cancel/Delete" className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </RequireAction>
                                                </>
                                            )}

                                            {/* Post-validation Actions */}
                                            {!['Created in Courier', 'Draft', 'Cancelled'].includes(shipment.shipmentStatus) && (
                                                <RequireAction permission="shipments.view">
                                                    <button onClick={() => handlePrintLabel(shipment._id)} title="Print Label" className="text-gray-600 hover:text-gray-900 bg-gray-100 p-1.5 rounded-lg transition-colors">
                                                        <Printer className="w-4 h-4" />
                                                    </button>
                                                </RequireAction>
                                            )}

                                            <button onClick={() => navigate(`/dispatch/${shipment._id}`)} className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors ml-2">{t('common.details', 'Details')}</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateShipmentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchShipments}
            />

            {confirmDialogEl}

        </div>
    );
}
