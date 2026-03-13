import React, { useState, useEffect, useRef } from 'react';
import { Clock, CheckSquare, XCircle, AlertCircle, RefreshCcw, Search } from 'lucide-react';
import { useHotkey } from '../hooks/useHotkey';
import { getAttendanceStatusColor } from '../constants/statusColors';
import PageHeader from '../components/PageHeader';
import { toISODate, toHHMM } from '../utils/dateUtils';
import { apiFetch } from '../utils/apiFetch';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import TableSkeleton from '../components/TableSkeleton';

export default function HRAttendance() {
    const { t } = useTranslation();
    const { hasPermission } = React.useContext(AuthContext);
    const [date, setDate] = useState(toISODate());
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const fetchAttendance = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const [empRes, attRes] = await Promise.all([
                apiFetch('/api/hr/employees'),
                apiFetch(`/api/hr/attendance?date=${date}`)
            ]);
            if (!empRes.ok || !attRes.ok) throw new Error('Failed');
            const empJson = await empRes.json();
            const attJson = await attRes.json();
            const employees = empJson.data ?? empJson;
            const attendances = attJson.data ?? attJson;

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
            setFetchError(error.message || t('hr.errorLoadAttendance', 'Failed to load attendance records.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendance();
    }, [date]);

    const getStatusStyle = getAttendanceStatusColor;

    const [searchTerm, setSearchTerm] = useState('');
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    const filteredRecords = records.filter(item =>
        item.employeeId.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.employeeId.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Modal State
    const [modalConfig, setModalConfig] = useState(null); // { employeeId, type, existingTime }
    const [timeInput, setTimeInput] = useState('');
    const [modalError, setModalError] = useState(null);

    // Escape key to close time editor modal
    useEffect(() => {
        if (!modalConfig) return;
        const handler = (e) => { if (e.key === 'Escape') setModalConfig(null); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [modalConfig]);

    const openModal = (employeeId, type, existingTime = '') => {
        setModalConfig({ employeeId, type, existingTime });
        setTimeInput(existingTime || toHHMM());
        setModalError(null);
    };

    const submitModal = async () => {
        if (!modalConfig) return;
        const { employeeId, type } = modalConfig;

        let timestamp = null;
        if (timeInput.trim() !== '') {
            if (!/^\d{2}:\d{2}$/.test(timeInput)) {
                setModalError(t('hr.alertInvalidFormat', 'Invalid time format. Use HH:MM.'));
                return;
            }
            timestamp = new Date(`${date}T${timeInput}`).toISOString();
        }

        try {
            const res = await apiFetch('/api/hr/attendance/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId, type, timestamp, date })
            });
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || t('hr.alertNetworkErrorRecord', 'Failed to record attendance.'));
            }
            fetchAttendance();
            setModalConfig(null);
            toast.success(t('hr.attendanceRecorded', 'Attendance recorded successfully'));
        } catch (error) {
            const errMsg = error.message || t('hr.alertNetworkErrorRecord', 'Failed to record attendance.');
            setModalError(errMsg);
            toast.error(errMsg);
        }
    };

    const handleClear = async () => {
        if (!modalConfig) return;
        const { employeeId, type } = modalConfig;

        try {
            const res = await apiFetch('/api/hr/attendance/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId, type, timestamp: null, date })
            });
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || t('hr.alertNetworkErrorClear', 'Failed to clear attendance.'));
            }
            fetchAttendance();
            setModalConfig(null);
            toast.success(t('hr.attendanceCleared', 'Attendance entry cleared'));
        } catch (error) {
            const errMsg = error.message || t('hr.alertNetworkErrorClear', 'Failed to clear attendance.');
            setModalError(errMsg);
            toast.error(errMsg);
        }
    };

    const [bulkClocking, setBulkClocking] = useState(false);
    const notClockedInCount = records.filter(item => !item.record?.morningIn).length;
    const handleBulkClockIn = async () => {
        const notClockedIn = records.filter(item => !item.record?.morningIn);
        if (notClockedIn.length === 0) return;
        setBulkClocking(true);
        setFetchError(null);
        let failed = 0;
        const now = new Date().toISOString();
        for (const item of notClockedIn) {
            try {
                const res = await apiFetch('/api/hr/attendance/record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employeeId: item.employeeId._id, type: 'morningIn', timestamp: now, date })
                });
                if (!res.ok) throw new Error('Failed');
            } catch { failed++; }
        }
        setBulkClocking(false);
        if (failed > 0) {
            setFetchError(`${failed} record(s) failed to clock in.`);
            toast.error(t('hr.bulkClockInPartialFail', `${failed} record(s) failed to clock in`));
        } else {
            toast.success(t('hr.bulkClockInSuccess', 'All employees clocked in successfully'));
        }
        fetchAttendance();
    };

    return (
        <div className="relative">
            <PageHeader
                title={t('hr.attendanceTitle', 'Staff Attendance')}
                subtitle={t('hr.attendanceSubtitle', 'Live clock-in tracking and automated work-hour computation.')}
                variant="hr"
                actions={
                    <div className="flex flex-wrap gap-3">
                            <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={t('hr.searchEmployeePlaceholder', 'Search... (Press /)')}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="ps-9 pe-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all w-44 font-bold"
                            />
                        </div>
                    <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded-xl px-3 py-1.5 shadow-sm ring-1 ring-emerald-500/5">
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">{t('hr.lblDate', 'Date')}</span>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                                className="bg-transparent text-gray-900 text-sm outline-none cursor-pointer font-black" />
                        </div>
                        {hasPermission('hr.employees.edit') && date === toISODate() && notClockedInCount > 0 && (
                            <button
                                onClick={handleBulkClockIn}
                                disabled={bulkClocking}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all leading-none disabled:opacity-60"
                            >
                                <CheckSquare className="w-4 h-4" />
                                {bulkClocking ? t('hr.clockingIn', 'Clocking in...') : t('hr.btnMarkAllPresent', `Mark All Present (${notClockedInCount})`)}
                            </button>
                        )}
                        <button onClick={fetchAttendance} disabled={loading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/30 active:scale-95 transition-all leading-none">
                            <RefreshCcw className={clsx("w-4 h-4", loading && "animate-spin")} />
                            {loading ? t('hr.syncing', 'Syncing...') : t('hr.btnLiveSync', 'Live Sync')}
                        </button>
                    </div>
                }
            />

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600">✕</button>
                </div>
            )}

            {/* Clock-in alert strip — only for today */}
            {!loading && date === toISODate() && (() => {
                const notIn = records.filter(item => !item.record?.morningIn);
                if (notIn.length === 0) return null;
                return (
                    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                        <span className="font-semibold text-amber-800">
                            {notIn.length} employee{notIn.length !== 1 ? 's' : ''} {t('hr.notClockedIn', 'have not clocked in yet')}:
                        </span>
                        <span className="text-amber-700 truncate">
                            {notIn.map(item => item.employeeId.name).join(', ')}
                        </span>
                    </div>
                );
            })()}

            {/* Attendance Grid */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="cf-table min-w-[800px]">
                        <thead>
                            <tr>
                                <th>{t('hr.colEmployee')}</th>
                                <th className="text-center">{t('hr.colMorningInOut')}</th>
                                <th className="text-center">{t('hr.colEveningInOut')}</th>
                                <th className="text-center">{t('hr.colLateMissing')}</th>
                                <th className="text-center">{t('hr.colWorkedOvertime')}</th>
                                <th className="text-center">{t('hr.colComputedStatus')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan="6" className="p-0">
                                    <TableSkeleton rows={6} cols={6} showHeader={false} />
                                </td></tr>
                            )}
                            {!loading && filteredRecords.length === 0 && (
                                <tr><td colSpan="6" className="px-6 py-12 text-center">
                                    <Search className="w-8 h-8 mx-auto text-gray-200 mb-2" />
                                    <p className="text-sm text-gray-400 font-medium">{t('hr.noEmployeesFound', 'No employees match your search.')}</p>
                                </td></tr>
                            )}
                            {filteredRecords.map(item => {
                                const emp = item.employeeId;
                                const att = item.record || {};
                                return (
                                    <tr key={emp._id}>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{emp.name}</div>
                                            <div className="text-xs text-gray-500">{emp.department} • {emp.role}</div>
                                        </td>

                                        <td className="px-6 py-4 text-center font-mono text-sm">
                                            <div className="flex items-center justify-center gap-2">
                                                {att.morningIn ? <button onClick={() => hasPermission('hr.employees.edit') && openModal(emp._id, 'morningIn', toHHMM(att.morningIn))} className={clsx("font-bold transition-colors", hasPermission('hr.employees.edit') ? "text-gray-900 hover:text-indigo-600 cursor-pointer" : "text-gray-900 cursor-default")}>{toHHMM(att.morningIn)}</button> : <button disabled={!hasPermission('hr.employees.edit')} onClick={() => openModal(emp._id, 'morningIn')} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('hr.btnMarkIn')}</button>}
                                                <span className="text-gray-300">|</span>
                                                {att.morningOut ? <button onClick={() => hasPermission('hr.employees.edit') && openModal(emp._id, 'morningOut', toHHMM(att.morningOut))} className={clsx("font-bold transition-colors", hasPermission('hr.employees.edit') ? "text-gray-900 hover:text-indigo-600 cursor-pointer" : "text-gray-900 cursor-default")}>{toHHMM(att.morningOut)}</button> : <button disabled={!hasPermission('hr.employees.edit')} onClick={() => openModal(emp._id, 'morningOut')} className="text-[10px] font-bold bg-gray-50 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('hr.btnMarkOutAtt')}</button>}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center font-mono text-sm">
                                            <div className="flex items-center justify-center gap-2">
                                                {att.eveningIn ? <button onClick={() => hasPermission('hr.employees.edit') && openModal(emp._id, 'eveningIn', toHHMM(att.eveningIn))} className={clsx("font-bold transition-colors", hasPermission('hr.employees.edit') ? "text-gray-900 hover:text-indigo-600 cursor-pointer" : "text-gray-900 cursor-default")}>{toHHMM(att.eveningIn)}</button> : <button disabled={!hasPermission('hr.employees.edit')} onClick={() => openModal(emp._id, 'eveningIn')} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('hr.btnMarkIn')}</button>}
                                                <span className="text-gray-300">|</span>
                                                {att.eveningOut ? <button onClick={() => hasPermission('hr.employees.edit') && openModal(emp._id, 'eveningOut', toHHMM(att.eveningOut))} className={clsx("font-bold transition-colors", hasPermission('hr.employees.edit') ? "text-gray-900 hover:text-indigo-600 cursor-pointer" : "text-gray-900 cursor-default")}>{toHHMM(att.eveningOut)}</button> : <button disabled={!hasPermission('hr.employees.edit')} onClick={() => openModal(emp._id, 'eveningOut')} className="text-[10px] font-bold bg-gray-50 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('hr.btnMarkOutAtt')}</button>}
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
                                onChange={(e) => { setTimeInput(e.target.value); setModalError(null); }}
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg font-mono px-4 py-3 border outline-none cursor-pointer"
                            />
                            {modalError && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {modalError}
                                </div>
                            )}
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
