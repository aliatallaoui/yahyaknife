import React, { useState, useContext, useEffect } from 'react';
import { Globe, Clock, Palette, Monitor, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function SettingsGeneral() {
    const { user, token, updateContextPreferences } = useContext(AuthContext);
    const { t, i18n } = useTranslation('settingsGeneral');
    const isAr = i18n.language === 'ar';

    // Form Local State
    const [language, setLanguage] = useState('ar');
    const [timezone, setTimezone] = useState('UTC');
    const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
    const [currency, setCurrency] = useState('DZD');
    const [theme, setTheme] = useState('system');

    // UI Feedback
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Sync from global user state on mount/update
    useEffect(() => {
        if (user?.preferences) {
            setLanguage(user.preferences.language || 'en');
            setTimezone(user.preferences.timezone || 'UTC');
            setDateFormat(user.preferences.dateFormat || 'DD/MM/YYYY');
            setCurrency(user.preferences.currency || 'DZD');
            setTheme(user.preferences.theme || 'system');
        }
    }, [user]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        try {
            const res = await fetch('http://localhost:5000/api/users/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    language,
                    timezone,
                    dateFormat,
                    currency,
                    theme
                })
            });

            if (res.ok) {
                const data = await res.json();
                updateContextPreferences(data.preferences);
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                console.error("Failed to save preferences");
            }
        } catch (error) {
            console.error("Error saving preferences:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-8 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6">{t('title')}</h3>

            <div className="space-y-8 max-w-2xl">

                {/* Localization */}
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2"><Globe className="w-4 h-4 text-gray-400" /> {t('localization')}</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">{t('language')}</label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"
                            >
                                <option value="en">English (US)</option>
                                <option value="fr">Français</option>
                                <option value="ar">العربية (Arabic)</option>
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">{t('langDesc')}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {t('timezone')}</label>
                            <select
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"
                            >
                                <option value="UTC">UTC (Universal Coordinated Time)</option>
                                <option value="Africa/Algiers">Africa/Algiers (CET)</option>
                                <option value="America/New_York">America/New_York (EST)</option>
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">{t('tzDesc')}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">{t('dateFormat')}</label>
                            <select
                                value={dateFormat}
                                onChange={(e) => setDateFormat(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"
                            >
                                <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">{t('currency')}</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"
                            >
                                <option value="DZD">DZD (Algerian Dinar)</option>
                                <option value="USD">USD ($)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Appearance */}
                <div className="space-y-4 pt-4">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2"><Palette className="w-4 h-4 text-gray-400" /> {t('appearance')}</h4>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-3">{t('themePref')}</label>
                        <div className="flex gap-4">
                            <ThemeOption icon={Monitor} label={t('themeSystem')} value="system" current={theme} onClick={() => setTheme('system')} />
                            <ThemeOption icon={Globe} label={t('themeLight')} value="light" current={theme} onClick={() => setTheme('light')} />
                            <ThemeOption icon={Globe} label={t('themeDark')} value="dark" current={theme} onClick={() => setTheme('dark')} />
                        </div>
                    </div>
                </div>

                <div className={clsx("pt-8 flex gap-3 items-center", isAr ? "justify-start" : "justify-end")}>
                    {saveSuccess && (
                        <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5 animate-in slide-in-from-end-2">
                            <CheckCircle2 className="w-4 h-4" /> {t('saved')}
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isSaving ? t('saving') : t('save')}
                    </button>
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
