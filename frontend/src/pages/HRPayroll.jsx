import React, { useState, useEffect, useRef } from 'react';
import { Calculator, CheckCircle, ShieldAlert, Download, Clock, AlertCircle, X, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { toMMYYYY, fmtMonthYear, subtract } from '../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import clsx from 'clsx';
import { useHotkey } from '../hooks/useHotkey';
import TableSkeleton from '../components/TableSkeleton';

// Build a list of the last 6 months as { value, label } options
function buildPeriodOptions() {
    const opts = [];
    for (let i = 0; i < 6; i++) {
        const m = subtract(new Date(), i, 'months');
        opts.push({ value: toMMYYYY(m), label: fmtMonthYear(m) });
    }
    return opts;
}
const PERIOD_OPTIONS = buildPeriodOptions();

export default function HRPayroll() {
    const { t } = useTranslation();
    const { hasPermission } = React.useContext(AuthContext);
    const defaultPeriod = toMMYYYY();
    const [period, setPeriod] = useState(defaultPeriod);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    // Modal State
    const [paymentModal, setPaymentModal] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');

    // Escape key to close payment modal
    useEffect(() => {
        if (!paymentModal) return;
        const handler = (e) => { if (e.key === 'Escape') { setPaymentModal(null); setPaymentAmount(''); } };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [paymentModal]);

    const fetchPayroll = async (selectedPeriod) => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/hr/payroll?period=${selectedPeriod}`);
            if (!res.ok) throw new Error('fetch failed');
            const json = await res.json();
            const data = json.data ?? (Array.isArray(json) ? json : []);
            setRecords(data);
        } catch {
            setErrorMsg(t('hr.alertFailedLoad', 'Failed to load payroll data.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayroll(period);
    }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleGenerateRun = async () => {
        try {
            const res = await apiFetch(`/api/hr/payroll/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ period })
            });
            if (res.ok) fetchPayroll(period);
            else { const d = await res.json(); setErrorMsg(d.error || t('hr.alertFailedGenerate', 'Failed to generate payroll run.')); }
        } catch {
            setErrorMsg(t('hr.alertFailedGenerate', 'Failed to generate payroll run.'));
        }
    };

    const handleApprove = async (recordId) => {
        try {
            const res = await apiFetch(`/api/hr/payroll/${recordId}/approve`, {
                method: 'PUT'
            });
            if (res.ok) {
                fetchPayroll(period);
            } else {
                const data = await res.json();
                setErrorMsg(data.error || t('hr.alertFailedApprove', 'Approval failed'));
            }
        } catch {
            setErrorMsg(t('hr.alertFailedApprove', 'Approval failed'));
        }
    };

    const [bulkApproving, setBulkApproving] = useState(false);
    const handleBulkApprove = async () => {
        const pendingRecords = records.filter(r => r.status === 'Pending Approval');
        if (pendingRecords.length === 0) return;
        setBulkApproving(true);
        setErrorMsg(null);
        let failed = 0;
        for (const record of pendingRecords) {
            try {
                const res = await apiFetch(`/api/hr/payroll/${record._id}/approve`, {
                    method: 'PUT'
                });
                if (!res.ok) failed++;
            } catch { failed++; }
        }
        setBulkApproving(false);
        if (failed > 0) setErrorMsg(t('hr.bulkApprovePartialFail', `${failed} record(s) failed to approve.`));
        fetchPayroll(period);
    };

    const submitPayment = async () => {
        if (!paymentModal || !paymentAmount) return;
        try {
            const res = await apiFetch(`/api/hr/payroll/${paymentModal.id}/pay`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parseFloat(paymentAmount) })
            });
            if (res.ok) {
                fetchPayroll(period);
                setPaymentModal(null);
                setPaymentAmount('');
            } else {
                const data = await res.json();
                setErrorMsg(data.error || t('hr.alertFailedPayment'));
            }
        } catch {
            setErrorMsg(t('hr.alertFailedPayment'));
        }
    };

    const setFullPayment = () => {
        if (paymentModal) setPaymentAmount(paymentModal.maxPayable.toString());
    };

    const totalLoad = records.reduce((acc, r) => acc + (r.finalPayableSalary || 0), 0);
    const totalDeductions = records.reduce((acc, r) => acc + (r.missingTimeDeductions || 0) + (r.absenceDeductions || 0), 0);
    const totalOT = records.reduce((acc, r) => acc + (r.overtimeAdditions || 0), 0);
    const pendingCount = records.filter(r => r.status === 'Pending Approval').length;

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    const filteredRecords = records.filter(r => {
        if (filterStatus !== 'All' && r.status !== filterStatus) return false;
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            if (!r.employeeId?.name?.toLowerCase().includes(q) && !r.employeeId?.role?.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={t('hr.payrollTitle', 'Enterprise Payroll')}
                subtitle={t('hr.payrollSubtitle', 'Automated salary distribution and compliance tracking.')}
                variant="hr"
                actions={
                    <div className="flex flex-wrap gap-3">
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 text-gray-700 dark:text-gray-300 text-sm font-bold outline-none focus:ring-2 focus:ring-[#5D5DFF] transition-all"
                        >
                            {PERIOD_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        {hasPermission('hr.payroll.approve') && pendingCount > 0 && (
                            <button
                                onClick={handleBulkApprove}
                                disabled={bulkApproving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 leading-none disabled:opacity-60"
                            >
                                <CheckCircle className="w-4 h-4" />
                                {bulkApproving ? t('hr.approving', 'Approving...') : t('hr.btnApproveAll', `Approve All (${pendingCount})`)}
                            </button>
                        )}
                        {hasPermission('hr.payroll.run') && (
                            <button
                                onClick={handleGenerateRun}
                                className="flex items-center gap-2 px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20 active:scale-95 leading-none"
                            >
                                <Calculator className="w-5 h-5" /> {t('hr.btnGenerateRun', 'Generate Run')}
                            </button>
                        )}
                    </div>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 truncate">{t('hr.totalPayrollLoad')}</p>
                        <h3 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tighter truncate">{totalLoad.toLocaleString()} <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">{t('hr.dzdCurrency')}</span></h3>
                    </div>
                    <div className="h-10 w-10 sm:h-16 sm:w-16 bg-gray-50 dark:bg-gray-700/50 rounded-xl sm:rounded-2xl flex items-center justify-center border border-gray-100 dark:border-gray-700 shrink-0">
                        <Calculator className="w-5 h-5 sm:w-8 sm:h-8 text-gray-600 dark:text-gray-400" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1 truncate">{t('hr.totalDeductions')}</p>
                        <h3 className="text-xl sm:text-3xl font-black text-rose-700 dark:text-rose-400 tracking-tighter truncate">{totalDeductions.toLocaleString()} <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">{t('hr.dzdCurrency')}</span></h3>
                    </div>
                    <div className="h-10 w-10 sm:h-16 sm:w-16 bg-rose-50 dark:bg-rose-900/30 rounded-xl sm:rounded-2xl flex items-center justify-center border border-rose-100 dark:border-rose-800 shrink-0">
                        <ShieldAlert className="w-5 h-5 sm:w-8 sm:h-8 text-rose-600" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 truncate">{t('hr.totalOtAdditions')}</p>
                        <h3 className="text-xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tighter truncate">{totalOT.toLocaleString()} <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">{t('hr.dzdCurrency')}</span></h3>
                    </div>
                    <div className="h-10 w-10 sm:h-16 sm:w-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl sm:rounded-2xl flex items-center justify-center border border-emerald-100 dark:border-emerald-800 shrink-0">
                        <Clock className="w-5 h-5 sm:w-8 sm:h-8 text-emerald-600" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 truncate">{t('hr.clearanceStatus')}</p>
                        <h3 className="text-lg sm:text-2xl font-black text-amber-700 dark:text-amber-400 tracking-tighter truncate">{pendingCount > 0 ? `${pendingCount} ${t('hr.statusPending')}` : t('hr.allCleared')}</h3>
                    </div>
                    <div className="h-10 w-10 sm:h-16 sm:w-16 bg-amber-50 dark:bg-amber-900/30 rounded-xl sm:rounded-2xl flex items-center justify-center border border-amber-100 dark:border-amber-800 shrink-0">
                        {pendingCount > 0 ? <ShieldAlert className="w-5 h-5 sm:w-8 sm:h-8 text-amber-600" /> : <CheckCircle className="w-5 h-5 sm:w-8 sm:h-8 text-emerald-600" />}
                    </div>
                </div>
            </div>

            {/* Inline error toast */}
            {errorMsg && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-800/50 rounded transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="w-4 h-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder={t('hr.searchEmployeePlaceholder', 'Search... (Press /)')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full ps-9 pe-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all font-bold"
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {['All', 'Pending Approval', 'Approved', 'Partially Paid', 'Paid'].map(status => {
                        const count = status === 'All' ? records.length : records.filter(r => r.status === status).length;
                        return (
                            <button key={status} onClick={() => setFilterStatus(status)}
                                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                                    filterStatus === status ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                )}>
                                {status === 'All' ? t('hr.allStatus', 'All') : status}
                                {count > 0 && (
                                    <span className={clsx('text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none',
                                        filterStatus === status ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                    )}>{count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Payroll Grid */}
            <div className="cf-table-wrap">
                <div className="overflow-x-auto">
                    <table className="cf-table min-w-[1000px]">
                        <thead>
                            <tr>
                                <th>{t('hr.colEmployeeDet')}</th>
                                <th className="text-end">{t('hr.colBaseContract')}</th>
                                <th className="text-end">{t('hr.colDeductions')}</th>
                                <th className="text-end">{t('hr.colOtAdditions')}</th>
                                <th className="text-end !text-gray-900 dark:!text-white">{t('hr.colFinalPayable')}</th>
                                <th className="text-center">{t('hr.colStatus')}</th>
                                <th className="text-center">{t('hr.colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={7} className="p-0">
                                    <TableSkeleton rows={5} cols={7} showHeader={false} />
                                </td></tr>
                            )}
                            {records.length === 0 && !loading && (
                                <tr className="empty-state">
                                    <td colSpan={7} className="py-16 text-center text-sm text-gray-400 dark:text-gray-500 font-medium">
                                        <Calculator className="w-8 h-8 mx-auto mb-2 text-gray-200 dark:text-gray-600" />
                                        {t('hr.noPayrollRecords', 'No payroll records for this period. Generate a run to get started.')}
                                    </td>
                                </tr>
                            )}
                            {records.length > 0 && filteredRecords.length === 0 && (
                                <tr className="empty-state"><td colSpan={7} className="px-6 py-12 text-center">
                                    <Search className="w-8 h-8 mx-auto text-gray-200 dark:text-gray-600 mb-2" />
                                    <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">{t('hr.noEmployeesFound', 'No records match your search or filter.')}</p>
                                </td></tr>
                            )}
                            {filteredRecords.map(record => (
                                <tr key={record._id}>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900 dark:text-white">{record.employeeId?.name || t('hr.unknownEmployee')}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">{record.employeeId?.role || '-'}</div>
                                    </td>

                                    <td className="px-6 py-4 text-end">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{(record.baseSalary || 0).toLocaleString()}</span>
                                    </td>

                                    <td className="px-6 py-4 text-end">
                                        <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                                            -{(record.missingTimeDeductions + record.absenceDeductions).toLocaleString()}
                                        </div>
                                        {record.metricsTotal.totalMissingMinutes > 0 && (
                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{record.metricsTotal.totalMissingMinutes}{t('hr.lblMinutes')} {t('hr.lblMissing')}</div>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-end">
                                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                            +{record.overtimeAdditions.toLocaleString()}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-right bg-gray-50/50 dark:bg-gray-700/30">
                                        <span className="text-lg font-black text-gray-900 dark:text-white">{(record.finalPayableSalary || 0).toLocaleString()}</span> <span className="text-xs text-gray-500 dark:text-gray-400">{t('hr.dzdCurrency')}</span>
                                        {(record.amountPaid > 0 && record.amountPaid < record.finalPayableSalary) && (
                                            <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 pb-1 border-b border-amber-200/50 dark:border-amber-700/50">{t('hr.lblPaid')} {(record.amountPaid || 0).toLocaleString()} {t('hr.dzdCurrency')}</div>
                                        )}
                                        {record.amountPaid > 0 && (
                                            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wider">{t('hr.lblRemaining')} {((record.finalPayableSalary || 0) - (record.amountPaid || 0)).toLocaleString()}</div>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border ${record.status === 'Pending Approval' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                                            record.status === 'Approved' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                                            record.status === 'Partially Paid' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' :
                                                record.status === 'Paid' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                                                    'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                                            }`}>
                                            {record.status === 'Pending Approval' ? t('hr.statusPendingApproval') :
                                                record.status === 'Approved' ? t('hr.statusApproved', 'Approved') :
                                                record.status === 'Partially Paid' ? t('hr.statusPartiallyPaid') :
                                                    record.status === 'Paid' ? t('hr.statusPaid') : record.status}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4 flex justify-center gap-2">
                                        <button onClick={() => window.print()} className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition" title={t('hr.downloadPayslip')}>
                                            <Download className="w-4 h-4" />
                                        </button>
                                        {record.status === 'Pending Approval' && hasPermission('hr.payroll.approve') && (
                                            <button onClick={() => handleApprove(record._id)} className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition font-bold text-xs px-3" title={t('hr.approvePayroll', 'Approve')}>
                                                {t('hr.btnApprove', 'Approve')}
                                            </button>
                                        )}
                                        {(record.status === 'Approved' || record.status === 'Partially Paid') && hasPermission('hr.payroll.approve') && (
                                            <button onClick={() => setPaymentModal({ id: record._id, maxPayable: record.finalPayableSalary - (record.amountPaid || 0), empName: record.employeeId?.name })} className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition font-bold text-xs px-3" title={t('hr.processPayment')}>
                                                {t('hr.btnPay')}
                                            </button>
                                        )}
                                        {record.status === 'Paid' && (
                                            <span className="p-1.5 text-emerald-400"><CheckCircle className="w-4 h-4" /></span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Partial / Full Payment Modal */}
            {paymentModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/80">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-emerald-600" /> {t('hr.modalIssuePaymentTitle')}
                            </h2>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                {t('hr.issuingPaymentFor')} <strong className="text-gray-900 dark:text-white">{paymentModal.empName}</strong>.
                                <br />{t('hr.remainingDeficit')} <strong className="text-rose-600">{(paymentModal.maxPayable || 0).toLocaleString()} {t('hr.dzdCurrency')}</strong>
                            </p>

                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('hr.lblPaymentAmount')}</label>
                            <input
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder={t('hr.placeholderAmount')}
                                className="w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-lg font-mono px-4 py-3 border outline-none ltr:text-left rtl:text-right bg-white dark:bg-gray-700 dark:text-gray-100"
                            />

                            <button onClick={setFullPayment} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 mt-2 block ltr:ml-auto rtl:mr-auto">
                                {t('hr.clearFullBalance')} ({paymentModal.maxPayable})
                            </button>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/80 flex gap-3 ltr:flex-row-reverse rtl:flex-row border-t border-gray-100 dark:border-gray-700">
                            <button onClick={submitPayment} disabled={!paymentAmount || isNaN(paymentAmount) || Number(paymentAmount) <= 0 || Number(paymentAmount) > paymentModal.maxPayable} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-colors flex-1 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed">
                                {t('hr.btnConfirmPayout')}
                            </button>
                            <button onClick={() => { setPaymentModal(null); setPaymentAmount(''); }} className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                                {t('hr.btnCancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
