import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { 
    AlertTriangle, ShieldAlert, TrendingUp, TrendingDown, 
    Box, Lightbulb, CheckCircle, RefreshCcw, X
} from 'lucide-react';
import clsx from 'clsx';
import { apiFetch } from '../utils/apiFetch';

export default function InsightFeed() {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const [insights, setInsights] = useState({ alerts: [], recommendations: [] });
    const [loading, setLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(true);

    const fetchInsights = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/api/intelligence/global-summary`);
            if (res.ok) {
                const data = await res.json();
                setInsights(data);
            }
        } catch (error) {
            // silently swallowed — non-fatal
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchInsights();
    }, [token]);

    if (!isVisible || (insights.alerts.length === 0 && insights.recommendations.length === 0)) {
        return null;
    }

    const getSeverityStyles = (severity, type) => {
        if (type === 'Stock') return 'bg-amber-50 text-amber-700 border-amber-200';
        if (severity === 'High') return 'bg-rose-50 text-rose-700 border-rose-200';
        if (severity === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-blue-50 text-blue-700 border-blue-200';
    };

    const getIcon = (type) => {
        switch (type) {
            case 'Stock': return <Box className="w-5 h-5 flex-shrink-0" />;
            case 'Fraud': return <ShieldAlert className="w-5 h-5 flex-shrink-0" />;
            case 'Trend': return <TrendingDown className="w-5 h-5 flex-shrink-0" />;
            default: return <AlertTriangle className="w-5 h-5 flex-shrink-0" />;
        }
    };

    return (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-2xl p-6 shadow-lg mb-6 text-white relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 border border-indigo-500/30">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
                            <path d="M0 24V0H24" fill="none" stroke="currentColor" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                </svg>
            </div>

            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                
                {/* Header Title */}
                <div className="flex items-center gap-3 md:w-1/4">
                    <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                        <Lightbulb className="w-6 h-6 text-yellow-300" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">{t('intelligence.feedTitle', 'Ecosystem Insights')}</h2>
                        <p className="text-indigo-200 text-sm font-medium mt-0.5">
                            {t('intelligence.feedSubtitle', 'Real-time algorithmic alerts')}
                        </p>
                    </div>
                </div>

                {/* Alerts & Recs Carousel or Wrap */}
                <div className="flex-1 flex flex-col gap-3 w-full">
                    
                    {/* Active Alerts */}
                    <div className="flex flex-wrap gap-3">
                        {loading ? (
                            <div className="flex items-center gap-2 text-indigo-300">
                                <RefreshCcw className="w-4 h-4 animate-spin" />
                                <span className="text-sm font-medium">Analyzing ecosystem...</span>
                            </div>
                        ) : (
                            insights.alerts.map((alert, idx) => (
                                <div 
                                    key={idx} 
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-bold shadow-sm backdrop-blur-md transition-transform hover:-translate-y-0.5",
                                        getSeverityStyles(alert.severity, alert.type)
                                    )}
                                >
                                    {getIcon(alert.type)}
                                    <span>{t(`intelligence.${alert.code}`, { count: alert.count, defaultValue: alert.message })}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Recommendations */}
                    {!loading && insights.recommendations.length > 0 && (
                        <div className="flex items-start gap-2 text-indigo-100 text-sm bg-black/20 p-3 rounded-xl border border-white/5">
                            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div className="flex flex-col gap-1 w-full">
                                <span className="font-bold text-white uppercase text-[10px] tracking-wider opacity-70">
                                    {t('intelligence.rec_title', 'Suggested Actions')}
                                </span>
                                <ul className="list-disc list-inside space-y-1">
                                    {insights.recommendations.map((rec, idx) => (
                                        <li key={idx} className="font-medium text-[13px]">{t(`intelligence.${rec}`, rec)}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Dismiss Button */}
                <button 
                    onClick={() => setIsVisible(false)}
                    className="absolute top-4 right-4 p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
