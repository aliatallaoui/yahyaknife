import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X, PhoneCall, CheckCircle, XCircle, MapPin,
    Save, MessageSquare, AlertTriangle, RefreshCw,
    Clock, PhoneMissed, WifiOff, Phone
} from 'lucide-react';
import axios from 'axios';

export default function OrderActionDrawer({ order, onClose, onSuccess }) {
    const { t } = useTranslation();
    const [note, setNote] = useState('');
    const [loadingAction, setLoadingAction] = useState(null);
    const [error, setError] = useState(null);
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [isPostponing, setIsPostponing] = useState(false);

    // Address edit state — use correct field paths from Order.shipping subdocument
    const [address, setAddress]   = useState(order?.shipping?.address || '');
    const [wilaya, setWilaya]     = useState(order?.shipping?.wilayaName || order?.wilaya || '');
    const [commune, setCommune]   = useState(order?.shipping?.commune || order?.commune || '');

    // Postpone state
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const [postponeDate, setPostponeDate] = useState(tomorrow.toISOString().slice(0, 10));

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

            await axios.post(
                `${import.meta.env.VITE_API_URL || ''}/api/call-center/log-call`,
                payload,
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || err.message || t('callcenter.actionFailed', 'Action failed'));
        } finally {
            setLoadingAction(null);
        }
    };

    // Customer display — Customer model uses `name` (single field), not firstName/lastName
    const customerName  = order.customer?.name || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Unknown';
    const customerPhone = order.customer?.phone || order.shipping?.phone1 || '';
    const orderId       = order.orderId || order.orderNumber || order._id?.slice(-6);
    const shippingWilaya   = order.shipping?.wilayaName || order.wilaya || '';
    const shippingCommune  = order.shipping?.commune || order.commune || '';
    const shippingAddress  = order.shipping?.address || order.shippingAddress || '';

    // Order items — stored as `products` array in Order model
    const items = order.products || order.items || [];

    const isLoading = (action) => loadingAction === action;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right">

                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{t('callcenter.drawer.title', 'Process Order')}</h2>
                        <p className="text-gray-500 text-sm font-mono font-medium">{orderId}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
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

                    {/* Customer Card */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0">
                                {customerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-900 text-base truncate">{customerName}</h3>
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

                    {/* Order Items — field: order.products, item.productName, item.price */}
                    <div>
                        <h4 className="font-bold text-gray-900 mb-3">{t('callcenter.drawer.items', 'Order Items')}</h4>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                            {items.length > 0 ? items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm font-medium text-gray-700 pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                    <div className="flex gap-2 items-start min-w-0">
                                        <span className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-xs shrink-0 font-bold">{item.quantity}×</span>
                                        <div className="min-w-0">
                                            <p className="truncate">{item.productName || item.name || 'Product'}</p>
                                            {item.variantName && <p className="text-xs text-gray-400 truncate">{item.variantName}</p>}
                                        </div>
                                    </div>
                                    <span className="shrink-0 ms-2">{((item.price ?? item.unitPrice ?? 0) * item.quantity).toLocaleString()} DZD</span>
                                </div>
                            )) : (
                                <p className="text-sm text-gray-400 text-center py-2">{t('callcenter.drawer.no_items', 'No items loaded')}</p>
                            )}
                            <div className="flex justify-between items-center pt-2 font-black text-gray-900 text-lg border-t border-gray-200">
                                <span>{t('callcenter.drawer.total', 'Total COD')}</span>
                                <span>{(order.totalAmount || 0).toLocaleString()} DZD</span>
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
                                    <label className="text-xs font-semibold text-amber-800 uppercase mb-1 block">{t('callcenter.lblWilaya', 'Wilaya')}</label>
                                    <input value={wilaya} onChange={e => setWilaya(e.target.value)} className="w-full border border-amber-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-amber-800 uppercase mb-1 block">{t('orders.lblCommune', 'Commune')}</label>
                                    <input value={commune} onChange={e => setCommune(e.target.value)} className="w-full border border-amber-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-amber-800 uppercase mb-1 block">{t('callcenter.lblAddress', 'Full Address')}</label>
                                <input value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-amber-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
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
                                <label className="text-xs font-semibold text-blue-800 uppercase mb-1 block">{t('callcenter.lblCallbackDate', 'Callback Date')}</label>
                                <input
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
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-gray-100 bg-white space-y-2">
                    {/* Primary: Confirm */}
                    <button
                        onClick={() => handleAction('Confirmed')}
                        disabled={!!loadingAction}
                        className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-sm shadow-emerald-500/20 transition-all hover:shadow-md disabled:opacity-50"
                    >
                        {isLoading('Confirmed') ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        {t('callcenter.action.confirm', 'Confirm Order')}
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
                        </button>
                        <button
                            onClick={() => { setIsPostponing(true); setIsEditingAddress(false); }}
                            disabled={!!loadingAction}
                            className="flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl font-bold transition-colors disabled:opacity-50 text-sm"
                        >
                            <Clock className="w-4 h-4" />
                            {t('callcenter.action.postpone', 'Postpone')}
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
                        </button>
                        <button
                            onClick={() => handleAction('Out of Coverage')}
                            disabled={!!loadingAction}
                            className="flex justify-center items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold transition-colors disabled:opacity-50 text-sm"
                        >
                            {isLoading('Out of Coverage') ? <RefreshCw className="w-4 h-4 animate-spin" /> : <WifiOff className="w-4 h-4" />}
                            {t('callcenter.action.no_coverage', 'No Coverage')}
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
