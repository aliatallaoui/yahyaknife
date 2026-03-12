import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
    const [projects, setProjects] = useState([]);
    const [globalTasks, setGlobalTasks] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    const { token } = useContext(AuthContext);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const [projRes, tasksRes, analyticsRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/projects`, { headers }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/projects/tasks/global`, { headers }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/projects/analytics`, { headers })
            ]);

            if (projRes.ok) { const projJson = await projRes.json(); setProjects(projJson.data ?? (Array.isArray(projJson) ? projJson : [])); }
            if (tasksRes.ok) { const tasksJson = await tasksRes.json(); setGlobalTasks(tasksJson.data ?? (Array.isArray(tasksJson) ? tasksJson : [])); }
            if (analyticsRes.ok) { const analyticsJson = await analyticsRes.json(); setAnalytics(analyticsJson.data ?? analyticsJson); }

        } catch (error) {
            console.error('Error fetching Project Data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const createProject = async (data) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) await fetchDashboardData();
        return res;
    };

    const updateTaskStatus = async (taskId, status) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/projects/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status })
        });
        if (res.ok) await fetchDashboardData();
        return res;
    };

    return (
        <ProjectContext.Provider value={{
            projects,
            globalTasks,
            analytics,
            loading,
            createProject,
            updateTaskStatus,
            refreshData: fetchDashboardData
        }}>
            {children}
        </ProjectContext.Provider>
    );
};
