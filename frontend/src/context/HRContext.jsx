import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';

export const HRContext = createContext();

export const HRProvider = ({ children }) => {
    const { token } = useContext(AuthContext);
    const [employees, setEmployees] = useState([]);
    const [attendanceToday, setAttendanceToday] = useState([]);
    const [payrollRecords, setPayrollRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch Employees (with full contract details)
    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/hr/employees`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmployees(res.data?.data ?? res.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Daily Attendance
    const fetchDailyAttendance = async (dateStr) => {
        try {
            setLoading(true);
            const url = `${import.meta.env.VITE_API_URL || ''}${dateStr ? `/api/hr/attendance?date=${dateStr}` : '/api/hr/attendance'}`;
            const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
            setAttendanceToday(res.data?.data ?? res.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    // Record Pointage manually (Admin side)
    const recordPointage = async (employeeId, type, timestamp) => {
        try {
            setLoading(true);
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/hr/attendance/record`, { employeeId, type, timestamp }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchDailyAttendance(); // Refresh today's board
            setError(null);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    // Payroll Operations
    const fetchPayroll = async (period) => {
        try {
            setLoading(true);
            const url = `${import.meta.env.VITE_API_URL || ''}${period ? `/api/hr/payroll?period=${period}` : '/api/hr/payroll'}`;
            const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
            setPayrollRecords(res.data?.data ?? res.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const generatePayroll = async (period) => {
        try {
            setLoading(true);
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/hr/payroll/generate`, { period }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchPayroll(period); // Refresh
            setError(null);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const approvePayroll = async (payrollId) => {
        try {
            setLoading(true);
            await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/hr/payroll/${payrollId}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Update local state without full refetch
            setPayrollRecords(records => records.map(r => r._id === payrollId ? { ...r, status: 'Approved' } : r));
            setError(null);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    // Expose context
    return (
        <HRContext.Provider value={{
            employees, fetchEmployees,
            attendanceToday, fetchDailyAttendance, recordPointage,
            payrollRecords, fetchPayroll, generatePayroll, approvePayroll,
            loading, error
        }}>
            {children}
        </HRContext.Provider>
    );
};
