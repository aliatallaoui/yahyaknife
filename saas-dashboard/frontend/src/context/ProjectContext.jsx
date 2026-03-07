import React, { createContext, useState, useEffect } from 'react';

export const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
    const [projects, setProjects] = useState([]);
    const [globalTasks, setGlobalTasks] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [projRes, tasksRes, analyticsRes] = await Promise.all([
                fetch('http://localhost:5000/api/projects'),
                fetch('http://localhost:5000/api/projects/tasks/global'),
                fetch('http://localhost:5000/api/projects/analytics')
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
        const res = await fetch('http://localhost:5000/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) await fetchDashboardData();
        return res;
    };

    const updateTaskStatus = async (taskId, status) => {
        const res = await fetch(`http://localhost:5000/api/projects/tasks/${taskId}`, {
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
