import React, { useState } from 'react';
import { Shield, Smartphone, Key, MonitorSmartphone, X, Laptop } from 'lucide-react';
import clsx from 'clsx';
import moment from 'moment';

export default function SettingsSecurity() {
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

    return (
        <div className="p-8 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Security & Logins</h3>

            <div className="space-y-10 max-w-3xl">

                {/* Password Section */}
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2"><Key className="w-4 h-4 text-gray-400" /> Change Password</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Current Password</label>
                                <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-gray-50/50" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">New Password</label>
                                <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-gray-50/50" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Confirm New Password</label>
                                <input type="password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-gray-50/50" />
                            </div>
                            <button className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-sm shadow-md hover:bg-indigo-700 transition">Update Password</button>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 h-fit">
                            <h5 className="text-xs font-bold text-gray-900 mb-2">Password Requirements:</h5>
                            <ul className="text-[11px] text-gray-600 space-y-2 list-disc pl-4">
                                <li>Minimum 8 characters long</li>
                                <li>At least one uppercase and one lowercase letter</li>
                                <li>At least one number or special character</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Two-Factor Authentication */}
                <div className="space-y-4 pt-2">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-gray-400" /> Multi-Factor Authentication</div>
                        {twoFactorEnabled ?
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">2FA Enabled</span> :
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">2FA Off</span>
                        }
                    </h4>

                    <div className="flex flex-col md:flex-row items-center justify-between bg-white border border-gray-200 p-5 rounded-xl shadow-sm gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-gray-900">Authenticator App</h5>
                                <p className="text-xs text-gray-500 mt-1">Use an app like Google Authenticator or Authy to generate verification codes. Highly recommended for ERP users.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                            className={clsx("px-4 py-2 font-bold rounded-lg text-sm border shadow-sm transition whitespace-nowrap", twoFactorEnabled ? "text-rose-600 bg-white border-rose-200 hover:bg-rose-50" : "text-gray-700 bg-white border-gray-200 hover:bg-gray-50")}
                        >
                            {twoFactorEnabled ? "Disable 2FA" : "Set Up App"}
                        </button>
                    </div>
                </div>

                {/* Active Sessions */}
                <div className="space-y-4 pt-2">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2"><MonitorSmartphone className="w-4 h-4 text-gray-400" /> Active Sessions</h4>

                    <p className="text-xs text-gray-500 mb-4">You are currently logged in on these devices. If you don't recognize a device, revoke it immediately.</p>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                            <div className="flex items-start gap-3">
                                <Laptop className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-gray-900">Windows PC • Chrome</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Algiers, DZ • 192.168.1.1</p>
                                    <span className="text-[10px] font-bold text-emerald-600 mt-1 inline-block">Current Session</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white border border-gray-100 shadow-sm rounded-xl">
                            <div className="flex items-start gap-3">
                                <Smartphone className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-gray-900">iPhone 14 Pro • Safari</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Algiers, DZ • 10.0.0.1</p>
                                    <span className="text-[10px] text-gray-400 mt-1 inline-block">Active 2 days ago</span>
                                </div>
                            </div>
                            <button className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Revoke Session">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
