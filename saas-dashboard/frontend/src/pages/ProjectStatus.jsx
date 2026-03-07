import { useEffect, useState } from 'react';
import { Briefcase, Activity, CheckSquare, Target, Clock, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import clsx from 'clsx';
import moment from 'moment';

const COLORS = ['#94A3B8', '#3B82F6', '#F59E0B', '#10B981'];

export default function ProjectStatus() {
    const [metrics, setMetrics] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjectData = async () => {
            try {
                const [metricsRes, projRes] = await Promise.all([
                    fetch('http://localhost:5000/api/projects/metrics'),
                    fetch('http://localhost:5000/api/projects/list')
                ]);

                setMetrics(await metricsRes.json());
                setProjects(await projRes.json());
            } catch (error) {
                console.error("Error fetching project data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjectData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    const taskData = metrics?.taskStatusCount ? [
        { name: 'To Do', value: metrics.taskStatusCount['To Do'] },
        { name: 'In Progress', value: metrics.taskStatusCount['In Progress'] },
        { name: 'In Review', value: metrics.taskStatusCount['In Review'] },
        { name: 'Done', value: metrics.taskStatusCount['Done'] }
    ] : [];

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Project Status</h2>
                    <p className="text-sm text-gray-500 mt-1">Track portfolio health, active initiatives, and task burndown.</p>
                </div>
                <button className="px-5 py-2.5 bg-gray-900 text-white font-semibold rounded-xl text-sm shadow-md transition-colors hover:bg-gray-800">New Project</button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ProjectCard title="Active Projects" value={metrics?.portfolio?.activeProjects} icon={Activity} color="text-indigo-600" bg="bg-indigo-50" />
                <ProjectCard title="Average Completion" value={`${metrics?.portfolio?.averageCompletion}%`} icon={CheckSquare} color="text-green-600" bg="bg-green-50" />
                <ProjectCard title="Upcoming Milestones" value={metrics?.upcomingMilestones?.length} icon={Target} color="text-yellow-600" bg="bg-yellow-50" highlight={metrics?.upcomingMilestones?.length > 0} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Active Projects List */}
                <div className="xl:col-span-2 flex flex-col gap-6">
                    <h3 className="text-lg font-bold text-gray-900 px-1">Active Portfolio</h3>
                    <div className="grid gap-4">
                        {projects.map(proj => (
                            <div key={proj._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-100 transition-colors group">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-lg mb-1">{proj.name}</h4>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                                            <span className="bg-gray-100 px-2 py-1 rounded-md">{proj.department}</span>
                                            {proj.manager && <span>Lead: <span className="text-gray-900">{proj.manager.name}</span></span>}
                                        </div>
                                    </div>
                                    <span className={clsx(
                                        "px-3 py-1 rounded-full text-xs font-bold shrink-0",
                                        proj.status === 'Completed' ? "bg-green-100 text-green-700" :
                                            proj.status === 'Active' ? "bg-blue-100 text-blue-700" :
                                                proj.status === 'On Hold' ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                                    )}>
                                        {proj.status}
                                    </span>
                                </div>

                                <div className="mb-4">
                                    <div className="flex justify-between text-sm font-semibold mb-1.5">
                                        <span className="text-gray-700">Progress</span>
                                        <span className="text-gray-900">{proj.completionPercentage}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                        <div
                                            className={clsx("h-2 rounded-full transition-all duration-500", proj.completionPercentage === 100 ? "bg-green-500" : "bg-blue-600")}
                                            style={{ width: `${proj.completionPercentage}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-500 font-medium pt-3 border-t border-gray-50">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Deadline: {moment(proj.deadline).format('MMM D, YYYY')}
                                    </div>
                                    <div className="tabular-nums">
                                        Budget: <span className="text-gray-900">${proj.spent.toLocaleString()} / ${proj.budget.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Side Panel: Tasks & Milestones */}
                <div className="flex flex-col gap-6">

                    {/* Task Breakdown */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Global Task Breakdown</h3>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={taskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                                        {taskData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Milestones */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1 min-h-[300px]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-gray-400" /> Key Milestones
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-0 styled-scrollbar">
                            <div className="divide-y divide-gray-100">
                                {metrics?.upcomingMilestones?.map(m => (
                                    <div key={m._id} className="p-5 hover:bg-gray-50/50 transition-colors">
                                        <div className="text-xs font-bold text-blue-600 mb-1">{m.projectId?.name || 'Unknown Project'}</div>
                                        <h4 className="font-semibold text-gray-900 text-sm mb-2">{m.title}</h4>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className={clsx("font-medium", moment(m.dueDate).isBefore(moment()) ? "text-red-500" : "text-gray-500")}>
                                                Due {moment(m.dueDate).fromNow()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {(!metrics?.upcomingMilestones || metrics.upcomingMilestones.length === 0) && (
                                    <div className="p-8 text-center text-gray-500 text-sm">No upcoming milestones.</div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}

function ProjectCard({ title, value, icon: Icon, color, bg, highlight }) {
    return (
        <div className={clsx("p-6 rounded-2xl border shadow-sm flex items-center justify-between transition-colors", highlight ? "bg-yellow-50/30 border-yellow-100" : "bg-white border-gray-100")}>
            <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <h3 className="text-3xl font-black text-gray-900 tabular-nums tracking-tight leading-none">{value}</h3>
            </div>
            <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", bg, color)}>
                <Icon className="w-7 h-7" />
            </div>
        </div>
    );
}
