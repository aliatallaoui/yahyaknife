import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CalendarDays, Flag, MessageSquare, Paperclip, Activity, Target, AlignLeft } from 'lucide-react';
import clsx from 'clsx';
import moment from 'moment';

const TAB_OPTIONS = ['Tasks (Kanban)', 'Milestones', 'Documents', 'Activity Log'];

export default function ProjectDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [projectData, setProjectData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Tasks (Kanban)');

    useEffect(() => {
        const fetchDeepProject = async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/projects/${id}`);
                if (res.ok) {
                    setProjectData(await res.json());
                } else {
                    console.error("Failed to load project details");
                }
            } catch (error) {
                console.error("Fetch Error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDeepProject();
    }, [id]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-indigo-600 animate-spin"></div>
        </div>
    );

    if (!projectData || !projectData.project) return <div className="p-8 text-center text-gray-500">Project Not Found.</div>;

    const { project, tasks, milestones, activity } = projectData;

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1400px]">

            {/* Nav & Header row */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/projects')}
                    className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-gray-900 rounded-lg shadow-sm transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{project.name}</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-gray-100 text-gray-700 border-gray-200">{project.projectId}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">{project.status}</span>
                    </div>
                </div>
            </div>

            {/* Top Layout Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Details */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Project Overview</h3>

                    <p className="text-gray-600 mb-6 text-sm leading-relaxed whitespace-pre-line">{project.description || "No description provided."}</p>

                    <div className="flex gap-4 mt-auto">
                        <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 mb-1">Completion</p>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xl font-black text-gray-900">{project.completionPercentage}%</span>
                                <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded", project.healthIndicator === 'On Track' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{project.healthIndicator}</span>
                            </div>
                            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${project.completionPercentage}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Metadata Sidebar */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">

                    <div>
                        <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Project Manager</p>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">{project.owner?.name?.charAt(0) || '?'}</div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">{project.owner?.name || 'Unassigned'}</p>
                                <p className="text-[11px] text-gray-500 font-medium">{project.department}</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wide">Timeline</p>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm font-medium text-gray-600"><CalendarDays className="w-4 h-4 text-gray-400" /> Start</span>
                                <span className="text-sm font-semibold text-gray-900">{project.startDate ? moment(project.startDate).format('MMM D, YYYY') : '--'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm font-medium text-gray-600"><Flag className="w-4 h-4 text-gray-400" /> Deadline</span>
                                <span className={clsx("text-sm font-semibold", project.deadline && new Date(project.deadline) < new Date() ? 'text-rose-600' : 'text-gray-900')}>{project.deadline ? moment(project.deadline).format('MMM D, YYYY') : '--'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wide">Tech Link</p>
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-semibold">{project.linkedModule}</span>
                    </div>

                </div>
            </div>

            {/* Deep Tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">

                <div className="flex border-b border-gray-100 bg-gray-50/50">
                    {TAB_OPTIONS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx("px-6 py-4 text-sm font-bold transition-all border-b-2", activeTab === tab ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50")}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="p-6 flex-1 bg-gray-50/20">

                    {activeTab === 'Tasks (Kanban)' && (
                        <div className="flex overflow-x-auto pb-4 gap-6 styled-scrollbar min-h-[400px] items-start">
                            {['To Do', 'In Progress', 'In Review', 'Blocked', 'Done'].map(status => {
                                const colTasks = tasks.filter(t => t.status === status);
                                return (
                                    <div key={status} className="flex-shrink-0 w-72 bg-gray-100/50 rounded-xl border border-gray-200 p-3 flex flex-col">
                                        <div className="flex justify-between items-center mb-3 px-1">
                                            <h4 className="font-bold text-gray-700 text-sm">{status}</h4>
                                            <span className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{colTasks.length}</span>
                                        </div>
                                        <div className="space-y-2 flex-1">
                                            {colTasks.map(task => (
                                                <div key={task._id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors">
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <span className="text-[10px] font-mono text-indigo-500 bg-indigo-50 px-1 rounded">{task.taskId}</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-gray-900 leading-tight mb-3 text-left">{task.title}</p>
                                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50">
                                                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600" title={task.assignee?.name}>
                                                            {task.assignee?.name?.charAt(0) || '?'}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {task.comments?.length > 0 && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MessageSquare className="w-3 h-3" /> {task.comments.length}</span>}
                                                            {task.attachments?.length > 0 && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Paperclip className="w-3 h-3" /> {task.attachments.length}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {colTasks.length === 0 && <div className="text-center py-4 text-xs font-medium text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">Empty</div>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {activeTab === 'Activity Log' && (
                        <div className="space-y-4 max-w-2xl mx-auto">
                            {activity.map(act => (
                                <div key={act._id} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                        <Activity className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900"><span className="font-bold">{act.actor?.name || 'System'}</span> {act.action}</p>
                                        <p className="text-xs text-gray-500 mt-1">{act.details}</p>
                                        <p className="text-[10px] text-gray-400 mt-2 font-mono">{moment(act.timestamp).format('MMM D, h:mm A')}</p>
                                    </div>
                                </div>
                            ))}
                            {activity.length === 0 && <div className="text-center text-sm text-gray-500 py-8">No recent activity.</div>}
                        </div>
                    )}

                </div>
            </div>

        </div>
    );
}
