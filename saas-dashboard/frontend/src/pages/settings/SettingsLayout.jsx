import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { User, Settings, Shield, Bell, Users, Truck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

export default function SettingsLayout() {
    const { t, i18n } = useTranslation('settingsTab');
    const isAr = i18n.language === 'ar';
    const navigate = useNavigate();

    const tabs = [
        { name: t('tabProfile'), path: '/settings/profile', icon: User },
        { name: t('tabGeneral'), path: '/settings/general', icon: Settings },
        { name: t('tabSecurity'), path: '/settings/security', icon: Shield },
        { name: t('tabAlerts'), path: '/settings/alerts', icon: Bell },
        { name: t('tabCouriers', 'Courier Integration'), path: '/settings/couriers', icon: Truck, adminOnly: true },
        { name: t('tabUsers'), path: '/settings/users', icon: Users, adminOnly: true },
    ];

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-gray-200 pb-5">
                <button
                    onClick={() => navigate('/')}
                    className={clsx("p-2 bg-white border border-gray-200 text-gray-400 hover:text-gray-900 rounded-lg shadow-sm transition-colors", isAr ? "scale-x-[-1]" : "")}
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('title')}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">

                {/* Settings Sidebar */}
                <div className="w-full md:w-64 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sticky top-6">
                    <nav className="space-y-1">
                        {tabs.map(tab => (
                            <NavLink
                                key={tab.name}
                                to={tab.path}
                                className={({ isActive }) => clsx(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                                    isActive ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.name}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                {/* Settings Content Area */}
                <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[500px]">
                    <Outlet />
                </div>

            </div>
        </div>
    );
}
