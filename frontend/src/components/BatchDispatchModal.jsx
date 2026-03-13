import React, { useState, useEffect, useRef } from 'react';
import { X, Truck, CheckCircle2, AlertCircle, Loader2, Package } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import useModalDismiss from '../hooks/useModalDismiss';

const STATUS = {
    PENDING: 'pending',
    DISPATCHING: 'dispatching',
    SUCCESS: 'success',
    ERROR: 'error'
};

export default function BatchDispatchModal({ isOpen, onClose, orders, onComplete }) {
    const { t } = useTranslation();
    const { backdropProps, panelProps } = useModalDismiss(onClose);
    const [dispatchItems, setDispatchItems] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const abortRef = useRef(false);

    useEffect(() => {
        if (isOpen && orders.length > 0) {
            setDispatchItems(orders.map(order => ({
                id: order._id,
                orderId: order.orderId,
                customerName: order.customer?.name || 'Unknown',
                totalAmount: order.totalAmount,
                status: STATUS.PENDING,
                message: ''
            })));
            setIsRunning(false);
            setIsDone(false);
            abortRef.current = false;
        }
    }, [isOpen, orders]);

    const startDispatch = async () => {
        setIsRunning(true);
        setIsDone(false);
        abortRef.current = false;
        const token = localStorage.getItem('token');

        for (let i = 0; i < dispatchItems.length; i++) {
            if (abortRef.current) break;

            const item = dispatchItems[i];

            // Mark as dispatching
            setDispatchItems(prev => prev.map((d, idx) =>
                idx === i ? { ...d, status: STATUS.DISPATCHING, message: t('dispatch.sendingToCourier', 'Sending to courier...') } : d
            ));

            try {
                const res = await apiFetch(`/api/shipments/quick-dispatch/${item.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Dispatch failed');
                setDispatchItems(prev => prev.map((d, idx) =>
                    idx === i ? {
                        ...d,
                        status: STATUS.SUCCESS,
                        message: data.tracking ? `${t('dispatch.tracking', 'Tracking')}: ${data.tracking}` : t('dispatch.dispatchedSuccessfully', 'Dispatched successfully')
                    } : d
                ));
            } catch (err) {
                const msg = err.message || 'Unknown error';
                setDispatchItems(prev => prev.map((d, idx) =>
                    idx === i ? { ...d, status: STATUS.ERROR, message: msg } : d
                ));
            }

            // Small delay between dispatches to avoid rate limiting
            if (i < dispatchItems.length - 1 && !abortRef.current) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        setIsRunning(false);
        setIsDone(true);
    };

    const handleClose = () => {
        if (isRunning) {
            abortRef.current = true;
        }
        if (isDone && onComplete) {
            onComplete();
        }
        onClose();
    };

    if (!isOpen) return null;

    const successCount = dispatchItems.filter(d => d.status === STATUS.SUCCESS).length;
    const errorCount = dispatchItems.filter(d => d.status === STATUS.ERROR).length;
    const pendingCount = dispatchItems.filter(d => d.status === STATUS.PENDING).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" {...backdropProps}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" {...panelProps}>

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                            <Truck className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{t('dispatch.batchDispatch', 'Batch Dispatch')}</h2>
                            <p className="text-xs text-gray-500">{dispatchItems.length} {t('dispatch.ordersToDispatch', 'orders to dispatch')}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} aria-label="Close" className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Summary */}
                {(isRunning || isDone) && (
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs font-bold text-green-700">{successCount} {t('common.success', 'Success')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-xs font-bold text-red-700">{errorCount} {t('common.failed', 'Failed')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs font-bold text-gray-500">{pendingCount} {t('common.pending', 'Pending')}</span>
                        </div>
                        {/* Progress bar */}
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-300"
                                style={{ width: `${((successCount + errorCount) / dispatchItems.length) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Order List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {dispatchItems.map((item, idx) => (
                        <div
                            key={item.id}
                            className={clsx(
                                "flex items-center gap-3 p-3 rounded-xl border transition-all",
                                item.status === STATUS.PENDING && "bg-gray-50 border-gray-100",
                                item.status === STATUS.DISPATCHING && "bg-blue-50 border-blue-200 ring-1 ring-blue-100",
                                item.status === STATUS.SUCCESS && "bg-green-50 border-green-200",
                                item.status === STATUS.ERROR && "bg-red-50 border-red-200"
                            )}
                        >
                            {/* Status Icon */}
                            <div className="shrink-0">
                                {item.status === STATUS.PENDING && (
                                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                                        <span className="text-[10px] font-black text-gray-500">{idx + 1}</span>
                                    </div>
                                )}
                                {item.status === STATUS.DISPATCHING && (
                                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                    </div>
                                )}
                                {item.status === STATUS.SUCCESS && (
                                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    </div>
                                )}
                                {item.status === STATUS.ERROR && (
                                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
                                        <AlertCircle className="w-4 h-4 text-red-600" />
                                    </div>
                                )}
                            </div>

                            {/* Order Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-900">{item.orderId}</span>
                                    <span className="text-xs text-gray-400">·</span>
                                    <span className="text-xs text-gray-500 truncate">{item.customerName}</span>
                                </div>
                                {item.message && (
                                    <p className={clsx(
                                        "text-[11px] mt-0.5 font-medium truncate",
                                        item.status === STATUS.SUCCESS && "text-green-600",
                                        item.status === STATUS.ERROR && "text-red-600",
                                        item.status === STATUS.DISPATCHING && "text-blue-600"
                                    )}>
                                        {item.message}
                                    </p>
                                )}
                            </div>

                            {/* Amount */}
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-gray-700 tabular-nums">{item.totalAmount?.toLocaleString()}</p>
                                <p className="text-[9px] text-gray-400 font-bold">{t('common.dzd', 'DZD')}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-between items-center">
                    {isDone ? (
                        <>
                            <p className="text-sm text-gray-600">
                                <span className="font-bold text-green-600">{successCount}</span> {t('dispatch.dispatched', 'dispatched')},{' '}
                                <span className="font-bold text-red-600">{errorCount}</span> {t('common.failed', 'failed')}
                            </p>
                            <button
                                onClick={handleClose}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
                            >
                                {t('common.done', 'Done')}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleClose}
                                disabled={isRunning}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={startDispatch}
                                disabled={isRunning}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-sm shadow-green-600/20 transition-all disabled:opacity-50"
                            >
                                {isRunning ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('dispatch.dispatching', 'Dispatching...')}
                                    </>
                                ) : (
                                    <>
                                        <Truck className="w-4 h-4" />
                                        {t('dispatch.dispatchAll', 'Dispatch All')} ({dispatchItems.length})
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
