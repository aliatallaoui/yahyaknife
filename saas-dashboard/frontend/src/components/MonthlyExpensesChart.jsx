import {
    ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { FileText } from 'lucide-react';

export default function MonthlyExpensesChart({ expenses }) {
    if (!expenses || expenses.length === 0) return null;

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-4 border border-gray-100 shadow-lg rounded-xl min-w-[200px]">
                    <p className="font-bold text-gray-900 mb-3">{label}</p>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-500 text-sm">Assets Expenses:</span>
                        <span className="font-semibold text-gray-900 tabular-nums">
                            {data.assets.toLocaleString()} <span className="text-xs text-gray-400 font-bold ml-1">DZ</span>
                        </span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-500 text-sm">Salary Expenses:</span>
                        <span className="font-semibold text-gray-900 tabular-nums">
                            {data.salary.toLocaleString()} <span className="text-xs text-gray-400 font-bold ml-1">DZ</span>
                        </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                        <span className="text-gray-500 text-sm">Monthly Expenses:</span>
                        <span className="font-bold text-gray-900 tabular-nums text-blue-600">
                            {data.monthly.toLocaleString()} <span className="text-xs opacity-70 font-bold ml-1">DZ</span>
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)] p-6 flex flex-col h-full w-full col-span-1 lg:col-span-1">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 leading-tight">Monthly Expenses</h2>
                        <p className="text-sm text-gray-500">Track and compare monthly business spending</p>
                    </div>
                </div>

                {/* Toggles */}
                <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                    <button className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-white shadow-sm text-gray-900">Monthly</button>
                    <button className="px-4 py-1.5 text-sm font-semibold rounded-lg text-gray-500 hover:text-gray-700">Quarterly</button>
                    <button className="px-4 py-1.5 text-sm font-semibold rounded-lg text-gray-500 hover:text-gray-700">Annually</button>
                </div>
            </div>

            {/* Chart */}
            <div className="flex-1 w-full mt-4">
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart
                        data={expenses}
                        margin={{ top: 20, right: 0, bottom: 0, left: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#C58AF9" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#1A73E8" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9CA3AF', fontSize: 13, fontWeight: 500 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9CA3AF', fontSize: 13, fontWeight: 500 }}
                            tickFormatter={(value) => `${value / 1000}k DZ`}
                            domain={[0, 400000]}
                            dx={-10}
                        />
                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ stroke: '#1A73E8', strokeWidth: 1, strokeDasharray: '5 5' }}
                        />

                        <Bar
                            dataKey="baseline"
                            fill="#d2e3fc"
                            radius={[4, 4, 0, 0]}
                            barSize={32}
                        />
                        <Area
                            type="monotone"
                            dataKey="actual"
                            fill="url(#colorArea)"
                            stroke="#1A73E8"
                            strokeWidth={3}
                            activeDot={{ r: 6, fill: "#1A73E8", stroke: "#fff", strokeWidth: 2 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
