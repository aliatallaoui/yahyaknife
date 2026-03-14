import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, CalendarDays, Search, CheckCircle, XCircle, Clock, Banknote, Filter, UserPlus, AlertTriangle } from 'lucide-react';
import { useHotkey } from '../hooks/useHotkey';
import EmployeeModal from '../components/hr/EmployeeModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import PageHeader from '../components/PageHeader';
import { apiFetch } from '../utils/apiFetch';
import clsx from 'clsx';
import { toISODate, fmtShortDate, fmtMediumDate, diffDays, fromNow } from '../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import TableSkeleton from '../components/TableSkeleton';

const COLORS = ['#1A73E8', '#C58AF9', '#EE6C4D', '#3D5A80', '#98C1D9', '#E0FBFC', '#293241'];

export default function HRSnapshot() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';
    const [metrics, setMetrics] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDept, setFilterDept] = useState('All');
    const [filterRole, setFilterRole] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [leaveError, setLeaveError] = useState(null);
    const [fetchError, setFetchError] = useState(null);
    const searchRef = useRef(null);
    const leaveErrorTimerRef = useRef(null);

    useEffect(() => {
        return () => { if (leaveErrorTimerRef.current) clearTimeout(leaveErrorTimerRef.current); };
    }, []);

    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    const fetchHRData = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const todayStr = toISODate();
            const [metricsRes, empRes, leaveRes, attRes] = await Promise.all([
                apiFetch(`/api/hr/metrics`),
                apiFetch(`/api/hr/employees`),
                apiFetch(`/api/hr/leaves`),
                apiFetch(`/api/hr/attendance?date=${todayStr}`)
            ]);
            if (!metricsRes.ok || !empRes.ok || !leaveRes.ok || !attRes.ok) throw new Error('fetch failed');

            const empRaw = await empRes.json();
            const empData = empRaw.data ?? empRaw;
            const leaveRaw = await leaveRes.json();
            const leaveData = leaveRaw.data ?? leaveRaw;
            const attRaw = await attRes.json();
            const attData = attRaw.data ?? attRaw;

            // Map today's attendance status to employees
            const attMap = {};
            if (Array.isArray(attData)) {
                attData.forEach(a => {
                    const empIdVal = a.employeeId?._id || a.employeeId;
                    if (empIdVal) {
                        attMap[empIdVal] = a.status;
                    }
                });
            }

            const empsArray = Array.isArray(empData) ? empData : (empData || []);
            const empsWithAtt = empsArray.map(e => ({
                ...e,
                todayAttendance: attMap[e._id] || 'Not Marked'
            }));

            const metricsJson = await metricsRes.json();
            setMetrics(metricsJson.data ?? metricsJson);
            setEmployees(empsWithAtt);
            setLeaves(Array.isArray(leaveData) ? leaveData : []);
        } catch {
            setFetchError(t('hr.errorLoadData', 'Failed to load HR data.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHRData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Format Department Data — hooks must be called before any early return
     
    const deptData = useMemo(() => metrics?.departmentDistribution ? Object.keys(metrics.departmentDistribution).map((key) => ({
        name: key,
        Headcount: metrics.departmentDistribution[key]
    })).sort((a, b) => b.Headcount - a.Headcount) : [], [metrics?.departmentDistribution]);

    // Filter options
    const uniqueDepts = useMemo(() => ['All', ...new Set(employees.map(e => e.department || 'Unassigned'))], [employees]);
    const uniqueRoles = useMemo(() => ['All', ...new Set(employees.map(e => e.role || 'Unassigned'))], [employees]);

    const filteredEmployees = useMemo(() => employees.filter(emp => {
        const empNameMatch = (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const empIdMatch = (emp.employeeId || emp._id || '').toString().toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSearch = empNameMatch || empIdMatch;
        const matchesDept = filterDept === 'All' || (emp.department || 'Unassigned') === filterDept;
        const matchesRole = filterRole === 'All' || (emp.role || 'Unassigned') === filterRole;
        const matchesStatus = filterStatus === 'All' || (emp.status || 'Active') === filterStatus;
        return matchesSearch && matchesDept && matchesRole && matchesStatus;
    }), [employees, searchTerm, filterDept, filterRole, filterStatus]);

    const pendingLeavesCount = useMemo(() => leaves.filter(l => l.status === 'Pending').length, [leaves]);

    if (loading) {
        return <TableSkeleton showKpis kpiCount={6} rows={8} cols={6} />;
    }

    const utilizationData = [
        { name: t('hr.activeWorking'), value: metrics?.activeEmployees || 0 },
        { name: t('hr.onLeaveInactive'), value: Math.max(0, (metrics?.totalEmployees || 0) - (metrics?.activeEmployees || 0)) }
    ];
    const UTILIZATION_COLORS = ['#10b981', '#f43f5e'];

    const handleLeaveStatusUpdate = async (id, newStatus) => {
        try {
            const res = await apiFetch(`/api/hr/leaves/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                const updJson = await res.json();
                setLeaves(leaves.map(l => l._id === id ? (updJson.data ?? updJson) : l));
                toast.success(t('hr.leaveStatusUpdated', `Leave request ${newStatus.toLowerCase()} successfully`));

                // Refresh employees to reflect deducted balance
                if (newStatus === 'Approved') {
                    const empRes = await apiFetch(`/api/hr/employees`);
                    const empJson = await empRes.json();
                    setEmployees(empJson.data ?? (Array.isArray(empJson) ? empJson : []));
                }
            } else {
                const data = await res.json().catch(() => ({}));
                const errMsg = data.message || t('hr.leaveUpdateError', 'Failed to update leave status.');
                setLeaveError(errMsg);
                toast.error(errMsg);
                if (leaveErrorTimerRef.current) clearTimeout(leaveErrorTimerRef.current);
                leaveErrorTimerRef.current = setTimeout(() => setLeaveError(null), 4000);
            }
        } catch {
            const errMsg = t('hr.leaveUpdateError', 'Failed to update leave status.');
            setLeaveError(errMsg);
            toast.error(errMsg);
            setTimeout(() => setLeaveError(null), 4000);
        }
    };

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <PageHeader
                title={t('hr.title', 'HR Snapshot')}
                subtitle={t('hr.subtitle', 'Dynamic workforce management, performance tracking, and payroll.')}
                variant="hr"
                actions={
                    <>
                        <button onClick={() => { setSelectedEmployee(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-6 py-2.5 bg-[#5D5DFF] hover:bg-[#4D4DFF] text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 leading-none">
                            <UserPlus className="w-5 h-5" /> {t('hr.btnAddEmployee')}
                        </button>
                        <button onClick={fetchHRData} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-all hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 leading-none">
                            <Clock className="w-4 h-4" /> {t('hr.btnRefresh')}
                        </button>
                    </>
                }
            />

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 truncate">{t('hr.totalHeadcount')}</p>
                        <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tighter truncate">{metrics?.totalEmployees || 0}</h3>
                    </div>
                    <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-800 shrink-0">
                        <Users className="w-8 h-8 text-blue-600" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 truncate">{t('hr.presentToday')}</p>
                        <h3 className="text-3xl font-black text-emerald-700 dark:text-emerald-300 tracking-tighter truncate">{metrics?.presentToday || 0}</h3>
                    </div>
                    <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center border border-emerald-100 dark:border-emerald-800 shrink-0">
                        <UserCheck className="w-8 h-8 text-emerald-600" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 truncate">{t('hr.lateToday')}</p>
                        <h3 className="text-3xl font-black text-amber-700 dark:text-amber-300 tracking-tighter truncate">{metrics?.lateToday || 0}</h3>
                    </div>
                    <div className="h-16 w-16 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center border border-amber-100 dark:border-amber-800 shrink-0">
                        <Clock className="w-8 h-8 text-amber-600" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1 truncate">{t('hr.absentToday')}</p>
                        <h3 className="text-3xl font-black text-rose-700 dark:text-rose-300 tracking-tighter truncate">{metrics?.absentToday || 0}</h3>
                    </div>
                    <div className="h-16 w-16 bg-rose-50 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center border border-rose-100 dark:border-rose-800 shrink-0">
                        <XCircle className="w-8 h-8 text-rose-600" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1 truncate">{t('hr.pendingLeaves')}</p>
                        <h3 className="text-3xl font-black text-purple-700 dark:text-purple-300 tracking-tighter truncate">{pendingLeavesCount}</h3>
                    </div>
                    <div className={clsx("h-16 w-16 rounded-2xl flex items-center justify-center border shrink-0", pendingLeavesCount > 0 ? "bg-purple-100 dark:bg-purple-900/40 border-purple-200 dark:border-purple-700 animate-pulse" : "bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-800")}>
                        <CalendarDays className="w-8 h-8 text-purple-600" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 truncate">{t('hr.estPayroll')}</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter truncate">{`${((metrics?.estimatedPayrollDZD || 0) / 1000).toFixed(0)}k`}</h3>
                    </div>
                    <div className="h-16 w-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center border border-gray-200 dark:border-gray-600 shrink-0">
                        <Banknote className="w-8 h-8 text-gray-800 dark:text-gray-200" />
                    </div>
                </div>
            </div>

            {/* Advanced Employee Directory Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-gray-100 dark:border-gray-700 gap-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">{t('hr.employeeDirectory')}</h3>

                    {/* Advanced Filter Bar */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <Search className="w-4 h-4 absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={t('hr.searchEmployeePlaceholder', 'Search... (Press /)')}
                                className="w-full md:w-48 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:border-blue-400 outline-none rounded-lg py-2 ltr:pl-9 ltr:pr-4 rtl:pr-9 rtl:pl-4 text-sm dark:text-gray-100 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
                            <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none font-medium cursor-pointer">
                                {uniqueDepts.map(d => <option key={d} value={d}>{d === 'All' ? t('hr.allDepts') : d}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
                            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none font-medium cursor-pointer max-w-[120px]">
                                {uniqueRoles.map(r => <option key={r} value={r}>{r === 'All' ? t('hr.allRoles') : r}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none font-medium cursor-pointer">
                                <option value="All">{t('hr.allStatus')}</option>
                                <option value="Active">{t('hr.statusActive', 'Active')}</option>
                                <option value="On Leave">{t('hr.statusOnLeave', 'On Leave')}</option>
                                <option value="Terminated">{t('hr.statusTerminated', 'Terminated')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="cf-table min-w-[1000px]">
                        <thead>
                            <tr>
                                <th>{t('hr.colEmployee')}</th>
                                <th>{t('hr.colRoleDept')}</th>
                                <th>{t('hr.colMonthlySalary')}</th>
                                <th className="text-center">{t('hr.colTodayAttendance')}</th>
                                <th className="text-center">{t('hr.colAccountStatus')}</th>
                                <th className="text-end">{t('hr.colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map((emp) => (
                                <tr key={emp._id} onClick={() => navigate(`/hr/employees/${emp._id}`)} className="cursor-pointer group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
                                                {emp.name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{emp.name}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('hr.idPrefix')} {emp.employeeId || emp._id.slice(-6).toUpperCase()}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-semibold text-gray-800 dark:text-gray-200">{emp.role}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{emp.department}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900 dark:text-white">
                                            {(emp.contractSettings?.monthlySalary || emp.salary || 0).toLocaleString()} <span className="text-xs font-normal text-gray-400 dark:text-gray-500">{t('hr.dzdCurrency')}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={clsx(
                                            "px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm border",
                                            emp.todayAttendance === 'Present' || emp.todayAttendance === 'Completed' || emp.todayAttendance === 'Overtime' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800" :
                                                emp.todayAttendance === 'Late' || emp.todayAttendance === 'Incomplete' ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800" :
                                                    emp.todayAttendance === 'Absent' ? "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-800" :
                                                        "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600"
                                        )}>
                                            <span className={clsx("w-1.5 h-1.5 rounded-full",
                                                emp.todayAttendance === 'Present' || emp.todayAttendance === 'Completed' || emp.todayAttendance === 'Overtime' ? "bg-emerald-500" :
                                                    emp.todayAttendance === 'Late' || emp.todayAttendance === 'Incomplete' ? "bg-amber-500" :
                                                        emp.todayAttendance === 'Absent' ? "bg-rose-500" :
                                                            "bg-gray-400"
                                            )}></span>
                                            {emp.todayAttendance === 'Present' ? t('hr.statusPresent') : emp.todayAttendance === 'Completed' ? t('hr.statusCompleted') : emp.todayAttendance === 'Late' ? t('hr.statusLate') : emp.todayAttendance === 'Incomplete' ? t('hr.statusIncomplete') : emp.todayAttendance === 'Absent' ? t('hr.statusAbsent') : emp.todayAttendance === 'Completed with Recovery' ? t('hr.statusCompletedRecovery') : emp.todayAttendance === 'Overtime' ? t('hr.overtime') : emp.todayAttendance === 'Not Marked' ? t('hr.notMarked') : emp.todayAttendance}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={clsx(
                                            "px-2.5 py-1 rounded-full text-xs font-semibold inline-block w-20",
                                            emp.status === 'Active' ? "bg-green-100/50 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                                                emp.status === 'On Leave' ? "bg-yellow-100/50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                        )}>
                                            {emp.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-end">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); setIsModalOpen(true); }}
                                            className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
                                        >
                                            {t('hr.quickEdit')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-700 mb-3">
                                            <Search className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('hr.noEmployeesFound')}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Department Distribution (Chart) */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">{t('hr.departmentDistribution')}</h3>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={deptData} layout="vertical" margin={{ top: 5, right: isAr ? 70 : 30, left: isAr ? 30 : 20, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} orientation={isAr ? 'right' : 'left'} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500, dx: isAr ? 60 : -10 }} width={80} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="Headcount" radius={isAr ? [4, 0, 0, 4] : [0, 4, 4, 0]} barSize={24}>
                                    {deptData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Leave Requests Feed */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-[400px]">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('hr.recentLeaveRequests')}</h3>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">{leaves.length} {t('hr.totalLabel')}</span>
                    </div>
                    {leaveError && (
                        <div className="mx-4 mt-3 flex items-center gap-2 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2 shrink-0">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{leaveError}</span>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-4 styled-scrollbar space-y-3">
                        {leaves.map(req => {
                            const statusConfig = {
                                'Approved': { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
                                'Pending': { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                                'Rejected': { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' }
                            }[req.status];
                            const StatusIcon = statusConfig.icon;

                            return (
                                <div key={req._id} className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-gray-200 dark:hover:border-gray-600 transition-colors bg-gray-50/30 dark:bg-gray-700/30">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm shrink-0">
                                            {req.employeeId?.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{req.employeeId?.name || 'Unknown'}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{req.type} • {fmtShortDate(req.startDate)} - {fmtMediumDate(req.endDate)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="ltr:text-right rtl:text-left hidden sm:block">
                                            <div className="text-xs font-medium text-gray-900 dark:text-white">{diffDays(req.endDate, req.startDate) + 1} {t('hr.daysLabel')}</div>
                                            <div className="text-[10px] text-gray-400 dark:text-gray-500">{t('hr.requestedAgo')} {fromNow(req.requestDate)}</div>
                                        </div>
                                        {req.status === 'Pending' ? (
                                            <div className="flex gap-1 ltr:ml-2 rtl:mr-2">
                                                <button onClick={() => handleLeaveStatusUpdate(req._id, 'Approved')} className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400 transition-colors" title={t('hr.btnApprove')}>
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleLeaveStatusUpdate(req._id, 'Rejected')} className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-colors" title={t('hr.btnReject')}>
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className={clsx("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-24 justify-center shrink-0 ltr:ml-2 rtl:mr-2", statusConfig.bg, statusConfig.color)}>
                                                <StatusIcon className="w-3.5 h-3.5" />
                                                {req.status}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Workforce Analytics Row */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">{t('hr.workforceUtilization')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-auto md:h-[280px]">
                    <div className="h-[250px] md:h-full relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={utilizationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="60%"
                                    outerRadius="80%"
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {utilizationData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={UTILIZATION_COLORS[index % UTILIZATION_COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8 sm:pb-5">
                            <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{metrics?.activeEmployees || 0}</span>
                            <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500">{t('hr.activeLabel')}</span>
                        </div>
                    </div>

                    <div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-100 dark:border-gray-600">
                            <h4 className="font-bold text-gray-900 dark:text-white mb-2">{t('hr.liveAvailabilityScore')}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('hr.liveAvailabilityDesc')}</p>
                            <div className="w-full bg-gray-200 dark:bg-gray-600 h-3 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${metrics?.totalEmployees > 0 ? ((metrics.activeEmployees / metrics.totalEmployees) * 100).toFixed(1) : 0}%` }}></div>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500">0%</span>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                    {metrics?.totalEmployees > 0 ? ((metrics.activeEmployees / metrics.totalEmployees) * 100).toFixed(1) : 0}% {t('hr.operationalText')}
                                </span>
                                <span className="text-xs font-bold text-gray-400 dark:text-gray-500">100%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {isModalOpen && (
                <EmployeeModal
                    employee={selectedEmployee}
                    onClose={() => setIsModalOpen(false)}
                    onSave={async () => {
                        setIsModalOpen(false);
                        toast.success(selectedEmployee ? t('hr.employeeUpdated', 'Employee updated successfully') : t('hr.employeeAdded', 'Employee added successfully'));
                        const empRes = await apiFetch(`/api/hr/employees`);
                        const empRefJson = await empRes.json();
                        setEmployees(empRefJson.data ?? (Array.isArray(empRefJson) ? empRefJson : []));
                    }}
                />
            )}
        </div>
    );
}
