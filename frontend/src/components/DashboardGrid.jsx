import { useState, useEffect, useContext } from 'react';
import { Sparkles, TrendingUp, DollarSign, Package, Truck, AlertTriangle, CheckCircle, Clock, ChevronRight, ShoppingCart, Timer, PackageCheck, Users, UserCheck, UserX, CalendarClock, FileBarChart2, BarChart3, CreditCard } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function DashboardGrid({ data }) {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const [hrMetrics, setHrMetrics] = useState(null);
    const [dailyReport, setDailyReport] = useState(null);

    useEffect(() => {
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/metrics`, { headers }).then(r => r.json()).then(json => setHrMetrics(json.data ?? json)).catch(() => { });
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/reports/daily`, { headers }).then(r => r.json()).then(json => setDailyReport(json.data ?? json)).catch(() => { });
    }, [token]);
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
    const total = Math.max(orderMetrics?.totalOrders || 1, 1);

    const pipelineStages = [
        {
            key: 'confirm',
            label: t('dashboard.awaitingConfirm'),
            hint: 'Waiting for confirmation',
            count: orderMetrics?.awaitingConfirmation || 0,
            icon: ShoppingCart,
            bg: 'bg-pink-50', border: 'border-pink-200',
            text: 'text-pink-700', bar: 'bg-pink-400'
        },
        {
            key: 'dispatch',
            label: t('dashboard.awaitingDispatch'),
            hint: 'Ready to be sent',
            count: orderMetrics?.awaitingDispatch || 0,
            icon: Timer,
            bg: 'bg-amber-50', border: 'border-amber-200',
            text: 'text-amber-700', bar: 'bg-amber-400'
        },
        {
            key: 'delivery',
            label: t('dashboard.inDelivery'),
            hint: 'On the way',
            count: orderMetrics?.inDelivery || 0,
            icon: Truck,
            bg: 'bg-blue-50', border: 'border-blue-200',
            text: 'text-blue-700', bar: 'bg-blue-400'
        },
        {
            key: 'delivered',
            label: t('dashboard.delivered'),
            hint: 'Successfully delivered ✓',
            count: orderMetrics?.deliveredOrders || 0,
            icon: PackageCheck,
            bg: 'bg-emerald-50', border: 'border-emerald-200',
            text: 'text-emerald-700', bar: 'bg-emerald-400'
        }
    ];

    return (
        <div className="flex flex-col gap-5 w-full">

            {/* ── Row 1: 4 KPI Cards — own row, no stretching ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

            {/* ── Row 1.2: Sales Performance KPIs — Moved from Sales Page ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <MetricCard
                    title={t('sales.totalVolume', 'Total Sales Volume')}
                    value={(financialMetrics?.totalSalesVolume || 0).toLocaleString()}
                    unit={t('common.currency')}
                    icon={TrendingUp}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <MetricCard
                    title={t('sales.avgOrderValue', 'Average Order Value')}
                    value={(financialMetrics?.averageOrderValue || 0).toLocaleString()}
                    unit={t('common.currency')}
                    icon={ShoppingCart}
                    color="text-purple-600"
                    bg="bg-purple-50"
                />
                <MetricCard
                    title={t('sales.totalOrdersCount', 'Total Orders Count')}
                    value={(orderMetrics?.totalOrders || 0).toLocaleString()}
                    unit={t('orders.unitOrders', 'Orders')}
                    icon={Package}
                    color="text-green-600"
                    bg="bg-green-50"
                />
            </div>

            {/* ── Row 1.5: Workshop / Bladesmith Operations KPIs ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard
                    title={t('dashboard.activeProduction', 'Active in Forge')}
                    value={data.workshopMetrics?.activeProduction || 0}
                    unit={t('knives.unitKnives', 'Knives')}
                    icon={Package}
                    isPositive={true}
                    color="text-orange-600"
                    bg="bg-orange-50"
                />
                <MetricCard
                    title={t('dashboard.completedThisMonth', 'Finished This Month')}
                    value={data.workshopMetrics?.completedThisMonth || 0}
                    unit={t('knives.unitKnives', 'Knives')}
                    icon={CheckCircle}
                    isPositive={true}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                />
                <MetricCard
                    title={t('dashboard.pendingCustom', 'Custom Orders')}
                    value={data.workshopMetrics?.pendingCustomOrders || 0}
                    unit={t('orders.unitOrders', 'Orders')}
                    icon={Users}
                    isPositive={false}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <MetricCard
                    title={t('dashboard.valueInProduction', 'Value in Forge')}
                    value={(data.workshopMetrics?.valueInProduction || 0).toLocaleString()}
                    unit={t('common.currency')}
                    icon={DollarSign}
                    isPositive={true}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
            </div>

            {/* ── Row 2: Order Pipeline (stage cards) + AI Insights ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

                {/* Order Pipeline — stage-by-stage flow */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Package className="w-5 h-5 text-blue-500" />
                            {t('dashboard.liveOrderPipeline')}
                        </h3>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                            {t('dashboard.total')}: <strong className="text-gray-800">{orderMetrics?.totalOrders || 0}</strong>
                        </span>
                    </div>

                    {(orderMetrics?.totalOrders || 0) === 0 ? (
                        <div className="h-28 flex flex-col items-center justify-center gap-2 text-gray-400">
                            <Package className="w-8 h-8 opacity-25" />
                            <p className="text-sm font-medium">No active orders right now</p>
                        </div>
                    ) : (
                        <div className="flex items-stretch gap-2 md:gap-3 overflow-x-auto pb-4 custom-scrollbar snap-x -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0">
                            {pipelineStages.map((stage, idx) => {
                                const StageIcon = stage.icon;
                                const pct = Math.round((stage.count / total) * 100);
                                return (
                                    <div key={stage.key} className="flex items-center gap-2 md:gap-3 flex-1 min-w-[150px] sm:min-w-0 shrink-0 snap-center sm:snap-align-none">
                                        <div className={clsx("flex-1 rounded-2xl border p-4 flex flex-col gap-2 min-w-0 h-full", stage.bg, stage.border)}>
                                            <div className="flex items-center justify-between mb-1">
                                                <StageIcon className={clsx("w-5 h-5", stage.text)} />
                                                {stage.count > 0 && (
                                                    <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/70", stage.text)}>
                                                        {pct}%
                                                    </span>
                                                )}
                                            </div>
                                            <p className={clsx("text-3xl font-black leading-none", stage.text)}>{stage.count}</p>
                                            <p className="text-xs font-bold text-gray-600 leading-tight mt-1 truncate">{stage.label}</p>
                                            <div className="w-full bg-white/50 h-1.5 rounded-full overflow-hidden mt-auto">
                                                <div className={clsx("h-full rounded-full", stage.bar)} style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-[10px] text-gray-500 leading-tight">{stage.hint}</p>
                                        </div>
                                        {idx < pipelineStages.length - 1 && (
                                            <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 rtl:rotate-180" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* AI Insight Feed */}
                <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden flex flex-col gap-4">
                    <div className="absolute top-0 end-0 p-4 opacity-5 pointer-events-none select-none">
                        <Sparkles className="w-36 h-36" />
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/10 shrink-0">
                            <Sparkles className="w-4 h-4 text-blue-200" />
                        </div>
                        <h3 className="text-sm font-bold text-white">{t('dashboard.cortexInsights')}</h3>
                    </div>
                    <div className="space-y-2 relative z-10 flex-1">
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

            {/* ── Row 3: Delivery & Logistics Health ── */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <Truck className="w-5 h-5 text-emerald-500" />
                    {t('dashboard.logisticsHealth')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-emerald-800">{t('dashboard.successRate')}</p>
                            <span className="text-2xl font-black text-emerald-700">{successRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-emerald-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${successRate}%` }} />
                        </div>
                        <p className="text-xs text-emerald-700 mt-2 font-medium">
                            {successRate >= 80 ? '🟢 Good performance' : successRate >= 60 ? '🟡 Moderate' : '🔴 Low — review couriers'}
                        </p>
                    </div>
                    <div className={clsx("rounded-2xl p-4 border", refusalRate > 30 ? "bg-rose-50 border-rose-100" : "bg-gray-50 border-gray-100")}>
                        <div className="flex items-center justify-between mb-2">
                            <p className={clsx("text-sm font-bold", refusalRate > 30 ? "text-rose-800" : "text-gray-700")}>{t('dashboard.refusalReturns')}</p>
                            <span className={clsx("text-2xl font-black", refusalRate > 30 ? "text-rose-700" : "text-gray-800")}>{refusalRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-rose-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${refusalRate}%` }} />
                        </div>
                        {refusalRate > 30 && <p className="text-xs text-rose-600 mt-2 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Check AI insights</p>}
                    </div>
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
            {/* ── Row 5: HR Daily Snapshot + Reports ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

                {/* HR Attendance Snapshot */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-5 select-none gap-2">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 truncate">
                            <Users className="w-5 h-5 text-violet-500 shrink-0" />
                            <span className="truncate">{t('dashboard.hrSnapshot', 'HR Snapshot')}</span>
                        </h3>
                        <span className="text-[10px] sm:text-xs text-gray-400 font-medium bg-gray-50 px-2 sm:px-3 py-1 rounded-full border border-gray-100 whitespace-nowrap">
                            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
                        <HRTile
                            icon={UserCheck} label={t('dashboard.presentToday', 'Present Today')}
                            value={hrMetrics?.presentToday ?? '—'}
                            total={hrMetrics?.activeEmployees}
                            color="text-emerald-600" bg="bg-emerald-50" bar="bg-emerald-400"
                        />
                        <HRTile
                            icon={UserX} label={t('dashboard.absentToday', 'Absent Today')}
                            value={hrMetrics?.absentToday ?? '—'}
                            total={hrMetrics?.activeEmployees}
                            color="text-rose-600" bg="bg-rose-50" bar="bg-rose-400"
                            isAlert={(hrMetrics?.absentToday || 0) > 0}
                        />
                        <HRTile
                            icon={Clock} label={t('dashboard.lateToday', 'Late Today')}
                            value={hrMetrics?.lateToday ?? '—'}
                            total={hrMetrics?.activeEmployees}
                            color="text-amber-600" bg="bg-amber-50" bar="bg-amber-400"
                            isAlert={(hrMetrics?.lateToday || 0) > 0}
                        />
                        <HRTile
                            icon={Users} label={t('dashboard.activeStaff', 'Active Staff')}
                            value={hrMetrics?.activeEmployees ?? '—'}
                            total={hrMetrics?.totalEmployees}
                            color="text-violet-600" bg="bg-violet-50" bar="bg-violet-400"
                        />
                    </div>
                    {/* Payroll estimate strip */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl p-4 border border-violet-100 gap-3">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] sm:text-xs font-bold text-violet-700 uppercase tracking-wider truncate">{t('dashboard.monthlyPayrollEst', 'Monthly Payroll Est')}</p>
                                <p className="text-[10px] sm:text-xs text-violet-500 mt-0.5 truncate">{t('dashboard.payrollSubtitle', 'Projected based on attendance')}</p>
                            </div>
                        </div>
                        <p className="text-xl sm:text-2xl font-black text-violet-900 tabular-nums self-end sm:self-auto block text-end w-full sm:w-auto">
                            {(hrMetrics?.estimatedPayrollDZD || 0).toLocaleString()}
                            <span className="text-[10px] sm:text-sm font-medium text-violet-400 ms-1">DZ</span>
                        </p>
                    </div>
                    {/* Daily overtime if any */}
                    {(dailyReport?.summary?.totalOvertimeMinutes || 0) > 0 && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 font-semibold bg-amber-50 px-3 py-2 rounded-xl border border-amber-100">
                            <CalendarClock className="w-3.5 h-3.5" />
                            {t('dashboard.overtimeStrip', { h: Math.round(dailyReport.summary.totalOvertimeMinutes / 60), n: dailyReport.summary.present })}
                        </div>
                    )}
                </div>

                {/* Reports Quick Access */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-5">
                        <FileBarChart2 className="w-5 h-5 text-blue-500" />
                        {t('dashboard.reportsTitle')}
                    </h3>
                    <div className="flex flex-col gap-3 flex-1">
                        <Link to="/hr/reports" className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <UserCheck className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-blue-900">{t('dashboard.dailyAttendance')}</p>
                                    <p className="text-xs text-blue-500">{t('dashboard.attendanceSub', { present: dailyReport?.summary?.present ?? 0, absent: dailyReport?.summary?.absent ?? 0 })}</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        <Link to="/hr/payroll" className="flex items-center justify-between p-3.5 rounded-2xl bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                                    <CreditCard className="w-4 h-4 text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-violet-900">{t('dashboard.payrollLink')}</p>
                                    <p className="text-xs text-violet-500">{t('dashboard.payrollSub', { amount: (hrMetrics?.estimatedPayrollDZD || 0).toLocaleString() })}</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-violet-400 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        <Link to="/hr" className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                                    <BarChart3 className="w-4 h-4 text-gray-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{t('dashboard.hrOverview')}</p>
                                    <p className="text-xs text-gray-500">{t('dashboard.hrOverviewSub', { count: hrMetrics?.totalEmployees ?? 0 })}</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    </div>
                </div>
            </div>

        </div>
    );
}

/* ─── Metric Card — compact, updated to match Net Real Profit card design ─── */
function MetricCard({ title, value, unit, icon: Icon, trend, isPositive, color, bg, isEmpty, emptyLabel }) {
    const borderColor = bg.replace('bg-', 'border-').replace('50', '100');
    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{title}</p>
                {isEmpty ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 mt-1">{emptyLabel}</span>
                ) : (
                    <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter flex items-baseline gap-1.5 flex-wrap truncate">
                        {value} <span className="text-sm font-medium text-gray-400">{unit}</span>
                    </h3>
                )}
                {trend && !isEmpty && (
                    <p className={clsx("text-xs font-bold mt-2 flex items-center gap-1", isPositive ? "text-emerald-600" : "text-gray-400")}>
                        {isPositive && <TrendingUp className="w-3 h-3" />}{trend}
                    </p>
                )}
            </div>
            <div className={clsx("h-16 w-16 rounded-2xl flex items-center justify-center border shrink-0", bg, borderColor)}>
                <Icon className={clsx("w-8 h-8", color)} />
            </div>
        </div>
    );
}

/* ─── Inventory Card ─── */
function InventoryCard({ icon: Icon, iconBg, iconColor, label, value, valueSuffix, hint, isAlert }) {
    const borderColor = iconBg.replace('bg-', 'border-').replace('50', '100');
    return (
        <div className={clsx("bg-white rounded-2xl shadow-sm border p-5 flex items-center justify-between gap-4 hover:shadow-md transition-shadow", isAlert ? "border-rose-100" : "border-gray-100")}>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{label}</p>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter flex items-baseline gap-1.5 truncate">
                    {value}{valueSuffix && <span className="text-xs font-bold text-rose-400 ms-1.5">{valueSuffix}</span>}
                </h3>
                {hint && <p className="text-xs text-gray-400 mt-1 font-medium truncate">{hint}</p>}
            </div>
            <div className={clsx("h-16 w-16 rounded-2xl flex items-center justify-center border shrink-0", iconBg, borderColor)}>
                <Icon className={clsx("w-8 h-8", iconColor)} />
            </div>
        </div>
    );
}

/* ─── HR Tile ─── */
function HRTile({ icon: Icon, label, value, total, color, bg, bar, isAlert }) {
    const pct = total > 0 ? Math.min(100, Math.round((Number(value) / Number(total)) * 100)) : 0;
    return (
        <div className={clsx(
            "rounded-2xl p-3 sm:p-4 border flex flex-col justify-between hover:shadow-sm transition-shadow",
            isAlert ? "bg-rose-50/60 border-rose-100" : "bg-gray-50/60 border-gray-100"
        )}>
            <div className="flex justify-between items-start mb-2 gap-2">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", bg)}>
                    <Icon className={clsx("w-4 h-4", color)} />
                </div>
                <p className="text-xl sm:text-2xl font-black text-gray-900 tabular-nums leading-none mt-1">{value}</p>
            </div>
            <div className="mt-auto">
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500 line-clamp-1 leading-tight mb-2 mt-1 truncate" title={label}>{label}</p>
                {total != null && (
                    <div className="w-full bg-gray-200 h-1 sm:h-1.5 rounded-full overflow-hidden">
                        <div className={clsx("h-full rounded-full transition-all duration-500", bar)} style={{ width: `${pct}%` }} />
                    </div>
                )}
            </div>
        </div>
    );
}
