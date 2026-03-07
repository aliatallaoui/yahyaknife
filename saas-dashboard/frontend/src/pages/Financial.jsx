import { useEffect, useState, useContext } from 'react';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Activity, ArrowUpRight, ArrowDownRight, Edit2, Trash2, Plus, Truck, Package, CheckCircle2 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
    LineChart, Line
} from 'recharts';
import clsx from 'clsx';
import moment from 'moment';
import { TransactionContext } from '../context/TransactionContext';
import TransactionModal from '../components/TransactionModal';

export default function Financial() {
    const { transactions, loading: txLoading, addTransaction, updateTransaction, deleteTransaction } = useContext(TransactionContext);
    const [overview, setOverview] = useState(null);
    const [loadingOverview, setLoadingOverview] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const limit = 10;

    // Deriving manual expenses and revenues from the unified context
    const expenses = transactions.filter(t => t.type === 'expense');
    const revenues = transactions.filter(t => t.type === 'revenue');

    const totalPages = Math.ceil(transactions.length / limit);
    const paginatedTransactions = transactions.slice((currentPage - 1) * limit, currentPage * limit);

    useEffect(() => {
        const fetchOverview = async () => {
            try {
                const finRes = await fetch('http://localhost:5000/api/finance/overview');
                const data = await finRes.json();
                setOverview(data);
            } catch (error) {
                console.error("Error fetching financial overview:", error);
            } finally {
                setLoadingOverview(false);
            }
        };
        fetchOverview();
    }, [transactions]); // Refetch overview when manual transactions change

    const handleOpenModal = (transaction = null) => {
        setSelectedTransaction(transaction);
        setIsModalOpen(true);
    };

    const handleFormSubmit = async (data) => {
        if (selectedTransaction) {
            await updateTransaction(selectedTransaction._id, data);
        } else {
            await addTransaction(data);
        }
    };

    if (loadingOverview || txLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-emerald-600 animate-spin"></div>
            </div>
        );
    }

    // Dynamic KPIs from the backend
    const pipeline = overview?.pipeline || { expectedRevenue: 0, transitRevenue: 0, deliveredRevenue: 0, settledRevenue: 0 };
    const {
        cogs = 0, operatingExpenses = 0, manualRevenue = 0, manualExpenses = 0,
        totalRecognizedRevenue = 0, totalExpenses = 0, netProfit = 0, profitMargin = 0
    } = overview || {};

    const pipelineData = [
        { name: 'Expected', value: pipeline.expectedRevenue, fill: '#6366f1' },
        { name: 'In Transit', value: pipeline.transitRevenue, fill: '#f59e0b' },
        { name: 'Delivered', value: pipeline.deliveredRevenue, fill: '#14b8a6' },
        { name: 'Settled', value: pipeline.settledRevenue, fill: '#22c55e' }
    ];

    return (
        <div className="flex flex-col gap-6">

            {/* Header */}
            <div className="flex justify-between items-center bg-emerald-900 text-white p-6 rounded-2xl shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Financial Hub</h2>
                    <p className="text-emerald-100 mt-1 text-sm font-medium">Real-time COD revenue tracking and global P&L</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all shadow-sm">
                        <Plus className="w-4 h-4" /> Add Manual Transaction
                    </button>
                </div>
            </div>

            {/* Profitability Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm col-span-1 md:col-span-2 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">True Net Profit</p>
                        <h3 className={clsx("text-4xl font-black tracking-tighter", netProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {netProfit.toLocaleString()} DZ
                        </h3>
                        <p className="text-xs text-gray-400 mt-1 font-medium">Revenue (Delivered+Settled) - COGS - Expenses</p>
                    </div>
                    <div className="h-16 w-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                        <DollarSign className="w-8 h-8 text-emerald-600" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Profit Margin</p>
                    <h3 className="text-3xl font-black text-gray-900 tracking-tighter">{profitMargin}%</h3>
                    <ProgressBar progress={Math.max(0, Math.min(100, profitMargin))} color="bg-emerald-500" />
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Recognized Revenue</p>
                    <h3 className="text-3xl font-black text-gray-900 tracking-tighter">{totalRecognizedRevenue.toLocaleString()} DZ</h3>
                    <div className="flex items-center gap-1 mt-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit">
                        <ArrowUpRight className="w-3 h-3" /> Includes COD Settled
                    </div>
                </div>
            </div>

            {/* Cash Flow Pipelines */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Visual Pipeline */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" /> COD Cash Pipeline
                    </h3>
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        <PipelineNode label="Expected (Queued)" value={pipeline.expectedRevenue} color="text-indigo-600" bg="bg-indigo-50" icon={Package} />
                        <PipelineNode label="Cash in Transit" value={pipeline.transitRevenue} color="text-amber-600" bg="bg-amber-50" icon={Truck} />
                        <PipelineNode label="Cash Delivered" value={pipeline.deliveredRevenue} color="text-teal-600" bg="bg-teal-50" icon={TrendingUp} />
                        <PipelineNode label="Cash Settled" value={pipeline.settledRevenue} color="text-emerald-600" bg="bg-emerald-50" icon={CheckCircle2} />
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={v => `${v / 1000}k`} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                    {pipelineData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Costs Breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col h-full">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-rose-500" /> Cost Structures
                    </h3>
                    <div className="space-y-6 flex-1">
                        <CostItem label="Cost of Goods (COGS)" value={cogs} total={totalExpenses} color="bg-rose-500" />
                        <CostItem label="Fulfillment & Gateway Fees" value={operatingExpenses - manualExpenses} total={totalExpenses} color="bg-orange-500" />
                        <CostItem label="Manual Operating Expenses" value={manualExpenses} total={totalExpenses} color="bg-purple-500" />

                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <span className="font-bold text-gray-700">Total Deductions</span>
                                <span className="font-black text-gray-900 text-lg tabular-nums">{totalExpenses.toLocaleString()} DZ</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Manual Ledger List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[500px]">
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Manual Operating Ledger</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{transactions.length} Total Tx</span>
                    </div>
                </div>
                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold w-32">Date</th>
                                <th className="p-4 font-semibold">Type</th>
                                <th className="p-4 font-semibold">Category</th>
                                <th className="p-4 font-semibold">Description</th>
                                <th className="p-4 font-semibold text-right">Amount</th>
                                <th className="p-4 font-semibold text-center w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {paginatedTransactions.map((tx) => (
                                <tr key={tx._id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="p-4 text-gray-500 font-medium">
                                        {moment(tx.date).format('MMM DD, YYYY')}
                                    </td>
                                    <td className="p-4">
                                        <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold",
                                            tx.type === 'revenue' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                        )}>
                                            {tx.type === 'revenue' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                            {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                                        </span>
                                    </td>
                                    <td className="p-4 font-semibold text-gray-700">{tx.category}</td>
                                    <td className="p-4 text-gray-500 truncate max-w-[200px]">{tx.description || '-'}</td>
                                    <td className={clsx("p-4 text-right font-bold tabular-nums",
                                        tx.type === 'revenue' ? "text-emerald-700" : "text-gray-900"
                                    )}>
                                        {tx.type === 'revenue' ? '+' : '-'}{tx.amount.toLocaleString()} DZ
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenModal(tx)} className="p-1.5 text-gray-400 hover:text-blue-600 bg-white shadow-sm border border-gray-100 rounded-md transition-colors">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => deleteTransaction(tx._id)} className="p-1.5 text-gray-400 hover:text-rose-600 bg-white shadow-sm border border-gray-100 rounded-md transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {paginatedTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center border border-dashed rounded-xl m-4 text-gray-500">
                                        No manual transactions recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                        <span className="text-sm font-medium text-gray-500">Page {currentPage} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-1.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-1.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <TransactionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleFormSubmit}
                    initialData={selectedTransaction}
                />
            )}
        </div>
    );
}

function PipelineNode({ label, value, color, bg, icon: Icon }) {
    return (
        <div className={clsx("p-4 rounded-xl border border-gray-100 flex flex-col gap-3", bg)}>
            <div className="flex items-center gap-2">
                <Icon className={clsx("w-4 h-4", color)} />
                <span className={clsx("text-xs font-bold uppercase tracking-wider", color)}>{label}</span>
            </div>
            <span className="text-2xl font-black text-gray-900 tracking-tight">{value.toLocaleString()}</span>
        </div>
    );
}

function CostItem({ label, value, total, color }) {
    const percent = total > 0 ? (value / total) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-gray-700">{label}</span>
                <span className="text-sm font-black text-gray-900">{value.toLocaleString()} <span className="text-gray-400 font-medium ml-1">({percent.toFixed(1)}%)</span></span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className={clsx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
}

function ProgressBar({ progress, color }) {
    return (
        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mt-3">
            <div className={clsx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${progress}%` }}></div>
        </div>
    );
}
