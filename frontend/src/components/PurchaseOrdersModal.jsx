import React, { useState, useContext, useEffect } from 'react';
import { X, Plus, Trash2, Search, Store } from 'lucide-react';
import { InventoryContext } from '../context/InventoryContext';
import { useTranslation } from 'react-i18next';
import useModalDismiss from '../hooks/useModalDismiss';
import { apiFetch } from '../utils/apiFetch';

const PurchaseOrdersModal = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { backdropProps, panelProps } = useModalDismiss(onClose);
    const { suppliers, products } = useContext(InventoryContext);
    const [supplierId, setSupplierId] = useState('');
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([]);

    // For selecting a variant
    const [selectedItemId, setSelectedItemId] = useState('');
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
                itemId: v._id,
                itemModel: 'ProductVariant',
                displayName: `${p.name} ${attrStr ? `(${attrStr})` : ''}`,
                sku: v.sku,
                cost: v.cost
            };
        });
    });

    const availableItems = availableVariants;

    useEffect(() => {
        if (!isOpen) {
            // Reset state when closed
            setSupplierId('');
            setExpectedDeliveryDate('');
            setNotes('');
            setItems([]);
            setSelectedItemId('');
            setQuantity('');
            setUnitCost('');
            setError(null);
        }
    }, [isOpen]);

    const handleAddItem = () => {
        if (!selectedItemId || !quantity || !unitCost) {
            setError(t('procurement.poItemValidation', 'Please select an item, quantity, and unit cost.'));
            return;
        }

        const itemObj = availableItems.find(i => i.itemId === selectedItemId);
        if (!itemObj) return;

        setItems(prev => [...prev, {
            itemObj,
            itemRef: itemObj.itemId,
            itemModel: itemObj.itemModel,
            quantity: Number(quantity),
            unitCost: Number(unitCost)
        }]);

        // Reset inputs
        setSelectedItemId('');
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

        if (!supplierId) return setError(t('procurement.supplierRequired', 'Supplier is required'));
        if (items.length === 0) return setError(t('procurement.itemsRequired', 'At least one item is required'));

        try {
            setSubmitting(true);

            const payload = {
                supplier: supplierId,
                expectedDeliveryDate: expectedDeliveryDate || undefined,
                notes,
                items: items.map(item => ({
                    itemRef: item.itemRef,
                    itemModel: item.itemModel,
                    quantity: item.quantity,
                    unitCost: item.unitCost
                }))
            };

            const response = await apiFetch(`/api/procurement/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || t('procurement.poFailed', 'Failed to create PO'));
            }

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" {...backdropProps}>
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-4xl flex flex-col max-h-[95vh] sm:max-h-[90vh]" {...panelProps}>
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Store className="w-5 h-5 text-indigo-600" />
                            {t('modals.poTitle', 'Create Purchase Order')}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('modals.poSubtitle', 'Order new stock from suppliers')}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    <form id="po-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Header Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                            <div>
                                <label htmlFor="po-supplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('modals.poSupplier', 'Supplier *')}</label>
                                <select
                                    id="po-supplier"
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors dark:text-gray-100"
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                    required
                                >
                                    <option value="">{t('modals.poSelectSupplier', 'Select Supplier')}</option>
                                    {suppliers.map(s => (
                                        <option key={s._id} value={s._id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="po-delivery" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('modals.poExpectedDelivery', 'Expected Delivery')}</label>
                                <input
                                    id="po-delivery"
                                    type="date"
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors dark:text-gray-100"
                                    value={expectedDeliveryDate}
                                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label htmlFor="po-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('modals.poNotes', 'Notes')}</label>
                                <textarea
                                    id="po-notes"
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors dark:text-gray-100"
                                    rows="2"
                                    placeholder={t('modals.poNotesPlaceholder', 'Internal notes or instructions for the supplier...')}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                ></textarea>
                            </div>
                        </div>

                        {/* Add Items Section */}
                        <div className="p-5 border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/20 rounded-xl">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('modals.poAddItemsFormat', 'Add Items format')}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                <div className="md:col-span-6">
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('modals.poItemToPurchase', 'Item to Purchase')}</label>
                                    <select
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-gray-100"
                                        value={selectedItemId}
                                        onChange={(e) => {
                                            setSelectedItemId(e.target.value);
                                            // Auto-fill cost
                                            const match = availableItems.find(i => i.itemId === e.target.value);
                                            if (match) setUnitCost(match.cost || 0);
                                        }}
                                    >
                                        <option value="">{t('modals.poSelectItem', 'Select Item...')}</option>
                                        {availableItems.map(i => (
                                            <option key={i.itemId} value={i.itemId}>{i.displayName} ({i.sku})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('modals.poQty', 'Quantity')}</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-gray-100"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('modals.poUnitCost', 'Unit Cost ($)')}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:text-gray-100"
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
                                        <Plus className="w-4 h-4" /> {t('modals.poBtnAdd', 'Add')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Items List */}
                        {items.length > 0 && (
                            <div className="cf-table-wrap">
                                <table className="cf-table min-w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('modals.poTableType', 'Item Type')}</th>
                                            <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('modals.poTableItem', 'Item')}</th>
                                            <th className="px-4 py-3 text-end text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('modals.poTableQty', 'Qty')}</th>
                                            <th className="px-4 py-3 text-end text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('modals.poTableCost', 'Cost')}</th>
                                            <th className="px-4 py-3 text-end text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('modals.poTableTotal', 'Total')}</th>
                                            <th className="px-4 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {items.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                                                    <span className="px-2 py-0.5 rounded text-xs border bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                                        {t('modals.poFinishedVariant', 'Product Variant')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                                                    {item.itemObj.displayName} <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">({item.itemObj.sku})</span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-end">{item.quantity}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-end">${item.unitCost.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-end">
                                                    ${(item.quantity * item.unitCost).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            <td colSpan="3" className="px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 text-end">{t('modals.poTotalAmount', 'Total Amount:')}</td>
                                            <td className="px-4 py-3 text-base font-bold text-indigo-600 text-end">
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

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-2xl flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                    >
                        {t('modals.btnCancel', 'Cancel')}
                    </button>
                    <button
                        type="submit"
                        form="po-form"
                        disabled={submitting || items.length === 0}
                        className="px-6 py-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? t('modals.poBtnCreating', 'Creating...') : t('modals.poBtnCreate', 'Create Purchase Order')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseOrdersModal;
