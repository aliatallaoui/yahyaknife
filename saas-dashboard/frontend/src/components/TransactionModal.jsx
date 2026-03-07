import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

export default function TransactionModal({ isOpen, onClose, onSubmit, initialData }) {
    const { t } = useTranslation();
    const isEdit = !!initialData;

    // Form State
    const [type, setType] = useState('expense');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Categories definition
    const expenseCategories = ['Marketing', 'Operations', 'Human Resources', 'Infrastructure', 'Equipment', 'Utilities', 'Rent', 'Other'];
    const revenueCategories = ['Product Sales', 'Service Revenue', 'Subscription Income', 'Other'];

    // Reset or populate form when modal opens/closes or initialData changes
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setType(initialData.type);
                setAmount(initialData.amount);
                setDate(new Date(initialData.date).toISOString().split('T')[0]);
                setDescription(initialData.description);
                // Map DB source to category field for unified form
                setCategory(initialData.category || initialData.source || '');
            } else {
                setType('expense');
                setAmount('');
                setDate(new Date().toISOString().split('T')[0]);
                setDescription('');
                setCategory(expenseCategories[0]);
            }
            setError(null);
        }
    }, [isOpen, initialData]);

    // Handle type change - ensure valid category is selected
    const handleTypeChange = (newType) => {
        setType(newType);
        setCategory(newType === 'expense' ? expenseCategories[0] : revenueCategories[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const formData = {
                type,
                amount: Number(amount),
                date,
                description,
                category
            };

            await onSubmit(formData);
            onClose();
        } catch (err) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">
                        {isEdit ? t('modals.trxTitleEdit') : t('modals.trxTitleAdd')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Type Selector (Only allowed when adding) */}
                    {!isEdit && (
                        <div className="grid grid-cols-2 gap-3 p-1 bg-gray-50 rounded-lg">
                            <button
                                type="button"
                                onClick={() => handleTypeChange('expense')}
                                className={clsx(
                                    "py-2 text-sm font-medium rounded-md transition-all",
                                    type === 'expense' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                )}
                            >
                                {t('modals.trxExpense')}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTypeChange('revenue')}
                                className={clsx(
                                    "py-2 text-sm font-medium rounded-md transition-all",
                                    type === 'revenue' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                )}
                            >
                                {t('modals.trxRevenue')}
                            </button>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.trxAmount')}</label>
                        <input
                            type="number"
                            step="0.01"
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.trxDate')}</label>
                        <input
                            type="date"
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.trxCategory')}</label>
                        <select
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            <option value="" disabled>{t('modals.trxSelectCategory')}</option>
                            {(type === 'expense' ? expenseCategories : revenueCategories).map(c => (
                                <option key={c} value={c}>
                                    {c === 'Marketing' ? t('modals.catMarketing') :
                                        c === 'Operations' ? t('modals.catOperations') :
                                            c === 'Human Resources' ? t('modals.catHR') :
                                                c === 'Infrastructure' ? t('modals.catInfrastructure') :
                                                    c === 'Equipment' ? t('modals.catEquipment') :
                                                        c === 'Utilities' ? t('modals.catUtilities') :
                                                            c === 'Rent' ? t('modals.catRent') :
                                                                c === 'Product Sales' ? t('modals.catProductSales') :
                                                                    c === 'Service Revenue' ? t('modals.catServiceRev') :
                                                                        c === 'Subscription Income' ? t('modals.catSubIncome') :
                                                                            c === 'Other' ? t('modals.catOther') : c}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.trxDesc')}</label>
                        <input
                            type="text"
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={t('modals.trxDescPlaceholder')}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            {t('modals.trxBtnCancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isEdit ? t('modals.trxBtnSave') : t('modals.trxBtnCreate')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
