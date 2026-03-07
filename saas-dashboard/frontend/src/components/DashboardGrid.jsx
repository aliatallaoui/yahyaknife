import { Sparkles, TrendingUp, TrendingDown, DollarSign, Package, Truck, AlertTriangle, CheckCircle2, CheckCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function DashboardGrid({ data }) {
    if (!data) return <div className="text-gray-500">Failed to load data.</div>;

    const { orderMetrics, deliveryMetrics, financialMetrics, inventoryMetrics, aiSummary } = data;

    // Derived logic for AI Insights array handling if it's an array or just a string
    const insightsList = Array.isArray(aiSummary) ? aiSummary : [aiSummary];

    const orderPipelineData = [
        { name: 'Awaiting Confirm', value: orderMetrics.awaitingConfirmation || 0 },
        { name: 'Awaiting Dispatch', value: orderMetrics.awaitingDispatch || 0 },
        { name: 'In Delivery', value: orderMetrics.inDelivery || 0 },
        { name: 'Delivered', value: orderMetrics.deliveredOrders || 0 }
    ];

    const PIPELINE_COLORS = ['#ec4899', '#f59e0b', '#3b82f6', '#10b981'];

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1400px]">

            {/* Control Center Header & AI Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">

                {/* Financial Overview (The heavy hitters) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Real Net Profit"
                        value={`${(financialMetrics?.realProfit || 0).toLocaleString()} DZ`}
                        icon={DollarSign}
                        trend="+12% vs last month"
                        isPositive={true}
                        color="text-emerald-600"
                        bg="bg-emerald-50"
                    />
                    <MetricCard
                        title="Delivered Revenue"
                        value={`${(financialMetrics?.deliveredRevenue || 0).toLocaleString()} DZ`}
                        icon={TrendingUp}
                        trend="Captured value"
                        color="text-indigo-600"
                        bg="bg-indigo-50"
                    />
                    <MetricCard
                        title="Cash in Transit"
                        value={`${(financialMetrics?.expectedRevenue || 0).toLocaleString()} DZ`}
                        icon={Truck}
                        trend="Expected settlement"
                        color="text-amber-600"
                        bg="bg-amber-50"
                    />
                    <MetricCard
                        title="Couriers Pending"
                        value={`${(financialMetrics?.globalSettlementsPending || 0).toLocaleString()} DZ`}
                        icon={Clock}
                        trend="To be collected apps"
                        color="text-rose-600"
                        bg="bg-rose-50"
                    />
                </div>

                {/* AI Insight Feed */}
                <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Sparkles className="w-48 h-48" />
                    </div>

                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10">
                                <Sparkles className="w-5 h-5 text-blue-100" />
                            </div>
                            <h3 className="text-xl font-bold tracking-tight text-white">Cortex AI Insights</h3>
                        </div>

                        <div className="space-y-4 relative z-10">
                            {insightsList.map((insight, idx) => (
                                <div key={idx} className="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10 flex gap-3 items-start">
                                    <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                                    <p className="text-sm font-medium leading-relaxed text-indigo-50">{insight || "System operating normally. No critical anomalies detected."}</p>
                                </div>
                            ))}
                            {(!insightsList || insightsList.length === 0 || !insightsList[0]) && (
                                <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10 flex gap-3 items-start">
                                    <CheckCircle className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                                    <p className="text-sm font-medium leading-relaxed text-indigo-50">All systems operating normally. Delivery networks are well balanced.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Grid: Order Pipeline & Delivery KPIs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Visual Order Pipeline */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-500" />
                        Live Order Pipeline
                    </h3>

                    <div className="flex h-64 items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={orderPipelineData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {orderPipelineData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIPELINE_COLORS[index % PIPELINE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) => [`${value} Orders`, 'Volume']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                            <span className="text-3xl font-black text-gray-900">{orderMetrics.totalOrders || 0}</span>
                            <span className="text-xs font-bold text-gray-400">TOTAL</span>
                        </div>
                    </div>
                </div>

                {/* Delivery Logistics Health */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Truck className="w-5 h-5 text-emerald-500" />
                        Delivery & Logistics Health
                    </h3>

                    <div className="grid grid-cols-2 gap-4 h-full">
                        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex flex-col justify-center">
                            <p className="text-sm font-bold text-gray-500 mb-2">Success Rate</p>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black text-emerald-600">
                                    {(deliveryMetrics?.deliverySuccessRate || 0).toFixed(1)}%
                                </span>
                            </div>
                            <div className="w-full bg-emerald-100 h-2 mt-4 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${deliveryMetrics?.deliverySuccessRate || 0}%` }}></div>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex flex-col justify-center">
                            <p className="text-sm font-bold text-gray-500 mb-2">Refusal / Returns</p>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black text-rose-600">
                                    {(deliveryMetrics?.refusalRate || 0).toFixed(1)}%
                                </span>
                            </div>
                            <div className="w-full bg-rose-100 h-2 mt-4 rounded-full overflow-hidden">
                                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${deliveryMetrics?.refusalRate || 0}%` }}></div>
                            </div>
                        </div>

                        <div className="col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-blue-800 mb-1">Total Refused & Returned</p>
                                <p className="text-xs text-blue-600 font-medium">Lost COGS due to failed last-mile.</p>
                            </div>
                            <span className="text-2xl font-black text-blue-900">
                                {(orderMetrics?.refusedOrders || 0) + (orderMetrics?.returnedOrders || 0)} Units
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Inventory Ledger Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center">
                        <DollarSign className="w-7 h-7 text-purple-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 mb-1">Total Inventory Value</p>
                        <h4 className="text-2xl font-black text-gray-900">{(inventoryMetrics?.inventoryValue || 0).toLocaleString()} DZ</h4>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
                        <Package className="w-7 h-7 text-orange-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 mb-1">Total Available Stock</p>
                        <h4 className="text-2xl font-black text-gray-900">{(inventoryMetrics?.totalAvailableStock || 0).toLocaleString()} <span className="text-sm font-bold text-gray-400">Units</span></h4>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
                        <AlertTriangle className="w-7 h-7 text-rose-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 mb-1">Dead Stock Variants</p>
                        <h4 className="text-2xl font-black text-gray-900">{inventoryMetrics?.deadStockVariants || 0} <span className="text-sm font-bold text-rose-400">Action Required</span></h4>
                    </div>
                </div>
            </div>

        </div>
    );
}

function MetricCard({ title, value, icon: Icon, trend, isPositive, color, bg }) {
    return (
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", bg, color)}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <div>
                <h3 className="text-2xl font-black text-gray-900 tabular-nums tracking-tight">{value}</h3>
                <p className="text-sm font-bold text-gray-500 mt-1">{title}</p>
                {trend && (
                    <p className={clsx("text-xs font-bold mt-3 inline-flex items-center gap-1", isPositive ? "text-emerald-600" : "text-gray-400")}>
                        {isPositive && <TrendingUp className="w-3 h-3" />}
                        {trend}
                    </p>
                )}
            </div>
        </div>
    );
}
