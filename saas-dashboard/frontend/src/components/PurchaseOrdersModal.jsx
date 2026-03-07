import React, { useState, useContext, useEffect } from 'react';
import { X, Plus, Trash2, Search, Store } from 'lucide-react';
import { InventoryContext } from '../context/InventoryContext';

const PurchaseOrdersModal = ({ isOpen, onClose }) => {
    const { suppliers, products, createPurchaseOrder } = useContext(InventoryContext);
    const [supplierId, setSupplierId] = useState('');
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([]);

    // For selecting a variant
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Flatten products to variants
    const availableVariants = products.flatMap(p => {
        if (!p.variants || p.variants.length === 0) return [];
        return p.variants.map(v => {
            let attrStr = '';
            if (v.attributes) {
                attrStr = Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ');
            }
            return {
                ...v,
                variantId: v._id,
                baseProductId: p._id,
                productName: p.name,
                displayName: `${p.name} ${attrStr ? `(${attrStr})` : ''}`
            };
        });
    });

    useEffect(() => {
        if (!isOpen) {
            // Reset state when closed
            setSupplierId('');
            setExpectedDeliveryDate('');
            setNotes('');
            setItems([]);
            setSelectedVariantId('');
            setQuantity('');
            setUnitCost('');
            setError(null);
        }
    }, [isOpen]);

    const handleAddItem = () => {
        if (!selectedVariantId || !quantity || !unitCost) {
            setError('Please select a product, quantity, and unit cost.');
            return;
        }

        const variantObj = availableVariants.find(v => v.variantId === selectedVariantId);
        if (!variantObj) return;

        setItems(prev => [...prev, {
            variantObj,
            variant: variantObj.variantId,
            quantity: Number(quantity),
            unitCost: Number(unitCost)
        }]);

        // Reset inputs
        setSelectedVariantId('');
        setQuantity('');
        setUnitCost('');
        setError(null);
    };

    const handleRemoveItem = (indexToRemove) => {
        setItems(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!supplierId) return setError('Supplier is required');
        if (items.length === 0) return setError('At least one item is required');

        try {
            setSubmitting(true);
            await createPurchaseOrder({
                supplier: supplierId,
                expectedDeliveryDate: expectedDeliveryDate || undefined,
                notes,
                items: items.map(item => ({
                    variant: item.variant,
                    quantity: item.quantity,
                    unitCost: item.unitCost
                }))
            });
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const totalCalculated = items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                            <Store className="w-5 h-5 text-indigo-600" />
                            Create Purchase Order
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Order new stock from suppliers</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    <form id="po-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Header Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier *</label>
                                <select
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors"
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                    required
                                >
                                    <option value="">Select Supplier</option>
                                    {suppliers.map(s => (
                                        <option key={s._id} value={s._id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Expected Delivery</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors"
                                    value={expectedDeliveryDate}
                                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                                <textarea
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors"
                                    rows="2"
                                    placeholder="Internal notes or instructions for the supplier..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                ></textarea>
                            </div>
                        </div>

                        {/* Add Items Section */}
                        <div className="p-5 border border-indigo-100 bg-indigo-50/30 rounded-xl">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Products</h3>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                <div className="md:col-span-6">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Product</label>
                                    <select
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                        value={selectedVariantId}
                                        onChange={(e) => {
                                            setSelectedVariantId(e.target.value);
                                            // Auto-fill cost
                                            const v = availableVariants.find(vr => vr.variantId === e.target.value);
                                            if (v) setUnitCost(v.cost);
                                        }}
                                    >
                                        <option value="">Select Variant...</option>
                                        {availableVariants.map(v => (
                                            <option key={v.variantId} value={v.variantId}>{v.displayName} ({v.sku})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Unit Cost ($)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                        value={unitCost}
                                        onChange={(e) => setUnitCost(e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="w-full flex items-center justify-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
                                    >
                                        <Plus className="w-4 h-4" /> Add
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Items List */}
                        {items.length > 0 && (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cost</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                                            <th className="px-4 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {items.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                    {item.variantObj.displayName} <span className="text-gray-400 font-normal ml-1">({item.variantObj.sku})</span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 text-right">{item.quantity}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600 text-right">${item.unitCost.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                                                    ${(item.quantity * item.unitCost).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                        <tr>
                                            <td colSpan="3" className="px-4 py-3 text-sm font-medium text-gray-600 text-right">Total Amount:</td>
                                            <td className="px-4 py-3 text-base font-bold text-indigo-600 text-right">
                                                ${totalCalculated.toLocaleString()}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="po-form"
                        disabled={submitting || items.length === 0}
                        className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Creating...' : 'Create Purchase Order'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseOrdersModal;
