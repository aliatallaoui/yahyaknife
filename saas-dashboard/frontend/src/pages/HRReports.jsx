import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Download, Calendar, User, Clock, AlertTriangle, Briefcase, FileSpreadsheet } from 'lucide-react';
import moment from 'moment';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function HRReports() {
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
                res = await axios.get(`/api/hr/reports/daily?date=${date}`);
            } else {
                res = await axios.get(`/api/hr/reports/${activeReport}?period=${period}`);
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
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                        <tr>
                            <th className="px-5 py-3 font-semibold">Employee</th>
                            <th className="px-5 py-3 font-semibold text-center">Worked Time</th>
                            <th className="px-5 py-3 font-semibold text-center">Late / Overtime</th>
                            <th className="px-5 py-3 font-semibold text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.records.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-5 py-3 font-medium text-gray-900">{r.employeeId?.name} <span className="text-xs text-gray-400 block">{r.employeeId?.role}</span></td>
                                <td className="px-5 py-3 font-mono text-center">{Math.floor(r.workedMinutes / 60)}h {r.workedMinutes % 60}m</td>
                                <td className="px-5 py-3 text-center">
                                    {r.lateMinutes > 0 ? <span className="text-red-500 font-bold">{r.lateMinutes}m Late</span> :
                                        r.overtimeMinutes > 0 ? <span className="text-emerald-500 font-bold">+{r.overtimeMinutes}m OT</span> : '-'}
                                </td>
                                <td className="px-5 py-3 text-center font-bold text-gray-600">{r.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    };

    const renderPayrollTable = () => {
        if (!data?.records) return null;
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                        <tr>
                            <th className="px-5 py-3 font-semibold">Employee</th>
                            <th className="px-5 py-3 font-semibold text-right">Base Salary</th>
                            <th className="px-5 py-3 font-semibold text-right">Deductions</th>
                            <th className="px-5 py-3 font-semibold text-right">Overtime Addition</th>
                            <th className="px-5 py-3 font-semibold text-right text-gray-900 border-l border-gray-200">Final Cleared Salary</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.records.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-5 py-3 font-medium text-gray-900">{r.employeeId?.name}</td>
                                <td className="px-5 py-3 text-right text-gray-600">{r.baseSalary.toLocaleString()}</td>
                                <td className="px-5 py-3 text-right text-red-600 font-bold">-{r.missingTimeDeductions + r.absenceDeductions}</td>
                                <td className="px-5 py-3 text-right text-emerald-600 font-bold">+{r.overtimeAdditions}</td>
                                <td className="px-5 py-3 text-right text-lg font-black text-gray-900 border-l border-gray-100 bg-gray-50/30">{r.finalPayableSalary.toLocaleString()} DZD</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    };

    const renderDeductionsTable = () => {
        if (!data?.records) return null;
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                        <tr>
                            <th className="px-5 py-3 font-semibold">Employee</th>
                            <th className="px-5 py-3 font-semibold text-right">Total Late/Missed (Min)</th>
                            <th className="px-5 py-3 font-semibold text-right">Loss from Lateness</th>
                            <th className="px-5 py-3 font-semibold text-right">Loss from Absence</th>
                            <th className="px-5 py-3 font-semibold text-right text-rose-700">Total Liability Deducted</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.records.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-5 py-3 font-medium text-gray-900">{r.employeeId?.name}</td>
                                <td className="px-5 py-3 text-right font-mono text-gray-600">{r.metricsTotal?.totalMissingMinutes}m</td>
                                <td className="px-5 py-3 text-right text-rose-500 font-medium">-{r.missingTimeDeductions}</td>
                                <td className="px-5 py-3 text-right text-rose-500 font-medium">-{r.absenceDeductions}</td>
                                <td className="px-5 py-3 text-right text-rose-700 font-bold bg-rose-50/30">-{Math.round(r.missingTimeDeductions + r.absenceDeductions)} DZD</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    };

    const renderOvertimeTable = () => {
        if (!data?.leaders) return null;
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                        <tr>
                            <th className="px-5 py-3 font-semibold">Employee</th>
                            <th className="px-5 py-3 font-semibold text-center">Days with Overtime</th>
                            <th className="px-5 py-3 font-semibold text-right text-emerald-700">Total Extra Minutes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.leaders.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-5 py-3 font-medium text-gray-900">{r.employee?.name} <span className="text-xs text-gray-400 block">{r.employee?.role}</span></td>
                                <td className="px-5 py-3 text-center text-gray-600 font-bold">{r.daysWithOvertime} Days</td>
                                <td className="px-5 py-3 text-right text-emerald-600 font-bold bg-emerald-50/30">{r.totalOvertimeMinutes}m</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    };

    const getReportTitle = () => {
        const titleMap = {
            'daily': `Daily Attendance Report - ${date}`,
            'monthly': `Monthly HR Matrix - ${period}`,
            'payroll': `Payroll Clearance Report - ${period}`,
            'overtime': `Overtime Leaders Report - ${period}`,
            'deductions': `Deductions & Liabilities - ${period}`
        };
        return titleMap[activeReport];
    };

    const getTableColumns = () => {
        if (activeReport === 'daily') {
            return ["Employee", "Role", "Worked Time", "Late / Overtime", "Status"];
        }
        if (activeReport === 'monthly') {
            return ["Employee", "Role", "Days Present", "Late Days", "Absent Days", "Total Missing Mins", "Est. Salary"];
        }
        if (activeReport === 'payroll') {
            return ["Employee", "Base Salary", "Missing/Absence Deductions", "Overtime Additions", "Final Cleared Salary"];
        }
        if (activeReport === 'deductions') {
            return ["Employee", "Total Late/Missed (Min)", "Loss from Lateness", "Loss from Absence", "Total Liability Deducted"];
        }
        if (activeReport === 'overtime') {
            return ["Employee", "Role", "Days with Overtime", "Total Extra Minutes"];
        }
        return [];
    };

    const getTableRows = () => {
        let rows = [];
        if (activeReport === 'daily' && data?.records) {
            rows = data.records.map(r => [
                r.employeeId?.name || 'Unknown',
                r.employeeId?.role || 'Unknown',
                `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m`,
                r.lateMinutes > 0 ? `${r.lateMinutes}m Late` : (r.overtimeMinutes > 0 ? `+${r.overtimeMinutes}m OT` : '-'),
                r.status || 'Unknown'
            ]);
        }
        else if (activeReport === 'monthly' && data?.data) {
            rows = data.data.map(r => [
                r.employee?.name || 'Unknown',
                r.employee?.role || 'Unknown',
                r.metricsTotal?.presentDays || 0,
                r.metricsTotal?.lateDays || 0,
                r.metricsTotal?.absentDays || 0,
                `${r.metricsTotal?.totalMissingMinutes || 0}m`,
                `${r.projectedSalary?.toLocaleString() || 0} DZD`
            ]);
        }
        else if (activeReport === 'payroll' && data?.records) {
            rows = data.records.map(r => [
                r.employeeId?.name || 'Unknown',
                r.baseSalary || 0,
                (r.missingTimeDeductions || 0) + (r.absenceDeductions || 0),
                r.overtimeAdditions || 0,
                r.finalPayableSalary || 0
            ]);
        }
        else if (activeReport === 'deductions' && data?.records) {
            rows = data.records.map(r => [
                r.employeeId?.name || 'Unknown',
                `${r.metricsTotal?.totalMissingMinutes || 0}m`,
                r.missingTimeDeductions || 0,
                r.absenceDeductions || 0,
                Math.round((r.missingTimeDeductions || 0) + (r.absenceDeductions || 0))
            ]);
        }
        else if (activeReport === 'overtime' && data?.leaders) {
            rows = data.leaders.map(r => [
                r.employee?.name || 'Unknown',
                r.employee?.role || 'Unknown',
                r.daysWithOvertime || 0,
                `${r.totalOvertimeMinutes || 0}m`
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
            <div className="flex justify-between items-start mb-8 border-b border-gray-200 pb-5">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <FileText className="w-8 h-8 text-blue-600" /> HR Data & Reports
                    </h1>
                    <p className="text-gray-500 mt-2">Generate aggregated exports for Attendance, Deductions, and Salary Clearance.</p>
                </div>
                <div className="flex items-center gap-3">
                    {activeReport === 'daily' ? (
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-gray-200 rounded-lg shadow-sm font-medium" />
                    ) : (
                        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="border-gray-200 rounded-lg shadow-sm font-bold text-gray-700">
                            <option value={moment().format('MM-YYYY')}>{moment().format('MMMM YYYY')}</option>
                            <option value={moment().subtract(1, 'months').format('MM-YYYY')}>{moment().subtract(1, 'months').format('MMMM YYYY')}</option>
                        </select>
                    )}
                    <button onClick={handleExportExcel} disabled={!data} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-green-700 hover:border-green-300 px-4 py-2 rounded-lg font-bold shadow-sm transition-colors disabled:opacity-50">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
                    </button>
                    <button onClick={handleExportPDF} disabled={!data} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-black transition-colors disabled:opacity-50">
                        <Download className="w-4 h-4" /> PDF
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                <ReportCard id="daily" title="Daily Status" desc="Single day snapshot" icon={Calendar} />
                <ReportCard id="monthly" title="Monthly Matrix" desc="30-day employee grid" icon={Briefcase} />
                <ReportCard id="payroll" title="Payroll Clears" desc="Gross vs Net calculations" icon={User} />
                <ReportCard id="overtime" title="Overtime Board" desc="Highest earners" icon={Clock} />
                <ReportCard id="deductions" title="Deductions & Losses" desc="Lateness liabilities" icon={AlertTriangle} />
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-blue-900 capitalize text-lg">{activeReport} Report Extract</h3>
                            <p className="text-blue-600 text-sm mt-0.5">Parameters: {activeReport === 'daily' ? date : period}</p>
                        </div>
                        <div className="px-4 py-1.5 bg-white rounded-full text-xs font-bold text-gray-500 border border-gray-100 shadow-sm">
                            {data?.records?.length ?? data?.data?.length ?? data?.leaders?.length ?? 0} Results Generated
                        </div>
                    </div>

                    {activeReport === 'daily' && renderDailyTable()}
                    {activeReport === 'payroll' && renderPayrollTable()}
                    {activeReport === 'deductions' && renderDeductionsTable()}
                    {activeReport === 'overtime' && renderOvertimeTable()}

                    {activeReport === 'monthly' && (
                        <div className="mt-8 text-center p-10 bg-white border border-gray-200 rounded-xl border-dashed hover:border-blue-300 transition-colors">
                            <Briefcase className="w-10 h-10 text-blue-500 mx-auto mb-3 opacity-60" />
                            <p className="text-gray-900 font-bold mb-1">Monthly Matrix Spreadsheet Ready</p>
                            <p className="text-gray-500 font-medium text-sm">Monthly Matrix is best viewed in Excel format due to wide grid boundaries.</p>
                            <div className="flex justify-center gap-3 mt-6">
                                <button onClick={handleExportExcel} disabled={!data} className="px-5 py-2.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold rounded-lg transition-colors border border-green-200 shadow-sm flex items-center gap-2">
                                    <FileSpreadsheet className="w-4 h-4" /> Export CSV / XLSX
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
