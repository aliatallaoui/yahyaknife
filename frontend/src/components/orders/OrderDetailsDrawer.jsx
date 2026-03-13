import React, { useState, useEffect, useContext } from 'react';
import { apiFetch } from '../../utils/apiFetch';
import { X, MapPin, Package, CreditCard, Truck, UserCircle, Save, Phone, Clock, FileText, CheckCircle2, Copy, Check, Lock } from 'lucide-react';
import { fmtFullDateTime } from '../../utils/dateUtils';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { ORDER_STATUS_COLORS as STATUS_COLORS, COD_STATUSES, getOrderStatusLabel } from '../../constants/statusColors';

// Click-to-copy phone with tel: fallback
function PhoneRow({ phone }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    if (!phone) return <span className="text-gray-400 dark:text-gray-500 text-sm mt-2 block">{t('common.noPhone', 'No phone number')}</span>;
    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(phone).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
    };
    return (
        <div className="mt-2 flex items-center gap-2">
            <a href={`tel:${phone}`} className="flex items-center gap-2 group flex-1">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Phone className="w-4 h-4" />
                </div>
                <span className="font-mono text-sm font-black text-gray-700 dark:text-gray-300 tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400">{phone}</span>
            </a>
            <button onClick={handleCopy} title={copied ? t('common.copied', 'Copied!') : t('common.copyNumber', 'Copy number')} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
        </div>
    );
}

// STATUS_COLORS and COD_STATUSES imported from statusColors.js

