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

            setProjects(await projRes.json());
            setGlobalTasks(await tasksRes.json());
            setAnalytics(await analyticsRes.json());

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) await fetchDashboardData();
        return res;
    };

    const updateTaskStatus = async (taskId, status) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/projects/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
