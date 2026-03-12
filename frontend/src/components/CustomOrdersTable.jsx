import React, { useContext, useState } from 'react';
import { SalesContext } from '../context/SalesContext';
import { useCustomer } from '../context/CustomerContext';
import { format } from 'date-fns';

import { Pencil, Trash2, Link, Edit3, AlertTriangle } from 'lucide-react';
import PhoneChip from './PhoneChip';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

const STATUS_STYLES = {
    'Pending': 'bg-gray-100 text-gray-700 border-gray-200',
    'Confirmed': 'bg-blue-50 text-blue-700 border-blue-200',
    'In Production': 'bg-orange-50 text-orange-700 border-orange-200',
    'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Delivered': 'bg-green-50 text-green-700 border-green-200',
    'Cancelled': 'bg-gray-50 text-gray-400 border-gray-200 line-through',
};

export default function CustomOrdersTable({ searchTerm }) {
    const { t } = useTranslation();
    const { customOrders, deleteCustomOrder, updateCustomOrder } = useContext(SalesContext);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);

    // Simple filter
    const filtered = (customOrders || []).filter(o =>
        o.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filtered.length === 0) {
        return <div className="p-8 text-center text-gray-500 font-medium">{t('sales.noCustomOrders', 'No custom orders found.')}</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
                <thead>
                    <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider relative">
                        <th className="p-4 font-semibold text-start w-32">{t('sales.orderId', 'Order ID')}</th>
                        <th className="p-4 font-semibold text-start">{t('sales.client', 'Client')}</th>
                        <th className="p-4 font-semibold text-start">{t('sales.request', 'Request Details')}</th>
                        <th className="p-4 font-semibold text-end">{t('sales.deposit', 'Deposit')}</th>
                        <th className="p-4 font-semibold text-end">{t('sales.price', 'Final Price')}</th>
                        <th className="p-4 font-semibold text-center">{t('sales.status', 'Status')}</th>
                        <th className="p-4 font-semibold text-end">{t('sales.action', 'Action')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {filtered.map(order => (
                        <tr key={order._id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 font-bold text-gray-900">{order.orderId}</td>
                            <td className="p-4">
                                <div className="font-bold text-gray-900">{order.customer?.name || 'Unknown'}</div>
                                <PhoneChip phone={order.customer?.phone} />
                            </td>
                            <td className="p-4">
                                <div className="font-semibold text-gray-700">{order.requestedType || 'Custom Knife'}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    {order.requestedSteel} • {order.requestedHandle}
                                </div>
                                {order.generatedKnifeCard && (
                                    <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded w-fit">
                                        <Link className="w-3 h-3" /> Knife Card Generated
                                    </div>
                                )}
                            </td>
                            <td className="p-4 text-end font-semibold text-gray-900">{order.depositPaid?.toLocaleString()} DZ</td>
                            <td className="p-4 text-end font-bold text-emerald-600">{order.finalPrice?.toLocaleString()} DZ</td>
                            <td className="p-4 text-center">
                                <select
                                    value={order.status}
                                    onChange={(e) => updateCustomOrder(order._id, { status: e.target.value })}
                                    className={clsx(
                                        "px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border outline-none appearance-none cursor-pointer text-center",
                                        STATUS_STYLES[order.status] || STATUS_STYLES['Pending']
                                    )}
                                >
                                    {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </td>
                            <td className="p-4 space-x-2 text-end">
                                <button
                                    onClick={() => setPendingDeleteId(order._id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-block"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {pendingDeleteId && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="font-bold text-gray-900">{t('sales.deleteCustomOrder', 'Delete Custom Order?')}</h3>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setPendingDeleteId(null)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button onClick={() => { deleteCustomOrder(pendingDeleteId); setPendingDeleteId(null); }} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                                {t('common.delete', 'Delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
