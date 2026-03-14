import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import { FileText, Download, Calendar, User, Clock, AlertTriangle, Briefcase, FileSpreadsheet } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { toMMYYYY, toISODate, fmtMonthYear, subtract } from '../utils/dateUtils';
import { useTranslation } from 'react-i18next';

export default function HRReports() {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const [activeReport, setActiveReport] = useState('monthly');
    const [period, setPeriod] = useState(toMMYYYY());
    const [date, setDate] = useState(toISODate());

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        fetchReport();
    }, [activeReport, period, date]);

    const fetchReport = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const url = activeReport === 'daily'
                ? `/api/hr/reports/daily?date=${date}`
                : `/api/hr/reports/${activeReport}?period=${period}`;
            const res = await apiFetch(url);
            if (!res.ok) throw new Error(t('hr.errorLoadReport', 'Failed to load report data.'));
            const json = await res.json();
            setData(json.data ?? json);
        } catch (error) {
            setFetchError(error.message || t('hr.errorLoadReport', 'Failed to load report data.'));
        } finally {
            setLoading(false);
        }
    };

    const ReportCard = ({ id, title, icon: Icon, desc }) => (
        <div
            onClick={() => setActiveReport(id)}
            className={`cursor-pointer p-4 rounded-xl border flex items-start gap-3 transition-all ${activeReport === id
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/30 shadow-sm ring-1 ring-blue-500/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
        >
            <div className={`p-2 rounded-lg ${activeReport === id ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <h4 className={`font-bold text-sm ${activeReport === id ? 'text-blue-900 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>{title}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
            </div>
        </div>
    );

    const renderDailyTable = () => {
        if (!data?.records) return null;
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
                <div className="overflow-x-auto">
                    <table className="cf-table min-w-[600px]">
                        <thead>
                            <tr>
                                <th>{t('hr.colEmployee')}</th>
                                <th className="text-center">{t('hr.colWorkedTime')}</th>
                                <th className="text-center">{t('hr.colLateOvertime')}</th>
                                <th className="text-center">{t('hr.colStatus')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.records.length === 0 && (
                                <tr><td colSpan="4" className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">{t('hr.noDataForPeriod', 'No records for this period')}</td></tr>
                            )}
                            {data.records.map((r) => (
                                <tr key={r.employeeId?._id || r._id}>
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{r.employeeId?.name} <span className="text-xs text-gray-400 dark:text-gray-500 block">{r.employeeId?.role}</span></td>
                                    <td className="px-5 py-3 font-mono text-center">{Math.floor(r.workedMinutes / 60)}{t('hr.lblHours')} {r.workedMinutes % 60}{t('hr.lblMinutes')}</td>
                                    <td className="px-5 py-3 text-center">
                                        {r.lateMinutes > 0 ? <span className="text-red-500 font-bold">{r.lateMinutes}{t('hr.lblMinutes')} {t('hr.lblLate')}</span> :
                                            r.overtimeMinutes > 0 ? <span className="text-emerald-500 font-bold">+{r.overtimeMinutes}{t('hr.lblMinutes')} {t('hr.lblOvertime')}</span> : '-'}
                                    </td>
                                    <td className="px-5 py-3 text-center font-bold text-gray-600 dark:text-gray-300">{r.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderPayrollTable = () => {
        if (!data?.records) return null;
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
                <div className="overflow-x-auto">
                    <table className="cf-table min-w-[700px]">
                        <thead>
                            <tr>
                                <th>{t('hr.colEmployee')}</th>
                                <th className="text-end">{t('hr.colBaseSalary')}</th>
                                <th className="text-end">{t('hr.colDeductionsTotal')}</th>
                                <th className="text-end">{t('hr.colOvertimeAddition')}</th>
                                <th className="text-end text-gray-900 dark:text-white ltr:border-l rtl:border-r border-gray-200 dark:border-gray-600">{t('hr.colFinalClearedSalary')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.records.length === 0 && (
                                <tr><td colSpan="5" className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">{t('hr.noDataForPeriod', 'No records for this period')}</td></tr>
                            )}
                            {data.records.map((r) => (
                                <tr key={r.employeeId?._id || r._id}>
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{r.employeeId?.name}</td>
                                    <td className="px-5 py-3 text-end text-gray-600 dark:text-gray-300">{(r.baseSalary || 0).toLocaleString()}</td>
                                    <td className="px-5 py-3 text-end text-red-600 font-bold">-{r.missingTimeDeductions + r.absenceDeductions}</td>
                                    <td className="px-5 py-3 text-end text-emerald-600 font-bold">+{r.overtimeAdditions}</td>
                                    <td className="px-5 py-3 text-end text-lg font-black text-gray-900 dark:text-white ltr:border-l rtl:border-r border-gray-100 dark:border-gray-600 bg-gray-50/30 dark:bg-gray-700/30">{(r.finalPayableSalary || 0).toLocaleString()} {t('hr.dzdCurrency')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderDeductionsTable = () => {
        if (!data?.records) return null;
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
                <div className="overflow-x-auto">
                    <table className="cf-table min-w-[700px]">
                        <thead>
                            <tr>
                                <th>{t('hr.colEmployee')}</th>
                                <th className="text-end">{t('hr.colTotalLateMissedMin')}</th>
                                <th className="text-end">{t('hr.colLossLateness')}</th>
                                <th className="text-end">{t('hr.colLossAbsence')}</th>
                                <th className="text-end text-rose-700 dark:text-rose-400">{t('hr.colTotalLiabilityDeducted')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.records.length === 0 && (
                                <tr><td colSpan="5" className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">{t('hr.noDataForPeriod', 'No records for this period')}</td></tr>
                            )}
                            {data.records.map((r) => (
                                <tr key={r.employeeId?._id || r._id}>
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{r.employeeId?.name}</td>
                                    <td className="px-5 py-3 text-end font-mono text-gray-600 dark:text-gray-300">{r.metricsTotal?.totalMissingMinutes}{t('hr.lblMinutes')}</td>
                                    <td className="px-5 py-3 text-end text-rose-500 font-medium">-{r.missingTimeDeductions}</td>
                                    <td className="px-5 py-3 text-end text-rose-500 font-medium">-{r.absenceDeductions}</td>
                                    <td className="px-5 py-3 text-end text-rose-700 dark:text-rose-400 font-bold bg-rose-50/30 dark:bg-rose-900/20">-{Math.round(r.missingTimeDeductions + r.absenceDeductions)} {t('hr.dzdCurrency')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderOvertimeTable = () => {
        if (!data?.leaders) return null;
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
                <div className="overflow-x-auto">
                    <table className="cf-table min-w-[500px]">
                        <thead>
                            <tr>
                                <th>{t('hr.colEmployee')}</th>
                                <th className="text-center">{t('hr.colDaysWithOvertime')}</th>
                                <th className="text-end text-emerald-700 dark:text-emerald-400">{t('hr.colTotalExtraMinutes')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.leaders.length === 0 && (
                                <tr><td colSpan="3" className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">{t('hr.noDataForPeriod', 'No records for this period')}</td></tr>
                            )}
                            {data.leaders.map((r) => (
                                <tr key={r.employee?._id || r._id}>
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{r.employee?.name} <span className="text-xs text-gray-400 dark:text-gray-500 block">{r.employee?.role}</span></td>
                                    <td className="px-5 py-3 text-center text-gray-600 dark:text-gray-300 font-bold">{r.daysWithOvertime} {t('hr.daysLabel')}</td>
                                    <td className="px-5 py-3 text-end text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/30 dark:bg-emerald-900/20">{r.totalOvertimeMinutes}{t('hr.lblMinutes')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const getReportTitle = () => {
        const titleMap = {
            'daily': `${t('hr.pdfDaily')} ${date}`,
            'monthly': `${t('hr.pdfMonthly')} ${period}`,
            'payroll': `${t('hr.pdfPayroll')} ${period}`,
            'overtime': `${t('hr.pdfOvertime')} ${period}`,
            'deductions': `${t('hr.pdfDeductions')} ${period}`
        };
        return titleMap[activeReport];
    };

    const getTableColumns = () => {
        if (activeReport === 'daily') {
            return [t('hr.colEmployee'), t('hr.colRole'), t('hr.colWorkedTime'), t('hr.colLateOvertime'), t('hr.colStatus')];
        }
        if (activeReport === 'monthly') {
            return [t('hr.colEmployee'), t('hr.colRole'), t('hr.colDaysPresent'), t('hr.colLateDays'), t('hr.colAbsentDays'), t('hr.colTotalLateMin'), t('hr.colTotalOvertimeMin')];
        }
        if (activeReport === 'payroll') {
            return [t('hr.colEmployee'), t('hr.colBaseSalary'), t('hr.colDeductionsTotal'), t('hr.colOvertimeAddition'), t('hr.colFinalClearedSalary')];
        }
        if (activeReport === 'deductions') {
            return [t('hr.colEmployee'), t('hr.colTotalLateMissedMin'), t('hr.colLossLateness'), t('hr.colLossAbsence'), t('hr.colTotalLiabilityDeducted')];
        }
        if (activeReport === 'overtime') {
            return [t('hr.colEmployee'), t('hr.colRole'), t('hr.colDaysWithOvertime'), t('hr.colTotalExtraMinutes')];
        }
        return [];
    };

    const getTableRows = () => {
        let rows = [];
        if (activeReport === 'daily' && data?.records) {
            rows = data.records.map(r => [
                r.employeeId?.name || t('hr.unknown'),
                r.employeeId?.role || t('hr.unknown'),
                `${Math.floor(r.workedMinutes / 60)}${t('hr.lblHours')} ${r.workedMinutes % 60}${t('hr.lblMinutes')}`,
                r.lateMinutes > 0 ? `${r.lateMinutes}${t('hr.lblMinutes')} ${t('hr.lblLate')}` : (r.overtimeMinutes > 0 ? `+${r.overtimeMinutes}${t('hr.lblMinutes')} ${t('hr.lblOvertime')}` : '-'),
                r.status || t('hr.unknown')
            ]);
        }
        else if (activeReport === 'monthly' && data?.data) {
            rows = data.data.map(r => {
                const days = Object.values(r.days || {});
                const presentDays = days.filter(d => d.status !== 'Absent').length;
                const totalLateMin = days.reduce((acc, d) => acc + (d.lateMin || 0), 0);
                return [
                    r.employee?.name || t('hr.unknown'),
                    r.employee?.role || t('hr.unknown'),
                    presentDays,
                    r.monthSummary?.lateDays || 0,
                    r.monthSummary?.absentDays || 0,
                    `${totalLateMin}${t('hr.lblMinutes')}`,
                    `${r.monthSummary?.totalOvertimeMin || 0}${t('hr.lblMinutes')}`
                ];
            });
        }
        else if (activeReport === 'payroll' && data?.records) {
            rows = data.records.map(r => [
                r.employeeId?.name || t('hr.unknown'),
                r.baseSalary || 0,
                (r.missingTimeDeductions || 0) + (r.absenceDeductions || 0),
                r.overtimeAdditions || 0,
                r.finalPayableSalary || 0
            ]);
        }
        else if (activeReport === 'deductions' && data?.records) {
            rows = data.records.map(r => [
                r.employeeId?.name || t('hr.unknown'),
                `${r.metricsTotal?.totalMissingMinutes || 0}${t('hr.lblMinutes')}`,
                r.missingTimeDeductions || 0,
                r.absenceDeductions || 0,
                Math.round((r.missingTimeDeductions || 0) + (r.absenceDeductions || 0))
            ]);
        }
        else if (activeReport === 'overtime' && data?.leaders) {
            rows = data.leaders.map(r => [
                r.employee?.name || t('hr.unknown'),
                r.employee?.role || t('hr.unknown'),
                r.daysWithOvertime || 0,
                `${r.totalOvertimeMinutes || 0}${t('hr.lblMinutes')}`
            ]);
        }
        return rows;
    };

    const handleExportPDF = async () => {
        if (!data) return;
        const { default: jsPDF } = await import('jspdf');
        await import('jspdf-autotable');
        const doc = new jsPDF();
        const title = getReportTitle();
        doc.setFontSize(16);
        doc.text(title, 14, 20);

        doc.autoTable({
            startY: 30,
            head: [getTableColumns()],
            body: getTableRows(),
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }
        });

        doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    };

    const handleExportExcel = async () => {
        if (!data) return;
        const XLSX = await import('xlsx');
        const { saveAs } = await import('file-saver');
        const wsData = [getTableColumns(), ...getTableRows()];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");

        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        const title = getReportTitle();
        saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={t('hr.reportsTitle', 'Analytical Intelligence')}
                subtitle={t('hr.reportsSubtitle', 'Comprehensive visibility into workforce performance and financial liabilities.')}
                variant="hr"
                actions={
                    <div className="flex flex-wrap gap-3">
                        {activeReport === 'daily' ? (
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 text-gray-700 dark:text-gray-100 text-sm font-bold outline-none focus:ring-2 focus:ring-[#5D5DFF] transition-all cursor-pointer" />
                        ) : (
                            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 text-gray-700 dark:text-gray-100 text-sm font-bold outline-none focus:ring-2 focus:ring-[#5D5DFF] transition-all">
                                {Array.from({ length: 6 }, (_, i) => {
                                    const m = subtract(new Date(), i, 'months');
                                    return <option key={i} value={toMMYYYY(m)}>{fmtMonthYear(m)}</option>;
                                })}
                            </select>
                        )}
                        <button onClick={handleExportExcel} disabled={!data} className="flex items-center gap-2 px-4 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 leading-none disabled:opacity-50">
                            <FileSpreadsheet className="w-4 h-4" /> {t('hr.btnExcel', 'Excel')}
                        </button>
                        <button onClick={handleExportPDF} disabled={!data} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-all hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-95 leading-none disabled:opacity-50">
                            <Download className="w-4 h-4" /> {t('hr.btnPdf', 'PDF')}
                        </button>
                    </div>
                }
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-8">
                <ReportCard id="daily" title={t('hr.reportDailyTitle')} desc={t('hr.reportDailyDesc')} icon={Calendar} />
                <ReportCard id="monthly" title={t('hr.reportMonthlyTitle')} desc={t('hr.reportMonthlyDesc')} icon={Briefcase} />
                <ReportCard id="payroll" title={t('hr.reportPayrollTitle')} desc={t('hr.reportPayrollDesc')} icon={User} />
                <ReportCard id="overtime" title={t('hr.reportOvertimeTitle')} desc={t('hr.reportOvertimeDesc')} icon={Clock} />
                <ReportCard id="deductions" title={t('hr.reportDeductionsTitle')} desc={t('hr.reportDeductionsDesc')} icon={AlertTriangle} />
            </div>

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
                </div>
            )}
            {loading ? (
                <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div></div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-5 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-blue-900 dark:text-blue-300 capitalize text-lg">{t('hr.reportExtract')} - {activeReport}</h3>
                            <p className="text-blue-600 dark:text-blue-400 text-sm mt-0.5">{t('hr.lblParameters')} {activeReport === 'daily' ? date : period}</p>
                        </div>
                        <div className="px-4 py-1.5 bg-white dark:bg-gray-800 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700 shadow-sm">
                            {data?.records?.length ?? data?.data?.length ?? data?.leaders?.length ?? 0} {t('hr.resultsGenerated')}
                        </div>
                    </div>

                    {activeReport === 'daily' && renderDailyTable()}
                    {activeReport === 'payroll' && renderPayrollTable()}
                    {activeReport === 'deductions' && renderDeductionsTable()}
                    {activeReport === 'overtime' && renderOvertimeTable()}

                    {activeReport === 'monthly' && (
                        <div className="mt-8 text-center p-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl border-dashed hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                            <Briefcase className="w-10 h-10 text-blue-500 mx-auto mb-3 opacity-60" />
                            <p className="text-gray-900 dark:text-white font-bold mb-1">{t('hr.monthlyMatrixReady')}</p>
                            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">{t('hr.monthlyMatrixExcelNotice')}</p>
                            <div className="flex justify-center gap-3 mt-6">
                                <button onClick={handleExportExcel} disabled={!data} className="px-5 py-2.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 font-bold rounded-lg transition-colors border border-green-200 dark:border-green-800 shadow-sm flex items-center gap-2">
                                    <FileSpreadsheet className="w-4 h-4" /> {t('hr.btnExportCsvXlsx')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
