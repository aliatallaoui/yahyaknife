import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import { X, Plus, Trash2, Loader2, PackageSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useModalDismiss from '../hooks/useModalDismiss';

export default function NewPOModal({ isOpen, onClose, suppliers, onSuccess }) {
    const { t } = useTranslation();
    const { backdropProps, panelProps } = useModalDismiss(onClose);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Form state
    const [supplier, setSupplier] = useState('');
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([
        { itemModel: 'ProductVariant', itemRef: '', quantity: 1, unitCost: 0 }
    ]);

    // Available product variants to reference
    const [variants, setVariants] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchVariants();
        }
    }, [isOpen]);

    const fetchVariants = async () => {
        try {
            const res = await apiFetch('/api/inventory/products');
            const data = await res.json();
            const allVariants = (data || []).flatMap(p =>
                (p.variants || []).map(v => ({
                    _id: v._id,
                    name: `${p.name} — ${v.sku}`,
                    sku: v.sku
                }))
            );
            setVariants(allVariants);
        } catch (err) {
            // non-blocking
        }
    };

    if (!isOpen) return null;

    const handleAddItem = () => {
        setItems([...items, { itemModel: 'ProductVariant', itemRef: '', quantity: 1, unitCost: 0 }]);
    };

    const handleRemoveItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!supplier) return setError(t('procurement.errSelectSupplier', 'Please select a supplier'));
        if (items.length === 0) return setError(t('procurement.errAddItems', 'Add at least one item'));

        // Basic validation checking if valid ObjectIds are used
        for (let item of items) {
            if (!item.itemRef || item.itemRef.length < 10) {
                return setError(t('procurement.errInvalidItemCode', 'Please select a valid material from the list'));
            }
        }

        setSubmitting(true);
        try {
            const res = await apiFetch('/api/procurement/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supplier,
                    items,
                    expectedDeliveryDate: expectedDeliveryDate || undefined,
                    notes
                })
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to create purchase order');
            }
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" {...backdropProps}>
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden" {...panelProps}>
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <PackageSearch className="w-5 h-5 text-indigo-600" />
                        {t('procurement.createNewPo', 'Create Purchase Order')}
                    </h2>
                    <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-sm font-bold">
                            {error}
                        </div>
                    )}

                    <form id="new-po-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="npo-supplier" className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('procurement.selectSupplier', 'Supplier')}</label>
                                <select
                                    id="npo-supplier"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={supplier}
                                    onChange={e => setSupplier(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>{t('procurement.chooseSupplier', 'Choose... ')}</option>
                                    {suppliers.map(s => (
                                        <option key={s._id} value={s._id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="npo-date" className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('procurement.expectedDate', 'Expected Delivery Date')}</label>
                                <input
                                    id="npo-date"
                                    type="date"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={expectedDeliveryDate}
                                    onChange={e => setExpectedDeliveryDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase">{t('procurement.orderItems', 'Order Items')}</label>
                                <button type="button" onClick={handleAddItem} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                    <Plus className="w-4 h-4" /> {t('procurement.addItem', 'Add Row')}
                                </button>
                            </div>

                            <div className="space-y-3">
                                {items.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                        <select
                                            className="w-1/3 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                            value={item.itemRef}
                                            onChange={e => updateItem(idx, 'itemRef', e.target.value)}
                                            required
                                        >
                                            <option value="" disabled>{t('procurement.selectVariant', 'Select Variant...')}</option>
                                            {variants.map(v => (
                                                <option key={v._id} value={v._id}>{v.name} [{v.sku}]</option>
                                            ))}
                                        </select>

                                        <input
                                            type="number"
                                            min="1"
                                            placeholder={t('procurement.qty', 'Qty')}
                                            className="w-24 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                            value={item.quantity}
                                            onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                                            required
                                        />
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{t('common.dzd', 'DZD')}</span>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder={t('procurement.unitCost', 'Cost / Unit')}
                                                className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-3 py-2 text-sm"
                                                value={item.unitCost}
                                                onChange={e => updateItem(idx, 'unitCost', Number(e.target.value))}
                                                required
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(idx)}
                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {items.length === 0 && (
                                    <div className="text-center p-6 text-gray-400 text-sm font-medium border-2 border-dashed border-gray-200 rounded-xl">
                                        {t('procurement.noItemsAdded', 'No items added. Click Add Row.')}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('procurement.notes', 'Internal Notes')}</label>
                            <textarea
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                rows="2"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder={t('procurement.notesPlaceholder', 'Optional instructions...')}
                            ></textarea>
                        </div>
                    </form>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        form="new-po-form"
                        type="submit"
                        disabled={submitting}
                        className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-lg shadow-indigo-500/30 flex items-center gap-2 disabled:opacity-70"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageSearch className="w-4 h-4" />}
                        {t('procurement.submitPo', 'Generate PO')}
                    </button>
                </div>
            </div>
        </div>
    );
}
