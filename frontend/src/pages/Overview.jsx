import { useEffect, useState } from 'react';
import DashboardGrid from '../components/DashboardGrid';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';

export default function Overview() {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch dashboard data
        const fetchData = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/dashboard/metrics`);
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

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title={t('dashboard.title', 'Operations Overview')}
                subtitle={t('dashboard.subtitle', 'Real-time monitoring of sales, inventory, and workshop performance.')}
            />
            <DashboardGrid data={data} />
        </div>
    );
}
