import React, { useContext, useState } from 'react';
import { ProjectContext } from '../context/ProjectContext';
import { LayoutDashboard, CheckCircle2, Clock, AlertTriangle, Plus, Search, Filter, TrendingUp, Users } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import moment from 'moment';

const STATUS_COLORS = {
    'Planned': 'bg-gray-100 text-gray-700 border-gray-200',
    'Active': 'bg-blue-50 text-blue-700 border-blue-200',
    'On Hold': 'bg-amber-50 text-amber-700 border-amber-200',
    'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Cancelled': 'bg-rose-50 text-rose-700 border-rose-200'
};

const HEALTH_COLORS = {
    'On Track': 'text-emerald-500 bg-emerald-50',
    'At Risk': 'text-amber-500 bg-amber-50',
    'Off Track': 'text-rose-500 bg-rose-50'
};

export default function ProjectStatus() {
    const { t, i18n } = useTranslation('projects');
    const isAr = i18n.language === 'ar';
    const { projects, analytics, loading, createProject } = useContext(ProjectContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProj, setNewProj] = useState({ name: '', description: '', department: 'General', deadline: '', linkedModule: 'None' });

    const handleCreateProject = async (e) => {
        e.preventDefault();
        await createProject(newProj);
        setIsModalOpen(false);
        setNewProj({ name: '', description: '', department: 'General', deadline: '', linkedModule: 'None' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-indigo-600 animate-spin"></div>
            </div>
        );
    }

    const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.projectId.toLowerCase().includes(searchTerm.toLowerCase()));

    // Formatting Task Distribution for Chart
    const taskDistData = analytics?.taskStatusDistribution ? Object.keys(analytics.taskStatusDistribution).map(key => ({
        name: key,
        value: analytics.taskStatusDistribution[key]
    })) : [];

    const TASK_COLORS = ['#9ca3af', '#3b82f6', '#8b5cf6', '#ef4444', '#10b981'];

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('title')}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm shadow-sm transition-colors hover:bg-gray-50 flex items-center gap-2">
                        <Filter className="w-4 h-4" /> {t('reportsBtn')}
                    </button>
                    <button
                        onClick={() => setIsModalOpen(!isModalOpen)}
                        className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl text-sm shadow-md transition-colors hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> {t('newProjBtn')}
                    </button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KPICard title={t('kpiActive')} value={analytics?.activeProjects || 0} icon={LayoutDashboard} color="text-indigo-600" bg="bg-indigo-50" />
                <KPICard title={t('kpiAvgComp')} value={`${analytics?.averageCompletion || 0}%`} icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" />
                <KPICard title={t('kpiCompYTD')} value={analytics?.completedProjects || 0} icon={CheckCircle2} color="text-teal-600" bg="bg-teal-50" />
                <KPICard title={t('kpiOverdue')} value={analytics?.overdueTasks || 0} icon={AlertTriangle} color="text-rose-600" bg="bg-rose-50" alert={analytics?.overdueTasks > 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Global Task Workload Chart */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[380px]">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-400" /> {t('chartTitle')}
                    </h3>
                    <div className="flex-1 ltr:ml-[-20px] rtl:mr-[-20px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={taskDistData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                    {taskDistData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={TASK_COLORS[index % TASK_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Project List (Master Overview) */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[380px]">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                        <h3 className="text-lg font-bold text-gray-900">{t('listTitle')}</h3>
                        <div className="relative">
                            <Search className={clsx("w-4 h-4 absolute top-1/2 -translate-y-1/2 text-gray-400", isAr ? "right-3" : "left-3")} />
                            <input
                                type="text"
                                placeholder={t('searchPlaceholder')}
                                className={clsx("bg-gray-50 border border-transparent focus:border-gray-200 outline-none rounded-lg py-2 pr-4 text-sm w-64", isAr ? "pr-9 pl-4" : "pl-9")}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 styled-scrollbar space-y-3">
                        {filteredProjects.map(proj => (
                            <div key={proj._id} className="group border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 hover:border-indigo-100 transition-all cursor-pointer">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100">
                                            {proj.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-900">{proj.name}</h4>
                                                <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold border", STATUS_COLORS[proj.status])}>{t(`status${proj.status.replace(' ', '')}`)}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 font-medium">{proj.projectId} • {t(`dept${proj.department}`)} • Link: {t(`mod${proj.linkedModule}`)}</p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-sm font-bold text-gray-900">{proj.completionPercentage}%</div>
                                        <div className={clsx("text-[10px] font-bold px-2 py-0.5 rounded mt-1", HEALTH_COLORS[proj.healthIndicator])}>
                                            {t(`health${proj.healthIndicator.replace(' ', '')}`)}
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-4">
                                    <div
                                        className={clsx("h-full rounded-full transition-all duration-500", proj.completionPercentage === 100 ? "bg-emerald-500" : "bg-indigo-500")}
                                        style={{ width: `${proj.completionPercentage}%` }}>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600" title={`${t('owner')}: ${proj.owner?.name || t('unassigned')}`}>
                                            {proj.owner?.name?.charAt(0) || '?'}
                                        </div>
                                        <span className="text-xs text-gray-500">{proj.owner?.name || t('unassigned')}</span>
                                    </div>
                                    <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {t('ends')} {moment(proj.deadline).format('MMM D, YYYY')}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {filteredProjects.length === 0 && (
                            <div className="text-center p-8 text-gray-500 text-sm">{t('noProjects')}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* New Project Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-900">{t('modalTitle')}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
                        </div>
                        <form onSubmit={handleCreateProject} className="p-6 space-y-4 text-start">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">{t('nameLabel')}</label>
                                <input type="text" required value={newProj.name} onChange={e => setNewProj({ ...newProj, name: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500" placeholder={t('namePlaceholder')} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">{t('descLabel')}</label>
                                <textarea rows="3" value={newProj.description} onChange={e => setNewProj({ ...newProj, description: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500" placeholder={t('descPlaceholder')}></textarea>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">{t('deptLabel')}</label>
                                    <select value={newProj.department} onChange={e => setNewProj({ ...newProj, department: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white">
                                        <option value="General">{t('deptGeneral')}</option>
                                        <option value="Manufacturing">{t('deptMfg')}</option>
                                        <option value="Sales">{t('deptSales')}</option>
                                        <option value="Marketing">{t('deptMarketing')}</option>
                                        <option value="Engineering">{t('deptEng')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">{t('linkedModuleLabel')}</label>
                                    <select value={newProj.linkedModule} onChange={e => setNewProj({ ...newProj, linkedModule: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white">
                                        <option value="None">{t('modNone')}</option>
                                        <option value="Sales">{t('modSales')}</option>
                                        <option value="Manufacturing">{t('modMfg')}</option>
                                        <option value="Inventory">{t('modInv')}</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">{t('deadlineLabel')}</label>
                                <input type="date" required value={newProj.deadline} onChange={e => setNewProj({ ...newProj, deadline: e.target.value })} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500" />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200">{t('cancelBtn')}</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md hover:bg-indigo-700">{t('submitBtn')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

function KPICard({ title, value, icon: Icon, color, bg, alert }) {
    return (
        <div className={clsx("p-6 rounded-2xl border shadow-sm flex justify-between items-start transition-colors", alert ? "bg-rose-50/30 border-rose-100" : "bg-white border-gray-100")}>
            <div>
                <p className="text-sm font-medium text-gray-500 mb-2">{title}</p>
                <h3 className="text-3xl font-black text-gray-900 tracking-tight leading-none">{value}</h3>
            </div>
            <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", bg, color)}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );
}
