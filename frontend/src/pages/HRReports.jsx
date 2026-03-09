import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Download, Calendar, User, Clock, AlertTriangle, Briefcase, FileSpreadsheet } from 'lucide-react';
import moment from 'moment';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useTranslation } from 'react-i18next';

export default function HRReports() {
    const { t } = useTranslation();
    const [activeReport, setActiveReport] = useState('monthly');
    const [period, setPeriod] = useState(moment().format('MM-YYYY'));
    const [date, setDate] = useState(moment().format('YYYY-MM-DD'));

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchReport();
    }, [activeReport, period, date]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            let res;
            if (activeReport === 'daily') {
                res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/hr/reports/daily?date=${date}`);
            } else {
                res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/hr/reports/${activeReport}?period=${period}`);
            }
            setData(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const ReportCard = ({ id, title, icon: Icon, desc }) => (
        <div
            onClick={() => setActiveReport(id)}
            className={`cursor-pointer p-4 rounded-xl border flex items-start gap-3 transition-all ${activeReport === id
                ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
                }`}
        >
            <div className={`p-2 rounded-lg ${activeReport === id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <h4 className={`font-bold text-sm ${activeReport === id ? 'text-blue-900' : 'text-gray-900'}`}>{title}</h4>
                <p className="text-xs text-gray-500 mt-1">{desc}</p>
            </div>
        </div>
    );

    const renderDailyTable = () => {
        if (!data?.records) return null;
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-start text-sm min-w-[600px]">
                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3 font-semibold">{t('hr.colEmployee')}</th>
                                <th className="px-5 py-3 font-semibold text-center">{t('hr.colWorkedTime')}</th>
                                <th className="px-5 py-3 font-semibold text-center">{t('hr.colLateOvertime')}</th>
                                <th className="px-5 py-3 font-semibold text-center">{t('hr.colStatus')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.records.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 font-medium text-gray-900">{r.employeeId?.name} <span className="text-xs text-gray-400 block">{r.employeeId?.role}</span></td>
                                    <td className="px-5 py-3 font-mono text-center">{Math.floor(r.workedMinutes / 60)}{t('hr.lblHours')} {r.workedMinutes % 60}{t('hr.lblMinutes')}</td>
                                    <td className="px-5 py-3 text-center">
                                        {r.lateMinutes > 0 ? <span className="text-red-500 font-bold">{r.lateMinutes}{t('hr.lblMinutes')} {t('hr.lblLate')}</span> :
                                            r.overtimeMinutes > 0 ? <span className="text-emerald-500 font-bold">+{r.overtimeMinutes}{t('hr.lblMinutes')} {t('hr.lblOvertime')}</span> : '-'}
                                    </td>
                                    <td className="px-5 py-3 text-center font-bold text-gray-600">{r.status}</td>
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-start text-sm min-w-[700px]">
                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3 font-semibold">{t('hr.colEmployee')}</th>
                                <th className="px-5 py-3 font-semibold text-end">{t('hr.colBaseSalary')}</th>
                                <th className="px-5 py-3 font-semibold text-end">{t('hr.colDeductionsTotal')}</th>
                                <th className="px-5 py-3 font-semibold text-end">{t('hr.colOvertimeAddition')}</th>
                                <th className="px-5 py-3 font-semibold text-end text-gray-900 ltr:border-l rtl:border-r border-gray-200">{t('hr.colFinalClearedSalary')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.records.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 font-medium text-gray-900">{r.employeeId?.name}</td>
                                    <td className="px-5 py-3 text-end text-gray-600">{r.baseSalary.toLocaleString()}</td>
                                    <td className="px-5 py-3 text-end text-red-600 font-bold">-{r.missingTimeDeductions + r.absenceDeductions}</td>
                                    <td className="px-5 py-3 text-end text-emerald-600 font-bold">+{r.overtimeAdditions}</td>
                                    <td className="px-5 py-3 text-end text-lg font-black text-gray-900 ltr:border-l rtl:border-r border-gray-100 bg-gray-50/30">{r.finalPayableSalary.toLocaleString()} {t('hr.dzdCurrency')}</td>
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-start text-sm min-w-[700px]">
                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3 font-semibold">{t('hr.colEmployee')}</th>
                                <th className="px-5 py-3 font-semibold text-end">{t('hr.colTotalLateMissedMin')}</th>
                                <th className="px-5 py-3 font-semibold text-end">{t('hr.colLossLateness')}</th>
                                <th className="px-5 py-3 font-semibold text-end">{t('hr.colLossAbsence')}</th>
                                <th className="px-5 py-3 font-semibold text-end text-rose-700">{t('hr.colTotalLiabilityDeducted')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.records.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 font-medium text-gray-900">{r.employeeId?.name}</td>
                                    <td className="px-5 py-3 text-end font-mono text-gray-600">{r.metricsTotal?.totalMissingMinutes}{t('hr.lblMinutes')}</td>
                                    <td className="px-5 py-3 text-end text-rose-500 font-medium">-{r.missingTimeDeductions}</td>
                                    <td className="px-5 py-3 text-end text-rose-500 font-medium">-{r.absenceDeductions}</td>
                                    <td className="px-5 py-3 text-end text-rose-700 font-bold bg-rose-50/30">-{Math.round(r.missingTimeDeductions + r.absenceDeductions)} {t('hr.dzdCurrency')}</td>
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-start text-sm min-w-[500px]">
                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3 font-semibold">{t('hr.colEmployee')}</th>
                                <th className="px-5 py-3 font-semibold text-center">{t('hr.colDaysWithOvertime')}</th>
                                <th className="px-5 py-3 font-semibold text-end text-emerald-700">{t('hr.colTotalExtraMinutes')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.leaders.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 font-medium text-gray-900">{r.employee?.name} <span className="text-xs text-gray-400 block">{r.employee?.role}</span></td>
                                    <td className="px-5 py-3 text-center text-gray-600 font-bold">{r.daysWithOvertime} {t('hr.daysLabel')}</td>
                                    <td className="px-5 py-3 text-end text-emerald-600 font-bold bg-emerald-50/30">{r.totalOvertimeMinutes}{t('hr.lblMinutes')}</td>
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
            return [t('hr.colEmployee'), t('hr.colRole'), t('hr.colDaysPresent'), t('hr.colLateDays'), t('hr.colAbsentDays'), t('hr.colTotalMissingMins'), t('hr.colEstSalary')];
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
            rows = data.data.map(r => [
                r.employee?.name || t('hr.unknown'),
                r.employee?.role || t('hr.unknown'),
                r.metricsTotal?.presentDays || 0,
                r.metricsTotal?.lateDays || 0,
                r.metricsTotal?.absentDays || 0,
                `${r.metricsTotal?.totalMissingMinutes || 0}${t('hr.lblMinutes')}`,
                `${r.projectedSalary?.toLocaleString() || 0} ${t('hr.dzdCurrency')}`
            ]);
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

    const handleExportPDF = () => {
        if (!data) return;
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

    const handleExportExcel = () => {
        if (!data) return;
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
        <div className="p-8 pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-200 pb-5 gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-3">
                        <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" /> {t('hr.reportsTitle')}
                    </h1>
                    <p className="text-sm sm:text-base text-gray-500 mt-2">{t('hr.reportsSubtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {activeReport === 'daily' ? (
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-gray-200 rounded-lg shadow-sm font-medium w-full sm:w-auto flex-1 sm:flex-none text-sm px-3 py-2" />
                    ) : (
                        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="border-gray-200 rounded-lg shadow-sm font-bold text-gray-700 w-full sm:w-auto flex-1 sm:flex-none text-sm px-3 py-2">
                            <option value={moment().format('MM-YYYY')}>{moment().format('MMMM YYYY')}</option>
                            <option value={moment().subtract(1, 'months').format('MM-YYYY')}>{moment().subtract(1, 'months').format('MMMM YYYY')}</option>
                        </select>
                    )}
                    <button onClick={handleExportExcel} disabled={!data} className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-green-700 hover:border-green-300 px-4 py-2 rounded-lg font-bold shadow-sm transition-colors disabled:opacity-50 text-sm whitespace-nowrap">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" /> {t('hr.btnExcel')}
                    </button>
                    <button onClick={handleExportPDF} disabled={!data} className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-black transition-colors disabled:opacity-50 text-sm whitespace-nowrap">
                        <Download className="w-4 h-4" /> {t('hr.btnPdf')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                <ReportCard id="daily" title={t('hr.reportDailyTitle')} desc={t('hr.reportDailyDesc')} icon={Calendar} />
                <ReportCard id="monthly" title={t('hr.reportMonthlyTitle')} desc={t('hr.reportMonthlyDesc')} icon={Briefcase} />
                <ReportCard id="payroll" title={t('hr.reportPayrollTitle')} desc={t('hr.reportPayrollDesc')} icon={User} />
                <ReportCard id="overtime" title={t('hr.reportOvertimeTitle')} desc={t('hr.reportOvertimeDesc')} icon={Clock} />
                <ReportCard id="deductions" title={t('hr.reportDeductionsTitle')} desc={t('hr.reportDeductionsDesc')} icon={AlertTriangle} />
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-blue-900 capitalize text-lg">{t('hr.reportExtract')} - {activeReport}</h3>
                            <p className="text-blue-600 text-sm mt-0.5">{t('hr.lblParameters')} {activeReport === 'daily' ? date : period}</p>
                        </div>
                        <div className="px-4 py-1.5 bg-white rounded-full text-xs font-bold text-gray-500 border border-gray-100 shadow-sm">
                            {data?.records?.length ?? data?.data?.length ?? data?.leaders?.length ?? 0} {t('hr.resultsGenerated')}
                        </div>
                    </div>

                    {activeReport === 'daily' && renderDailyTable()}
                    {activeReport === 'payroll' && renderPayrollTable()}
                    {activeReport === 'deductions' && renderDeductionsTable()}
                    {activeReport === 'overtime' && renderOvertimeTable()}

                    {activeReport === 'monthly' && (
                        <div className="mt-8 text-center p-10 bg-white border border-gray-200 rounded-xl border-dashed hover:border-blue-300 transition-colors">
                            <Briefcase className="w-10 h-10 text-blue-500 mx-auto mb-3 opacity-60" />
                            <p className="text-gray-900 font-bold mb-1">{t('hr.monthlyMatrixReady')}</p>
                            <p className="text-gray-500 font-medium text-sm">{t('hr.monthlyMatrixExcelNotice')}</p>
                            <div className="flex justify-center gap-3 mt-6">
                                <button onClick={handleExportExcel} disabled={!data} className="px-5 py-2.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold rounded-lg transition-colors border border-green-200 shadow-sm flex items-center gap-2">
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
