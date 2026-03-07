import React, { useState, useEffect } from 'react';
import { Clock, CheckSquare, XCircle, AlertCircle, RefreshCcw } from 'lucide-react';
import moment from 'moment';
import axios from 'axios';

export default function HRAttendance() {
    const [date, setDate] = useState(moment().format('YYYY-MM-DD'));
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const [empRes, attRes] = await Promise.all([
                axios.get('/api/hr/employees'),
                axios.get(`/api/hr/attendance?date=${date}`)
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
                alert('Invalid format. Use HH:mm');
                return;
            }
            timestamp = moment(`${date} ${timeInput}`, 'YYYY-MM-DD HH:mm').toISOString();
        }

        try {
            const res = await axios.post('/api/hr/attendance/record', {
                employeeId,
                type,
                timestamp,
                date
            });
            if (res.status === 200 || res.status === 201) {
                fetchAttendance();
                setModalConfig(null);
            } else {
                alert('Failed to record pointage');
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || 'Network error while recording pointage');
        }
    };

    const handleClear = async () => {
        if (!modalConfig) return;
        const { employeeId, type } = modalConfig;

        try {
            const res = await axios.post('/api/hr/attendance/record', {
                employeeId,
                type,
                timestamp: null,
                date
            });
            if (res.status === 200 || res.status === 201) {
                fetchAttendance();
                setModalConfig(null);
            } else {
                alert('Failed to clear pointage');
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || 'Network error while clearing pointage');
        }
    };

    return (
        <div className="p-8 relative">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold border-b-4 border-indigo-600 pb-2 inline-block">Daily Pointage & Attendance</h1>
                    <p className="text-gray-500 mt-2">Track clock-ins, missing hours, and calculate daily overtime.</p>
                </div>
                <div className="flex gap-4">
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                        className="border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-700 px-3 py-2 border outline-none cursor-pointer" />
                    <button onClick={fetchAttendance} disabled={loading} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-indigo-700 disabled:bg-indigo-300">
                        <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Syncing...' : 'Live Sync'}
                    </button>
                </div>
            </div>

            {/* Attendance Grid */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Employee</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Morning In-Out</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Evening In-Out</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Late / Missing</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Worked / Overtime</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Computed Status</th>
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
                                            {att.morningIn ? <button onClick={() => openModal(emp._id, 'morningIn', moment(att.morningIn).format('HH:mm'))} className="text-gray-900 font-bold hover:text-indigo-600 transition-colors cursor-pointer">{moment(att.morningIn).format('HH:mm')}</button> : <button onClick={() => openModal(emp._id, 'morningIn')} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">Mark In</button>}
                                            <span className="text-gray-300">|</span>
                                            {att.morningOut ? <button onClick={() => openModal(emp._id, 'morningOut', moment(att.morningOut).format('HH:mm'))} className="text-gray-900 font-bold hover:text-indigo-600 transition-colors cursor-pointer">{moment(att.morningOut).format('HH:mm')}</button> : <button onClick={() => openModal(emp._id, 'morningOut')} className="text-[10px] font-bold bg-gray-50 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded transition-colors">Mark Out</button>}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-center font-mono text-sm">
                                        <div className="flex items-center justify-center gap-2">
                                            {att.eveningIn ? <button onClick={() => openModal(emp._id, 'eveningIn', moment(att.eveningIn).format('HH:mm'))} className="text-gray-900 font-bold hover:text-indigo-600 transition-colors cursor-pointer">{moment(att.eveningIn).format('HH:mm')}</button> : <button onClick={() => openModal(emp._id, 'eveningIn')} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">Mark In</button>}
                                            <span className="text-gray-300">|</span>
                                            {att.eveningOut ? <button onClick={() => openModal(emp._id, 'eveningOut', moment(att.eveningOut).format('HH:mm'))} className="text-gray-900 font-bold hover:text-indigo-600 transition-colors cursor-pointer">{moment(att.eveningOut).format('HH:mm')}</button> : <button onClick={() => openModal(emp._id, 'eveningOut')} className="text-[10px] font-bold bg-gray-50 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded transition-colors">Mark Out</button>}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            {att.lateMinutes > 0 && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold">{att.lateMinutes}m Late</span>}
                                            {att.missingMinutes > 0 && <span className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-bold">{att.missingMinutes}m Missing</span>}
                                            {(!att.lateMinutes && !att.missingMinutes) && <span className="text-gray-300">-</span>}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        <span className="text-sm font-black text-gray-700">{Math.floor((att.workedMinutes || 0) / 60)}h {(att.workedMinutes || 0) % 60}m</span>
                                        {att.overtimeMinutes > 0 && (
                                            <div className="text-xs font-bold text-indigo-600 mt-1">+{att.overtimeMinutes}m OT</div>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusStyle(att.status || 'Absent')}`}>
                                            {att.status || 'Absent'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Time Editor Modal */}
            {modalConfig && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-600" />
                                {modalConfig.existingTime ? 'Edit Pointage' : 'Mark Attendance'}
                            </h2>
                            <button onClick={() => setModalConfig(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Select Time (HH:mm)</label>
                            <input
                                type="time"
                                value={timeInput}
                                onChange={(e) => setTimeInput(e.target.value)}
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg font-mono px-4 py-3 border outline-none cursor-pointer"
                            />
                        </div>

                        <div className="px-6 py-4 bg-gray-50 flex gap-3 flex-row-reverse border-t border-gray-100">
                            <button
                                onClick={submitModal}
                                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors flex-1"
                            >
                                Save Pointage
                            </button>
                            {modalConfig.existingTime && (
                                <button
                                    onClick={handleClear}
                                    className="px-4 py-2 bg-rose-50 text-rose-600 font-bold rounded-lg hover:bg-rose-100 transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                            <button
                                onClick={() => setModalConfig(null)}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
