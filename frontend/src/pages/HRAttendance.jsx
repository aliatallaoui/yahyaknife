import React, { useState, useEffect } from 'react';
import { Clock, CheckSquare, XCircle, AlertCircle, RefreshCcw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import moment from 'moment';
import axios from 'axios';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

export default function HRAttendance() {
    const { t } = useTranslation();
    const [date, setDate] = useState(moment().format('YYYY-MM-DD'));
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const [empRes, attRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL || ''}/api/hr/employees`),
                axios.get(`${import.meta.env.VITE_API_URL || ''}/api/hr/attendance?date=${date}`)
            ]);
            const employees = empRes.data;
            const attendances = attRes.data;

            // Merge active employees with valid pointage
            const activeEmployees = employees.filter(e => e.status !== 'Terminated');
            const merged = activeEmployees.map(emp => {
                const record = attendances.find(a => (a.employeeId?._id || a.employeeId) === emp._id) || null;
                return {
                    employeeId: emp,
                    record: record
                };
            });
            setRecords(merged);
        } catch (error) {
            console.error('Error fetching pointage:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendance();
    }, [date]);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Present': return 'bg-emerald-100 text-emerald-800';
            case 'Late': return 'bg-amber-100 text-amber-800';
            case 'Completed with Recovery': return 'bg-blue-100 text-blue-800';
            case 'Incomplete': return 'bg-orange-100 text-orange-800';
            case 'Absent': return 'bg-rose-100 text-rose-800';
            case 'Overtime': return 'bg-indigo-100 text-indigo-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Modal State
    const [modalConfig, setModalConfig] = useState(null); // { employeeId, type, existingTime }
    const [timeInput, setTimeInput] = useState('');

    const openModal = (employeeId, type, existingTime = '') => {
        setModalConfig({ employeeId, type, existingTime });
        setTimeInput(existingTime || moment().format('HH:mm'));
    };

    const submitModal = async () => {
        if (!modalConfig) return;
        const { employeeId, type } = modalConfig;

        let timestamp = null;
        if (timeInput.trim() !== '') {
            if (!/^\d{2}:\d{2}$/.test(timeInput)) {
                alert(t('hr.alertInvalidFormat'));
                return;
            }
            timestamp = moment(`${date} ${timeInput}`, 'YYYY-MM-DD HH:mm').toISOString();
        }

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/hr/attendance/record`, {
                employeeId,
                type,
                timestamp,
                date
            });
            if (res.status === 200 || res.status === 201) {
                fetchAttendance();
                setModalConfig(null);
            } else {
                alert(t('hr.alertFailedRecord'));
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || t('hr.alertNetworkErrorRecord'));
        }
    };

    const handleClear = async () => {
        if (!modalConfig) return;
        const { employeeId, type } = modalConfig;

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/hr/attendance/record`, {
                employeeId,
                type,
                timestamp: null,
                date
            });
            if (res.status === 200 || res.status === 201) {
                fetchAttendance();
                setModalConfig(null);
            } else {
                alert(t('hr.alertFailedClear'));
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || t('hr.alertNetworkErrorClear'));
        }
    };

    return (
        <div className="relative">
            <PageHeader
                title={t('hr.attendanceTitle', 'Staff Attendance')}
                subtitle={t('hr.attendanceSubtitle', 'Live clock-in tracking and automated work-hour computation.')}
                variant="hr"
                actions={
                    <div className="flex flex-wrap gap-3">
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-[#5D5DFF] transition-all cursor-pointer" />
                        <button onClick={fetchAttendance} disabled={loading} className="flex items-center gap-2 bg-[#5D5DFF] hover:bg-[#4D4DFF] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all leading-none">
                            <RefreshCcw className={clsx("w-4 h-4", loading && "animate-spin")} />
                            {loading ? t('hr.syncing', 'Syncing...') : t('hr.btnLiveSync', 'Live Sync')}
                        </button>
                    </div>
                }
            />

            {/* Attendance Grid */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-start min-w-[800px]">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t('hr.colEmployee')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">{t('hr.colMorningInOut')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">{t('hr.colEveningInOut')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">{t('hr.colLateMissing')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">{t('hr.colWorkedOvertime')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">{t('hr.colComputedStatus')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {records.map(item => {
                                const emp = item.employeeId;
                                const att = item.record || {};
                                return (
                                    <tr key={emp._id} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{emp.name}</div>
                                            <div className="text-xs text-gray-500">{emp.department} • {emp.role}</div>
                                        </td>

                                        <td className="px-6 py-4 text-center font-mono text-sm">
                                            <div className="flex items-center justify-center gap-2">
                                                {att.morningIn ? <button onClick={() => openModal(emp._id, 'morningIn', moment(att.morningIn).format('HH:mm'))} className="text-gray-900 font-bold hover:text-indigo-600 transition-colors cursor-pointer">{moment(att.morningIn).format('HH:mm')}</button> : <button onClick={() => openModal(emp._id, 'morningIn')} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">{t('hr.btnMarkIn')}</button>}
                                                <span className="text-gray-300">|</span>
                                                {att.morningOut ? <button onClick={() => openModal(emp._id, 'morningOut', moment(att.morningOut).format('HH:mm'))} className="text-gray-900 font-bold hover:text-indigo-600 transition-colors cursor-pointer">{moment(att.morningOut).format('HH:mm')}</button> : <button onClick={() => openModal(emp._id, 'morningOut')} className="text-[10px] font-bold bg-gray-50 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded transition-colors">{t('hr.btnMarkOutAtt')}</button>}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center font-mono text-sm">
                                            <div className="flex items-center justify-center gap-2">
                                                {att.eveningIn ? <button onClick={() => openModal(emp._id, 'eveningIn', moment(att.eveningIn).format('HH:mm'))} className="text-gray-900 font-bold hover:text-indigo-600 transition-colors cursor-pointer">{moment(att.eveningIn).format('HH:mm')}</button> : <button onClick={() => openModal(emp._id, 'eveningIn')} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">{t('hr.btnMarkIn')}</button>}
                                                <span className="text-gray-300">|</span>
                                                {att.eveningOut ? <button onClick={() => openModal(emp._id, 'eveningOut', moment(att.eveningOut).format('HH:mm'))} className="text-gray-900 font-bold hover:text-indigo-600 transition-colors cursor-pointer">{moment(att.eveningOut).format('HH:mm')}</button> : <button onClick={() => openModal(emp._id, 'eveningOut')} className="text-[10px] font-bold bg-gray-50 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded transition-colors">{t('hr.btnMarkOutAtt')}</button>}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                {att.lateMinutes > 0 && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold">{att.lateMinutes}{t('hr.lblMinutes')} {t('hr.lblLate')}</span>}
                                                {att.missingMinutes > 0 && <span className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-bold">{att.missingMinutes}{t('hr.lblMinutes')} {t('hr.lblMissing')}</span>}
                                                {(!att.lateMinutes && !att.missingMinutes) && <span className="text-gray-300">-</span>}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <span className="text-sm font-black text-gray-700">{Math.floor((att.workedMinutes || 0) / 60)}{t('hr.lblHours')} {(att.workedMinutes || 0) % 60}{t('hr.lblMinutes')}</span>
                                            {att.overtimeMinutes > 0 && (
                                                <div className="text-xs font-bold text-indigo-600 mt-1">+{att.overtimeMinutes}{t('hr.lblMinutes')} {t('hr.lblOvertime')}</div>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusStyle(att.status || 'Absent')}`}>
                                                {att.status ? (att.status === 'Present' ? t('hr.statusPresent') : att.status === 'Completed' ? t('hr.statusCompleted') : att.status === 'Late' ? t('hr.statusLate') : att.status === 'Incomplete' ? t('hr.statusIncomplete') : att.status === 'Absent' ? t('hr.statusAbsent') : att.status === 'Completed with Recovery' ? t('hr.statusCompletedRecovery') : att.status === 'Overtime' ? t('hr.overtime') : att.status === 'Not Marked' ? t('hr.notMarked') : att.status) : t('hr.statusAbsent')}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Time Editor Modal */}
            {modalConfig && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-600" />
                                {modalConfig.existingTime ? t('hr.modalEditPointageTitle') : t('hr.modalMarkAttendanceTitle')}
                            </h2>
                            <button onClick={() => setModalConfig(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('hr.lblSelectTime')}</label>
                            <input
                                type="time"
                                value={timeInput}
                                onChange={(e) => setTimeInput(e.target.value)}
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg font-mono px-4 py-3 border outline-none cursor-pointer"
                            />
                        </div>

                        <div className="px-6 py-4 bg-gray-50 flex gap-3 ltr:flex-row-reverse rtl:flex-row border-t border-gray-100">
                            <button
                                onClick={submitModal}
                                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors flex-1"
                            >
                                {t('hr.btnSavePointage')}
                            </button>
                            {modalConfig.existingTime && (
                                <button
                                    onClick={handleClear}
                                    className="px-4 py-2 bg-rose-50 text-rose-600 font-bold rounded-lg hover:bg-rose-100 transition-colors"
                                >
                                    {t('hr.btnClear')}
                                </button>
                            )}
                            <button
                                onClick={() => setModalConfig(null)}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                {t('hr.btnCancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
