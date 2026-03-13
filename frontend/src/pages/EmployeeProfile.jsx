import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, User, Briefcase, Calendar, MapPin, Phone, Mail,
    Clock, CheckCircle, XCircle, AlertCircle, Wallet, TrendingUp, TrendingDown,
    FileText, Activity
} from 'lucide-react';
import { fmtShortDate, fmtMediumDate, fmtFullDate, fmtMonthYear, fmtWeekdayDate, fmtTime, toISODate, toMMYYYY, parseMMYYYY, diffDays } from '../utils/dateUtils';
import clsx from 'clsx';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../utils/apiFetch';
import PageHeader from '../components/PageHeader';

export default function EmployeeProfile() {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const { id } = useParams();
    const navigate = useNavigate();

    const [employee, setEmployee] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [payrolls, setPayrolls] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const [activeTab, setActiveTab] = useState('attendance'); // attendance | payroll | leaves

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [empRes, attRes, payRes, leaveRes] = await Promise.all([
                    apiFetch(`/api/hr/employees/${id}`),
                    apiFetch(`/api/hr/employees/${id}/attendance`),
                    apiFetch(`/api/hr/payroll?employeeId=${id}`),
                    apiFetch(`/api/hr/leaves?employeeId=${id}`)
                ]);

                if (!empRes.ok) throw new Error('Employee not found');

                const empJson = await empRes.json();
                setEmployee(empJson.data ?? empJson);
                if (attRes.ok) {
                    const attJson = await attRes.json();
                    setAttendance(attJson.data ?? (Array.isArray(attJson) ? attJson : []));
                }
                if (payRes.ok) {
                    const payJson = await payRes.json();
                    setPayrolls(payJson.data ?? (Array.isArray(payJson) ? payJson : []));
                }
                if (leaveRes.ok) {
                    const leaveJson = await leaveRes.json();
                    setLeaves(leaveJson.data ?? (Array.isArray(leaveJson) ? leaveJson : []));
                }
            } catch (err) {
                setFetchError(err.message === 'Employee not found' ? null : t('hr.errorLoadEmployee', 'Failed to load employee data.'));
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) return (
        <div className="flex justify-center items-center h-screen">
            <div className="w-8 h-8 rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 animate-spin"></div>
        </div>
    );

    if (!employee) return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
            <User className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" />
            {fetchError
                ? <><AlertCircle className="w-10 h-10 mb-2 text-red-400" /><h2 className="text-xl font-bold text-red-600 dark:text-red-400">{fetchError}</h2></>
                : <h2 className="text-xl font-bold dark:text-gray-300">{t('hr.empNotFound', 'Employee not found')}</h2>
            }
            <button onClick={() => navigate('/hr')} className="mt-4 text-blue-600 hover:underline">{t('hr.btnReturnDirectory', 'Return to Directory')}</button>
        </div>
    );

    // ==========================================
    // Analytics Math
    // ==========================================
    const currentMonthPrefix = toISODate().slice(0, 7);
    const thisMonthAttendance = attendance.filter(a => a.date.startsWith(currentMonthPrefix));

    // Attendance Summaries
    const workedDaysAmount = thisMonthAttendance.filter(a => a.workedMinutes > 0).length;
    const latesAmount = thisMonthAttendance.filter(a => a.lateMinutes > 0).length;
    const absencesAmount = thisMonthAttendance.filter(a => a.status === 'Absent').length;
    const totalOvertimeMin = thisMonthAttendance.reduce((sum, a) => sum + (a.overtimeMinutes || 0), 0);
    const totalMissingMin = thisMonthAttendance.reduce((sum, a) => sum + (a.missingMinutes || 0), 0);
    const totalWorkedMin = thisMonthAttendance.reduce((sum, a) => sum + (a.workedMinutes || 0), 0);
    const totalRequiredMin = thisMonthAttendance.reduce((sum, a) => sum + (a.requiredMinutes || 0), 0);

    // Salary Summaries
    const baseSalary = employee.contractSettings?.monthlySalary || employee.salary || 0;
    const reqMinutesPerDay = employee.contractSettings?.dailyRequiredMinutes || 480;
    const wagePerMin = baseSalary / (22 * reqMinutesPerDay);

    const missingDeductions = Math.round(totalMissingMin * wagePerMin);
    const overtimeBonus = Math.round(totalOvertimeMin * wagePerMin * (employee.contractSettings?.overtimeRateMultiplier || 1.5));
    const absenceDeduct = Math.round(absencesAmount * (baseSalary / 22));
    const estGrossSalary = Math.round(baseSalary + overtimeBonus - missingDeductions - absenceDeduct);

    // Calculate previously paid salary specifically for this month
    const paidThisMonth = payrolls.filter(p => p.period === toMMYYYY() && p.status === 'Paid')
        .reduce((sum, p) => sum + p.finalPayableSalary, 0);
    const unpaidEst = Math.max(0, estGrossSalary - paidThisMonth);

    // Today status
    const todayStr = toISODate();
    const todayAtt = attendance.find(a => a.date === todayStr);

    const formatHHMM = (dateStr) => dateStr ? fmtTime(dateStr) : '--:--';
    const formatHours = (mins) => `${Math.floor(mins / 60)}${t('hr.lblHours', 'h')} ${mins % 60}${t('hr.lblMinutes', 'm')}`;

    // Chart Data (Last 14 days work time)
    const chartData = [...attendance].slice(0, 14).reverse().map(a => ({
        date: fmtShortDate(a.date),
        worked: parseFloat((a.workedMinutes / 60).toFixed(1)),
        required: parseFloat((a.requiredMinutes / 60).toFixed(1))
    }));

    return (
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-10">
            <PageHeader
                title={t('hr.empProfileTitle', 'Employee Profile')}
                subtitle={t('hr.empProfileSubtitle', 'Comprehensive overview of performance, attendance, and payroll projections.')}
                variant="hr"
                actions={
                    <button
                        onClick={() => navigate('/hr')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 backdrop-blur-md active:scale-95 leading-none"
                    >
                        <ArrowLeft className="w-4 h-4 ltr:scale-x-100 rtl:-scale-x-100" /> {t('hr.btnReturnDirectory', 'Return')}
                    </button>
                }
            />

            {/* Top Grid: Identity & Salary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">

                {/* 1. Identity Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 sm:p-8 flex flex-col items-center relative overflow-hidden">
                    <div className="absolute top-0 w-full h-32 bg-gradient-to-br from-blue-600 to-blue-400 opacity-10"></div>

                    <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-4xl font-extrabold text-white mb-4 shadow-xl shadow-blue-600/20 z-10 border-4 border-white dark:border-gray-800">
                        {employee.name?.charAt(0)}
                    </div>

                    <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white text-center z-10">{employee.name}</h2>
                    <p className="text-blue-600 font-bold mb-6 text-sm flex items-center gap-1.5 z-10">
                        <Briefcase className="w-4 h-4" /> {employee.role}
                    </p>

                    <div className="w-full space-y-4">
                        <ProfileRow icon={HashIcon} label={t('hr.lblEmployeeId')} value={employee.employeeId || employee._id.slice(-6).toUpperCase()} />
                        <ProfileRow icon={LayersIcon} label={t('hr.lblDepartment')} value={employee.department} />
                        <ProfileRow icon={Calendar} label={t('hr.lblStartDate')} value={fmtFullDate(employee.joinDate)} />
                        <ProfileRow icon={Mail} label={t('hr.lblEmail')} value={employee.email || t('hr.na')} />
                        <ProfileRow icon={Activity} label={t('hr.lblContractStatus')} value={employee.status === 'Active' ? t('hr.activeLabel') || employee.status : employee.status} highlight={employee.status === 'Active'} />
                    </div>
                </div>

                {/* 2. Salary Summary */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 lg:p-8 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Wallet className="w-5 h-5 text-blue-500" /> {t('hr.livePayrollProjection')}</h3>
                            <span className="text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full">{fmtMonthYear()}</span>
                        </div>

                        <div className="mb-8">
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">{t('hr.estimatedNetPayout')}</p>
                            <div className="flex items-end gap-2">
                                <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tight">{estGrossSalary.toLocaleString()}</span>
                                <span className="text-lg font-bold text-gray-400 dark:text-gray-500 mb-1">{t('hr.dzdCurrency')}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <FinanceRow label={t('hr.monthlyBaseSalary')} value={baseSalary} type="base" t={t} />
                            <FinanceRow label={t('hr.overtimeBonus')} value={overtimeBonus} type="addition" t={t} />
                            <FinanceRow label={t('hr.latenessAndMissing')} value={missingDeductions} type="deduction" t={t} />
                            <FinanceRow label={t('hr.absencePenalty')} value={absenceDeduct} type="deduction" t={t} />
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4">
                            <div>
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-0.5">{t('hr.alreadyPaidThisMonth')}</p>
                                <p className="text-lg font-bold text-emerald-600">{paidThisMonth.toLocaleString()} {t('hr.dzdCurrency')}</p>
                            </div>
                            <div className="ltr:text-right rtl:text-left">
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-0.5">{t('hr.remainingToPay')}</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{unpaidEst.toLocaleString()} {t('hr.dzdCurrency')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3 & 5. Today Status & Month Quick Stats */}
                <div className="flex flex-col gap-6">
                    {/* Today Status Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 flex-1">
                        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-5">{t('hr.todaysPulse')}</h3>

                        <div className="flex items-center gap-4 mb-6">
                            <div className={clsx(
                                "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                                todayAtt?.status === 'Present' || todayAtt?.status === 'Completed' || todayAtt?.status === 'Overtime' || todayAtt?.status === 'Completed with Recovery' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500" :
                                    todayAtt?.status === 'Late' || todayAtt?.status === 'Incomplete' ? "bg-amber-50 dark:bg-amber-900/30 text-amber-500" :
                                        todayAtt?.status === 'Absent' ? "bg-rose-50 dark:bg-rose-900/30 text-rose-500" : "bg-gray-50 dark:bg-gray-700/50 text-gray-400"
                            )}>
                                {(!todayAtt || todayAtt.status === 'Absent') ? <XCircle className="w-8 h-8" /> :
                                    (todayAtt.status === 'Late' || todayAtt.status === 'Incomplete') ? <AlertCircle className="w-8 h-8" /> :
                                        <CheckCircle className="w-8 h-8" />}
                            </div>
                            <div>
                                <h4 className={clsx(
                                    "text-2xl font-black tracking-tight",
                                    todayAtt?.status === 'Present' || todayAtt?.status === 'Completed' || todayAtt?.status === 'Overtime' || todayAtt?.status === 'Completed with Recovery' ? "text-emerald-600" :
                                        todayAtt?.status === 'Late' || todayAtt?.status === 'Incomplete' ? "text-amber-600" :
                                            todayAtt?.status === 'Absent' ? "text-rose-600" : "text-gray-900 dark:text-white"
                                )}>
                                    {todayAtt?.status ? (todayAtt.status === 'Present' ? t('hr.statusPresent') : todayAtt.status === 'Completed' ? t('hr.statusCompleted') : todayAtt.status === 'Late' ? t('hr.statusLate') : todayAtt.status === 'Incomplete' ? t('hr.statusIncomplete') : todayAtt.status === 'Absent' ? t('hr.statusAbsent') : todayAtt.status === 'Completed with Recovery' ? t('hr.statusCompletedRecovery') : todayAtt.status === 'Overtime' ? t('hr.overtime') : todayAtt.status === 'Not Marked' ? t('hr.notMarked') : todayAtt.status) : t('hr.notMarked')}
                                </h4>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{fmtWeekdayDate()}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <TimeBlock label={t('hr.colMorningIn')} time={formatHHMM(todayAtt?.morningIn)} />
                            <TimeBlock label={t('hr.colMorningOut')} time={formatHHMM(todayAtt?.morningOut)} />
                            <TimeBlock label={t('hr.colEveningIn')} time={formatHHMM(todayAtt?.eveningIn)} />
                            <TimeBlock label={t('hr.colEveningOut')} time={formatHHMM(todayAtt?.eveningOut)} />
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <StatSquare label={t('hr.workedDays')} value={workedDaysAmount} icon={Calendar} color="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" />
                        <StatSquare label={t('hr.absences')} value={absencesAmount} icon={XCircle} color="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" />
                        <StatSquare label={t('hr.lates')} value={latesAmount} icon={Clock} color="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" />
                        <StatSquare label={t('hr.overtime')} value={formatHours(totalOvertimeMin)} icon={TrendingUp} color="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" />
                    </div>
                </div>
            </div>

            {/* Bottom Section: Tabs & Historic Grid */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col mt-2">

                {/* 4. Work Time Chart & Tabs Header */}
                <div className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 p-4 sm:p-6 flex flex-col xl:flex-row items-center justify-between gap-4 sm:gap-6">

                    {/* Time Progress Tracker */}
                    <div className="flex-1 w-full max-w-xl">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{t('hr.monthlyTimeFulfillment')}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('hr.cumulativeWorkedHours')}</p>
                            </div>
                            <div className="ltr:text-right rtl:text-left">
                                <span className="text-lg font-black text-blue-600">{Math.floor(totalWorkedMin / 60)}{t('hr.lblHours', 'h')}</span>
                                <span className="text-sm font-bold text-gray-400 dark:text-gray-500"> / {Math.floor(totalRequiredMin / 60)}{t('hr.lblHours', 'h')}</span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 h-2.5 rounded-full overflow-hidden flex">
                            <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${totalRequiredMin > 0 ? Math.min(100, (totalWorkedMin / totalRequiredMin) * 100) : 0}%` }}></div>
                        </div>
                        <div className="mt-2 text-xs font-bold text-rose-500 ltr:text-right rtl:text-left">
                            {totalMissingMin > 0 && `${formatHours(totalMissingMin)} ${t('hr.missingGlobally')}`}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex flex-wrap bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm shrink-0 w-full xl:w-auto overflow-x-auto gap-1">
                        <TabButton active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={Clock} label={t('hr.tabTimesheets')} count={attendance.length} />
                        <TabButton active={activeTab === 'payroll'} onClick={() => setActiveTab('payroll')} icon={FileText} label={t('hr.tabPayrollHistory')} count={payrolls.length} />
                        <TabButton active={activeTab === 'leaves'} onClick={() => setActiveTab('leaves')} icon={Calendar} label={t('hr.tabLeaveHistory')} count={leaves.length} />
                    </div>
                </div>

                {/* Tab Contents */}
                <div className="p-0">
                    {activeTab === 'attendance' && (
                        <div className="overflow-x-auto">
                            <table className="cf-table min-w-[900px]">
                                <thead>
                                    <tr>
                                        <th>{t('hr.colDate')}</th>
                                        <th>{t('hr.colMorning')}</th>
                                        <th>{t('hr.colEvening')}</th>
                                        <th>{t('hr.colTotalWorked')}</th>
                                        <th>{t('hr.colLateMissing')}</th>
                                        <th>{t('hr.overtime')}</th>
                                        <th className="ltr:text-right rtl:text-left">{t('hr.colStatus')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attendance.slice(0, 31).map(att => (
                                        <tr key={att._id}>
                                            <td className="p-4 ltr:pl-6 rtl:pr-6 text-gray-900 dark:text-white font-bold">{fmtMediumDate(att.date)}</td>
                                            <td className="p-4 text-gray-500 dark:text-gray-400">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={clsx("w-14 text-center px-1.5 py-0.5 rounded text-xs", att.morningIn ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "text-gray-300 dark:text-gray-600")}>{formatHHMM(att.morningIn)}</span>
                                                    <span className="text-gray-300 dark:text-gray-600 inline-block ltr:rotate-0 rtl:rotate-180">→</span>
                                                    <span className={clsx("w-14 text-center px-1.5 py-0.5 rounded text-xs", att.morningOut ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "text-gray-300 dark:text-gray-600")}>{formatHHMM(att.morningOut)}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-500 dark:text-gray-400">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={clsx("w-14 text-center px-1.5 py-0.5 rounded text-xs", att.eveningIn ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-300 dark:text-gray-600")}>{formatHHMM(att.eveningIn)}</span>
                                                    <span className="text-gray-300 dark:text-gray-600 inline-block ltr:rotate-0 rtl:rotate-180">→</span>
                                                    <span className={clsx("w-14 text-center px-1.5 py-0.5 rounded text-xs", att.eveningOut ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-300 dark:text-gray-600")}>{formatHHMM(att.eveningOut)}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 font-bold text-gray-900 dark:text-white">{formatHours(att.workedMinutes || 0)} <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">/ {formatHours(att.requiredMinutes || 0)}</span></td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1 text-xs">
                                                    {att.lateMinutes > 0 && <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded w-fit">{att.lateMinutes}{t('hr.lblMinutes', 'm')} {t('hr.lblLate')}</span>}
                                                    {att.missingMinutes > 0 && <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded w-fit">{formatHours(att.missingMinutes)} {t('hr.lblMiss')}</span>}
                                                    {!att.lateMinutes && !att.missingMinutes && <span className="text-gray-300 dark:text-gray-600">-</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-purple-600 font-bold">{att.overtimeMinutes > 0 ? <span dir="ltr">{`+${formatHours(att.overtimeMinutes)}`}</span> : '-'}</td>
                                            <td className="p-4 ltr:pr-6 rtl:pl-6 ltr:text-right rtl:text-left">
                                                <span className={clsx("px-2.5 py-1 rounded text-xs font-bold",
                                                    att.status === 'Present' || att.status === 'Completed' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
                                                        att.status === 'Absent' ? "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" :
                                                            att.status === 'Late' || att.status === 'Incomplete' ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
                                                                "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                                )}>
                                                    {att.status ? (att.status === 'Present' ? t('hr.statusPresent') : att.status === 'Completed' ? t('hr.statusCompleted') : att.status === 'Late' ? t('hr.statusLate') : att.status === 'Incomplete' ? t('hr.statusIncomplete') : att.status === 'Absent' ? t('hr.statusAbsent') : att.status === 'Completed with Recovery' ? t('hr.statusCompletedRecovery') : att.status === 'Overtime' ? t('hr.overtime') : att.status === 'Not Marked' ? t('hr.notMarked') : att.status) : t('hr.notMarked')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {attendance.length === 0 && (
                                        <tr><td colSpan="7" className="p-10 text-center text-gray-500 dark:text-gray-400 font-medium">{t('hr.noAttendanceRecords')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'payroll' && (
                        <div className="overflow-x-auto">
                            <table className="cf-table min-w-[800px]">
                                <thead>
                                    <tr>
                                        <th>{t('hr.colPeriod')}</th>
                                        <th>{t('hr.colBaseSalary')}</th>
                                        <th>{t('hr.colOtAdditions')}</th>
                                        <th>{t('hr.colDeductionsTotal')}</th>
                                        <th>{t('hr.colFinalPaid')}</th>
                                        <th className="ltr:text-right rtl:text-left">{t('hr.colStatus')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payrolls.map(pay => (
                                        <tr key={pay._id}>
                                            <td className="p-4 ltr:pl-6 rtl:pr-6 text-gray-900 dark:text-white font-bold">{fmtMonthYear(parseMMYYYY(pay.period))}</td>
                                            <td className="p-4 text-gray-500 dark:text-gray-400">{pay.baseSalary?.toLocaleString()} {t('hr.dzdCurrency')}</td>
                                            <td className="p-4 text-emerald-600">+{(pay.overtimeAdditions || 0).toLocaleString()} {t('hr.dzdCurrency')}</td>
                                            <td className="p-4 text-rose-600">-{(pay.missingTimeDeductions + pay.absenceDeductions || 0).toLocaleString()} {t('hr.dzdCurrency')}</td>
                                            <td className="p-4 font-black text-blue-600 text-lg">{pay.finalPayableSalary?.toLocaleString()} {t('hr.dzdCurrency')}</td>
                                            <td className="p-4 ltr:pr-6 rtl:pl-6 ltr:text-right rtl:text-left">
                                                <span className={clsx("px-2.5 py-1 rounded text-xs font-bold", pay.status === 'Paid' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400")}>
                                                    {pay.status === 'Paid' ? t('hr.statusPaid') : (pay.status === 'Pending' ? t('hr.statusPending') : pay.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {payrolls.length === 0 && (
                                        <tr><td colSpan="6" className="p-10 text-center text-gray-500 dark:text-gray-400 font-medium">{t('hr.noPayrollHistory')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'leaves' && (
                        <div className="overflow-x-auto">
                            <table className="cf-table min-w-[800px]">
                                <thead>
                                    <tr>
                                        <th>{t('hr.colRequestedOn')}</th>
                                        <th>{t('hr.colType')}</th>
                                        <th>{t('hr.colDuration')}</th>
                                        <th>{t('hr.colReason')}</th>
                                        <th className="ltr:text-right rtl:text-left">{t('hr.colStatus')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaves.map(l => (
                                        <tr key={l._id}>
                                            <td className="p-4 ltr:pl-6 rtl:pr-6 text-gray-900 dark:text-white font-bold">{fmtMediumDate(l.requestDate)}</td>
                                            <td className="p-4 text-gray-700 dark:text-gray-300">
                                                <span className="bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-md text-xs font-bold">{l.type}</span>
                                            </td>
                                            <td className="p-4 text-gray-500 dark:text-gray-400">
                                                <div className="flex items-center gap-1">
                                                    {fmtShortDate(l.startDate)} <span className="inline-block ltr:rotate-0 rtl:rotate-180">➔</span> {fmtShortDate(l.endDate)} <span className="text-gray-400 dark:text-gray-500 font-normal ml-2">({diffDays(l.endDate, l.startDate) + 1} {t('hr.daysLabel')})</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">{l.reason}</td>
                                            <td className="p-4 ltr:pr-6 rtl:pl-6 ltr:text-right rtl:text-left">
                                                <span className={clsx("px-2.5 py-1 rounded text-xs font-bold", l.status === 'Approved' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : l.status === 'Rejected' ? "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400")}>
                                                    {l.status === 'Approved' ? t('hr.statusApproved') : l.status === 'Rejected' ? t('hr.statusRejected') : l.status === 'Pending' ? t('hr.statusPending') : l.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {leaves.length === 0 && (
                                        <tr><td colSpan="5" className="p-10 text-center text-gray-500 dark:text-gray-400 font-medium">{t('hr.noLeaveRequests')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Subcomponents

function HashIcon({ className }) {
    return <span className={clsx("font-black", className)}>#</span>;
}

function LayersIcon({ className }) {
    return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
}

function ProfileRow({ icon: Icon, label, value, highlight }) {
    return (
        <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-700/50 pb-2">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{label}</span>
            </div>
            <span className={clsx("text-sm font-bold text-right", highlight ? "text-emerald-600" : "text-gray-900 dark:text-white")}>{value}</span>
        </div>
    );
}

function FinanceRow({ label, value, type, t }) {
    return (
        <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-gray-500 dark:text-gray-400">{label}</span>
            <span className={clsx("font-bold tabular-nums",
                type === 'base' ? "text-gray-900 dark:text-white" :
                    type === 'addition' ? "text-emerald-600" : "text-rose-600"
            )}>
                <span dir="ltr">{type === 'base' ? '' : type === 'addition' ? '+' : '-'} {value.toLocaleString()} <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">{t('hr.dzdCurrency')}</span></span>
            </span>
        </div>
    );
}

function TimeBlock({ label, time }) {
    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 text-center">{label}</span>
            <span className={clsx("text-lg font-black tracking-tight", time !== '--:--' ? "text-blue-600 dark:text-blue-400" : "text-gray-300 dark:text-gray-600")}>{time}</span>
        </div>
    );
}

function StatSquare({ label, value, icon: Icon, color }) {
    return (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-4 flex flex-col bg-white dark:bg-gray-800">
            <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center mb-3", color)}>
                <Icon className="w-4 h-4" />
            </div>
            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-1">{value}</span>
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{label}</span>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex-1 xl:flex-none whitespace-nowrap",
                active ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
        >
            <Icon className="w-4 h-4" />
            {label}
            {count > 0 && (
                <span className={clsx('text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none', active ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400')}>{count}</span>
            )}
        </button>
    );
}
