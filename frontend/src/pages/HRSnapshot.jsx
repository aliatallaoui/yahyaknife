import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, CalendarDays, Search, CheckCircle, XCircle, Clock, Banknote, Filter, Plus, UserPlus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';

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

    const fetchHRData = async () => {
        setLoading(true);
        try {
            const todayStr = moment().format('YYYY-MM-DD');
            const [metricsRes, empRes, leaveRes, attRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/metrics`),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/employees`),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/leaves`),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/attendance?date=${todayStr}`)
            ]);

            const empData = await empRes.json();
            const leaveData = await leaveRes.json();
            const attData = await attRes.json();

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

            const empsArray = Array.isArray(empData) ? empData : [];
            const empsWithAtt = empsArray.map(e => ({
                ...e,
                todayAttendance: attMap[e._id] || 'Not Marked'
            }));

            setMetrics(await metricsRes.json());
            setEmployees(empsWithAtt);
            setLeaves(Array.isArray(leaveData) ? leaveData : []);
        } catch (error) {
            console.error("Error fetching HR data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHRData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    // Format Department Data
    const deptData = metrics?.departmentDistribution ? Object.keys(metrics.departmentDistribution).map((key) => ({
        name: key,
        Headcount: metrics.departmentDistribution[key]
    })).sort((a, b) => b.Headcount - a.Headcount) : [];

    // Filter options
    const uniqueDepts = ['All', ...new Set(employees.map(e => e.department || 'Unassigned'))];
    const uniqueRoles = ['All', ...new Set(employees.map(e => e.role || 'Unassigned'))];

    const filteredEmployees = employees.filter(emp => {
        const empNameMatch = (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const empIdMatch = (emp.employeeId || emp._id || '').toString().toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSearch = empNameMatch || empIdMatch;
        const matchesDept = filterDept === 'All' || (emp.department || 'Unassigned') === filterDept;
        const matchesRole = filterRole === 'All' || (emp.role || 'Unassigned') === filterRole;
        const matchesStatus = filterStatus === 'All' || (emp.status || 'Active') === filterStatus;
        return matchesSearch && matchesDept && matchesRole && matchesStatus;
    });

    const pendingLeavesCount = leaves.filter(l => l.status === 'Pending').length;

    const utilizationData = [
        { name: t('hr.activeWorking'), value: metrics?.activeEmployees || 0 },
        { name: t('hr.onLeaveInactive'), value: Math.max(0, (metrics?.totalEmployees || 0) - (metrics?.activeEmployees || 0)) }
    ];
    const UTILIZATION_COLORS = ['#10b981', '#f43f5e'];

    const handleLeaveStatusUpdate = async (id, newStatus) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/leaves/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                const updated = await res.json();
                setLeaves(leaves.map(l => l._id === id ? updated : l));

                // Refresh employees to reflect deducted balance
                if (newStatus === 'Approved') {
                    const empRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/employees`);
                    setEmployees(await empRes.json());
                }
            }
        } catch (error) {
            console.error('Failed to update leave status', error);
        }
    };

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <PageHeader
                title={t('hr.title', 'HR Snapshot')}
                subtitle={t('hr.subtitle', 'Dynamic workforce management, performance tracking, and payroll.')}
                actions={
                    <>
                        <button onClick={() => { setSelectedEmployee(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-6 py-2.5 bg-[#5D5DFF] hover:bg-[#4D4DFF] text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 leading-none">
                            <UserPlus className="w-5 h-5" /> {t('hr.btnAddEmployee')}
                        </button>
                        <button onClick={fetchHRData} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl transition-all hover:bg-gray-50 active:scale-95 leading-none">
                            <Clock className="w-4 h-4" /> {t('hr.btnRefresh')}
                        </button>
                    </>
                }
            />

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{t('hr.totalHeadcount')}</p>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tighter truncate">{metrics?.totalEmployees || 0}</h3>
                    </div>
                    <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shrink-0">
                        <Users className="w-8 h-8 text-blue-600" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-1 truncate">{t('hr.presentToday')}</p>
                        <h3 className="text-3xl font-black text-emerald-700 tracking-tighter truncate">{metrics?.presentToday || 0}</h3>
                    </div>
                    <div className="h-16 w-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shrink-0">
                        <UserCheck className="w-8 h-8 text-emerald-600" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-1 truncate">{t('hr.lateToday')}</p>
                        <h3 className="text-3xl font-black text-amber-700 tracking-tighter truncate">{metrics?.lateToday || 0}</h3>
                    </div>
                    <div className="h-16 w-16 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-100 shrink-0">
                        <Clock className="w-8 h-8 text-amber-600" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-rose-600 uppercase tracking-wider mb-1 truncate">{t('hr.absentToday')}</p>
                        <h3 className="text-3xl font-black text-rose-700 tracking-tighter truncate">{metrics?.absentToday || 0}</h3>
                    </div>
                    <div className="h-16 w-16 bg-rose-50 rounded-2xl flex items-center justify-center border border-rose-100 shrink-0">
                        <XCircle className="w-8 h-8 text-rose-600" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-1 truncate">{t('hr.pendingLeaves')}</p>
                        <h3 className="text-3xl font-black text-purple-700 tracking-tighter truncate">{pendingLeavesCount}</h3>
                    </div>
                    <div className={clsx("h-16 w-16 rounded-2xl flex items-center justify-center border shrink-0", pendingLeavesCount > 0 ? "bg-purple-100 border-purple-200 animate-pulse" : "bg-purple-50 border-purple-100")}>
                        <CalendarDays className="w-8 h-8 text-purple-600" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{t('hr.estPayroll')}</p>
                        <h3 className="text-3xl font-black text-gray-900 tracking-tighter truncate">{`${((metrics?.estimatedPayrollDZD || 0) / 1000).toFixed(0)}k`}</h3>
                    </div>
                    <div className="h-16 w-16 bg-gray-100 rounded-2xl flex items-center justify-center border border-gray-200 shrink-0">
                        <Banknote className="w-8 h-8 text-gray-800" />
                    </div>
                </div>
            </div>

            {/* Advanced Employee Directory Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-gray-100 gap-4">
                    <h3 className="text-lg font-bold text-gray-900 whitespace-nowrap">{t('hr.employeeDirectory')}</h3>

                    {/* Advanced Filter Bar */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <Search className="w-4 h-4 absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t('hr.searchEmployeePlaceholder')}
                                className="w-full md:w-48 bg-gray-50 border border-gray-200 focus:border-blue-400 outline-none rounded-lg py-2 ltr:pl-9 ltr:pr-4 rtl:pr-9 rtl:pl-4 text-sm transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none font-medium cursor-pointer">
                                {uniqueDepts.map(d => <option key={d} value={d}>{d === 'All' ? t('hr.allDepts') : d}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none font-medium cursor-pointer max-w-[120px]">
                                {uniqueRoles.map(r => <option key={r} value={r}>{r === 'All' ? t('hr.allRoles') : r}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none font-medium cursor-pointer">
                                <option value="All">{t('hr.allStatus')}</option>
                                <option value="Active">Active</option>
                                <option value="On Leave">On Leave</option>
                                <option value="Terminated">Terminated</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-start border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                <th className="p-4 font-semibold">{t('hr.colEmployee')}</th>
                                <th className="p-4 font-semibold">{t('hr.colRoleDept')}</th>
                                <th className="p-4 font-semibold">{t('hr.colMonthlySalary')}</th>
                                <th className="p-4 font-semibold text-center">{t('hr.colTodayAttendance')}</th>
                                <th className="p-4 font-semibold text-center">{t('hr.colAccountStatus')}</th>
                                <th className="p-4 font-semibold text-end">{t('hr.colActions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredEmployees.map((emp) => (
                                <tr key={emp._id} onClick={() => navigate((emp.workshopRole && emp.workshopRole !== 'None') ? `/production/workers/${emp._id}` : `/hr/employees/${emp._id}`)} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
                                                {emp.name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{emp.name}</div>
                                                <div className="text-xs text-gray-500 font-medium">{t('hr.idPrefix')} {emp.employeeId || emp._id.slice(-6).toUpperCase()}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-semibold text-gray-800">{emp.role}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{emp.department}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">
                                            {(emp.contractSettings?.monthlySalary || emp.salary || 0).toLocaleString()} <span className="text-xs font-normal text-gray-400">{t('hr.dzdCurrency')}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={clsx(
                                            "px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm border",
                                            emp.todayAttendance === 'Present' || emp.todayAttendance === 'Completed' || emp.todayAttendance === 'Overtime' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                emp.todayAttendance === 'Late' || emp.todayAttendance === 'Incomplete' ? "bg-amber-50 text-amber-700 border-amber-100" :
                                                    emp.todayAttendance === 'Absent' ? "bg-rose-50 text-rose-700 border-rose-100" :
                                                        "bg-gray-50 text-gray-600 border-gray-200"
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
                                            emp.status === 'Active' ? "bg-green-100/50 text-green-700" :
                                                emp.status === 'On Leave' ? "bg-yellow-100/50 text-yellow-700" : "bg-gray-100 text-gray-600"
                                        )}>
                                            {emp.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-end">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); setIsModalOpen(true); }}
                                            className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors border border-gray-200"
                                        >
                                            {t('hr.quickEdit')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 mb-3">
                                            <Search className="w-6 h-6 text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 font-medium">{t('hr.noEmployeesFound')}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Department Distribution (Chart) */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">{t('hr.departmentDistribution')}</h3>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
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
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[400px]">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                        <h3 className="text-lg font-bold text-gray-900">{t('hr.recentLeaveRequests')}</h3>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{leaves.length} {t('hr.totalLabel')}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 styled-scrollbar space-y-3">
                        {leaves.map(req => {
                            const statusConfig = {
                                'Approved': { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
                                'Pending': { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                                'Rejected': { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' }
                            }[req.status];
                            const StatusIcon = statusConfig.icon;

                            return (
                                <div key={req._id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors bg-gray-50/30">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                                            {req.employeeId?.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-sm">{req.employeeId?.name || 'Unknown'}</h4>
                                            <p className="text-xs text-gray-500">{req.type} • {moment(req.startDate).format('MMM D')} - {moment(req.endDate).format('MMM D, YYYY')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="ltr:text-right rtl:text-left hidden sm:block">
                                            <div className="text-xs font-medium text-gray-900">{moment(req.endDate).diff(moment(req.startDate), 'days') + 1} {t('hr.daysLabel')}</div>
                                            <div className="text-[10px] text-gray-400">{t('hr.requestedAgo')} {moment(req.requestDate).fromNow()}</div>
                                        </div>
                                        {req.status === 'Pending' ? (
                                            <div className="flex gap-1 ltr:ml-2 rtl:mr-2">
                                                <button onClick={() => handleLeaveStatusUpdate(req._id, 'Approved')} className="p-1.5 rounded-md hover:bg-green-100 text-green-600 transition-colors" title={t('hr.btnApprove')}>
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleLeaveStatusUpdate(req._id, 'Rejected')} className="p-1.5 rounded-md hover:bg-red-100 text-red-600 transition-colors" title={t('hr.btnReject')}>
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
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">{t('hr.workforceUtilization')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-auto md:h-[280px]">
                    <div className="h-[250px] md:h-full relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
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
                            <span className="text-2xl sm:text-3xl font-black text-gray-900">{metrics?.activeEmployees || 0}</span>
                            <span className="text-[10px] sm:text-xs font-bold text-gray-400">{t('hr.activeLabel')}</span>
                        </div>
                    </div>

                    <div>
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                            <h4 className="font-bold text-gray-900 mb-2">{t('hr.liveAvailabilityScore')}</h4>
                            <p className="text-sm text-gray-600 mb-4">{t('hr.liveAvailabilityDesc')}</p>
                            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${metrics?.totalEmployees > 0 ? ((metrics.activeEmployees / metrics.totalEmployees) * 100).toFixed(1) : 0}%` }}></div>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs font-bold text-gray-400">0%</span>
                                <span className="text-sm font-black text-emerald-600">
                                    {metrics?.totalEmployees > 0 ? ((metrics.activeEmployees / metrics.totalEmployees) * 100).toFixed(1) : 0}% {t('hr.operationalText')}
                                </span>
                                <span className="text-xs font-bold text-gray-400">100%</span>
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
                        const empRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/employees`);
                        setEmployees(await empRes.json());
                    }}
                />
            )}
        </div>
    );
}

function EmployeeModal({ employee, onClose, onSave }) {
    const { t } = useTranslation();
    const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const [formData, setFormData] = useState({
        name: employee?.name || '',
        email: employee?.email || '',
        department: employee?.department || 'Manufacturing',
        role: employee?.role || '',
        workshopRole: employee?.workshopRole || 'None',
        status: employee?.status || 'Active',
        salary: employee?.salary || employee?.contractSettings?.monthlySalary || 0,
        dailyRequiredMinutes: employee?.contractSettings?.dailyRequiredMinutes || 480,
        morningStart: employee?.contractSettings?.schedule?.morningStart || '08:00',
        morningEnd: employee?.contractSettings?.schedule?.morningEnd || '12:00',
        eveningStart: employee?.contractSettings?.schedule?.eveningStart || '13:00',
        eveningEnd: employee?.contractSettings?.schedule?.eveningEnd || '17:00',
        workDays: employee?.contractSettings?.workDays?.map(d => daysMap.indexOf(d)).filter(i => i !== -1).join(',') || '0,1,2,3,4'
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const payload = {
            name: formData.name,
            email: formData.email,
            department: formData.department,
            role: formData.role,
            workshopRole: formData.workshopRole,
            status: formData.status,
            salary: Number(formData.salary),
            contractSettings: {
                monthlySalary: Number(formData.salary),
                dailyRequiredMinutes: Number(formData.dailyRequiredMinutes),
                schedule: {
                    morningStart: formData.morningStart,
                    morningEnd: formData.morningEnd,
                    eveningStart: formData.eveningStart,
                    eveningEnd: formData.eveningEnd
                },
                workDays: formData.workDays.split(',').map(n => daysMap[Number(n)]).filter(Boolean)
            }
        };

        try {
            const url = employee ? `/api/hr/employees/${employee._id}` : '/api/hr/employees';
            const method = employee ? 'PUT' : 'POST';

            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            onSave();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex justify-center items-center overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-2xl my-8 p-6 shadow-2xl relative">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-gray-900">{employee ? t('hr.editEmployeeTitle') : t('hr.addEmployeeTitle')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblFullName')}</label>
                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder={t('hr.namePlaceholder')} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblEmail')}</label>
                            <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder={t('hr.emailPlaceholder')} />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblDepartment')}</label>
                            <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none">
                                <option value="Manufacturing">{t('hr.deptManufacturing')}</option>
                                <option value="Warehouse">{t('hr.deptWarehouse')}</option>
                                <option value="Dispatch">{t('hr.deptDispatch')}</option>
                                <option value="Customer Support">{t('hr.deptCustomerSupport')}</option>
                                <option value="Engineering">{t('hr.deptEngineering')}</option>
                                <option value="Finance">{t('hr.deptFinance')}</option>
                                <option value="Sales">{t('hr.deptSales')}</option>
                                <option value="Marketing">{t('hr.deptMarketing')}</option>
                                <option value="HR">{t('hr.deptHR')}</option>
                                <option value="Design">{t('hr.deptDesign')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblRole')}</label>
                            <input required type="text" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder={t('hr.rolePlaceholder')} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Workshop Role</label>
                            <select value={formData.workshopRole} onChange={e => setFormData({ ...formData, workshopRole: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none">
                                <option value="None">None (Standard HR)</option>
                                <option value="Master Bladesmith">Master Bladesmith</option>
                                <option value="Grinder">Grinder</option>
                                <option value="Handle Maker">Handle Maker</option>
                                <option value="Finisher">Finisher</option>
                                <option value="Apprentice">Apprentice</option>
                                <option value="Packager">Packager</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblStatus')}</label>
                            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none">
                                <option value="Active">{t('hr.statusActive')}</option>
                                <option value="On Leave">{t('hr.statusOnLeave')}</option>
                                <option value="Terminated">{t('hr.statusTerminated')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <h3 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2"><Banknote className="w-4 h-4" /> {t('hr.contractSchedule')}</h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-blue-800 mb-1">{t('hr.lblMonthlySalary')}</label>
                                <input required type="number" value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} className="w-full bg-white border border-blue-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-blue-800 mb-1">{t('hr.lblRequiredMinutes')}</label>
                                <input required type="number" value={formData.dailyRequiredMinutes} onChange={e => setFormData({ ...formData, dailyRequiredMinutes: e.target.value })} className="w-full bg-white border border-blue-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">{t('hr.lblMorningIn')}</label>
                                <input type="time" value={formData.morningStart} onChange={e => setFormData({ ...formData, morningStart: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-sm outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">{t('hr.lblMorningOut')}</label>
                                <input type="time" value={formData.morningEnd} onChange={e => setFormData({ ...formData, morningEnd: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-sm outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">{t('hr.lblEveningIn')}</label>
                                <input type="time" value={formData.eveningStart} onChange={e => setFormData({ ...formData, eveningStart: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-sm outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">{t('hr.lblEveningOut')}</label>
                                <input type="time" value={formData.eveningEnd} onChange={e => setFormData({ ...formData, eveningEnd: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-sm outline-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">{t('hr.lblActiveWorkDays')}</label>
                            <input type="text" value={formData.workDays} onChange={e => setFormData({ ...formData, workDays: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none" placeholder="0,1,2,3,4" />
                            <p className="text-[10px] text-gray-400 mt-1">{t('hr.activeWorkDaysDesc')}</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">{t('hr.btnCancel')}</button>
                        <button type="submit" disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md disabled:bg-blue-300">
                            {isSaving ? t('hr.savingText') : t('hr.btnSaveEmployee')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function HRCard({ title, value, icon: Icon, color, bg, highlight }) {
    return (
        <div className={clsx("p-4 sm:p-6 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 transition-colors", highlight ? "bg-purple-50/30 border-purple-100" : "bg-white border-gray-100")}>
            <div className={clsx("w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0", bg, color)}>
                <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1">{title}</p>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tabular-nums tracking-tight leading-none">{value}</h3>
            </div>
        </div>
    );
}
