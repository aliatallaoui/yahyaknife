import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, DollarSign, RefreshCw, CheckCircle, XCircle, Search, AlertTriangle, Layers } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import { fmtShortDate } from '../utils/dateUtils';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function CourierFinanceDesk() {
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const { hasPermission } = useContext(AuthContext);
    const navigate = useNavigate();

    const [couriers, setCouriers] = useState([]);
    const [loadingCouriers, setLoadingCouriers] = useState(true);
    
    // Settlement Drawer state
    const [selectedCourier, setSelectedCourier] = useState(null);
    const [deliveries, setDeliveries] = useState([]);
    const [loadingDeliveries, setLoadingDeliveries] = useState(false);
    const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
    const [customAmount, setCustomAmount] = useState('');
    const [settlementNotes, setSettlementNotes] = useState('');
    const [processingSettlement, setProcessingSettlement] = useState(false);
    const [error, setError] = useState('');

    // Escape key to close settlement drawer
    useEffect(() => {
        if (!selectedCourier) return;
        const handler = (e) => { if (e.key === 'Escape') setSelectedCourier(null); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [selectedCourier]);

    useEffect(() => {
        if (!hasPermission('finance.view') && !hasPermission('couriers.edit')) {
            navigate('/dashboard');
        }
        fetchCouriers();
    }, [hasPermission, navigate]);

    const fetchCouriers = async () => {
        setLoadingCouriers(true);
        try {
            const res = await apiFetch('/api/finance/courier-balances');
            if (res.ok) {
                const data = await res.json();
                setCouriers(data.data ?? data);
            }
        } catch (err) {
            setError(t('finance.loadCouriersError', 'Failed to load courier balances.'));
        } finally {
            setLoadingCouriers(false);
        }
    };

    const handleSelectCourier = async (courier) => {
        setSelectedCourier(courier);
        setLoadingDeliveries(true);
        setSelectedOrderIds(new Set());
        setCustomAmount('');
        setError('');
        try {
            const res = await apiFetch(`/api/finance/courier-deliveries/${courier._id}`);
            if (res.ok) {
                const data = await res.json();
                setDeliveries(data.data ?? data);
            }
        } catch (err) {
            setError(t('finance.loadError', 'Failed to load deliveries'));
        } finally {
            setLoadingDeliveries(false);
        }
    };

    const toggleOrderSelection = (id) => {
        const newSet = new Set(selectedOrderIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedOrderIds(newSet);
    };

    const selectAllOrders = () => {
        if (selectedOrderIds.size === deliveries.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(deliveries.map(d => d._id)));
        }
    };

    const calculatedTotal = useMemo(() => deliveries
        .filter(d => selectedOrderIds.has(d._id))
        .reduce((sum, d) => sum + (d.financials?.codAmount ?? 0), 0), [deliveries, selectedOrderIds]);

    const handleSettle = async () => {
        if (selectedOrderIds.size === 0) {
            setError(t('finance.errNoOrders', 'Please select at least one order.'));
            return;
        }
        const paidAmountFloat = parseFloat(customAmount || calculatedTotal);
        if (isNaN(paidAmountFloat) || paidAmountFloat <= 0) {
            setError(t('finance.errInvalidAmount', 'Please enter a valid amount greater than 0.'));
            return;
        }

        setProcessingSettlement(true);
        setError('');
        try {
            const res = await apiFetch('/api/finance/settle-courier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courierId: selectedCourier._id,
                    orderIds: Array.from(selectedOrderIds),
                    amountPaid: paidAmountFloat,
                    notes: settlementNotes
                })
            });

            if (res.ok) {
                setSelectedCourier(null);
                fetchCouriers();
            } else {
                const data = await res.json();
                setError(data.message || t('finance.errGeneral'));
            }
        } catch (err) {
            setError(t('finance.errGeneral', 'An error occurred during settlement.'));
        } finally {
            setProcessingSettlement(false);
        }
    };

    return (
        <div className="w-full space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl shadow-sm">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        {t('finance.courierDeskTitle', 'Courier Cash Reconciliation')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 max-w-2xl">
                        {t('finance.courierDeskDesc', 'Manage incoming Cash On Delivery drops from couriers. Select orders they are paying for to settle their ledger balances.')}
                    </p>
                </div>
            </div>

            {/* Balances Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {loadingCouriers ? (
                    <div className="col-span-full py-12 flex justify-center"><RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                ) : couriers.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 font-medium border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl">{t('general.no_data')}</div>
                ) : (
                    couriers.map(courier => (
                        <div key={courier._id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300">
                                        <Truck className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{courier.name}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{courier.integrationType}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-xl border border-rose-100/50 dark:border-rose-800/50">
                                    <p className="text-[10px] uppercase font-bold text-rose-500 dark:text-rose-400 mb-1">{t('finance.pendingRemittance', 'Pending Cash Drop')}</p>
                                    <p className="text-xl font-black text-rose-700 dark:text-rose-300">{courier.pendingRemittance?.toLocaleString() || 0} DZD</p>
                                </div>

                                <button
                                    onClick={() => handleSelectCourier(courier)}
                                    disabled={courier.pendingRemittance <= 0}
                                    className="w-full py-2.5 bg-gray-900 dark:bg-emerald-600 hover:bg-black dark:hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {t('finance.btnSettle', 'Open Settlement')} <DollarSign className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Settlement Drawer / Modal */}
            {selectedCourier && (
                <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full sm:max-w-3xl bg-white dark:bg-gray-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">

                        {/* Drawer Header */}
                        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <Truck className="w-5 h-5 text-emerald-600" />
                                    {t('finance.settleCourier', 'Settle Cash for')} {selectedCourier.name}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('finance.pending', 'Pending')}: <strong className="text-rose-600 dark:text-rose-400">{selectedCourier.pendingRemittance?.toLocaleString()} {t('common.dzd', 'DZD')}</strong></p>
                            </div>
                            <button onClick={() => setSelectedCourier(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors">
                                <XCircle className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                            </button>
                        </div>

                        {/* Order List */}
                        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-800 space-y-4">
                            {error && (
                                <div className="p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm font-bold flex gap-2 items-center">
                                    <AlertTriangle className="w-4 h-4" /> {error}
                                </div>
                            )}

                            <div className="flex justify-between items-end mb-2">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-emerald-500" />
                                    {t('finance.deliveredOrders', 'Unsettled Delivered Orders')}
                                </h3>
                                <button onClick={selectAllOrders} className="text-emerald-600 hover:text-emerald-700 text-xs font-bold transition-colors">
                                    {selectedOrderIds.size === deliveries.length ? t('finance.deselectAll', 'Deselect All') : t('finance.selectAll', 'Select All')}
                                </button>
                            </div>

                            {loadingDeliveries ? (
                                <div className="py-20 flex justify-center"><RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                            ) : deliveries.length === 0 ? (
                                <div className="py-20 text-center text-gray-500 dark:text-gray-400 font-medium bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600">
                                    {t('finance.noUnsettledDeliveries', 'No unsettled deliveries found for this courier.')}
                                </div>
                            ) : (
                                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                                    <table className="cf-table">
                                        <thead>
                                            <tr>
                                                <th className="w-10"></th>
                                                <th>{t('datagrid.colOrder')}</th>
                                                <th>{t('datagrid.colCustomer')}</th>
                                                <th>{t('datagrid.colDate')}</th>
                                                <th className="text-right">{t('datagrid.colTotal')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deliveries.map(d => {
                                                const isSelected = selectedOrderIds.has(d._id);
                                                return (
                                                    <tr key={d._id} className={clsx("cursor-pointer", isSelected && "row-selected")} onClick={() => toggleOrderSelection(d._id)}>
                                                        <td className="px-4 py-3">
                                                            <div className={clsx("w-5 h-5 rounded border flex items-center justify-center transition-colors", isSelected ? "bg-emerald-500 border-emerald-500" : "border-gray-300 dark:border-gray-600")}>
                                                                {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-xs font-bold text-gray-900 dark:text-white">{d.orderId || d._id.slice(-6)}</td>
                                                        <td className="px-4 py-3">
                                                            <p className="font-semibold text-gray-900 dark:text-white">{d.customer?.name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">{d.customer?.phone}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtShortDate(d.date)}</td>
                                                        <td className="px-4 py-3 font-black text-gray-900 dark:text-white text-right">{d.financials?.codAmount?.toLocaleString()} {t('common.dzd', 'DZD')}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Footer / Calculation */}
                        <div className="p-6 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                            <div className="mb-4 space-y-3">
                                <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
                                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('finance.expectedFromSelected', 'Expected from Selected')} ({selectedOrderIds.size})</span>
                                    <span className="text-2xl font-black text-gray-900 dark:text-white">{calculatedTotal.toLocaleString()} {t('common.dzd', 'DZD')}</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase pb-1 block">{t('finance.actualCashHandedOver', 'Actual Cash Handed Over')}</label>
                                        <input
                                            type="number"
                                            placeholder={calculatedTotal || '0'}
                                            value={customAmount}
                                            onChange={(e) => setCustomAmount(e.target.value)}
                                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl font-black text-lg text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase pb-1 block">{t('finance.notesOptional', 'Notes (Optional)')}</label>
                                        <input
                                            type="text"
                                            placeholder={t('finance.settlementNotesPlaceholder', 'e.g. Missing 500 DZD for gas')}
                                            value={settlementNotes}
                                            onChange={(e) => setSettlementNotes(e.target.value)}
                                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl font-medium dark:text-gray-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSettle}
                                disabled={processingSettlement || selectedOrderIds.size === 0}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl font-bold text-lg flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-md"
                            >
                                {processingSettlement ? <RefreshCw className="w-6 h-6 animate-spin" /> : <><CheckCircle className="w-6 h-6" /> {t('finance.confirmSettlement', 'Confirm Settlement')}</>}
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
