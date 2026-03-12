import { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import EcommerceAnalytics from './EcommerceAnalytics';
import { ShoppingCart, Banknote, UserX, Package, ChevronRight, RefreshCw } from 'lucide-react';

// Briefing chip — each item links to a relevant filtered view
function BriefingChip({ icon: Icon, label, count, to, color, loading }) {
    const navigate = useNavigate();
    if (loading) {
        return <div className="h-8 w-40 bg-gray-100 rounded-full animate-pulse" />;
    }
    if (count === 0 || count == null) return null;
    return (
        <button
            onClick={() => navigate(to)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all hover:shadow-sm active:scale-95 ${color}`}
        >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{count.toLocaleString()} {label}</span>
            <ChevronRight className="w-3 h-3 opacity-60" />
        </button>
    );
}

export default function Overview() {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const [briefing, setBriefing] = useState(null);
    const [briefingLoading, setBriefingLoading] = useState(true);

    const fetchBriefing = async () => {
        if (!token) return;
        setBriefingLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/dashboard/metrics`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const json = await res.json();
                setBriefing(json.data ?? json);
            }
        } catch {
            // non-fatal — briefing strip degrades gracefully
        } finally {
            setBriefingLoading(false);
        }
    };

    useEffect(() => {
        fetchBriefing();
    }, [token]);

    // Derive actionable counts from the dedicated briefing sub-object
    const awaitingConfirmation = briefing?.briefing?.awaitingConfirmation ?? 0;
    const pendingSettlements   = briefing?.briefing?.pendingSettlements ?? 0;
    const absentToday          = briefing?.briefing?.absentToday ?? 0;
    const lowStockVariants     = briefing?.briefing?.lowStockVariants ?? 0;

    const hasAnyAlert = briefingLoading || awaitingConfirmation > 0 || pendingSettlements > 0 || absentToday > 0 || lowStockVariants > 0;

    return (
        <div className="animate-in fade-in duration-300 space-y-4">

            {/* Morning Briefing Strip — only rendered when there are actionable items */}
            {hasAnyAlert && (
                <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide me-1">
                        {briefingLoading ? t('dashboard.briefingLoading', 'Loading...') : t('dashboard.actionRequired', 'Action Required')}
                    </span>

                    <BriefingChip
                        icon={ShoppingCart}
                        label={t('dashboard.briefingOrdersAwaiting', 'orders awaiting confirmation')}
                        count={awaitingConfirmation}
                        to="/sales?status=New"
                        color="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                        loading={briefingLoading}
                    />
                    <BriefingChip
                        icon={Banknote}
                        label={t('dashboard.briefingCouriersPending', 'courier settlements pending')}
                        count={pendingSettlements}
                        to="/finance"
                        color="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                        loading={briefingLoading}
                    />
                    <BriefingChip
                        icon={UserX}
                        label={t('dashboard.briefingAbsentToday', 'employees absent today')}
                        count={absentToday}
                        to="/hr/attendance"
                        color="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                        loading={briefingLoading}
                    />
                    <BriefingChip
                        icon={Package}
                        label={t('dashboard.briefingLowStock', 'low-stock variants')}
                        count={lowStockVariants}
                        to="/inventory"
                        color="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                        loading={briefingLoading}
                    />

                    {!briefingLoading && (
                        <button
                            onClick={fetchBriefing}
                            className="ms-auto p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title={t('overview.refreshBriefing', 'Refresh briefing')}
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            )}

            <EcommerceAnalytics />
        </div>
    );
}
