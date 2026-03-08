import React, { useState, useEffect } from 'react';
import { Calculator, CheckCircle, ShieldAlert, Download, Clock } from 'lucide-react';
import moment from 'moment';
import { useTranslation } from 'react-i18next';

export default function HRPayroll() {
    const { t } = useTranslation();
    const defaultPeriod = moment().format('MM-YYYY');
    const [period, setPeriod] = useState(defaultPeriod);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [paymentModal, setPaymentModal] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');

    const fetchPayroll = async (selectedPeriod) => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/payroll?period=${selectedPeriod}`);
            const data = await res.json();
            setRecords(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayroll(period);
    }, [period]);

    const handleGenerateRun = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/payroll/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ period })
            });
            if (res.ok) fetchPayroll(period);
        } catch (error) {
            console.error(t('hr.alertFailedGenerate'), error);
        }
    };

    const submitPayment = async () => {
        if (!paymentModal || !paymentAmount) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/payroll/${paymentModal.id}/approve`, {
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
                alert(data.error || t('hr.alertFailedPayment'));
            }
        } catch (error) {
            console.error(t('hr.alertFailedPayment'), error);
        }
    };

    const setFullPayment = () => {
        if (paymentModal) setPaymentAmount(paymentModal.maxPayable.toString());
    };

    const totalLoad = records.reduce((acc, r) => acc + (r.finalPayableSalary || 0), 0);
    const totalDeductions = records.reduce((acc, r) => acc + (r.missingTimeDeductions || 0) + (r.absenceDeductions || 0), 0);
    const totalOT = records.reduce((acc, r) => acc + (r.overtimeAdditions || 0), 0);
    const pendingCount = records.filter(r => r.status === 'Pending Approval').length;

    return (
        <div className="p-8">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 border-b-4 border-emerald-500 pb-2 inline-block">{t('hr.payrollTitle')}</h1>
                    <p className="text-gray-500 mt-2">{t('hr.payrollSubtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <select value={period} onChange={(e) => setPeriod(e.target.value)}
                        className="border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 font-bold text-gray-700">
                        <option value={moment().format('MM-YYYY')}>{moment().format('MMMM YYYY')}</option>
                        <option value={moment().subtract(1, 'month').format('MM-YYYY')}>{moment().subtract(1, 'month').format('MMMM YYYY')}</option>
                    </select>
                    <button onClick={handleGenerateRun} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-emerald-700">
                        <Calculator className="w-5 h-5" /> {t('hr.btnGenerateRun')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('hr.totalPayrollLoad')}</p>
                    <p className="text-3xl font-black text-gray-900">{totalLoad.toLocaleString()} <span className="text-sm text-gray-500 font-medium">{t('hr.dzdCurrency')}</span></p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('hr.totalDeductions')}</p>
                    <p className="text-3xl font-black text-rose-600">{totalDeductions.toLocaleString()} <span className="text-sm text-gray-500 font-medium">{t('hr.dzdCurrency')}</span></p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('hr.totalOtAdditions')}</p>
                    <p className="text-3xl font-black text-emerald-600">{totalOT.toLocaleString()} <span className="text-sm text-gray-500 font-medium">{t('hr.dzdCurrency')}</span></p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('hr.clearanceStatus')}</p>
                        <p className="text-lg font-bold text-amber-600">{pendingCount > 0 ? `${pendingCount} ${t('hr.statusPending')}` : t('hr.allCleared')}</p>
                    </div>
                    {pendingCount > 0 ? <ShieldAlert className="w-10 h-10 text-amber-100" /> : <CheckCircle className="w-10 h-10 text-emerald-100" />}
                </div>
            </div>

            {/* Payroll Grid */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <table className="w-full text-start">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('hr.colEmployeeDet')}</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-end">{t('hr.colBaseContract')}</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-end">{t('hr.colDeductions')}</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-end">{t('hr.colOtAdditions')}</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-900 uppercase tracking-wider text-end">{t('hr.colFinalPayable')}</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center">{t('hr.colStatus')}</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center">{t('hr.colActions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {records.map(record => (
                            <tr key={record._id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900">{record.employeeId?.name || t('hr.unknownEmployee')}</div>
                                    <div className="text-xs text-gray-500 font-medium mt-0.5">{record.employeeId?.role || '-'}</div>
                                </td>

                                <td className="px-6 py-4 text-end">
                                    <span className="text-sm font-medium text-gray-600">{record.baseSalary.toLocaleString()}</span>
                                </td>

                                <td className="px-6 py-4 text-end">
                                    <div className="text-sm font-bold text-rose-600">
                                        -{(record.missingTimeDeductions + record.absenceDeductions).toLocaleString()}
                                    </div>
                                    {record.metricsTotal.totalMissingMinutes > 0 && (
                                        <div className="text-[10px] text-gray-400 mt-1">{record.metricsTotal.totalMissingMinutes}{t('hr.lblMinutes')} {t('hr.lblMissing')}</div>
                                    )}
                                </td>

                                <td className="px-6 py-4 text-end">
                                    <div className="text-sm font-bold text-emerald-600">
                                        +{record.overtimeAdditions.toLocaleString()}
                                    </div>
                                </td>

                                <td className="px-6 py-4 text-right bg-gray-50/50">
                                    <span className="text-lg font-black text-gray-900">{record.finalPayableSalary.toLocaleString()}</span> <span className="text-xs text-gray-500">{t('hr.dzdCurrency')}</span>
                                    {(record.amountPaid > 0 && record.amountPaid < record.finalPayableSalary) && (
                                        <div className="text-xs font-bold text-amber-600 mt-1 pb-1 border-b border-amber-200/50">{t('hr.lblPaid')} {record.amountPaid.toLocaleString()} {t('hr.dzdCurrency')}</div>
                                    )}
                                    {record.amountPaid > 0 && (
                                        <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">{t('hr.lblRemaining')} {(record.finalPayableSalary - record.amountPaid).toLocaleString()}</div>
                                    )}
                                </td>

                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border ${record.status === 'Pending Approval' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        record.status === 'Partially Paid' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                            record.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                'bg-gray-50 text-gray-600 border-gray-200'
                                        }`}>
                                        {record.status === 'Pending Approval' ? t('hr.statusPendingApproval') :
                                            record.status === 'Partially Paid' ? t('hr.statusPartiallyPaid') :
                                                record.status === 'Paid' ? t('hr.statusPaid') : record.status}
                                    </span>
                                </td>

                                <td className="px-6 py-4 flex justify-center gap-2">
                                    <button onClick={() => window.print()} className="p-1.5 bg-gray-100 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition" title={t('hr.downloadPayslip')}>
                                        <Download className="w-4 h-4" />
                                    </button>
                                    {record.status !== 'Paid' ? (
                                        <button onClick={() => setPaymentModal({ id: record._id, maxPayable: record.finalPayableSalary - (record.amountPaid || 0), empName: record.employeeId?.name })} className="p-1.5 bg-gray-100 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition font-bold text-xs px-3" title={t('hr.processPayment')}>
                                            {t('hr.btnPay')}
                                        </button>
                                    ) : (
                                        <span className="p-1.5 text-emerald-400"><CheckCircle className="w-4 h-4" /></span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Partial / Full Payment Modal */}
            {paymentModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-emerald-600" /> {t('hr.modalIssuePaymentTitle')}
                            </h2>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-500 mb-4">
                                {t('hr.issuingPaymentFor')} <strong className="text-gray-900">{paymentModal.empName}</strong>.
                                <br />{t('hr.remainingDeficit')} <strong className="text-rose-600">{paymentModal.maxPayable.toLocaleString()} {t('hr.dzdCurrency')}</strong>
                            </p>

                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('hr.lblPaymentAmount')}</label>
                            <input
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder={t('hr.placeholderAmount')}
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-lg font-mono px-4 py-3 border outline-none ltr:text-left rtl:text-right"
                            />

                            <button onClick={setFullPayment} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 mt-2 block ltr:ml-auto rtl:mr-auto">
                                {t('hr.clearFullBalance')} ({paymentModal.maxPayable})
                            </button>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex gap-3 ltr:flex-row-reverse rtl:flex-row border-t border-gray-100">
                            <button onClick={submitPayment} disabled={!paymentAmount || isNaN(paymentAmount) || Number(paymentAmount) <= 0 || Number(paymentAmount) > paymentModal.maxPayable} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-colors flex-1 disabled:bg-gray-300 disabled:cursor-not-allowed">
                                {t('hr.btnConfirmPayout')}
                            </button>
                            <button onClick={() => { setPaymentModal(null); setPaymentAmount(''); }} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors">
                                {t('hr.btnCancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
