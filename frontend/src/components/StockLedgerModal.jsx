import React, { useState, useEffect, useContext } from 'react';
import { X, Search, FileText, AlertTriangle } from 'lucide-react';
import { InventoryContext } from '../context/InventoryContext';
import { fmtShortDateTime } from '../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import useModalDismiss from '../hooks/useModalDismiss';

const StockLedgerModal = ({ isOpen, onClose, product }) => {
    const { t } = useTranslation();
    const { backdropProps, panelProps } = useModalDismiss(onClose);
    const { fetchVariantLedger } = useContext(InventoryContext);
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        if (isOpen && product) {
            setLoading(true);
            setFetchError(null);
            fetchVariantLedger(product._id)
                .then(data => {
                    setLedger(data);
                    setLoading(false);
                })
                .catch(() => {
                    setFetchError(t('modals.errorLoadMovements', 'Failed to load stock movements.'));
                    setLoading(false);
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" {...backdropProps}>
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl flex flex-col max-h-[95vh] sm:max-h-[90vh]" {...panelProps}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            {t('modals.ledgerTitle', 'Stock Ledger')}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('modals.ledgerSubtitle', 'Movement history for')} {product.productName ?? product.name} ({product.sku})</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : fetchError ? (
                        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-400">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{fetchError}</span>
                        </div>
                    ) : ledger.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">{t('modals.noMovements', 'No stock movements found for this product.')}</p>
                        </div>
                    ) : (
                        <div className="cf-table-wrap">
                            <table className="cf-table min-w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('modals.colDate', 'Date')}</th>
                                        <th scope="col" className="px-6 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('modals.colType', 'Type')}</th>
                                        <th scope="col" className="px-6 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('modals.colQty', 'Quantity')}</th>
                                        <th scope="col" className="px-6 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('modals.colReason', 'Reference/Reason')}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {ledger.map((movement) => (
                                        <tr key={movement._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {fmtShortDateTime(movement.date)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                                                    ${movement.type === 'Purchase' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        movement.type === 'Sale' ? 'bg-green-50 text-green-700 border-green-200' :
                                                            'bg-gray-50 text-gray-700 border-gray-200'}`}
                                                >
                                                    {movement.type === 'Purchase' ? t('modals.typePurchase', 'Purchase') : movement.type === 'Sale' ? t('modals.typeSale', 'Sale') : movement.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <span className={movement.quantity > 0 ? 'text-green-600' : movement.quantity < 0 ? 'text-red-600' : 'text-gray-500'}>
                                                    {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                                <div>{movement.reason}</div>
                                                {movement.referenceId && <div className="text-xs text-gray-400 mt-0.5">{t('modals.refText', 'Ref')}: {movement.referenceId}</div>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-2xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm"
                    >
                        {t('modals.btnCancel', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StockLedgerModal;
