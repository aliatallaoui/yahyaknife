import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X, PhoneCall, CheckCircle, XCircle, MapPin,
    Save, MessageSquare, AlertTriangle, RefreshCw,
    Clock, PhoneMissed, WifiOff, Phone, Shield,
    User, ShoppingBag, TrendingDown, Ban,
    ChevronLeft, ChevronRight, Truck, Route,
    Loader2, Send as SendIcon
} from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import toast from 'react-hot-toast';
import useModalDismiss from '../../hooks/useModalDismiss';
import { useHotkey } from '../../hooks/useHotkey';
import TrackingTimeline from './TrackingTimeline';
import MessagePanel from './MessagePanel';
import OrderEditPanel from './OrderEditPanel';

const RISK_COLORS = { Low: 'bg-emerald-100 text-emerald-700', Medium: 'bg-amber-100 text-amber-700', High: 'bg-red-100 text-red-700' };
const TRUST_COLOR = (s) => s >= 70 ? 'text-emerald-600' : s >= 40 ? 'text-amber-600' : 'text-red-600';

function StatPill({ label, value, icon: Icon, className = '' }) {
    return (
        <div className={`flex flex-col items-center p-2 rounded-lg bg-white border border-gray-100 ${className}`}>
            {Icon && <Icon className="w-3.5 h-3.5 text-gray-400 mb-0.5" />}
            <span className="text-base font-black text-gray-900">{value}</span>
            <span className="text-[10px] font-medium text-gray-500 uppercase leading-tight text-center">{label}</span>
        </div>
    );
}

