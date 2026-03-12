import React, { useState, useEffect, useRef } from 'react';
import { useHotkey } from '../hooks/useHotkey';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import RequireAction from '../components/Guards/RequireAction';
import { Truck, Search, Plus, Archive, FileText, CheckCircle, Clock, AlertTriangle, XCircle, ArrowRight, CheckSquare, Trash2, Printer, MapPin, Package, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';
import moment from 'moment';
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
    const [confirmDelete, setConfirmDelete] = useState(null); // shipment id pending delete
    const [errorMsg, setErrorMsg] = useState(null);
    const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), 5000); };
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    useEffect(() => {
        fetchShipments();
    }, []);

    const fetchShipments = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/shipments`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShipments(res.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching shipments', error);
            setLoading(false);
        }
    };

    const handleValidate = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/shipments/${id}/validate`, { ask_collection: 1 }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchShipments();
        } catch (error) {
            showError(error.response?.data?.message || 'Failed to validate shipment.');
        }
    };

    const handleDelete = (id) => setConfirmDelete(id);

    const confirmDeleteShipment = async () => {
        const id = confirmDelete;
        setConfirmDelete(null);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${import.meta.env.VITE_API_URL || ''}/api/shipments/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchShipments();
        } catch (error) {
            showError(error.response?.data?.message || 'Failed to delete shipment.');
        }
    };

    const handlePrintLabel = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/shipments/${id}/label`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.url) {
                window.open(res.data.url, '_blank');
            }
        } catch (error) {
            showError(error.response?.data?.message || 'Failed to fetch printing label.');
        }
    };

    const handleExport = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/shipments/export/csv`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'dispatch_shipments.csv');
            document.body.appendChild(link);
            link.click();
        } catch (error) {
            console.error('Export failed', error);
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
                        <RequireAction permission="dispatch.export">
                            <button onClick={handleExport} className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-all active:scale-95">
                                <FileText className="w-4 h-4 mr-2" />
                                {t('dispatch.exportList', 'Export List')}
                            </button>
                        </RequireAction>
                        <RequireAction permission="dispatch.create_shipment">
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <div className="w-full md:w-auto flex gap-2 overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
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
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
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
                                <tr><td colSpan="6" className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-3 text-gray-400">
                                        <div className="w-7 h-7 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin" />
                                        <span className="text-sm font-medium">Loading shipments...</span>
                                    </div>
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
                                                <span className="text-sm font-bold text-gray-900">{shipment.externalTrackingId || 'Pending...'}</span>
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
                                            <div className="text-[10px] text-gray-400 mt-1">{moment(shipment.createdAt).format('MMM D, HH:mm')}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-900">{(shipment.codAmount || 0).toLocaleString()} DZD</div>
                                            <div className="text-[10px] text-gray-500 border border-gray-200 bg-gray-50 rounded px-1.5 py-0.5 inline-block mt-1">
                                                {shipment.paymentStatus?.replace(/_/g, ' ') || '—'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2 items-center">
                                            {/* Pre-validation Actions */}
                                            {['Created in Courier', 'Draft'].includes(shipment.shipmentStatus) && (
                                                <>
                                                    <RequireAction permission="dispatch.validate_shipment">
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
                                                <RequireAction permission="dispatch.generate_label">
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

            {/* Delete confirm dialog */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
                            <Trash2 className="w-5 h-5 text-red-600" />
                        </div>
                        <h3 className="text-base font-black text-gray-900 mb-2">Delete this shipment?</h3>
                        <p className="text-sm text-gray-500 leading-relaxed mb-6">This will cancel the dispatch request. The linked order will revert to Confirmed status.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                            <button onClick={confirmDeleteShipment} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error toast */}
            {errorMsg && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-gray-900 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-w-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="leading-snug">{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="ml-2 text-gray-400 hover:text-white transition-colors shrink-0"><X className="w-4 h-4" /></button>
                </div>
            )}
        </div>
    );
}
