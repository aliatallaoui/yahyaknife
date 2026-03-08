import { Sparkles, TrendingUp, DollarSign, Package, Truck, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

export default function DashboardGrid({ data }) {
    const { t } = useTranslation();
    if (!data) return (
        <div className="flex items-center justify-center h-64 flex-col gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <p className="text-gray-500 font-medium">Could not load dashboard data. Please refresh.</p>
        </div>
    );

    const { orderMetrics, deliveryMetrics, financialMetrics, inventoryMetrics, aiSummary } = data;
    const insightsList = Array.isArray(aiSummary) ? aiSummary.filter(Boolean) : (aiSummary ? [aiSummary] : []);
    const successRate = parseFloat(deliveryMetrics?.deliverySuccessRate || 0);
    const refusalRate = parseFloat(deliveryMetrics?.refusalRate || 0);

    const orderPipelineData = [
        { name: t('dashboard.awaitingConfirm'), value: orderMetrics.awaitingConfirmation || 0 },
        { name: t('dashboard.awaitingDispatch'), value: orderMetrics.awaitingDispatch || 0 },
        { name: t('dashboard.inDelivery'), value: orderMetrics.inDelivery || 0 },
        { name: t('dashboard.delivered'), value: orderMetrics.deliveredOrders || 0 }
    ];
    const PIPELINE_COLORS = ['#ec4899', '#f59e0b', '#3b82f6', '#10b981'];

    return (
        <div className="flex flex-col gap-5 w-full max-w-[1400px]">

            {/* ── Row 1: 4 KPI Cards (own row, compact height) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title={t('dashboard.profit')}
                    value={(financialMetrics?.realProfit || 0).toLocaleString()}
                    unit={t('common.currency')}
                    icon={DollarSign}
                    trend={t('dashboard.profitTrend')}
                    isPositive={true}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <MetricCard
                    title={t('dashboard.revenue')}
                    value={(financialMetrics?.deliveredRevenue || 0).toLocaleString()}
                    unit={t('common.currency')}
                    icon={TrendingUp}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                />
                <MetricCard
                    title={t('dashboard.cash_transit')}
                    value={(financialMetrics?.expectedRevenue || 0).toLocaleString()}
                    unit={t('common.currency')}
                    icon={Truck}
                    color="text-amber-600"
                    bg="bg-amber-50"
                />
                <MetricCard
                    title={t('dashboard.couriers_pending')}
                    value={(financialMetrics?.globalSettlementsPending || 0).toLocaleString()}
                    unit={t('common.currency')}
                    icon={Clock}
                    color="text-rose-600"
                    bg="bg-rose-50"
                    isEmpty={(financialMetrics?.globalSettlementsPending || 0) === 0}
                    emptyLabel="✓ All Settled"
                />
            </div>

            {/* ── Row 2: Order Pipeline + AI Insights side by side ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">

                {/* Order Pipeline Donut */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Package className="w-5 h-5 text-blue-500" />
                            {t('dashboard.liveOrderPipeline')}
                        </h3>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                            {t('dashboard.total')}: <strong className="text-gray-800">{orderMetrics.totalOrders || 0}</strong>
                        </span>
                    </div>
                    {(orderMetrics.totalOrders || 0) === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center gap-2 text-gray-400">
                            <Package className="w-10 h-10 opacity-25" />
                            <p className="text-sm font-medium">No active orders right now</p>
                        </div>
                    ) : (
                        <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={orderPipelineData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                                        {orderPipelineData.map((_, idx) => <Cell key={idx} fill={PIPELINE_COLORS[idx]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => [`${v} orders`, '']} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: 12 }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* AI Insight Feed */}
                <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col gap-4">
                    <div className="absolute top-0 end-0 p-4 opacity-5 pointer-events-none select-none">
                        <Sparkles className="w-40 h-40" />
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/10 shrink-0">
                            <Sparkles className="w-4 h-4 text-blue-200" />
                        </div>
                        <h3 className="text-sm font-bold text-white">{t('dashboard.cortexInsights')}</h3>
                    </div>
                    <div className="space-y-2.5 relative z-10 flex-1">
                        {insightsList.length > 0 ? insightsList.map((insight, idx) => (
                            <div key={idx} className="bg-black/25 rounded-xl p-3 border border-white/10 flex gap-2.5 items-start">
                                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                                <p className="text-xs leading-relaxed text-indigo-100">{insight}</p>
                            </div>
                        )) : (
                            <div className="bg-emerald-600/20 border border-emerald-400/30 rounded-xl p-3 flex gap-2.5 items-center">
                                <CheckCircle className="w-4 h-4 text-emerald-300 shrink-0" />
                                <p className="text-xs font-medium text-emerald-100">{t('dashboard.systemsOperatingNormal')}</p>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-indigo-300/50 font-medium">AI-powered • Updates every 5 min</p>
                </div>
            </div>

            {/* ── Row 3: Delivery Logistics Health ── */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <Truck className="w-5 h-5 text-emerald-500" />
                    {t('dashboard.logisticsHealth')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Success Rate */}
                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-emerald-800">{t('dashboard.successRate')}</p>
                            <span className="text-2xl font-black text-emerald-700">{successRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-emerald-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${successRate}%` }} />
                        </div>
                        <p className="text-xs text-emerald-700 mt-2 font-medium">
                            {successRate >= 80 ? '🟢 Good performance' : successRate >= 60 ? '🟡 Moderate — consider follow-ups' : '🔴 Low — review couriers'}
                        </p>
                    </div>
                    {/* Refusal Rate */}
                    <div className={clsx("rounded-2xl p-4 border", refusalRate > 30 ? "bg-rose-50 border-rose-100" : "bg-gray-50 border-gray-100")}>
                        <div className="flex items-center justify-between mb-2">
                            <p className={clsx("text-sm font-bold", refusalRate > 30 ? "text-rose-800" : "text-gray-700")}>{t('dashboard.refusalReturns')}</p>
                            <span className={clsx("text-2xl font-black", refusalRate > 30 ? "text-rose-700" : "text-gray-800")}>{refusalRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-rose-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${refusalRate}%` }} />
                        </div>
                        {refusalRate > 30 && <p className="text-xs text-rose-600 mt-2 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Check AI insights above</p>}
                    </div>
                    {/* Total Refused */}
                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-blue-800">{t('dashboard.totalRefusedReturned')}</p>
                            <p className="text-xs text-blue-600 font-medium mt-0.5">{t('dashboard.lostCogs')}</p>
                        </div>
                        <span className="text-3xl font-black text-blue-900">
                            {(orderMetrics?.refusedOrders || 0) + (orderMetrics?.returnedOrders || 0)}
                            <span className="text-sm font-medium text-blue-500 ms-1">{t('dashboard.units')}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Row 4: Inventory Summary ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InventoryCard icon={DollarSign} iconBg="bg-purple-50" iconColor="text-purple-600"
                    label={t('dashboard.totalInventoryValue')}
                    value={`${(inventoryMetrics?.inventoryValue || 0).toLocaleString()} ${t('common.currency')}`}
                    hint="Total value of all products in stock" />
                <InventoryCard icon={Package} iconBg="bg-orange-50" iconColor="text-orange-600"
                    label={t('dashboard.totalAvailableStock')}
                    value={`${(inventoryMetrics?.totalAvailableStock || 0).toLocaleString()} ${t('dashboard.units')}`}
                    hint="Units ready to ship" />
                <InventoryCard icon={AlertTriangle} iconBg="bg-rose-50" iconColor="text-rose-600"
                    label={t('dashboard.deadStockVariants')}
                    value={inventoryMetrics?.deadStockVariants || 0}
                    valueSuffix={t('dashboard.actionRequired')}
                    hint="Products with no sales — review pricing"
                    isAlert={(inventoryMetrics?.deadStockVariants || 0) > 0} />
            </div>
        </div>
    );
}

/* ─── Metric Card — compact, fixed height ─── */
function MetricCard({ title, value, unit, icon: Icon, trend, isPositive, color, bg, isEmpty, emptyLabel }) {
    return (
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className={clsx("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0", bg, color)}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            {isEmpty ? (
                <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">{emptyLabel}</span>
            ) : (
                <h3 className="text-2xl font-black text-gray-900 tabular-nums tracking-tight">
                    {value} <span className="text-sm font-medium text-gray-400">{unit}</span>
                </h3>
            )}
            <p className="text-sm font-bold text-gray-500 mt-1">{title}</p>
            {trend && !isEmpty && (
                <p className={clsx("text-xs font-semibold mt-2 flex items-center gap-1", isPositive ? "text-emerald-600" : "text-gray-400")}>
                    {isPositive && <TrendingUp className="w-3 h-3" />}{trend}
                </p>
            )}
        </div>
    );
}

/* ─── Inventory Card ─── */
function InventoryCard({ icon: Icon, iconBg, iconColor, label, value, valueSuffix, hint, isAlert }) {
    return (
        <div className={clsx("bg-white rounded-3xl shadow-sm border p-5 flex items-start gap-4 hover:shadow-md transition-shadow", isAlert ? "border-rose-100" : "border-gray-100")}>
            <div className={clsx("w-11 h-11 rounded-2xl flex items-center justify-center shrink-0", iconBg)}>
                <Icon className={clsx("w-5 h-5", iconColor)} />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-bold text-gray-500 mb-0.5">{label}</p>
                <h4 className="text-xl font-black text-gray-900">
                    {value}{valueSuffix && <span className="text-xs font-bold text-rose-400 ms-1.5">{valueSuffix}</span>}
                </h4>
                {hint && <p className="text-[11px] text-gray-400 mt-1 font-medium">{hint}</p>}
            </div>
        </div>
    );
}
