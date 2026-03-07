import { useEffect, useState } from 'react';
import { Users, UserMinus, UserCheck, Star, MessageSquare, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { useCustomer } from '../context/CustomerContext';
import CustomerModal from '../components/modals/CustomerModal';
import clsx from 'clsx';
import moment from 'moment';

const COLORS = ['#4361EE', '#3B82F6', '#60A5FA', '#93C5FD', '#111827', '#6B7280'];

export default function CustomerInsight() {
    const { customers, loading: contextLoading, createCustomer, updateCustomer, deleteCustomer } = useCustomer();
    const [metrics, setMetrics] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);

    useEffect(() => {
        const fetchCustomerData = async () => {
            try {
                const [metricsRes, feedbackRes] = await Promise.all([
                    fetch('http://localhost:5000/api/customers/metrics'),
                    fetch('http://localhost:5000/api/customers/feedback')
                ]);

                setMetrics(await metricsRes.json());
                setFeedback(await feedbackRes.json());
            } catch (error) {
                console.error("Error fetching customer data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCustomerData();
    }, []);

    if (loading || contextLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    const handleCreateClick = () => {
        setEditingCustomer(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (customer) => {
        setEditingCustomer(customer);
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (id) => {
        if (window.confirm("Are you sure you want to delete this customer?")) {
            try {
                await deleteCustomer(id);
            } catch (error) {
                alert("Failed to delete customer.");
            }
        }
    };

    const handleModalSubmit = async (payload) => {
        try {
            if (editingCustomer) await updateCustomer(editingCustomer._id, payload);
            else await createCustomer(payload);
            setIsModalOpen(false);
        } catch (error) {
            alert("Failed to save customer.");
        }
    };

    // Format Acquisition data for PieChart
    const acquisitionData = metrics?.acquisitionDistribution ? Object.keys(metrics.acquisitionDistribution).map((key) => ({
        name: key,
        value: metrics.acquisitionDistribution[key]
    })).sort((a, b) => b.value - a.value) : [];

    return (
        <div className="flex flex-col gap-6">

            {/* Top Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Insight</h2>
                    <p className="text-sm text-gray-500 mt-1">Acquisition channels, retention metrics, and customer CRM.</p>
                </div>
                <button onClick={handleCreateClick} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl text-sm transition-all hover:bg-blue-700 shadow-sm shadow-blue-600/20">
                    <Plus className="w-4 h-4" /> New Customer
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <InsightCard
                    title="Total Customers"
                    value={metrics?.totalCustomers?.toLocaleString()}
                    icon={Users}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <InsightCard
                    title="Active Users"
                    value={metrics?.retentionStatus?.active?.toLocaleString()}
                    icon={UserCheck}
                    color="text-green-600"
                    bg="bg-green-50"
                    percentage={`${Math.round((metrics?.retentionStatus?.active / metrics?.totalCustomers) * 100)}%`}
                />
                <InsightCard
                    title="Churned Users"
                    value={metrics?.retentionStatus?.churned?.toLocaleString()}
                    icon={UserMinus}
                    color="text-red-600"
                    bg="bg-red-50"
                    percentage={`${Math.round((metrics?.retentionStatus?.churned / metrics?.totalCustomers) * 100)}%`}
                />
                <InsightCard
                    title="Average Rating"
                    value={`${feedback?.averageRating} / 5`}
                    icon={Star}
                    color="text-yellow-600"
                    bg="bg-yellow-50"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                <div className="xl:col-span-2 flex flex-col gap-6">
                    {/* Acquisition Breakdown */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Acquisition Channels</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={acquisitionData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={3}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {acquisitionData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            formatter={(value) => [value, 'Customers']}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div>
                                <div className="space-y-4">
                                    {acquisitionData.map((ch, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm">
                                            <span className="flex items-center gap-3">
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                                                <span className="text-gray-700 font-medium">{ch.name}</span>
                                            </span>
                                            <span className="font-bold text-gray-900 tabular-nums">
                                                {ch.value} <span className="text-gray-400 font-normal">({Math.round((ch.value / metrics.totalCustomers) * 100)}%)</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* New vs Returning */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">New vs Returning</h3>
                            <p className="text-sm text-gray-500">Customer loyalty distribution.</p>
                        </div>
                        <div className="flex gap-8">
                            <div className="text-center">
                                <div className="text-3xl font-black text-blue-600 tabular-nums mb-1">{metrics?.newVsReturning?.new}</div>
                                <div className="text-xs font-semibold uppercase text-gray-400 tracking-wider">New</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-black text-indigo-900 tabular-nums mb-1">{metrics?.newVsReturning?.returning}</div>
                                <div className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Returning</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feedback Feed */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full max-h-[600px]">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-gray-400" /> Recent Feedback
                        </h3>
                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{feedback?.totalReviews} total</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0 styled-scrollbar">
                        <div className="divide-y divide-gray-100">
                            {feedback?.recentFeedback?.map(fb => (
                                <div key={fb._id} className="p-5 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={clsx("text-xs font-bold px-2 py-1 rounded-md",
                                            fb.rating >= 4 ? "bg-green-50 text-green-700" :
                                                fb.rating === 3 ? "bg-yellow-50 text-yellow-700" :
                                                    "bg-red-50 text-red-700"
                                        )}>
                                            {fb.rating} / 5 Stars
                                        </span>
                                        <span className="text-xs text-gray-400">{moment(fb.date).fromNow()}</span>
                                    </div>
                                    <p className="text-sm text-gray-700 mb-3">{fb.comment}</p>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-semibold text-gray-900">{fb.customerId?.name || 'Anonymous User'}</span>
                                        <span className="text-gray-500">{fb.category}</span>
                                    </div>
                                </div>
                            ))}
                            {(!feedback?.recentFeedback || feedback.recentFeedback.length === 0) && (
                                <div className="p-8 text-center text-gray-500 text-sm">No recent feedback.</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Customer CRM Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Customer Directory</h3>
                </div>
                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold">Name & Channel</th>
                                <th className="p-4 font-semibold">Email</th>
                                <th className="p-4 font-semibold text-center">Trust & Risk</th>
                                <th className="p-4 font-semibold text-center">Orders</th>
                                <th className="p-4 font-semibold text-right">LTV & AOV</th>
                                <th className="p-4 font-semibold text-right text-emerald-600">Net Profit</th>
                                <th className="p-4 font-semibold text-center">Status</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {customers.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500">No customers found.</td></tr>
                            ) : customers.map((customer) => (
                                <tr key={customer._id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="text-gray-900 font-bold">{customer.name}</div>
                                        <div className="text-xs text-indigo-600 font-medium">{customer.acquisitionChannel}</div>
                                    </td>
                                    <td className="p-4 text-gray-500">{customer.email}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-md border",
                                                customer.isSuspicious ? "border-red-200 bg-red-50 text-red-700" :
                                                    (customer.trustScore || 100) > 80 ? "border-green-200 bg-green-50 text-green-700" :
                                                        "border-yellow-200 bg-yellow-50 text-yellow-700"
                                            )}>
                                                TS: {Math.round(customer.trustScore || 100)}
                                            </span>
                                            {customer.isSuspicious && (
                                                <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> Suspicious
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400">RR: {Math.round(customer.refusalRate || 0)}%</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center font-bold text-gray-700">{customer.totalOrders || 0}</td>
                                    <td className="p-4 text-right">
                                        <div className="font-bold text-gray-900 tabular-nums">${(customer.lifetimeValue || 0).toLocaleString()}</div>
                                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">AOV: ${(customer.averageOrderValue || 0).toFixed(2)}</div>
                                    </td>
                                    <td className="p-4 text-right font-black text-emerald-600 tabular-nums">
                                        ${(customer.netProfitGenerated || 0).toLocaleString()}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider",
                                            customer.status === 'Active' ? 'bg-green-100 text-green-800' :
                                                customer.status === 'Churned' ? 'bg-red-100 text-red-800' :
                                                    customer.status === 'At Risk' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                                        )}>
                                            {customer.status}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleEditClick(customer)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Customer">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDeleteClick(customer._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Customer">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <CustomerModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleModalSubmit}
                    initialData={editingCustomer}
                />
            )}

        </div>
    );
}

function InsightCard({ title, value, icon: Icon, color, bg, percentage }) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", bg, color)}>
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-gray-900 tabular-nums tracking-tight leading-none">{value}</h3>
                    <p className="text-sm font-medium text-gray-500 mt-1">{title}</p>
                </div>
            </div>
            {percentage && (
                <div className="text-xl font-bold text-gray-300">{percentage}</div>
            )}
        </div>
    );
}
