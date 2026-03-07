import { useEffect, useState } from 'react';
import DashboardGrid from '../components/DashboardGrid';

export default function Overview() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch dashboard data
        const fetchData = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/dashboard/metrics');
                const json = await response.json();
                setData(json);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    return <DashboardGrid data={data} />;
}
