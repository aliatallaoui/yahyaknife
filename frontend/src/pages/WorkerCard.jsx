import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Wrench, Star, Zap, Award, Activity, CheckCircle, TrendingUp, Clock } from 'lucide-react';
import moment from 'moment';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import PageHeader from '../components/PageHeader';

export default function WorkerCard() {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const { id } = useParams();
    const navigate = useNavigate();

    const [worker, setWorker] = useState(null);
    const [productivity, setProductivity] = useState([]);
    const [rewards, setRewards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const h = { headers: { Authorization: `Bearer ${token}` } };
                const [workerRes, prodRes, rewRes] = await Promise.all([
                    fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/employees/${id}`, h),
                    fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/productivity?employeeId=${id}`, h),
                    fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/rewards?employeeId=${id}`, h)
                ]);

                if (!workerRes.ok) throw new Error('Worker not found');

                const workerJson = await workerRes.json();
                setWorker(workerJson.data ?? workerJson);
                const prodJson = await prodRes.json();
                setProductivity(prodJson.data ?? (Array.isArray(prodJson) ? prodJson : []));
                const rewJson = await rewRes.json();
                setRewards(rewJson.data ?? (Array.isArray(rewJson) ? rewJson : []));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) return (
        <div className="flex justify-center items-center h-screen">
            <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-amber-600 animate-spin"></div>
        </div>
    );

    if (!worker) return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-500">
            <User className="w-16 h-16 mb-4 text-gray-300" />
            <h2 className="text-xl font-bold">{t('hr.workerNotFound', 'Worker Not Found')}</h2>
            <button onClick={() => navigate(-1)} className="mt-4 text-amber-600 hover:underline">{t('hr.returnBtn', 'Return')}</button>
        </div>
    );

    // Stats Math
    const totalOperations = productivity.reduce((sum, p) => sum + p.operations.reduce((s, op) => s + op.quantity, 0), 0);
    const averageQuality = productivity.length > 0
        ? productivity.reduce((sum, p) => sum + p.operations.reduce((s, op) => s + op.qualityScore, 0) / Math.max(1, p.operations.length), 0) / productivity.length
        : 0;
    const totalBonuses = rewards.reduce((sum, r) => sum + r.amount, 0);
    const unpaidBonuses = rewards.filter(r => !r.isPaid).reduce((sum, r) => sum + r.amount, 0);

    return (
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-10">
            <PageHeader
                title={t('hr.workerCardTitle', 'Artisan Workbench Profile')}
                subtitle={t('hr.workerCardSubtitle', 'Deep productivity analytics and workshop contribution record.')}
                variant="hr"
                actions={
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-all shadow-sm active:scale-95 leading-none"
                    >
                        <ArrowLeft className="w-4 h-4 ltr:scale-x-100 rtl:-scale-x-100" /> {t('hr.btnBack', 'Back')}
                    </button>
                }
            />

            {/* Top Cards: Identity & Global Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. Identity Card */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col items-center relative overflow-hidden">
                    <div className="absolute top-0 w-full h-32 bg-gradient-to-br from-amber-600 to-orange-400 opacity-10"></div>
                    <div className="w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-4xl font-extrabold text-white mb-4 shadow-xl shadow-amber-600/20 z-10 border-4 border-white">
                        {worker.name?.charAt(0)}
                    </div>

                    <h2 className="text-2xl font-extrabold text-gray-900 text-center z-10">{worker.name}</h2>
                    <p className="text-amber-600 font-bold mb-4 text-sm flex items-center gap-1.5 z-10 bg-amber-50 px-3 py-1 rounded-full">
                        <Wrench className="w-4 h-4" /> {worker.workshopRole || 'Apprentice'}
                    </p>

                    <div className="flex flex-wrap gap-2 justify-center mb-6 z-10">
                        {worker.skills?.length > 0 ? worker.skills.map((skill, i) => (
                            <span key={i} className="bg-gray-100 text-gray-600 px-2.5 py-1 text-xs font-bold rounded-lg border border-gray-200">{skill}</span>
                        )) : (
                            <span className="text-sm text-gray-400">{t('hr.noSkillsTracked', 'No specialized skills tracked')}</span>
                        )}
                    </div>
                </div>

                {/* 2. Productivity Snapshot */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:p-8 flex flex-col justify-center">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> {t('hr.productionOutput', 'Production Output')}</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-gray-900 mb-1">{totalOperations}</span>
                            <span className="text-xs font-bold text-gray-500 text-center">{t('hr.lifetimeOperations', 'Lifetime Operations')}</span>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col items-center justify-center">
                            <div className="flex items-center gap-1 mb-1">
                                <span className="text-3xl font-black text-emerald-600">{averageQuality.toFixed(1)}</span>
                                <Star className="w-5 h-5 text-amber-400 fill-amber-400 mb-1" />
                            </div>
                            <span className="text-xs font-bold text-gray-500 text-center">{t('hr.avgQualityScore', 'Avg. Quality Score')}</span>
                        </div>
                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex flex-col items-center justify-center col-span-2">
                            <span className="text-2xl font-black text-amber-700 mb-1">{worker.productivityMultiplier?.toFixed(2) || '1.00'}x</span>
                            <span className="text-xs font-bold text-amber-600 text-center">{t('hr.rewardMultiplier', 'Reward Multiplier')}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Rewards Snapshot */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:p-8 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Award className="w-5 h-5 text-indigo-500" /> {t('hr.bonusesRewards', 'Bonuses & Rewards')}</h3>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm font-semibold text-gray-500 mb-1">{t('hr.lifetimeBonuses', 'Lifetime Bonuses Earned')}</p>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black text-gray-900 tracking-tight">{totalBonuses.toLocaleString()}</span>
                                <span className="text-base font-bold text-gray-400 mb-1">DZ</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-6 border-t border-gray-100">
                        <div className="bg-indigo-50 rounded-2xl p-4 flex flex-col">
                            <p className="text-xs font-bold text-indigo-400 mb-0.5">{t('hr.pendingPayout', 'Pending Payout')}</p>
                            <p className="text-xl font-black text-indigo-600">{unpaidBonuses.toLocaleString()} DZ</p>
                        </div>
                    </div>
                </div>

                {/* 4. Shift Schedule (Requested) */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:p-8 flex flex-col lg:col-span-1">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" /> {t('hr.shiftSchedule', 'Work Schedule')}
                    </h3>

                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> {t('hr.morningShift', 'Morning Shift')}
                            </p>
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t('hr.starts', 'Starts')}</span>
                                    <span className="text-xl font-black text-gray-900">{worker.contractSettings?.schedule?.morningStart || '08:00'}</span>
                                </div>
                                <div className="w-8 h-px bg-gray-200"></div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t('hr.ends', 'Ends')}</span>
                                    <span className="text-xl font-black text-gray-900">{worker.contractSettings?.schedule?.morningEnd || '12:00'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> {t('hr.eveningShift', 'Evening Shift')}
                            </p>
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t('hr.starts', 'Starts')}</span>
                                    <span className="text-xl font-black text-gray-900">{worker.contractSettings?.schedule?.eveningStart || '13:00'}</span>
                                </div>
                                <div className="w-8 h-px bg-gray-200"></div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t('hr.ends', 'Ends')}</span>
                                    <span className="text-xl font-black text-gray-900">{worker.contractSettings?.schedule?.eveningEnd || '17:00'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Bottom Section: Logs & Histories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2 flex-1">

                {/* Tool / Productivity Logs */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-gray-50/50 p-5 pl-6 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-base font-bold text-gray-900">{t('hr.recentOpsLog', 'Recent Operations Log')}</h3>
                        <span className="text-xs font-bold text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">{productivity.length} {t('hr.sessions', 'sessions')}</span>
                    </div>
                    <div className="p-0 overflow-y-auto max-h-[500px]">
                        {productivity.length === 0 ? (
                            <div className="p-10 text-center text-gray-400 font-medium">{t('hr.noProductivityLogs', 'No productivity logs recorded yet.')}</div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {productivity.map(log => (
                                    <div key={log._id} className="p-4 sm:p-6 hover:bg-gray-50/50 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{moment(log.date).format('MMMM Do YYYY')}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{t('hr.recordedOps', 'Recorded')} {log.operations?.length || 0}</p>
                                            </div>
                                            <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg">
                                                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                                                <span className="text-xs font-bold text-emerald-700">{log.dailyScore || 0} pts</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {log.operations?.map((op, idx) => (
                                                <div key={idx} className="bg-white border text-xs font-bold border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                                                    <Wrench className="w-3 h-3 text-gray-400" />
                                                    {op.operationName}
                                                    <span className="text-amber-500 flex items-center bg-amber-50 px-1 rounded ml-1"><Star className="w-2.5 h-2.5 fill-amber-500 mr-0.5" />{op.qualityScore}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Financial / Reward History */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-gray-50/50 p-5 pl-6 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-base font-bold text-gray-900">Reward History</h3>
                        <span className="text-xs font-bold text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">{rewards.length} awards</span>
                    </div>
                    <div className="p-0 overflow-y-auto max-h-[500px]">
                        {rewards.length === 0 ? (
                            <div className="p-10 text-center text-gray-400 font-medium">No rewards granted yet.</div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {rewards.map(r => (
                                    <div key={r._id} className="p-4 sm:p-6 hover:bg-gray-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                                <TrendingUp className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{r.type}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{moment(r.dateAwarded).format('MMM Do, YYYY')} • {r.reason || 'Routine bonus'}</p>
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right flex flex-row sm:flex-col items-baseline sm:items-end gap-2 sm:gap-1.5 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-gray-100 justify-between sm:justify-end">
                                            <span className="text-lg font-black text-indigo-600">+{r.amount.toLocaleString()} <span className="text-xs">DZ</span></span>
                                            <span className={clsx("px-2 py-0.5 text-[10px] font-bold uppercase rounded", r.isPaid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                                                {r.isPaid ? 'Cleared in Payroll' : 'Pending Payout'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>

        </div>
    );
}
