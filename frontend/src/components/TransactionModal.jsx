import { useState, useEffect } from 'react';
import { X, Save, Loader2, Users } from 'lucide-react';
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

    // Payroll worker state
    const [payrollRecords, setPayrollRecords] = useState([]);
    const [payrollLoading, setPayrollLoading] = useState(false);
    const [selectedPayrollId, setSelectedPayrollId] = useState('');

    // Categories definition
    const expenseCategories = ['Marketing', 'Operations', 'Human Resources', 'Infrastructure', 'Equipment', 'Utilities', 'Rent', 'Other'];
    const revenueCategories = ['Product Sales', 'Service Revenue', 'Subscription Income', 'Other'];

    const isHR = type === 'expense' && category === 'Human Resources';

    // Fetch payroll records when HR category is selected
    useEffect(() => {
        if (isHR && payrollRecords.length === 0) {
            setPayrollLoading(true);
            fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/payroll`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                .then(r => r.ok ? r.json() : [])
                .then(json => {
                    const data = json.data ?? (Array.isArray(json) ? json : []);
                    // Only show unpaid payroll records
                    const unpaid = data.filter(p => p.status !== 'Paid');
                    setPayrollRecords(unpaid);
                })
                .catch(() => setPayrollRecords([]))
                .finally(() => setPayrollLoading(false));
        }
    }, [isHR]);

    // When a worker is selected, auto-fill amount and description
    useEffect(() => {
        if (selectedPayrollId && payrollRecords.length > 0) {
            const record = payrollRecords.find(p => p._id === selectedPayrollId);
            if (record) {
                const remaining = record.finalPayableSalary - record.amountPaid;
                const empName = record.employeeId?.name || 'Unknown';
                setAmount(remaining);
                setDescription(`Salary payment — ${empName} (${record.period})`);
            }
        }
    }, [selectedPayrollId]);

    // Reset or populate form when modal opens/closes or initialData changes
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setType(initialData.type);
                setAmount(initialData.amount);
                setDate(new Date(initialData.date).toISOString().split('T')[0]);
                setDescription(initialData.description);
                setCategory(initialData.category || initialData.source || '');
            } else {
                setType('expense');
                setAmount('');
                setDate(new Date().toISOString().split('T')[0]);
                setDescription('');
                setCategory(expenseCategories[0]);
            }
            setSelectedPayrollId('');
            setPayrollRecords([]);
            setError(null);
        }
    }, [isOpen, initialData]);

    // Handle type change
    const handleTypeChange = (newType) => {
        setType(newType);
        setCategory(newType === 'expense' ? expenseCategories[0] : revenueCategories[0]);
        setSelectedPayrollId('');
    };

    const handleCategoryChange = (newCat) => {
        setCategory(newCat);
        setSelectedPayrollId('');
        if (newCat !== 'Human Resources') {
            // Clear auto-filled HR data
            if (description.startsWith('Salary payment')) {
                setDescription('');
                setAmount('');
            }
        }
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

            // If HR category and a worker is selected, also sync payroll
            if (isHR && selectedPayrollId) {
                const payRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/payroll/${selectedPayrollId}/pay`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ amount: Number(amount) })
                });
                if (!payRes.ok) {
                    const payErr = await payRes.json();
                    throw new Error(payErr.error || t('modals.payrollSyncFailed', 'Payroll sync failed'));
                }
                // The payroll controller already creates an Expense via sync
                // So we don't need to also call onSubmit which would create a duplicate
                onClose();
                // Trigger a refresh of transactions
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('payroll-synced'));
                }
                return;
            }

            await onSubmit(formData);
            onClose();
        } catch (err) {
            setError(err.message || t('common.errorOccurred', 'An error occurred'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const selectedRecord = payrollRecords.find(p => p._id === selectedPayrollId);

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

                    {/* Type Selector */}
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

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.trxCategory')}</label>
                        <select
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            value={category}
                            onChange={(e) => handleCategoryChange(e.target.value)}
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

                    {/* Worker Selection — only when HR category */}
                    {isHR && (
                        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-violet-800">
                                <Users className="w-4 h-4" />
                                {t('modals.selectEmployee', 'Select Employee to Pay')}
                            </div>
                            {payrollLoading ? (
                                <div className="text-sm text-violet-500 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> {t('modals.loadingWorkers', 'Loading workers...')}
                                </div>
                            ) : payrollRecords.length === 0 ? (
                                <div className="text-sm text-violet-400 italic">
                                    {t('modals.noUnpaidPayroll', 'No unpaid payroll records. You can still add a manual HR expense below.')}
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={selectedPayrollId}
                                        onChange={(e) => setSelectedPayrollId(e.target.value)}
                                        className="w-full border border-violet-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                                    >
                                        <option value="">{t('modals.selectWorkerOptional', '— Select a worker (optional) —')}</option>
                                        {payrollRecords.map(pr => {
                                            const remaining = pr.finalPayableSalary - pr.amountPaid;
                                            const empName = pr.employeeId?.name || 'Unknown';
                                            return (
                                                <option key={pr._id} value={pr._id}>
                                                    {empName} — {pr.period} — Remaining: {remaining.toLocaleString()} DZ
                                                </option>
                                            );
                                        })}
                                    </select>

                                    {/* Show worker payment info */}
                                    {selectedRecord && (
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="bg-white rounded-lg p-2 border border-violet-100">
                                                <div className="text-[10px] text-gray-500 font-bold uppercase">{t('modals.workerSalary', 'Salary')}</div>
                                                <div className="text-sm font-black text-gray-900">{selectedRecord.finalPayableSalary.toLocaleString()}</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-2 border border-violet-100">
                                                <div className="text-[10px] text-emerald-600 font-bold uppercase">{t('modals.workerPaid', 'Paid')}</div>
                                                <div className="text-sm font-black text-emerald-600">{selectedRecord.amountPaid.toLocaleString()}</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-2 border border-violet-100">
                                                <div className="text-[10px] text-amber-600 font-bold uppercase">{t('modals.workerRemaining', 'Remaining')}</div>
                                                <div className="text-sm font-black text-amber-600">{(selectedRecord.finalPayableSalary - selectedRecord.amountPaid).toLocaleString()}</div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Amount */}
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

                    {/* Date */}
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

                    {/* Description */}
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
                            {isEdit ? t('modals.trxBtnSave') : (isHR && selectedPayrollId ? t('modals.payAndRecord', 'Pay & Record') : t('modals.trxBtnCreate'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
