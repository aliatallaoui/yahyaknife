import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Save, Loader2, Package, CreditCard, MapPin, Tag, AlertTriangle,
    Shield, Truck, FileText, Plus, Trash2, ChevronDown, ChevronUp,
    Phone, Star, Printer
} from 'lucide-react';
import clsx from 'clsx';
import { apiFetch } from '../../utils/apiFetch';
import toast from 'react-hot-toast';
import { COD_STATUSES, getOrderStatusLabel } from '../../constants/statusColors';

const PRIORITIES = ['Normal', 'High Priority', 'Urgent', 'VIP'];
const PRIORITY_COLORS = {
    Normal: 'bg-gray-100 text-gray-600 border-gray-200',
    'High Priority': 'bg-amber-50 text-amber-700 border-amber-200',
    Urgent: 'bg-red-50 text-red-700 border-red-200',
    VIP: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function OrderEditPanel({ order, onSaved }) {
    const { t } = useTranslation();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Sections toggle
    const [openSection, setOpenSection] = useState(null);
    const toggle = (s) => setOpenSection(openSection === s ? null : s);

    // Editable state (initialized from order)
    const [status, setStatus] = useState(order?.status || '');
    const [priority, setPriority] = useState(order?.priority || 'Normal');
    const [tags, setTags] = useState(order?.tags?.join(', ') || '');
    const [notes, setNotes] = useState(order?.notes || '');
    const [phone1, setPhone1] = useState(order?.shipping?.phone1 || '');
    const [phone2, setPhone2] = useState(order?.shipping?.phone2 || '');
    const [wilaya, setWilaya] = useState(order?.shipping?.wilayaName || order?.wilaya || '');
    const [commune, setCommune] = useState(order?.shipping?.commune || order?.commune || '');
    const [address, setAddress] = useState(order?.shipping?.address || '');
    const [products, setProducts] = useState(
        (order?.products || []).map(p => ({ ...p }))
    );
    const [discount, setDiscount] = useState(order?.discount || order?.financials?.discount || 0);

    // Courier/label
    const [labelLoading, setLabelLoading] = useState(false);

    useEffect(() => {
        if (order) {
            setStatus(order.status || '');
            setPriority(order.priority || 'Normal');
            setTags(order.tags?.join(', ') || '');
            setNotes(order.notes || '');
            setPhone1(order.shipping?.phone1 || '');
            setPhone2(order.shipping?.phone2 || '');
            setWilaya(order.shipping?.wilayaName || order.wilaya || '');
            setCommune(order.shipping?.commune || order.commune || '');
            setAddress(order.shipping?.address || '');
            setProducts((order.products || []).map(p => ({ ...p })));
            setDiscount(order.discount || order.financials?.discount || 0);
        }
    }, [order?._id]);

    if (!order) return null;

    const subtotal = products.reduce((s, p) => s + (p.quantity || 0) * (p.unitPrice || 0), 0);
    const courierFee = order.financials?.courierFee || 0;
    const total = subtotal + courierFee - (discount || 0);

    const handleProductChange = (idx, field, value) => {
        setProducts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: field === 'name' ? value : Number(value) || 0 } : p));
    };

    const addProduct = () => {
        setProducts(prev => [...prev, { name: '', quantity: 1, unitPrice: 0, variantId: null }]);
    };

    const removeProduct = (idx) => {
        setProducts(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const updateData = {};

            // Status change
            if (status !== order.status) updateData.status = status;

            // Priority
            if (priority !== (order.priority || 'Normal')) updateData.priority = priority;

            // Tags
            const newTags = tags.split(',').map(t => t.trim()).filter(Boolean);
            const oldTags = order.tags || [];
            if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) updateData.tags = newTags;

            // Notes
            if (notes !== (order.notes || '')) updateData.notes = notes;

            // Shipping
            const shippingUpdate = {};
            if (phone1 !== (order.shipping?.phone1 || '')) shippingUpdate.phone1 = phone1;
            if (phone2 !== (order.shipping?.phone2 || '')) shippingUpdate.phone2 = phone2;
            if (wilaya !== (order.shipping?.wilayaName || order.wilaya || '')) shippingUpdate.wilayaName = wilaya;
            if (commune !== (order.shipping?.commune || order.commune || '')) shippingUpdate.commune = commune;
            if (address !== (order.shipping?.address || '')) shippingUpdate.address = address;
            if (Object.keys(shippingUpdate).length > 0) updateData.shipping = { ...(order.shipping || {}), ...shippingUpdate };

            // Products
            const prodsChanged = JSON.stringify(products.map(p => ({ name: p.name, quantity: p.quantity, unitPrice: p.unitPrice, variantId: p.variantId }))) !==
                JSON.stringify((order.products || []).map(p => ({ name: p.name, quantity: p.quantity, unitPrice: p.unitPrice, variantId: p.variantId })));
            if (prodsChanged) updateData.products = products;

            // Discount
            if (discount !== (order.discount || order.financials?.discount || 0)) {
                updateData.financials = { ...(order.financials || {}), discount };
            }

            if (Object.keys(updateData).length === 0) {
                toast('No changes to save', { icon: 'ℹ️' });
                setSaving(false);
                return;
            }

            const res = await apiFetch(`/api/sales/orders/${order._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Save failed');
            }

            toast.success('Order updated', { duration: 3000 });
            if (onSaved) onSaved();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePrintLabel = async () => {
        setLabelLoading(true);
        try {
            // Find shipment for this order
            const res = await apiFetch(`/api/call-center/tracking/${order._id}`);
            const json = await res.json();
            const data = json.data ?? json;
            const labelUrl = data.shipment?.labelUrl;
            if (labelUrl) {
                window.open(labelUrl, '_blank');
            } else {
                toast.error('No shipping label available');
            }
        } catch {
            toast.error('Failed to fetch label');
        } finally {
            setLabelLoading(false);
        }
    };

    const Section = ({ id, icon: Icon, title, children }) => {
        const open = openSection === id;
        return (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggle(id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-bold text-gray-700"
                >
                    <span className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-gray-500" />
                        {title}
                    </span>
                    {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                </button>
                {open && <div className="px-4 py-3 border-t border-gray-100 space-y-3">{children}</div>}
            </div>
        );
    };

    return (
        <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Full Order Control
            </h4>

            {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{error}</span>
                </div>
            )}

            {/* Status & Priority */}
            <Section id="status" icon={Shield} title="Status & Priority">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Status</label>
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 font-semibold"
                        >
                            {COD_STATUSES.map(s => (
                                <option key={s} value={s}>{getOrderStatusLabel(t, s)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Priority</label>
                        <div className="flex flex-wrap gap-1">
                            {PRIORITIES.map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPriority(p)}
                                    className={clsx(
                                        'px-2 py-1 rounded-md text-[10px] font-bold border transition-all',
                                        priority === p ? PRIORITY_COLORS[p] + ' ring-2 ring-indigo-400' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                    )}
                                >
                                    {p === 'VIP' && <Star className="w-2.5 h-2.5 inline mr-0.5" />}
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Tags (comma-separated)</label>
                    <input
                        value={tags}
                        onChange={e => setTags(e.target.value)}
                        placeholder="e.g. VIP, Fragile, Rush"
                        className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {['Escalated', 'VIP', 'Fragile', 'Rush', 'High Risk'].map(tag => (
                            <button
                                key={tag}
                                onClick={() => {
                                    const current = tags.split(',').map(t => t.trim()).filter(Boolean);
                                    if (current.includes(tag)) {
                                        setTags(current.filter(t => t !== tag).join(', '));
                                    } else {
                                        setTags([...current, tag].join(', '));
                                    }
                                }}
                                className={clsx(
                                    'px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors',
                                    tags.split(',').map(t => t.trim()).includes(tag)
                                        ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                )}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            </Section>

            {/* Shipping & Contact */}
            <Section id="shipping" icon={MapPin} title="Shipping & Contact">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> Phone 1</label>
                        <input value={phone1} onChange={e => setPhone1(e.target.value)} className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/30" dir="ltr" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> Phone 2</label>
                        <input value={phone2} onChange={e => setPhone2(e.target.value)} placeholder="Optional" className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/30" dir="ltr" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Wilaya</label>
                        <input value={wilaya} onChange={e => setWilaya(e.target.value)} className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/30" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Commune</label>
                        <input value={commune} onChange={e => setCommune(e.target.value)} className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/30" />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Full Address</label>
                    <input value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500/30" />
                </div>
            </Section>

            {/* Products & Pricing */}
            <Section id="products" icon={Package} title="Products & Pricing">
                <div className="space-y-2">
                    {products.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
                            <input
                                value={p.name || ''}
                                onChange={e => handleProductChange(idx, 'name', e.target.value)}
                                placeholder="Product name"
                                className="flex-1 min-w-0 border border-gray-200 rounded-md text-xs px-2 py-1.5 bg-white focus:ring-1 focus:ring-indigo-500/30"
                            />
                            <input
                                type="number"
                                value={p.quantity || ''}
                                onChange={e => handleProductChange(idx, 'quantity', e.target.value)}
                                min="1"
                                className="w-14 border border-gray-200 rounded-md text-xs px-2 py-1.5 bg-white text-center focus:ring-1 focus:ring-indigo-500/30"
                                placeholder="Qty"
                            />
                            <input
                                type="number"
                                value={p.unitPrice || ''}
                                onChange={e => handleProductChange(idx, 'unitPrice', e.target.value)}
                                min="0"
                                className="w-20 border border-gray-200 rounded-md text-xs px-2 py-1.5 bg-white text-end focus:ring-1 focus:ring-indigo-500/30"
                                placeholder="Price"
                            />
                            <span className="text-[10px] text-gray-400 font-mono w-16 text-end shrink-0">{((p.quantity || 0) * (p.unitPrice || 0)).toLocaleString()}</span>
                            {products.length > 1 && (
                                <button onClick={() => removeProduct(idx)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                    <button onClick={addProduct} className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700">
                        <Plus className="w-3 h-3" /> Add product
                    </button>
                </div>

                <div className="border-t border-gray-200 pt-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Subtotal</span>
                        <span className="font-mono">{subtotal.toLocaleString()} DZD</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Courier Fee</span>
                        <span className="font-mono">{courierFee.toLocaleString()} DZD</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Discount</span>
                        <input
                            type="number"
                            value={discount}
                            onChange={e => setDiscount(Number(e.target.value) || 0)}
                            min="0"
                            className="w-20 border border-gray-200 rounded text-xs px-2 py-1 bg-white text-end focus:ring-1 focus:ring-indigo-500/30"
                        />
                    </div>
                    <div className="flex justify-between text-sm font-black text-gray-900 pt-1.5 border-t border-dashed border-gray-200">
                        <span>Total COD</span>
                        <span>{total.toLocaleString()} DZD</span>
                    </div>
                </div>
            </Section>

            {/* Notes & Courier */}
            <Section id="notes" icon={FileText} title="Notes & Courier">
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Internal Notes</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Notes visible to all agents..."
                        rows={3}
                        className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white resize-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                </div>
                {/* Label printing */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Truck className="w-3.5 h-3.5" />
                        <span className="font-semibold">{order.courier?.name || 'No courier assigned'}</span>
                    </div>
                    <button
                        onClick={handlePrintLabel}
                        disabled={labelLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                        {labelLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                        Print Label
                    </button>
                </div>
            </Section>

            {/* Save */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-sm"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    );
}
