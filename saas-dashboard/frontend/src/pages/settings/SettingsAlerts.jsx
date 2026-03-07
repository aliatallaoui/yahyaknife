import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { BellRing, ShieldCheck, Mail, Smartphone, CheckSquare } from 'lucide-react';

export default function SettingsAlerts() {
    const { user } = useContext(AuthContext);

    return (
        <div className="p-8 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Alerts & Access Permissions</h3>

            <div className="space-y-10 max-w-3xl">

                {/* Permissions Summary Read-Only */}
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-500" /> Current Role & Access Scope
                    </h4>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Assigned Role</p>
                                <p className="text-lg font-black text-gray-900 capitalize">{user?.role || 'User'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Department</p>
                                <p className="text-sm font-bold text-gray-900 capitalize">{user?.department || 'System'}</p>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
                            <h5 className="text-xs font-bold text-gray-700 mb-3 border-b border-gray-50 pb-2">Policy Scope (Granted via JWT)</h5>
                            <ul className="space-y-2">
                                <li className="text-xs flex items-center gap-2 text-emerald-700 font-medium bg-emerald-50/50 p-1.5 rounded"><CheckSquare className="w-3.5 h-3.5" /> Operations Read/Write Access</li>
                                <li className="text-xs flex items-center gap-2 text-emerald-700 font-medium bg-emerald-50/50 p-1.5 rounded"><CheckSquare className="w-3.5 h-3.5" /> Project Portfolio Editor</li>
                                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                    <li className="text-xs flex items-center gap-2 text-indigo-700 font-bold bg-indigo-50/50 p-1.5 rounded"><ShieldCheck className="w-3.5 h-3.5" /> Admin Hub Access</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Notifications Engine */}
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2 text-gray-700">
                        <BellRing className="w-4 h-4 text-gray-400" /> System Notifications
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">Configure which operational events trigger alerts. Dashboard alerts show up in the top right bell icon.</p>

                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left bg-white">
                            <thead className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3">Event Trigger</th>
                                    <th className="px-5 py-3 text-center"><DashboardIcon /> Dashboard</th>
                                    <th className="px-5 py-3 text-center"><EmailIcon /> Email</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <ToggleRow title="Sales & Orders" desc="New confirmations, refused orders, returns." defaultInApp={true} defaultEmail={false} />
                                <ToggleRow title="Inventory Stockouts" desc="Alerts when a raw material or SKU drops below minimum." defaultInApp={true} defaultEmail={true} />
                                <ToggleRow title="Production Milestones" desc="When a batch completes QA and yields stock." defaultInApp={true} defaultEmail={false} />
                                <ToggleRow title="Project Tasks" desc="Tasks assigned directly to you or overdue events." defaultInApp={true} defaultEmail={true} />
                                <ToggleRow title="Courier Settlements" desc="Financial reconciliations from dispatch logs." defaultInApp={false} defaultEmail={false} />
                            </tbody>
                        </table>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md hover:bg-indigo-700">Save Alert Preferences</button>
                    </div>
                </div>

            </div>
        </div>
    );
}

function DashboardIcon() { return <span className="flex justify-center items-center gap-1"><BellRing className="w-3 h-3" /> App</span>; }
function EmailIcon() { return <span className="flex justify-center items-center gap-1"><Mail className="w-3 h-3" /> Email</span>; }

function ToggleRow({ title, desc, defaultInApp, defaultEmail }) {
    const [inApp, setInApp] = useState(defaultInApp);
    const [email, setEmail] = useState(defaultEmail);

    return (
        <tr className="hover:bg-gray-50/50 transition-colors">
            <td className="px-5 py-4">
                <p className="text-sm font-bold text-gray-900">{title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
            </td>
            <td className="px-5 py-4 text-center">
                <input type="checkbox" checked={inApp} onChange={() => setInApp(!inApp)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
            </td>
            <td className="px-5 py-4 text-center">
                <input type="checkbox" checked={email} onChange={() => setEmail(!email)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
            </td>
        </tr>
    );
}
