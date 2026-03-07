import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, CalendarDays, Search, CheckCircle, XCircle, Clock, Banknote, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import clsx from 'clsx';
import moment from 'moment';

const COLORS = ['#1A73E8', '#C58AF9', '#EE6C4D', '#3D5A80', '#98C1D9', '#E0FBFC', '#293241'];

export default function HRSnapshot() {
    const navigate = useNavigate();
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
                fetch('http://localhost:5000/api/hr/metrics'),
                fetch('http://localhost:5000/api/hr/employees'),
                fetch('http://localhost:5000/api/hr/leaves'),
                fetch(`http://localhost:5000/api/hr/attendance?date=${todayStr}`)
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
        { name: 'Active (Working)', value: metrics?.activeEmployees || 0 },
        { name: 'On Leave / Inactive', value: Math.max(0, (metrics?.totalEmployees || 0) - (metrics?.activeEmployees || 0)) }
    ];
    const UTILIZATION_COLORS = ['#10b981', '#f43f5e'];

    const handleLeaveStatusUpdate = async (id, newStatus) => {
        try {
            const res = await fetch(`http://localhost:5000/api/hr/leaves/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                const updated = await res.json();
                setLeaves(leaves.map(l => l._id === id ? updated : l));

                // Refresh employees to reflect deducted balance
                if (newStatus === 'Approved') {
                    const empRes = await fetch('http://localhost:5000/api/hr/employees');
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
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">HR Snapshot</h2>
                    <p className="text-sm text-gray-500 mt-1">Workforce distribution, employee directory, and leave management.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchHRData} className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl text-sm transition-colors hover:bg-gray-200">
                        Refresh Data
                    </button>
                    <button onClick={() => { setSelectedEmployee(null); setIsModalOpen(true); }} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl text-sm shadow-md transition-colors hover:bg-blue-700">
                        Add Employee
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <HRCard title="Total Headcount" value={metrics?.totalEmployees || 0} icon={Users} color="text-blue-600" bg="bg-blue-50" />
                <HRCard title="Present Today" value={metrics?.presentToday || 0} icon={UserCheck} color="text-emerald-600" bg="bg-emerald-50" />
                <HRCard title="Late Today" value={metrics?.lateToday || 0} icon={Clock} color="text-amber-600" bg="bg-amber-50" />
                <HRCard title="Absent Today" value={metrics?.absentToday || 0} icon={XCircle} color="text-rose-600" bg="bg-rose-50" />
                <HRCard title="Pending Leaves" value={pendingLeavesCount} icon={CalendarDays} color="text-purple-600" bg="bg-purple-50" highlight={pendingLeavesCount > 0} />
                <HRCard title="Est. Payroll (DZD)" value={`${((metrics?.estimatedPayrollDZD || 0) / 1000).toFixed(0)}k`} icon={Banknote} color="text-gray-800" bg="bg-gray-100" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Department Distribution (Chart) */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Department Distribution</h3>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={deptData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} width={80} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="Headcount" radius={[0, 4, 4, 0]} barSize={24}>
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
                        <h3 className="text-lg font-bold text-gray-900">Recent Leave Requests</h3>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{leaves.length} Total</span>
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
                                        <div className="text-right hidden sm:block">
                                            <div className="text-xs font-medium text-gray-900">{moment(req.endDate).diff(moment(req.startDate), 'days') + 1} Days</div>
                                            <div className="text-[10px] text-gray-400">Requested {moment(req.requestDate).fromNow()}</div>
                                        </div>
                                        {req.status === 'Pending' ? (
                                            <div className="flex gap-1 ml-2">
                                                <button onClick={() => handleLeaveStatusUpdate(req._id, 'Approved')} className="p-1.5 rounded-md hover:bg-green-100 text-green-600 transition-colors" title="Approve">
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleLeaveStatusUpdate(req._id, 'Rejected')} className="p-1.5 rounded-md hover:bg-red-100 text-red-600 transition-colors" title="Reject">
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className={clsx("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-24 justify-center shrink-0 ml-2", statusConfig.bg, statusConfig.color)}>
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
                <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Workforce Utilization & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-[280px]">
                    <div className="h-full relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={utilizationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {utilizationData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={UTILIZATION_COLORS[index % UTILIZATION_COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-5">
                            <span className="text-3xl font-black text-gray-900">{metrics?.activeEmployees || 0}</span>
                            <span className="text-xs font-bold text-gray-400">ACTIVE</span>
                        </div>
                    </div>

                    <div>
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                            <h4 className="font-bold text-gray-900 mb-2">Live Availability Score</h4>
                            <p className="text-sm text-gray-600 mb-4">Percentage of the total factory and operations workforce currently available to be deployed to active production zones or dispatch.</p>
                            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${metrics?.totalEmployees > 0 ? ((metrics.activeEmployees / metrics.totalEmployees) * 100).toFixed(1) : 0}%` }}></div>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs font-bold text-gray-400">0%</span>
                                <span className="text-sm font-black text-emerald-600">
                                    {metrics?.totalEmployees > 0 ? ((metrics.activeEmployees / metrics.totalEmployees) * 100).toFixed(1) : 0}% Operational
                                </span>
                                <span className="text-xs font-bold text-gray-400">100%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Advanced Employee Directory Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-gray-100 gap-4">
                    <h3 className="text-lg font-bold text-gray-900 whitespace-nowrap">Employee Directory</h3>

                    {/* Advanced Filter Bar */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search Name or ID..."
                                className="w-full md:w-48 bg-gray-50 border border-gray-200 focus:border-blue-400 outline-none rounded-lg py-2 pl-9 pr-4 text-sm transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none font-medium cursor-pointer">
                                {uniqueDepts.map(d => <option key={d} value={d}>{d === 'All' ? 'All Depts' : d}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none font-medium cursor-pointer max-w-[120px]">
                                {uniqueRoles.map(r => <option key={r} value={r}>{r === 'All' ? 'All Roles' : r}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none font-medium cursor-pointer">
                                <option value="All">All Status</option>
                                <option value="Active">Active</option>
                                <option value="On Leave">On Leave</option>
                                <option value="Terminated">Terminated</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                <th className="p-4 font-semibold">Employee</th>
                                <th className="p-4 font-semibold">Role & Dept</th>
                                <th className="p-4 font-semibold">Monthly Salary</th>
                                <th className="p-4 font-semibold text-center">Today's Attendance</th>
                                <th className="p-4 font-semibold text-center">Account Status</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredEmployees.map((emp) => (
                                <tr key={emp._id} onClick={() => navigate(`/hr/employees/${emp._id}`)} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
                                                {emp.name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{emp.name}</div>
                                                <div className="text-xs text-gray-500 font-medium">ID: {emp.employeeId || emp._id.slice(-6).toUpperCase()}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-semibold text-gray-800">{emp.role}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{emp.department}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">
                                            {(emp.contractSettings?.monthlySalary || emp.salary || 0).toLocaleString()} <span className="text-xs font-normal text-gray-400">DZD</span>
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
                                            {emp.todayAttendance}
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
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); setIsModalOpen(true); }}
                                            className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors border border-gray-200"
                                        >
                                            Quick Edit
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
                                        <p className="text-gray-500 font-medium">No employees found matching the current filters.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {isModalOpen && (
                <EmployeeModal
                    employee={selectedEmployee}
                    onClose={() => setIsModalOpen(false)}
                    onSave={async () => {
                        setIsModalOpen(false);
                        const empRes = await fetch('http://localhost:5000/api/hr/employees');
                        setEmployees(await empRes.json());
                    }}
                />
            )}
        </div>
    );
}

function EmployeeModal({ employee, onClose, onSave }) {
    const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const [formData, setFormData] = useState({
        name: employee?.name || '',
        email: employee?.email || '',
        department: employee?.department || 'Manufacturing',
        role: employee?.role || '',
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
            const url = employee ? `http://localhost:5000/api/hr/employees/${employee._id}` : 'http://localhost:5000/api/hr/employees';
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
                    <h2 className="text-xl font-bold text-gray-900">{employee ? 'Edit Employee Record' : 'Add New Employee'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Full Name</label>
                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder="John Doe" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                            <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder="john@company.com" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Department</label>
                            <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none">
                                <option>Manufacturing</option>
                                <option>Warehouse</option>
                                <option>Dispatch</option>
                                <option>Customer Support</option>
                                <option>Engineering</option>
                                <option>Finance</option>
                                <option>Sales</option>
                                <option>Marketing</option>
                                <option>HR</option>
                                <option>Design</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Role</label>
                            <input required type="text" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder="Manager" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
                            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none">
                                <option>Active</option>
                                <option>On Leave</option>
                                <option>Terminated</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <h3 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2"><Banknote className="w-4 h-4" /> Contract & Schedule</h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-blue-800 mb-1">Monthly Salary (DZD)</label>
                                <input required type="number" value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} className="w-full bg-white border border-blue-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-blue-800 mb-1">Required Minutes / Day (Ex: 480 = 8h)</label>
                                <input required type="number" value={formData.dailyRequiredMinutes} onChange={e => setFormData({ ...formData, dailyRequiredMinutes: e.target.value })} className="w-full bg-white border border-blue-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Morning In</label>
                                <input type="time" value={formData.morningStart} onChange={e => setFormData({ ...formData, morningStart: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-sm outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Morning Out</label>
                                <input type="time" value={formData.morningEnd} onChange={e => setFormData({ ...formData, morningEnd: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-sm outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Evening In</label>
                                <input type="time" value={formData.eveningStart} onChange={e => setFormData({ ...formData, eveningStart: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-sm outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Evening Out</label>
                                <input type="time" value={formData.eveningEnd} onChange={e => setFormData({ ...formData, eveningEnd: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-sm outline-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Active Work Days (0=Sun, 6=Sat)</label>
                            <input type="text" value={formData.workDays} onChange={e => setFormData({ ...formData, workDays: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none" placeholder="0,1,2,3,4" />
                            <p className="text-[10px] text-gray-400 mt-1">Comma separated. Days outside this list count as weekend overtime automatically.</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md disabled:bg-blue-300">
                            {isSaving ? 'Saving...' : 'Save Employee Data'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function HRCard({ title, value, icon: Icon, color, bg, highlight }) {
    return (
        <div className={clsx("p-6 rounded-2xl border shadow-sm flex items-center gap-4 transition-colors", highlight ? "bg-purple-50/30 border-purple-100" : "bg-white border-gray-100")}>
            <div className={clsx("w-14 h-14 rounded-xl flex items-center justify-center shrink-0", bg, color)}>
                <Icon className="w-7 h-7" />
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <h3 className="text-3xl font-black text-gray-900 tabular-nums tracking-tight leading-none">{value}</h3>
            </div>
        </div>
    );
}