export default function OrderActionDrawer({ order, onClose, onSuccess, orderIndex = -1, totalOrders = 0, onNavigate }) {
    const { t } = useTranslation();
    const { backdropProps, panelProps } = useModalDismiss(onClose);
    const [note, setNote] = useState('');
    const [loadingAction, setLoadingAction] = useState(null);
    const [error, setError] = useState(null);
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [isPostponing, setIsPostponing] = useState(false);

    // Intel state
    const [intel, setIntel] = useState(null);
    const [intelLoading, setIntelLoading] = useState(false);

    // Confirmation checklist state
    const [showChecklist, setShowChecklist] = useState(false);
    const [checklist, setChecklist] = useState({ address: false, phone: false, stock: false });

    // Address edit state
    const [address, setAddress]   = useState(order?.shipping?.address || '');
    const [wilaya, setWilaya]     = useState(order?.shipping?.wilayaName || order?.wilaya || '');
    const [commune, setCommune]   = useState(order?.shipping?.commune || order?.commune || '');

    // Postpone state
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const [postponeDate, setPostponeDate] = useState(tomorrow.toISOString().slice(0, 10));

    // Best time to call hint
    const [bestTimes, setBestTimes] = useState(null);

    // New panels state
    const [showTracking, setShowTracking] = useState(false);
    const [showMessaging, setShowMessaging] = useState(false);
    const [showEditPanel, setShowEditPanel] = useState(false);
    const [dispatching, setDispatching] = useState(false);

    // Fetch order intelligence and lock order when drawer opens
    useEffect(() => {
        if (!order?._id) return;
        setIntelLoading(true);
        
        apiFetch(`/api/call-center/order-intel/${order._id}`)
            .then(res => res.json())
            .then(data => setIntel(data.data ?? data))
            .catch(() => setIntel(null))
            .finally(() => setIntelLoading(false));

        // Pessimistic lock
        apiFetch(`/api/call-center/order/${order._id}/lock`, { method: 'POST' }).catch(() => {});

        return () => {
            // Unlock on unmount or order change
            apiFetch(`/api/call-center/order/${order._id}/unlock`, { method: 'POST', keepalive: true }).catch(() => {});
        };
    }, [order?._id]);

    // Fetch best time to call (cached on backend for 1h)
    useEffect(() => {
        apiFetch('/api/call-center/best-time-to-call')
            .then(res => res.json())
            .then(data => setBestTimes(data.data ?? data))
            .catch(() => setBestTimes(null));
    }, []);

    if (!order) return null;

    const handleAction = async (actionType, extra = {}) => {
        setLoadingAction(actionType);
        setError(null);
        try {
            const payload = { orderId: order._id, actionType, note, ...extra };

            if (actionType === 'Address_Updated') {
                payload.newAddress = address;
                payload.newWilaya  = wilaya;
                payload.newCommune = commune;
            }
            if (actionType === 'Postponed') {
                payload.postponedUntil = new Date(postponeDate).toISOString();
            }

            const res = await apiFetch('/api/call-center/log-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || t('callcenter.actionFailed', 'Action failed'));
            }
            const actionLabels = {
                'Confirmed': t('callcenter.toast.confirmed', 'Order confirmed'),
                'No Answer': t('callcenter.toast.noAnswer', 'Logged as No Answer'),
                'Postponed': t('callcenter.toast.postponed', 'Callback scheduled'),
                'Cancelled by Customer': t('callcenter.toast.cancelled', 'Order cancelled'),
                'Wrong Number': t('callcenter.toast.wrongNumber', 'Logged as Wrong Number'),
                'Out of Coverage': t('callcenter.toast.outOfCoverage', 'Logged as Out of Coverage'),
                'Address_Updated': t('callcenter.toast.addressUpdated', 'Address updated'),
            };
            toast.success(actionLabels[actionType] || actionType, { duration: 3000 });
            onSuccess();
        } catch (err) {
            setError(err.message || t('callcenter.actionFailed', 'Action failed'));
        } finally {
            setLoadingAction(null);
        }
    };

    // Quick dispatch handler
    const handleQuickDispatch = async () => {
        setDispatching(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/call-center/quick-dispatch/${order._id}`, { method: 'POST' });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Dispatch failed');
            }
            const json = await res.json();
            const data = json.data ?? json;
            toast.success(data.trackingId ? `Dispatched! Tracking: ${data.trackingId}` : 'Dispatched (tracking pending)', { duration: 4000 });
            onSuccess();
        } catch (err) {
            setError(err.message || 'Dispatch failed');
        } finally {
            setDispatching(false);
        }
    };

    // Keyboard shortcuts
    const safeAction = useCallback((action) => { if (!loadingAction) handleAction(action); }, [loadingAction]);
    const triggerConfirm = useCallback(() => {
        if (loadingAction) return;
        if (showChecklist) {
            // All checks passed, confirm
            if (checklist.address && checklist.phone && checklist.stock) handleAction('Confirmed');
        } else {
            setShowChecklist(true);
            setChecklist({ address: false, phone: false, stock: false });
        }
    }, [loadingAction, showChecklist, checklist]);
    useHotkey('enter', () => triggerConfirm(), { preventDefault: true });
    useHotkey('n', () => safeAction('No Answer'));
    useHotkey('p', () => { if (!loadingAction) { setIsPostponing(true); setIsEditingAddress(false); } });
    useHotkey('c', () => safeAction('Cancelled by Customer'));
    useHotkey('w', () => safeAction('Wrong Number'));
    useHotkey('o', () => safeAction('Out of Coverage'));
    useHotkey('ArrowLeft', () => { if (onNavigate && orderIndex > 0) onNavigate(-1); }, { preventDefault: true });
    useHotkey('ArrowRight', () => { if (onNavigate && orderIndex < totalOrders - 1) onNavigate(1); }, { preventDefault: true });

    // Customer display
    const customerName  = order.customer?.name || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || t('common.unknown', 'Unknown');
    const customerPhone = order.customer?.phone || order.shipping?.phone1 || '';
    const orderId       = order.orderId || order.orderNumber || order._id?.slice(-6);
    const shippingWilaya   = order.shipping?.wilayaName || order.wilaya || '';
    const shippingCommune  = order.shipping?.commune || order.commune || '';
    const shippingAddress  = order.shipping?.address || order.shippingAddress || '';

    const items = order.products || order.items || [];
    const isLoading = (action) => loadingAction === action;
    const cust = intel?.customer;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/50 backdrop-blur-sm animate-in fade-in" {...backdropProps}>
            <div className="w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right" {...panelProps}>

                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{t('callcenter.drawer.title', 'Process Order')}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-gray-500 text-sm font-mono font-medium">{orderId}</p>
                            {totalOrders > 0 && orderIndex >= 0 && (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                    {orderIndex + 1} / {totalOrders}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {onNavigate && totalOrders > 1 && (
                            <>
                                <button
                                    onClick={() => onNavigate(-1)}
                                    disabled={orderIndex <= 0}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
                                    title={t('callcenter.drawer.prev', 'Previous order (←)')}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onNavigate(1)}
                                    disabled={orderIndex >= totalOrders - 1}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
                                    title={t('callcenter.drawer.next', 'Next order (→)')}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">

                    {/* Error Banner */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                            <button onClick={() => setError(null)} className="ms-auto text-rose-400 hover:text-rose-600"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    )}

                    {/* Duplicate Order Warning */}
                    {intel?.duplicateCount > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800 font-semibold animate-in fade-in">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {t('callcenter.drawer.duplicateWarning', '{{count}} other active order(s) with this phone number', { count: intel.duplicateCount })}
                        </div>
                    )}

                    {/* Customer Card */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0">
                                {customerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-gray-900 text-base truncate">{customerName}</h3>
                                    {cust?.blacklisted && (
                                        <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                                            <Ban className="w-2.5 h-2.5" /> BLOCKED
                                        </span>
                                    )}
                                </div>
                                <a
                                    href={`tel:${customerPhone}`}
                                    className="inline-flex items-center gap-2 mt-2 text-indigo-700 font-bold bg-white px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm hover:bg-indigo-600 hover:text-white transition-colors text-sm"
                                >
                                    <PhoneCall className="w-4 h-4" />
                                    {customerPhone || t('callcenter.no_phone', 'No Phone')}
                                </a>
                                {(shippingWilaya || shippingAddress) && (
                                    <div className="flex items-start gap-2 text-gray-600 text-sm mt-2">
                                        <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                        <span className="leading-snug">
                                            {[shippingWilaya, shippingCommune].filter(Boolean).join(', ')}
                                            {shippingAddress && <><br /><span className="text-gray-400">{shippingAddress}</span></>}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Customer Intelligence Card */}
                    {intelLoading ? (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-center gap-2 text-sm text-gray-400">
                            <RefreshCw className="w-4 h-4 animate-spin" /> {t('callcenter.drawer.loadingCustomer', 'Loading customer data...')}
                        </div>
                    ) : cust && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3 animate-in fade-in">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-gray-500" />
                                    {t('callcenter.drawer.customerProfile', 'Customer Profile')}
                                </h4>
                                <div className="flex items-center gap-2">
                                    {cust.riskLevel && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RISK_COLORS[cust.riskLevel] || 'bg-gray-100 text-gray-600'}`}>
                                            {cust.riskLevel} Risk
                                        </span>
                                    )}
                                    {cust.segment && (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                                            {cust.segment}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <StatPill label={t('callcenter.intel.trust', 'Trust')} value={<span className={TRUST_COLOR(cust.trustScore ?? 100)}>{cust.trustScore ?? 100}</span>} icon={Shield} />
                                <StatPill label={t('callcenter.intel.orders', 'Orders')} value={cust.totalOrders ?? 0} icon={ShoppingBag} />
                                <StatPill label={t('callcenter.intel.delivered', 'Delivered')} value={cust.deliveredOrders ?? 0} icon={CheckCircle} />
                                <StatPill label={t('callcenter.intel.refusals', 'Refusals')} value={cust.totalRefusals ?? 0} icon={TrendingDown} className={cust.totalRefusals > 0 ? 'border-red-200 bg-red-50' : ''} />
                                <StatPill label={t('callcenter.intel.cancelled', 'Cancelled')} value={cust.cancelledOrders ?? 0} icon={XCircle} className={cust.cancelledOrders > 2 ? 'border-amber-200 bg-amber-50' : ''} />
                                <StatPill label={t('callcenter.intel.successRate', 'Success %')} value={`${cust.deliverySuccessRate ?? 0}%`} icon={User} />
                            </div>
                        </div>
                    )}

                    {/* Dynamic Call Scripts */}
                    {intel?.callScripts?.length > 0 && (
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200 animate-in fade-in space-y-2">
                            <h4 className="font-bold text-indigo-900 mb-1 flex items-center gap-2 text-sm">
                                <MessageSquare className="w-4 h-4" />
                                {t('callcenter.drawer.playbook', 'Agent Playbook')}
                            </h4>
                            {intel.callScripts.map((cs, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-lg border border-indigo-100 text-sm shadow-sm">
                                    <span className="font-black text-indigo-700 block mb-1 text-[10px] uppercase tracking-wide">{cs.name}</span>
                                    <p className="text-slate-800 leading-snug font-medium text-[13px]">"{cs.script}"</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Previous Call History */}
                    {intel?.callHistory?.length > 0 && (
                        <div className="animate-in fade-in">
                            <h4 className="font-bold text-gray-900 mb-2 text-sm flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-gray-500" />
                                {t('callcenter.drawer.callHistory', 'Previous Calls')}
                                <span className="text-xs font-normal text-gray-400">({intel.callHistory.length})</span>
                            </h4>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                {intel.callHistory.map((call, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-xs bg-gray-50 rounded-lg p-2 border border-gray-100">
                                        <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                                            {call.callAttemptNumber || idx + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between gap-2">
                                                <span className="font-semibold text-gray-700">{call.actionType}</span>
                                                <span className="text-gray-400 shrink-0">{new Date(call.createdAt).toLocaleString()}</span>
                                            </div>
                                            {(call.agent?.name || call.note) && (
                                                <p className="text-gray-500 truncate">
                                                    {call.agent?.name}{call.note ? ` — ${call.note}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Order Items */}
                    <div>
                        <h4 className="font-bold text-gray-900 mb-3">{t('callcenter.drawer.items', 'Order Items')}</h4>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                            {items.length > 0 ? items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm font-medium text-gray-700 pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                    <div className="flex gap-2 items-start min-w-0">
                                        <span className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-xs shrink-0 font-bold">{item.quantity}×</span>
                                        <div className="min-w-0">
                                            <p className="truncate">{item.productName || item.name || t('common.product', 'Product')}</p>
                                            {item.variantName && <p className="text-xs text-gray-400 truncate">{item.variantName}</p>}
                                        </div>
                                    </div>
                                    <span className="shrink-0 ms-2">{((item.price ?? item.unitPrice ?? 0) * item.quantity).toLocaleString()} {t('common.dzd', 'DZD')}</span>
                                </div>
                            )) : (
                                <p className="text-sm text-gray-400 text-center py-2">{t('callcenter.drawer.no_items', 'No items loaded')}</p>
                            )}
                            <div className="flex justify-between items-center pt-2 font-black text-gray-900 text-lg border-t border-gray-200">
                                <span>{t('callcenter.drawer.total', 'Total COD')}</span>
                                <span>{(order.totalAmount || 0).toLocaleString()} {t('common.dzd', 'DZD')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Edit Address */}
                    {isEditingAddress && (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-bold text-amber-900 flex items-center gap-2 text-sm">
                                <MapPin className="w-4 h-4" />
                                {t('callcenter.drawer.edit_address', 'Update Delivery Info')}
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="drawer-wilaya" className="text-xs font-semibold text-amber-800 uppercase mb-1 block">{t('callcenter.lblWilaya', 'Wilaya')}</label>
                                    <input id="drawer-wilaya" value={wilaya} onChange={e => setWilaya(e.target.value)} className="w-full border border-amber-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                </div>
                                <div>
                                    <label htmlFor="drawer-commune" className="text-xs font-semibold text-amber-800 uppercase mb-1 block">{t('orders.lblCommune', 'Commune')}</label>
                                    <input id="drawer-commune" value={commune} onChange={e => setCommune(e.target.value)} className="w-full border border-amber-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="drawer-address" className="text-xs font-semibold text-amber-800 uppercase mb-1 block">{t('callcenter.lblAddress', 'Full Address')}</label>
                                <input id="drawer-address" value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-amber-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button onClick={() => setIsEditingAddress(false)} className="px-3 py-1.5 text-amber-700 text-sm font-medium hover:bg-amber-100 rounded-lg">{t('general.cancel', 'Cancel')}</button>
                                <button onClick={() => handleAction('Address_Updated')} disabled={isLoading('Address_Updated')} className="px-3 py-1.5 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 flex items-center gap-2 disabled:opacity-50">
                                    {isLoading('Address_Updated') ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {t('general.save', 'Save Address')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Postpone Panel */}
                    {isPostponing && (
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-bold text-blue-900 flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4" />
                                {t('callcenter.drawer.postpone', 'Schedule Callback')}
                            </h4>
                            <div>
                                <label htmlFor="drawer-callback-date" className="text-xs font-semibold text-blue-800 uppercase mb-1 block">{t('callcenter.lblCallbackDate', 'Callback Date')}</label>
                                <input
                                    id="drawer-callback-date"
                                    type="date"
                                    value={postponeDate}
                                    min={new Date().toISOString().slice(0, 10)}
                                    onChange={e => setPostponeDate(e.target.value)}
                                    className="w-full border border-blue-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button onClick={() => setIsPostponing(false)} className="px-3 py-1.5 text-blue-700 text-sm font-medium hover:bg-blue-100 rounded-lg">{t('general.cancel', 'Cancel')}</button>
                                <button onClick={() => handleAction('Postponed')} disabled={isLoading('Postponed')} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
                                    {isLoading('Postponed') ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                                    {t('callcenter.action.postpone_confirm', 'Set Callback')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Confirmation Quality Checklist */}
                    {showChecklist && (
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-bold text-emerald-900 flex items-center gap-2 text-sm">
                                <CheckCircle className="w-4 h-4" />
                                {t('callcenter.drawer.checklist', 'Pre-Confirmation Checklist')}
                            </h4>
                            <p className="text-xs text-emerald-700">{t('callcenter.drawer.checklistHint', 'Verify these with the customer before confirming:')}</p>
                            <div className="space-y-2">
                                {[
                                    { key: 'address', label: t('callcenter.check.address', 'Delivery address confirmed (wilaya, commune, full address)') },
                                    { key: 'phone', label: t('callcenter.check.phone', 'Phone number is correct and reachable') },
                                    { key: 'stock', label: t('callcenter.check.stock', 'Products & quantities verified with customer') },
                                ].map(({ key, label }) => (
                                    <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={checklist[key]}
                                            onChange={() => setChecklist(prev => ({ ...prev, [key]: !prev[key] }))}
                                            className="mt-0.5 w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span className={`text-sm ${checklist[key] ? 'text-emerald-800 font-semibold' : 'text-emerald-600'}`}>{label}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button onClick={() => setShowChecklist(false)} className="px-3 py-1.5 text-emerald-700 text-sm font-medium hover:bg-emerald-100 rounded-lg">
                                    {t('general.cancel', 'Cancel')}
                                </button>
                                <button
                                    onClick={() => handleAction('Confirmed')}
                                    disabled={!checklist.address || !checklist.phone || !checklist.stock || !!loadingAction}
                                    className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {isLoading('Confirmed') ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    {t('callcenter.action.confirmChecked', 'Confirm Order')}
                                    <kbd className="hidden sm:inline text-[9px] opacity-60 bg-emerald-700/40 px-1.5 py-0.5 rounded font-mono">Enter</kbd>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Interaction Note */}
                    <div>
                        <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2 text-sm">
                            <MessageSquare className="w-4 h-4 text-gray-500" />
                            {t('callcenter.drawer.call_note', 'Interaction Note')}
                            <span className="text-xs font-normal text-gray-400">{t('general.optional', '(optional)')}</span>
                        </h4>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder={t('callcenter.drawer.note_placeholder', 'E.g., Customer asked for delivery after 5 PM…')}
                            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[80px] bg-gray-50 resize-none"
                        />
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {[
                                t('callcenter.notes.call_before', 'Call before delivery'),
                                t('callcenter.notes.after_5pm', 'Deliver after 5 PM'),
                                t('callcenter.notes.morning', 'Deliver in the morning'),
                                t('callcenter.notes.leave_reception', 'Leave at reception')
                            ].map((preset, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setNote(prev => prev ? `${prev} | ${preset}` : preset)}
                                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] font-medium rounded-lg transition-colors border border-gray-200/60"
                                >
                                    + {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ─── Post-Confirmation Tools ─── */}
                    {/* Quick Dispatch (only shows for Confirmed orders) */}
                    {order.status === 'Confirmed' && (
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200 space-y-2 animate-in fade-in">
                            <h4 className="font-bold text-indigo-900 flex items-center gap-2 text-sm">
                                <Truck className="w-4 h-4" />
                                {t('callcenter.drawer.dispatch', 'Quick Dispatch')}
                            </h4>
                            <p className="text-xs text-indigo-700">
                                {t('callcenter.drawer.dispatchHint', 'Send this confirmed order directly to the courier for delivery.')}
                            </p>
                            <button
                                onClick={handleQuickDispatch}
                                disabled={dispatching}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {dispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                                {dispatching ? t('callcenter.drawer.dispatching', 'Dispatching...') : t('callcenter.drawer.dispatchNow', 'Dispatch to Courier')}
                            </button>
                        </div>
                    )}

                    {/* Tracking Timeline (toggle) */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <button
                            onClick={() => setShowTracking(!showTracking)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-bold text-gray-700"
                        >
                            <span className="flex items-center gap-2">
                                <Route className="w-4 h-4 text-gray-500" />
                                {t('callcenter.drawer.tracking', 'Order Tracking')}
                            </span>
                            <span className="text-xs text-gray-400">{showTracking ? '▲' : '▼'}</span>
                        </button>
                        {showTracking && (
                            <div className="px-4 py-3 border-t border-gray-100">
                                <TrackingTimeline orderId={order._id} isOpen={showTracking} />
                            </div>
                        )}
                    </div>

                    {/* Customer Messaging Panel (toggle) */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <button
                            onClick={() => setShowMessaging(!showMessaging)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-bold text-gray-700"
                        >
                            <span className="flex items-center gap-2">
                                <SendIcon className="w-4 h-4 text-gray-500" />
                                {t('callcenter.drawer.messaging', 'Send Customer Message')}
                            </span>
                            <span className="text-xs text-gray-400">{showMessaging ? '▲' : '▼'}</span>
                        </button>
                        {showMessaging && (
                            <div className="px-4 py-3 border-t border-gray-100">
                                <MessagePanel
                                    orderId={order._id}
                                    isOpen={showMessaging}
                                    onMessageSent={(tpl) => toast.success(`Message sent (${tpl})`, { duration: 3000 })}
                                />
                            </div>
                        )}
                    </div>

                    {/* Full Order Edit Panel (toggle) */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <button
                            onClick={() => setShowEditPanel(!showEditPanel)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-bold text-gray-700"
                        >
                            <span className="flex items-center gap-2">
                                <Save className="w-4 h-4 text-gray-500" />
                                {t('callcenter.drawer.editOrder', 'Edit Order Details')}
                            </span>
                            <span className="text-xs text-gray-400">{showEditPanel ? '▲' : '▼'}</span>
                        </button>
                        {showEditPanel && (
                            <div className="px-4 py-3 border-t border-gray-100">
                                <OrderEditPanel
                                    order={order}
                                    onSaved={onSuccess}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 sm:p-5 border-t border-gray-100 bg-white space-y-2">
                    {/* Primary: Confirm (opens checklist first) */}
                    <button
                        onClick={triggerConfirm}
                        disabled={!!loadingAction}
                        className={`w-full flex justify-center items-center gap-2 px-4 py-3 rounded-xl font-bold shadow-sm transition-all hover:shadow-md disabled:opacity-50 ${showChecklist ? 'bg-emerald-300 text-emerald-800' : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'}`}
                    >
                        {isLoading('Confirmed') ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        {showChecklist ? t('callcenter.action.checklistOpen', 'Complete Checklist Above ↑') : t('callcenter.action.confirm', 'Confirm Order')}
                        <kbd className="ml-1 text-[9px] opacity-60 bg-emerald-600/40 px-1.5 py-0.5 rounded font-mono">Enter</kbd>
                    </button>

                    {/* Secondary: No Answer + Postpone */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => handleAction('No Answer')}
                            disabled={!!loadingAction}
                            className="flex justify-center items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors disabled:opacity-50 text-sm"
                        >
                            {isLoading('No Answer') ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PhoneMissed className="w-4 h-4" />}
                            {t('callcenter.action.no_answer', 'No Answer')}
                            <kbd className="hidden sm:inline text-[9px] opacity-50 bg-gray-200 px-1 py-0.5 rounded font-mono">N</kbd>
                        </button>
                        <button
                            onClick={() => { setIsPostponing(true); setIsEditingAddress(false); }}
                            disabled={!!loadingAction}
                            className="flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl font-bold transition-colors disabled:opacity-50 text-sm"
                        >
                            <Clock className="w-4 h-4" />
                            {t('callcenter.action.postpone', 'Postpone')}
                            <kbd className="hidden sm:inline text-[9px] opacity-50 bg-blue-100 px-1 py-0.5 rounded font-mono">P</kbd>
                        </button>
                    </div>

                    {/* Tertiary: Wrong Number + Out of Coverage */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => handleAction('Wrong Number')}
                            disabled={!!loadingAction}
                            className="flex justify-center items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl font-bold transition-colors disabled:opacity-50 text-sm"
                        >
                            {isLoading('Wrong Number') ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                            {t('callcenter.action.wrong_number', 'Wrong Number')}
                            <kbd className="hidden sm:inline text-[9px] opacity-50 bg-amber-100 px-1 py-0.5 rounded font-mono">W</kbd>
                        </button>
                        <button
                            onClick={() => handleAction('Out of Coverage')}
                            disabled={!!loadingAction}
                            className="flex justify-center items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold transition-colors disabled:opacity-50 text-sm"
                        >
                            {isLoading('Out of Coverage') ? <RefreshCw className="w-4 h-4 animate-spin" /> : <WifiOff className="w-4 h-4" />}
                            {t('callcenter.action.no_coverage', 'No Coverage')}
                            <kbd className="hidden sm:inline text-[9px] opacity-50 bg-slate-100 px-1 py-0.5 rounded font-mono">O</kbd>
                        </button>
                    </div>

                    {/* Danger: Cancel */}
                    <button
                        onClick={() => handleAction('Cancelled by Customer')}
                        disabled={!!loadingAction}
                        className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 hover:border-red-600 rounded-xl font-bold transition-colors disabled:opacity-50 text-sm"
                    >
                        {isLoading('Cancelled by Customer') ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        {t('callcenter.action.cancel', 'Customer Cancelled')}
                        <kbd className="hidden sm:inline text-[9px] opacity-50 bg-red-100 px-1 py-0.5 rounded font-mono">C</kbd>
                    </button>

                    {/* Utility links */}
                    <div className="flex justify-center gap-4 pt-1">
                        {!isEditingAddress && (
                            <button
                                onClick={() => { setIsEditingAddress(true); setIsPostponing(false); }}
                                className="text-xs font-medium text-indigo-500 hover:text-indigo-700 underline underline-offset-4"
                            >
                                {t('callcenter.action.edit_address', 'Edit Address')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
