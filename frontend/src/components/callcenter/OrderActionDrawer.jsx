import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X, PhoneCall, CheckCircle, XCircle, MapPin,
    Save, MessageSquare, AlertTriangle
} from 'lucide-react';
import axios from 'axios';

export default function OrderActionDrawer({ order, onClose, onSuccess }) {
    const { t } = useTranslation();
    const [note, setNote] = useState('');
    const [loadingAction, setLoadingAction] = useState(null);
    const [isEditingAddress, setIsEditingAddress] = useState(false);

    // Address Edit State
    const [address, setAddress] = useState(order?.shippingAddress || '');
    const [wilaya, setWilaya] = useState(order?.wilaya || '');
    const [commune, setCommune] = useState(order?.commune || '');

    if (!order) return null;

    const handleAction = async (actionType) => {
        setLoadingAction(actionType);
        try {
            const payload = {
                orderId: order._id,
                actionType,
                note
            };

            if (actionType === 'Address_Updated') {
                payload.newAddress = address;
                payload.newWilaya = wilaya;
                payload.newCommune = commune;
            }

            // In production, hits POST /api/call-center/log-call
            const response = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/call-center/log-call`, payload, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            onSuccess(); // Close drawer & refresh parent 
        } catch (error) {
            console.error("Action Error", error);
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right">

                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{t('callcenter.drawer.title', 'Process Order')}</h2>
                        <p className="text-gray-500 text-sm font-medium">{order.orderNumber}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">

                    {/* Customer Info Card */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0">
                                {order.customer?.firstName?.charAt(0) || 'U'}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-lg">
                                    {order.customer?.firstName} {order.customer?.lastName}
                                </h3>
                                <div className="mt-2 space-y-2">
                                    <div className="flex items-center gap-2 text-indigo-700 font-medium bg-white px-3 py-1.5 rounded-lg border border-indigo-100 inline-flex shadow-sm">
                                        <PhoneCall className="w-4 h-4" />
                                        <a href={`tel:${order.customer?.phone}`}>{order.customer?.phone || 'No Phone Number'}</a>
                                    </div>
                                    <div className="flex items-start gap-2 text-gray-600 text-sm pt-1">
                                        <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                        <span>{order.wilaya}, {order.commune}<br />{order.shippingAddress}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Order Details */}
                    <div>
                        <h4 className="font-bold text-gray-900 mb-3">{t('callcenter.drawer.items', 'Order Items')}</h4>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                            {order.items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm font-medium text-gray-700 pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                    <div className="flex gap-2 items-center">
                                        <span className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-xs">{item.quantity}x</span>
                                        <span>{item.name || 'Product'}</span>
                                    </div>
                                    <span>{(item.unitPrice * item.quantity).toLocaleString()} DZD</span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center pt-2 font-black text-gray-900 text-lg">
                                <span>{t('callcenter.drawer.total', 'Total COD')}</span>
                                <span>{order.totalAmount?.toLocaleString()} DZD</span>
                            </div>
                        </div>
                    </div>

                    {/* Edit Address Section */}
                    {isEditingAddress && (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-bold text-amber-900 flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                {t('callcenter.drawer.edit_address', 'Update Delivery Info')}
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-amber-800 uppercase mb-1 block">Wilaya</label>
                                    <input value={wilaya} onChange={e => setWilaya(e.target.value)} className="w-full border-amber-200 rounded-md text-sm px-3 py-2 bg-white" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-amber-800 uppercase mb-1 block">Commune</label>
                                    <input value={commune} onChange={e => setCommune(e.target.value)} className="w-full border-amber-200 rounded-md text-sm px-3 py-2 bg-white" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-amber-800 uppercase mb-1 block">Full Address</label>
                                <input value={address} onChange={e => setAddress(e.target.value)} className="w-full border-amber-200 rounded-md text-sm px-3 py-2 bg-white" />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsEditingAddress(false)} className="px-3 py-1.5 text-amber-700 text-sm font-medium hover:bg-amber-100 rounded-md">{t('general.cancel', 'Cancel')}</button>
                                <button onClick={() => handleAction('Address_Updated')} disabled={loadingAction === 'Address_Updated'} className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 flex items-center gap-2">
                                    {loadingAction === 'Address_Updated' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {t('general.save', 'Save Address')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Interaction Note */}
                    <div>
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-gray-500" />
                            {t('callcenter.drawer.call_note', 'Interaction Note (Optional)')}
                        </h4>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={t('callcenter.drawer.note_placeholder', 'E.g., Customer asked for delivery after 5 PM...')}
                            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px] bg-gray-50"
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-gray-100 bg-white grid grid-cols-2 gap-3">
                    <button
                        onClick={() => handleAction('Cancelled')}
                        disabled={loadingAction === 'Cancelled'}
                        className="flex justify-center items-center gap-2 px-4 py-3 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                    >
                        {loadingAction === 'Cancelled' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                        {t('callcenter.action.cancel', 'Cancel Order')}
                    </button>

                    <button
                        onClick={() => handleAction('Confirmed')}
                        disabled={loadingAction === 'Confirmed'}
                        className="flex justify-center items-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-sm shadow-emerald-500/20 transition-all hover:shadow-md disabled:opacity-50"
                    >
                        {loadingAction === 'Confirmed' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        {t('callcenter.action.confirm', 'Confirm Order')}
                    </button>

                    <button
                        onClick={() => handleAction('Called_NoAnswer')}
                        disabled={loadingAction === 'Called_NoAnswer'}
                        className="col-span-2 flex justify-center items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors mt-1 disabled:opacity-50"
                    >
                        {loadingAction === 'Called_NoAnswer' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
                        {t('callcenter.action.no_answer', 'Log No Answer')}
                    </button>

                    {!isEditingAddress && (
                        <button
                            onClick={() => setIsEditingAddress(true)}
                            className="col-span-2 text-center text-sm font-medium text-indigo-600 hover:text-indigo-800 pt-2 pb-1 underline underline-offset-4"
                        >
                            {t('callcenter.action.edit_address', 'Edit Shipping Address')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
