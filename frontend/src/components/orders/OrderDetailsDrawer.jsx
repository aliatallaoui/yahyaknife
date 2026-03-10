import React, { useState, useEffect } from 'react';
import axios from 'axios';
import moment from 'moment';
import { X, MapPin, Package, CreditCard, Truck, UserCircle, Save, Phone, Clock, FileText, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

const COD_STATUSES = ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'];

const STATUS_COLORS = {
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

export default function OrderDetailsDrawer({ order, onClose, onUpdate }) {
    const { t } = useTranslation();
    const [agents, setAgents] = useState([]);
    const [saving, setSaving] = useState(false);

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

    useEffect(() => {
        const fetchDeps = async () => {
            try {
                const token = localStorage.getItem('token');
                const usrRes = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
                setAgents((usrRes.data || []).filter(u => ['Admin', 'Call Center Agent'].includes(u.role)));
            } catch (err) { console.error(err); }
        };
        fetchDeps();
    }, []);

    if (!order) return null;

    const handleSavePrimary = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/${order._id}`, {
                status,
                assignedAgent: assignedAgent || null,
                notes: internalNotes
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (onUpdate) onUpdate(res.data);
            onClose();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />

            {/* Drawer */}
            <div className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-gray-50 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-200">

                {/* Header */}
                <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 shrink-0">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xl font-black text-gray-900 tracking-tight">{order.orderId}</h2>
                            <span className={clsx("px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wide border", STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600 border-gray-200')}>
                                {order.status}
                            </span>
                        </div>
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {moment(order.date).format('MMMM Do YYYY, h:mm a')}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body scrollable content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Quick Action Operations */}
                    <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 opacity-50 pointer-events-none"></div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <CheckCircle2 className="w-4 h-4 text-blue-500" /> Operational Controls
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Update Lifecycle</label>
                                <select value={status} onChange={e => setStatus(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors">
                                    {COD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Assign Call Center Agent</label>
                                <select value={assignedAgent} onChange={e => setAssignedAgent(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors">
                                    <option value="">Unassigned</option>
                                    {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Internal Order Notes</label>
                            <textarea
                                value={internalNotes}
                                onChange={e => setInternalNotes(e.target.value)}
                                rows={2}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-blue-500 w-full resize-none transition-colors placeholder:text-gray-300"
                                placeholder="Add instructions for courier or call center..."
                            />
                        </div>
                    </div>

                    {/* Customer & Location Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-3">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <UserCircle className="w-4 h-4 text-gray-400" /> Customer Identity
                            </h3>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">{order.customer?.name || order.shipping?.firstName || 'Walk-in'}</p>
                                <div className="mt-2 flex items-center gap-2 group cursor-pointer" onClick={() => {
                                    const phone = order.customer?.phone || order.shipping?.phone1;
                                    if (phone) window.open(`tel:${phone}`);
                                }}>
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <Phone className="w-4 h-4" />
                                    </div>
                                    <span className="font-mono text-sm font-black text-gray-700 tracking-tight group-hover:text-blue-600">{order.customer?.phone || order.shipping?.phone1 || 'No Phone'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-3">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <MapPin className="w-4 h-4 text-gray-400" /> Location & Delivery
                            </h3>
                            <div>
                                <p className="font-bold text-gray-900 text-sm tracking-tight">{order.wilaya || 'Unspecified Wilaya'}</p>
                                <p className="text-gray-500 text-xs mt-0.5">{order.commune || 'Unspecified Commune'}</p>
                                {order.shipping?.address1 && (
                                    <p className="text-gray-600 text-xs mt-2 p-2 bg-gray-50 rounded-md border border-gray-100">{order.shipping.address1}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Products Included */}
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                            <Package className="w-4 h-4 text-gray-400" /> Products Payload
                        </h3>
                        <div className="flex flex-col gap-2 divide-y divide-gray-50">
                            {order.products?.map((prod, idx) => (
                                <div key={idx} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800 text-sm truncate max-w-[250px]">{prod.name}</span>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Qty: {prod.quantity} × {(prod.unitPrice || 0).toLocaleString()} DZD</span>
                                    </div>
                                    <span className="font-black text-gray-900 text-sm">{(prod.quantity * (prod.unitPrice || 0)).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Financials & Courier */}
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4 text-gray-400" /> Financials
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100">
                                {order.paymentStatus || 'Unpaid'}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-500">Subtotal</span>
                            <span className="font-bold text-gray-800">{(order.totalAmount - (order.shipping?.cost || 0)).toLocaleString()} DZD</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-500">Delivery Fee</span>
                            <span className="font-bold text-gray-800">{(order.shipping?.cost || 0).toLocaleString()} DZD</span>
                        </div>
                        <div className="pt-3 border-t border-dashed border-gray-200 flex items-center justify-between">
                            <span className="font-black text-gray-900 uppercase tracking-widest">Total Value</span>
                            <span className="font-black text-xl text-blue-600">{(order.totalAmount || 0).toLocaleString()} <span className="text-xs">DZD</span></span>
                        </div>

                        {/* Selected Courier Reference */}
                        <div className="mt-2 pt-3 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-gray-400" />
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Aggregator</span>
                            </div>
                            {order.courier ? (
                                <span className="text-xs font-black text-gray-900 tracking-tight">{order.courier.name}</span>
                            ) : (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 rounded uppercase border border-amber-100">Not Dispatched</span>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer Action */}
                <div className="bg-white px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                        Discard
                    </button>
                    <button
                        onClick={handleSavePrimary}
                        disabled={saving}
                        className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <><div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div> Saving...</>
                        ) : (
                            <><Save className="w-4 h-4" /> Save Operations</>
                        )}
                    </button>
                </div>

            </div>
        </>
    );
}