export default function OrderDetailsDrawer({ order, onClose, onUpdate }) {
    const { t } = useTranslation();
    const { hasPermission } = useContext(AuthContext);
    const [agents, setAgents] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const canEdit = hasPermission('orders.edit');
    const canChangeStatus = hasPermission('orders.status.change');

    // Editable state
    const [status, setStatus] = useState(order?.status || '');
    const [assignedAgent, setAssignedAgent] = useState(order?.assignedAgent?._id || '');
    const [internalNotes, setInternalNotes] = useState(order?.notes || '');

    useEffect(() => {
        if (order) {
            setStatus(order.status);
            setAssignedAgent(order.assignedAgent?._id || '');
            setInternalNotes(order.notes || '');
        }
    }, [order]);

    // Escape key to close drawer
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    useEffect(() => {
        const fetchDeps = async () => {
            try {
                const usrRes = await apiFetch('/api/call-center/agents');
                const usrData = await usrRes.json();
                setAgents((usrData.data ?? usrData) || []);
            } catch (err) { /* agent list fetch is best-effort */ }
        };
        fetchDeps();
    }, []);

    if (!order) return null;

    const handleSavePrimary = async () => {
        setSaving(true);
        try {
            const res = await apiFetch(`/api/sales/orders/${order._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    assignedAgent: assignedAgent || null,
                    notes: internalNotes
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Save failed');

            if (onUpdate) onUpdate(data);
            onClose();
        } catch (err) {
            setSaveError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />

            {/* Drawer */}
            <div className="fixed top-0 end-0 bottom-0 w-full sm:max-w-lg bg-gray-50 dark:bg-gray-900 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 border-s border-gray-200 dark:border-gray-700" role="dialog" aria-modal="true">

                {/* Header */}
                <div className="bg-white dark:bg-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 shrink-0">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{order.orderId}</h2>
                            <span className={clsx("px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wide border", STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600')}>
                                {getOrderStatusLabel(t, order.status)}
                            </span>
                        </div>
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {fmtFullDateTime(order.createdAt)}
                        </span>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body scrollable content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Quick Action Operations */}
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-blue-100 dark:border-blue-800 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-bl-full -z-10 opacity-50 pointer-events-none"></div>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                            <CheckCircle2 className="w-4 h-4 text-blue-500" /> {t('ordersControl.drawer.operationalControls', { defaultValue: 'Operational Controls' })}
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('ordersControl.drawer.updateLifecycle', { defaultValue: 'Update Lifecycle' })}</label>
                                <select value={status} onChange={e => setStatus(e.target.value)} disabled={!canChangeStatus} className={clsx("bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors", !canChangeStatus && "opacity-60 cursor-not-allowed")}>
                                    {COD_STATUSES.map(s => <option key={s} value={s}>{getOrderStatusLabel(t, s)}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('ordersControl.drawer.assignAgent', { defaultValue: 'Assign Call Center Agent' })}</label>
                                <select value={assignedAgent} onChange={e => setAssignedAgent(e.target.value)} disabled={!canEdit} className={clsx("bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 transition-colors", !canEdit && "opacity-60 cursor-not-allowed")}>
                                    <option value="">{t('ordersControl.bulk.unassignAgent', { defaultValue: 'Unassigned' })}</option>
                                    {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                                </select>
                                {order?.assignmentMode && (
                                    <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border w-fit ${
                                        { manual: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700', product: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700', store: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700', round_robin: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700', claim: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' }[order.assignmentMode] || 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                                    }`}>
                                        {t(`callcenter.mode.${order.assignmentMode}`, order.assignmentMode.replace('_', ' '))}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('ordersControl.drawer.internalNotes', { defaultValue: 'Internal Order Notes' })}</label>
                            <textarea
                                value={internalNotes}
                                onChange={e => setInternalNotes(e.target.value)}
                                rows={2}
                                disabled={!canEdit}
                                className={clsx("bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 w-full resize-none transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-500", !canEdit && "opacity-60 cursor-not-allowed")}
                                placeholder={t('ordersControl.drawer.notesPlaceholder', { defaultValue: 'Add instructions for courier or call center...' })}
                            />
                        </div>
                    </div>

                    {/* Customer & Location Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-3">
                            <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                <UserCircle className="w-4 h-4" /> {t('ordersControl.details.customerInfo', { defaultValue: 'Customer Identity' })}
                            </h3>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{order.customer?.name || order.shipping?.firstName || 'Walk-in'}</p>
                                <PhoneRow phone={order.customer?.phone || order.shipping?.phone1} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-3">
                            <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                <MapPin className="w-4 h-4" /> {t('ordersControl.drawer.locationAndDelivery', { defaultValue: 'Location & Delivery' })}
                            </h3>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-gray-100 text-sm tracking-tight">{order.wilaya || order.shipping?.wilayaName || t('ordersControl.drawer.unspecifiedWilaya', { defaultValue: 'Unspecified Wilaya' })}</p>
                                <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{order.commune || order.shipping?.commune || t('ordersControl.drawer.unspecifiedCommune', { defaultValue: 'Unspecified Commune' })}</p>
                                {order.shipping?.address1 && (
                                    <p className="text-gray-600 dark:text-gray-300 text-xs mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-100 dark:border-gray-600">{order.shipping.address1}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Products Included */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                            <Package className="w-4 h-4" /> {t('ordersControl.drawer.productsPayload', { defaultValue: 'Products Payload' })}
                        </h3>
                        <div className="flex flex-col gap-2 divide-y divide-gray-50 dark:divide-gray-700">
                            {order.products?.map((prod, idx) => (
                                <div key={idx} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate max-w-[250px]">{prod.name}</span>
                                        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('ordersControl.grid.qty', { defaultValue: 'Qty' })}: {prod.quantity} × {(prod.unitPrice || 0).toLocaleString()} {t('common.dzd', 'DZD')}</span>
                                    </div>
                                    <span className="font-black text-gray-900 dark:text-gray-100 text-sm">{(prod.quantity * (prod.unitPrice || 0)).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Financials & Courier */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4" /> {t('ordersControl.drawer.financials', { defaultValue: 'Financials' })}
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-700">
                                {t(`sales.payment${(order.paymentStatus || 'Unpaid').replace(/\s+/g, '')}`) || order.paymentStatus || 'Unpaid'}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-500 dark:text-gray-400">{t('ordersControl.drawer.subtotal', { defaultValue: 'Subtotal' })}</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{(order.totalAmount - (order.shipping?.cost || 0)).toLocaleString()} {t('common.dzd', 'DZD')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-500 dark:text-gray-400">{t('ordersControl.drawer.deliveryFee', { defaultValue: 'Delivery Fee' })}</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{(order.shipping?.cost || 0).toLocaleString()} {t('common.dzd', 'DZD')}</span>
                        </div>
                        <div className="pt-3 border-t border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-between">
                            <span className="font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest">{t('ordersControl.grid.totalValue', { defaultValue: 'Total Value' })}</span>
                            <span className="font-black text-xl text-blue-600 dark:text-blue-400">{(order.totalAmount || 0).toLocaleString()} <span className="text-xs">{t('common.dzd', 'DZD')}</span></span>
                        </div>

                        {/* Selected Courier Reference */}
                        <div className="mt-2 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('ordersControl.drawer.aggregator', { defaultValue: 'Aggregator' })}</span>
                            </div>
                            {order.courier ? (
                                <span className="text-xs font-black text-gray-900 dark:text-gray-100 tracking-tight">{order.courier.name}</span>
                            ) : (
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 rounded uppercase border border-amber-100 dark:border-amber-700">{t('ordersControl.drawer.notDispatched', { defaultValue: 'Not Dispatched' })}</span>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer Action */}
                {saveError && (
                    <div className="mx-6 mb-2 px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                        <span className="shrink-0">⚠</span>
                        <span>{saveError}</span>
                        <button onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-700 dark:hover:text-red-300">✕</button>
                    </div>
                )}
                <div className="bg-white dark:bg-gray-800 px-6 py-4 border-t border-gray-100 dark:border-gray-700 shrink-0 flex items-center justify-between">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        {t('ordersControl.bulk.cancel', { defaultValue: 'Discard' })}
                    </button>
                    {(canEdit || canChangeStatus) ? (
                        <button
                            onClick={handleSavePrimary}
                            disabled={saving}
                            className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving ? (
                                <><div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div> {t('ordersControl.grid.updating', { defaultValue: 'Saving...' })}</>
                            ) : (
                                <><Save className="w-4 h-4" /> {t('ordersControl.drawer.saveOperations', { defaultValue: 'Save Operations' })}</>
                            )}
                        </button>
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 dark:text-gray-500">
                            <Lock className="w-3.5 h-3.5" /> {t('ordersControl.drawer.readOnly', { defaultValue: 'Read Only' })}
                        </span>
                    )}
                </div>

            </div>
        </>
    );
}
