import { useEffect, useState } from 'react';
import EcommerceAnalytics from './EcommerceAnalytics';
import PageHeader from '../components/PageHeader';
import { useTranslation } from 'react-i18next';

export default function Overview() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);

    // Simulate initial mount loading to match previous behavior
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-indigo-600 animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500">
            <EcommerceAnalytics />
        </div>
    );
}
