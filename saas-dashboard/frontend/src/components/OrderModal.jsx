import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import moment from 'moment';

const CHANNELS = ['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Other'];
const STATUSES = ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'];
const PAYMENT_STATUSES = ['Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded'];

export default function OrderModal({ isOpen, onClose, onSubmit, initialData, inventoryProducts = [], customers = [], couriers = [] }) {
    const isEdit = !!initialData;

    // Form state
    const [orderId, setOrderId] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [courierId, setCourierId] = useState('');
    const [channel, setChannel] = useState('Website');
    const [status, setStatus] = useState('New');
    const [paymentStatus, setPaymentStatus] = useState('Unpaid');
    const [fulfillmentStatus, setFulfillmentStatus] = useState('Unfulfilled');
    const [fulfillmentPipeline, setFulfillmentPipeline] = useState('Pending');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(moment().format('YYYY-MM-DD'));
    const [codAmount, setCodAmount] = useState(0);
    const [courierFee, setCourierFee] = useState(0);

    // Dynamic products array
    const [products, setProducts] = useState([{ variantId: '', name: '', quantity: 1, unitPrice: 0, availableStock: null }]);

    // Flatten inventory products to variants
    const availableVariants = inventoryProducts.flatMap(p => {
        if (!p.variants || p.variants.length === 0) return [];
        return p.variants.map(v => {
            let attrStr = '';
            if (v.attributes) {
                attrStr = Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ');
            }
            const stock = (v.totalStock || 0) - (v.reservedStock || 0);
            return {
                variantId: v._id,
                baseProductId: p._id,
                productName: p.name,
                displayName: `${p.name} ${attrStr ? `(${attrStr})` : ''}`,
                price: v.price,
                sku: v.sku,
                availableStock: stock
            };
        });
    });

    useEffect(() => {
        if (isOpen) {
            if (isEdit && initialData) {
                setOrderId(initialData.orderId);
                setCustomerId(initialData.customer?._id || initialData.customer || '');
                setCourierId(initialData.courier?._id || initialData.courier || '');
                setChannel(initialData.channel);
                setStatus(initialData.status);
                setPaymentStatus(initialData.paymentStatus || 'Unpaid');
                setNotes(initialData.notes || '');
                setDate(moment(initialData.date).format('YYYY-MM-DD'));
                setCodAmount(initialData.financials?.codAmount || 0);
                setCourierFee(initialData.financials?.courierFee || 0);
                setProducts(
                    initialData.products?.length > 0
                        ? initialData.products.map(p => ({
                            variantId: p.variantId?._id || p.variantId || '',
                            name: p.name || 'Unknown Item',
                            quantity: p.quantity,
                            unitPrice: p.unitPrice,
                            availableStock: null
                        }))
                        : [{ variantId: '', name: '', quantity: 1, unitPrice: 0, availableStock: null }]
                );
            } else {
                // Reset form for create
                setOrderId(`ORD-${Math.floor(Math.random() * 100000)}`);
                setCustomerId('');
                setCourierId('');
                setChannel('Website');
                setStatus('New');
                setPaymentStatus('Unpaid');
                setNotes('');
                setDate(moment().format('YYYY-MM-DD'));
                setCodAmount(0);
                setCourierFee(0);
                setProducts([{ variantId: '', name: '', quantity: 1, unitPrice: 0, availableStock: null }]);
            }
        }
    }, [isOpen, isEdit, initialData]);

    if (!isOpen) return null;

    const handleProductChange = (index, field, value) => {
        const newProducts = [...products];
        newProducts[index][field] = value;
        setProducts(newProducts);
    };

    const handleProductChangeMulti = (index, updates) => {
        const newProducts = [...products];
        newProducts[index] = { ...newProducts[index], ...updates };
        setProducts(newProducts);
    };

    const addProductLine = () => {
        setProducts([...products, { variantId: '', name: '', quantity: 1, unitPrice: 0, availableStock: null }]);
    };

    const removeProductLine = (index) => {
        if (products.length > 1) {
            setProducts(products.filter((_, i) => i !== index));
        }
    };

    const calculateTotal = () => {
        return products.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Filter out empty lines
        const validProducts = products.filter(p => (p.variantId || p.name.trim() !== '') && Number(p.quantity) > 0 && Number(p.unitPrice) >= 0);

        if (validProducts.length === 0) {
            alert("Order must contain at least one valid product.");
            return;
        }

        const payload = {
            orderId,
            customerId,
            courier: courierId || null,
            channel,
            status,
            paymentStatus,
            notes,
            financials: {
                codAmount: Number(codAmount),
                courierFee: Number(courierFee),
                cogs: initialData?.financials?.cogs || 0,
                marketplaceFees: initialData?.financials?.marketplaceFees || 0,
                gatewayFees: initialData?.financials?.gatewayFees || 0
            },
            date: new Date(date),
            products: validProducts,
            totalAmount: calculateTotal()
        };

        onSubmit(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEdit ? 'Edit Sales Order' : 'Create New Sale'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    <form id="orderForm" onSubmit={handleSubmit} className="space-y-6">

                        {/* Two column grid for basic info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Order ID</label>
                                <input required type="text" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors" value={orderId} onChange={e => setOrderId(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                                <input required type="date" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors" value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Customer</label>
                                <select required className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                                    <option value="" disabled>Select a customer...</option>
                                    {customers.map(c => <option key={c._id} value={c._id}>{c.name} ({c.email})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Sales Channel</label>
                                <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none" value={channel} onChange={e => setChannel(e.target.value)}>
                                    {CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Line Items Section */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-semibold text-gray-900">Line Items</h3>
                                    <a href="/inventory" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline font-medium">
                                        Manage Products ↗
                                    </a>
                                </div>
                                <button type="button" onClick={addProductLine} className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                                    <Plus className="w-3 h-3" /> Add Product
                                </button>
                            </div>

                            <div className="space-y-3">
                                {products.map((product, index) => (
                                    <div key={index} className="flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                        <div className="flex-1">
                                            {availableVariants.length > 0 ? (
                                                <select
                                                    required
                                                    className="w-full bg-transparent outline-none border-b border-gray-200 focus:border-blue-500 py-1 text-sm font-medium appearance-none"
                                                    value={product.variantId || ''}
                                                    onChange={e => {
                                                        const selectedId = e.target.value;
                                                        const selectedVariant = availableVariants.find(v => v.variantId === selectedId);
                                                        if (selectedVariant) {
                                                            handleProductChangeMulti(index, {
                                                                variantId: selectedVariant.variantId,
                                                                name: selectedVariant.displayName,
                                                                unitPrice: selectedVariant.price,
                                                                availableStock: selectedVariant.availableStock
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <option value="" disabled>Select Variant...</option>
                                                    {availableVariants.map(v => (
                                                        <option key={v.variantId} value={v.variantId}>
                                                            {v.displayName} - ${v.price?.toFixed(2) || 0} (Stock: {v.availableStock})
                                                        </option>
                                                    ))}
                                                    {/* Display fallback for legacy orders */}
                                                    {product.name && !product.variantId && (
                                                        <option value="" disabled>{product.name} (Legacy)</option>
                                                    )}
                                                </select>
                                            ) : (
                                                <input required type="text" placeholder="Product Name (No Inventory Loaded)" className="w-full bg-transparent outline-none border-b border-gray-200 focus:border-blue-500 py-1 text-sm font-medium" value={product.name} onChange={e => handleProductChangeMulti(index, { name: e.target.value })} />
                                            )}
                                        </div>
                                        <div className="w-24">
                                            <label className="text-xs text-gray-500 block mb-1">Quantity</label>
                                            <input required type="number" min="1" max={product.availableStock !== null ? product.availableStock : undefined} className="w-full bg-gray-50 outline-none border border-gray-200 focus:border-blue-500 py-1 px-2 rounded text-sm" value={product.quantity} onChange={e => handleProductChange(index, 'quantity', e.target.value)} />
                                            {product.availableStock !== null && (
                                                <p className="text-[10px] text-gray-500 mt-1 font-medium">Avail: {product.availableStock}</p>
                                            )}
                                        </div>
                                        <div className="w-32">
                                            <label className="text-xs text-gray-500 block mb-1">Unit Price ($)</label>
                                            <input required type="number" min="0" step="0.01" className="w-full bg-gray-50 outline-none border border-gray-200 focus:border-blue-500 py-1 px-2 rounded text-sm" value={product.unitPrice} onChange={e => handleProductChange(index, 'unitPrice', e.target.value)} />
                                        </div>
                                        <button type="button" onClick={() => removeProductLine(index)} disabled={products.length === 1} className="mt-5 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded disabled:opacity-50 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end mt-4">
                                <p className="text-sm text-gray-500 font-medium">Total: <span className="text-lg font-bold text-gray-900">${calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                            </div>
                        </div>

                        {/* Status Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">COD Status Pipeline</label>
                                <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none font-bold text-blue-800" value={status} onChange={e => setStatus(e.target.value)}>
                                    {STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Dispatch Courier</label>
                                <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none" value={courierId} onChange={e => setCourierId(e.target.value)}>
                                    <option value="">Unassigned</option>
                                    {couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Expected COD (DZ)</label>
                                <input type="number" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors" value={codAmount} onChange={e => setCodAmount(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Courier Fee (DZ)</label>
                                <input type="number" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors" value={courierFee} onChange={e => setCourierFee(e.target.value)} />
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Internal Notes</label>
                            <textarea rows="3" placeholder="Add tracking links or customer requests here..." className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors resize-none" value={notes} onChange={e => setNotes(e.target.value)}></textarea>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="orderForm" className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/20 transition-all">
                        {isEdit ? 'Save Changes' : 'Create Order'}
                    </button>
                </div>
            </div>
        </div>
    );
}
