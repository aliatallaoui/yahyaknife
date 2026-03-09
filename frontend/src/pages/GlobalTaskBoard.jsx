import React, { useContext, useState } from 'react';
import { ProjectContext } from '../context/ProjectContext';
import { Target, Search, Clock, List, LayoutGrid, CheckCircle2, AlertCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';

const TASK_STATUS_CONFIG = {
    'To Do': { bg: 'bg-gray-100', dot: 'bg-gray-400', border: 'border-gray-200' },
    'In Progress': { bg: 'bg-blue-50', dot: 'bg-blue-500', border: 'border-blue-200' },
    'In Review': { bg: 'bg-purple-50', dot: 'bg-purple-500', border: 'border-purple-200' },
    'Blocked': { bg: 'bg-rose-50', dot: 'bg-rose-500', border: 'border-rose-200' },
    'Done': { bg: 'bg-emerald-50', dot: 'bg-emerald-500', border: 'border-emerald-200' }
};

const PRIORITY_COLORS = {
    'Low': 'bg-gray-100 text-gray-700',
    'Medium': 'bg-blue-50 text-blue-700',
    'High': 'bg-orange-50 text-orange-700',
    'Urgent': 'bg-rose-100 text-rose-700 font-bold border border-rose-200'
};

export default function GlobalTaskBoard() {
    const { t, i18n } = useTranslation('projects');
    const isAr = i18n.language === 'ar';
    const { globalTasks, loading, updateTaskStatus } = useContext(ProjectContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'list'

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-indigo-600 animate-spin"></div>
            </div>
        );
    }

    const filteredTasks = globalTasks.filter(t =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.taskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.assignee?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getTasksByStatus = (status) => filteredTasks.filter(t => t.status === status);

    return (
        <div className="flex flex-col gap-6">

            {/* Header Controls */}
            <PageHeader
                title={t('gtbTitle', 'Global Task Board')}
                subtitle={t('gtbSubtitle', 'Unified visibility across all projects and operational lifecycles.')}
                variant="projects"
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-blue-400 absolute start-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder={t('projects.gtbSearch', 'Search tasks, assignees...')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ps-9 pe-4 py-2 bg-white border border-blue-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all w-48 sm:w-64 shadow-sm font-bold"
                            />
                        </div>
                        <div className="flex bg-white border border-gray-200 p-1 rounded-xl shadow-sm">
                            <button
                                className={clsx("p-2 rounded-lg flex items-center justify-center transition-all", viewMode === 'kanban' ? "bg-indigo-50 text-[#5D5DFF] shadow-sm ring-1 ring-indigo-500/10" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50")}
                                onClick={() => setViewMode('kanban')}
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </button>
                            <button
                                className={clsx("p-2 rounded-lg flex items-center justify-center transition-all", viewMode === 'list' ? "bg-purple-50 text-[#8B5CF6] shadow-sm ring-1 ring-purple-500/10" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50")}
                                onClick={() => setViewMode('list')}
                            >
                                <List className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                }
            />

            {viewMode === 'kanban' ? (
                /* KANBAN VIEW */
                <div className="flex overflow-x-auto pb-4 gap-6 styled-scrollbar min-h-[600px] items-start">
                    {Object.keys(TASK_STATUS_CONFIG).map(status => {
                        const colTasks = getTasksByStatus(status);
                        return (
                            <div key={status} className={clsx("flex-shrink-0 w-80 rounded-2xl border p-4 flex flex-col", TASK_STATUS_CONFIG[status].bg, TASK_STATUS_CONFIG[status].border)}>
                                <div className="flex justify-between items-center mb-4 px-1">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                        <span className={clsx("w-2 h-2 rounded-full", TASK_STATUS_CONFIG[status].dot)}></span>
                                        {t(`status${status.replace(' ', '')}`)}
                                    </h3>
                                    <span className="text-xs font-bold text-gray-500 bg-white/50 px-2 py-0.5 rounded-full">{colTasks.length}</span>
                                </div>

                                <div className="flex-1 space-y-3">
                                    {colTasks.map(task => (
                                        <div key={task._id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all group">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-bold text-indigo-600 tracking-wider font-mono bg-indigo-50 px-1.5 py-0.5 rounded">{task.taskId}</span>
                                                <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-semibold", PRIORITY_COLORS[task.priority])}>{t(`priority${task.priority}`)}</span>
                                            </div>

                                            <h4 className="font-bold text-gray-900 text-sm mb-1 leading-snug">{task.title}</h4>

                                            {task.project && (
                                                <p className="text-[11px] text-gray-500 font-medium mb-3 truncate border-l-2 border-indigo-200 pl-2">{task.project.name}</p>
                                            )}

                                            <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600" title={task.assignee?.name}>
                                                        {task.assignee?.name?.charAt(0) || '?'}
                                                    </div>
                                                </div>

                                                {task.deadline && (
                                                    <div className={clsx("text-[10px] font-semibold flex items-center gap-1", new Date(task.deadline) < new Date() ? "text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded" : "text-gray-400")}>
                                                        <Clock className="w-3 h-3" />
                                                        {moment(task.deadline).format('MMM D')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {colTasks.length === 0 && (
                                        <div className="border-2 border-dashed border-gray-200/60 rounded-xl p-6 text-center text-xs font-medium text-gray-400">{t('emptyLaneTasks')}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* LIST VIEW */
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[600px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className={clsx("p-4 font-semibold w-24", isAr ? "text-right" : "text-left")}>{t('thTaskId')}</th>
                                    <th className={clsx("p-4 font-semibold", isAr ? "text-right" : "text-left")}>{t('thTitle')}</th>
                                    <th className={clsx("p-4 font-semibold", isAr ? "text-right" : "text-left")}>{t('thProject')}</th>
                                    <th className={clsx("p-4 font-semibold", isAr ? "text-right" : "text-left")}>{t('thAssignee')}</th>
                                    <th className="p-4 font-semibold text-center w-28">{t('thPriority')}</th>
                                    <th className="p-4 font-semibold text-center w-32">{t('thStatus')}</th>
                                    <th className={clsx("p-4 font-semibold w-32", isAr ? "text-left" : "text-right")}>{t('thDeadline')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {filteredTasks.map((task) => (
                                    <tr key={task._id} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                                        <td className="p-4 font-mono text-[11px] text-gray-400">{task.taskId}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-gray-900">{task.title}</div>
                                            {task.linkedEntity && <div className="text-xs text-indigo-500 mt-0.5">{t('linkedContext')}</div>}
                                        </td>
                                        <td className="p-4 text-gray-600 font-medium text-[13px]">{task.project?.name}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                                    {task.assignee?.name?.charAt(0) || '?'}
                                                </div>
                                                <span className="text-gray-700 text-xs font-semibold">{task.assignee?.name || t('unassignedPM')}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={clsx("text-[10px] px-2.5 py-1 rounded-full font-semibold", PRIORITY_COLORS[task.priority])}>{t(`priority${task.priority}`)}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full w-28 justify-center">
                                                <span className={clsx("w-1.5 h-1.5 rounded-full", TASK_STATUS_CONFIG[task.status].dot)}></span>
                                                {t(`status${task.status.replace(' ', '')}`)}
                                            </span>
                                        </td>
                                        <td className={clsx("p-4 font-medium text-xs", task.deadline && new Date(task.deadline) < new Date() && task.status !== 'Done' ? "text-rose-600" : "text-gray-500", isAr ? "text-left" : "text-right")}>
                                            {task.deadline ? moment(task.deadline).format('MMM D, YYYY') : '--'}
                                        </td>
                                    </tr>
                                ))}
                                {filteredTasks.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-gray-500 text-sm">{t('noTasksFound')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
