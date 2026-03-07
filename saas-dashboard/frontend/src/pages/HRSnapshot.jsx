import { useEffect, useState } from 'react';
import { Users, UserCheck, CalendarDays, Search, CheckCircle, XCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import clsx from 'clsx';
import moment from 'moment';

const COLORS = ['#1A73E8', '#C58AF9', '#EE6C4D', '#3D5A80', '#98C1D9', '#E0FBFC', '#293241'];

export default function HRSnapshot() {
    const [metrics, setMetrics] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchHRData = async () => {
            try {
                const [metricsRes, empRes, leaveRes] = await Promise.all([
                    fetch('http://localhost:5000/api/hr/metrics'),
                    fetch('http://localhost:5000/api/hr/employees'),
                    fetch('http://localhost:5000/api/hr/leaves')
                ]);

                setMetrics(await metricsRes.json());
                setEmployees(await empRes.json());
                setLeaves(await leaveRes.json());
            } catch (error) {
                console.error("Error fetching HR data:", error);
            } finally {
                setLoading(false);
            }
        };
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

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendingLeavesCount = leaves.filter(l => l.status === 'Pending').length;

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">HR Snapshot</h2>
                    <p className="text-sm text-gray-500 mt-1">Workforce distribution, employee directory, and leave management.</p>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl text-sm shadow-md transition-colors hover:bg-blue-700">Add Employee</button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <HRCard title="Total Headcount" value={metrics?.totalEmployees} icon={Users} color="text-blue-600" bg="bg-blue-50" />
                <HRCard title="Active Employees" value={metrics?.activeEmployees} icon={UserCheck} color="text-green-600" bg="bg-green-50" />
                <HRCard title="Pending Leave Requests" value={pendingLeavesCount} icon={CalendarDays} color="text-purple-600" bg="bg-purple-50" highlight={pendingLeavesCount > 0} />
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
                                        <div className={clsx("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-24 justify-center shrink-0", statusConfig.bg, statusConfig.color)}>
                                            <StatusIcon className="w-3.5 h-3.5" />
                                            {req.status}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Directory Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Employee Directory</h3>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search name, role, dept..."
                            className="bg-gray-50 border border-transparent focus:border-gray-200 outline-none rounded-lg py-2 pl-9 pr-4 text-sm w-64 md:w-80"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold">Name</th>
                                <th className="p-4 font-semibold">Role</th>
                                <th className="p-4 font-semibold">Department</th>
                                <th className="p-4 font-semibold">Contact</th>
                                <th className="p-4 font-semibold text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredEmployees.map((emp) => (
                                <tr key={emp._id} className="hover:bg-gray-50/50 transition-colors cursor-pointer">
                                    <td className="p-4 font-bold text-gray-900">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0">
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div>{emp.name}</div>
                                                <div className="text-xs text-gray-400 font-normal">Joined {moment(emp.joinDate).format('YYYY')}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-700 font-medium">{emp.role}</td>
                                    <td className="p-4">
                                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-semibold">{emp.department}</span>
                                    </td>
                                    <td className="p-4 text-blue-600 font-medium">{emp.email}</td>
                                    <td className="p-4 text-center">
                                        <span className={clsx(
                                            "px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1",
                                            emp.status === 'Active' ? "bg-green-50 text-green-700" :
                                                emp.status === 'On Leave' ? "bg-yellow-50 text-yellow-700" : "bg-gray-100 text-gray-600"
                                        )}>
                                            <span className={clsx("w-1.5 h-1.5 rounded-full",
                                                emp.status === 'Active' ? "bg-green-500" :
                                                    emp.status === 'On Leave' ? "bg-yellow-500" : "bg-gray-400"
                                            )}></span>
                                            {emp.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No employees found matching "{searchTerm}"</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
