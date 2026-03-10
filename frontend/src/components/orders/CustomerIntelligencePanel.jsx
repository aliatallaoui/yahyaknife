import { AlertTriangle, Info, CheckCircle, Clock } from 'lucide-react';
import moment from 'moment';

export default function CustomerIntelligencePanel({ data, isSearching }) {
    if (isSearching) {
        return (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-center justify-center min-h-[100px] animate-pulse">
                <p className="text-sm text-gray-500 font-medium tracking-wide">Looking up phone number...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="bg-blue-50/50 border border-blue-100/50 rounded-xl p-4 flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-sm text-blue-800/80">
                    Enter phone number to fetch customer history, duplicate warnings, and automatic risk evaluation.
                </p>
            </div>
        );
    }

    const { exists, customer, activeDuplicateOrders, riskIndicator, warning } = data;

    const RiskBadge = () => {
        if (riskIndicator === 'High') {
            return (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200">
                    <AlertTriangle className="w-3.5 h-3.5" /> High Risk
                </div>
            );
        }
        if (riskIndicator === 'Medium') {
            return (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">
                    <AlertTriangle className="w-3.5 h-3.5" /> Medium Risk
                </div>
            );
        }
        return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5" /> Trusted Customer
            </div>
        );
    }

    return (
        <div className="bg-white border shadow-sm rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        {exists ? customer.name : "New Customer"}
                        {exists && <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">ID: {customer._id.substring(customer._id.length - 6)}</span>}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        {exists ? `Joined ${moment(customer.joinDate).fromNow()}` : 'No previous records found.'}
                    </p>
                </div>
                <RiskBadge />
            </div>

            {warning && (
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-start gap-2 text-sm text-orange-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="font-medium leading-tight">{warning}</p>
                </div>
            )}

            {exists && (
                <div className="grid grid-cols-4 gap-4 pt-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Orders</span>
                        <span className="text-lg font-bold text-gray-900">{customer.totalOrders}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Delivered</span>
                        <span className="text-lg font-bold text-gray-900">{customer.deliveredOrders}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Return Rate</span>
                        <span className="text-lg font-bold text-gray-900">{customer.returnRate || customer.refusalRate?.toFixed(1) || 0}%</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">LTV</span>
                        <span className="text-lg font-bold text-gray-900">${customer.lifetimeValue?.toLocaleString()}</span>
                    </div>
                </div>
            )}

            {activeDuplicateOrders && activeDuplicateOrders.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                    <h4 className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide">Active Duplicate Orders</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                        {activeDuplicateOrders.map(dup => (
                            <div key={dup._id} className="bg-gray-50 rounded-lg p-2.5 text-xs flex items-center justify-between border border-gray-100">
                                <div>
                                    <span className="font-semibold text-gray-900 block">{dup.orderId}</span>
                                    <span className="text-gray-500 block">{moment(dup.date).fromNow()}</span>
                                </div>
                                <div className="text-right">
                                    <span className="font-semibold text-blue-600 block">${dup.totalAmount}</span>
                                    <span className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold mt-1 inline-block">{dup.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
