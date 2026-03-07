import React, { useState } from 'react';
import { Globe, Clock, Palette, Monitor } from 'lucide-react';
import clsx from 'clsx';

export default function SettingsGeneral() {
    const [theme, setTheme] = useState('system');

    return (
        <div className="p-8 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6">General Settings</h3>

            <div className="space-y-8 max-w-2xl">

                {/* Localization */}
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2"><Globe className="w-4 h-4 text-gray-400" /> Localization</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Language</label>
                            <select className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm">
                                <option value="en">English (US)</option>
                                <option value="fr">Français</option>
                                <option value="ar">العربية (Arabic)</option>
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">Changes internal label translations.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Timezone</label>
                            <select className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm">
                                <option value="UTC">UTC (Universal Coordinated Time)</option>
                                <option value="Africa/Algiers">Africa/Algiers (CET)</option>
                                <option value="America/New_York">America/New_York (EST)</option>
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">Affects order timestamps and dispatch logs.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Date Format</label>
                            <select className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm">
                                <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Currency Display</label>
                            <select className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm">
                                <option value="DZD">DZD (Algerian Dinar)</option>
                                <option value="USD">USD ($)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Appearance */}
                <div className="space-y-4 pt-4">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2"><Palette className="w-4 h-4 text-gray-400" /> Appearance</h4>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-3">Theme Preference</label>
                        <div className="flex gap-4">
                            <ThemeOption icon={Monitor} label="System" value="system" current={theme} onClick={() => setTheme('system')} />
                            <ThemeOption icon={Globe} label="Light" value="light" current={theme} onClick={() => setTheme('light')} />
                            <ThemeOption icon={Globe} label="Dark" value="dark" current={theme} onClick={() => setTheme('dark')} />
                        </div>
                    </div>
                </div>

                <div className="pt-8 flex justify-end gap-3">
                    <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md hover:bg-indigo-700">Save Preferences</button>
                </div>
            </div>
        </div>
    );
}

function ThemeOption({ icon: Icon, label, value, current, onClick }) {
    const isActive = value === current;
    return (
        <div
            onClick={onClick}
            className={clsx(
                "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-colors",
                isActive ? "border-indigo-600 bg-indigo-50" : "border-gray-100 bg-white hover:border-gray-300"
            )}
        >
            <Icon className={clsx("w-6 h-6", isActive ? "text-indigo-600" : "text-gray-400")} />
            <span className={clsx("text-xs font-bold", isActive ? "text-indigo-800" : "text-gray-600")}>{label}</span>
        </div>
    );
}
