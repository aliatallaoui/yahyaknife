import { useContext, useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Bell, ChevronDown, LogOut,
    Settings, Shield, Users, BellRing, HelpCircle,
    CheckCircle2, Globe, Check, Menu
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
    { code: 'ar', label: 'العربية', flag: '🇩🇿', dir: 'rtl' },
    { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
];

export default function Header({ setMobileMenuOpen }) {
    const { user, token, logout, updateContextPreferences } = useContext(AuthContext);
    const { t, i18n } = useTranslation();
    const [profileOpen, setProfileOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const profileRef = useRef(null);
    const langRef = useRef(null);
    const navigate = useNavigate();

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'Super Admin';
    const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

    useEffect(() => {
        const handler = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
            if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSignOut = () => {
        if (window.confirm('Are you sure you want to sign out?')) logout();
    };

    const handleLangChange = async (code) => {
        // 1. Update UI and LocalStorage instantly
        i18n.changeLanguage(code);
        setLangOpen(false);

        // 2. Optimistic Update of Context (prevents jumping back on refresh if token loads quickly)
        if (user) {
            updateContextPreferences({
                ...(user.preferences || {}),
                language: code
            });
        }

        // 3. Sync to backend
        if (user && token) {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/preferences`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        language: code
                    })
                });

                if (!res.ok) {
                    console.error("Backend failed to save language preference");
                }
            } catch (error) {
                console.error("Failed to sync language preference:", error);
            }
        }
    };

    return (
        <header className="h-[72px] px-3 sm:px-8 flex items-center border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
            <div className="flex items-center justify-between w-full">
                {/* Left: Page Title */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                        onClick={() => setMobileMenuOpen?.(true)}
                        className="p-1 -ms-1 text-gray-600 hover:bg-gray-100 rounded-lg md:hidden shrink-0"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="min-w-0 flex flex-col">
                        <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight leading-tight truncate">{t('dashboard.title', 'لوحة التحكم')}</h1>
                        <p className="hidden sm:block text-xs text-gray-500 font-medium mt-0.5 truncate">{t('dashboard.subtitle', 'المؤشرات الرئيسية للأداء')}</p>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">

                    {/* Language Selector */}
                    <div className="relative" ref={langRef}>
                        <button
                            onClick={() => setLangOpen(!langOpen)}
                            className={clsx(
                                "flex items-center gap-1.5 sm:gap-2 h-9 px-2 sm:px-3 rounded-xl border font-semibold text-sm transition-all duration-200 shrink-0",
                                langOpen
                                    ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                                    : "bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-700"
                            )}
                        >
                            <Globe className="w-4 h-4" />
                            <span className="text-base leading-none">{currentLang.flag}</span>
                            <span className="hidden sm:block">{currentLang.label}</span>
                            <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform duration-200", langOpen && "rotate-180")} />
                        </button>

                        {langOpen && (
                            <div className="absolute end-0 mt-2 w-44 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 py-1.5">
                                {LANGUAGES.map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => handleLangChange(lang.code)}
                                        className={clsx(
                                            "w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-colors",
                                            lang.code === i18n.language
                                                ? "text-blue-700 bg-blue-50"
                                                : "text-gray-700 hover:bg-gray-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">{lang.flag}</span>
                                            <span>{lang.label}</span>
                                        </div>
                                        {lang.code === i18n.language && <Check className="w-4 h-4 text-blue-600" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="hidden sm:block h-7 w-px bg-gray-200 mx-1" />

                    {/* Notification Bell */}
                    <button className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 shrink-0">
                        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="absolute top-2 end-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                    </button>

                    {/* Messages */}
                    <button className="hidden sm:flex w-10 h-10 items-center justify-center rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 shrink-0">
                        <MessageSquare className="w-5 h-5" />
                    </button>

                    {/* Divider */}
                    <div className="hidden sm:block h-7 w-px bg-gray-200 mx-1" />

                    {/* User Profile */}
                    <div className="relative" ref={profileRef}>
                        <button
                            onClick={() => setProfileOpen(!profileOpen)}
                            className={clsx(
                                "flex items-center gap-2 sm:gap-3 h-9 sm:h-10 pl-1.5 pr-1.5 sm:pl-2 sm:pr-3 rounded-xl border transition-all duration-200 shrink-0",
                                profileOpen ? "bg-gray-50 border-gray-200 shadow-sm" : "bg-transparent border-transparent hover:bg-gray-50 hover:border-gray-200"
                            )}
                        >
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-sm shrink-0">
                                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="flex flex-col items-start hidden sm:flex">
                                <span className="text-sm font-bold text-gray-900 leading-tight">{user?.name || 'User'}</span>
                                <span className="text-[10px] text-gray-500 font-medium capitalize">{user?.role || 'user'}</span>
                            </div>
                            <ChevronDown className={clsx("w-3.5 h-3.5 text-gray-400 transition-transform duration-200 hidden sm:block", profileOpen && "rotate-180")} />
                        </button>

                        {profileOpen && (
                            <div className="absolute end-0 mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Profile Header */}
                                <div className="px-2 py-1 flex flex-col gap-1 border-b border-gray-100 bg-gray-50/30">
                                    <div className="flex items-center gap-3 px-3 py-2">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-inner">
                                            {user?.name?.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-900 leading-none mb-1">{user?.name}</span>
                                            <span className="text-[10px] font-bold text-gray-400 truncate max-w-[140px] leading-none">{user?.email}</span>
                                        </div>
                                    </div>
                                    <div className="px-3 pb-2 flex">
                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full border border-indigo-100">
                                            {user?.role === 'Super Admin' ? t('roles.superAdmin', 'Super Admin') : user?.role}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-1 space-y-0.5">
                                    <p className="text-[10px] font-bold text-gray-400 px-3 pt-2 pb-1 uppercase tracking-widest">{t('dropdown.accountSettings', 'Account Settings')}</p>
                                    <button onClick={() => { navigate('/settings/profile'); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors group">
                                        <div className="p-1.5 bg-gray-50 group-hover:bg-indigo-100 rounded-md transition-colors">
                                            <Users className="w-4 h-4" /> {/* Changed from User to Users based on the provided snippet, assuming it's a typo in the instruction and should be User */}
                                        </div>
                                        <div className="flex flex-col items-start translate-y-[-1px]">
                                            <span>{t('dropdown.myProfile', 'My Profile')}</span>
                                            <span className="text-[10px] font-medium text-gray-400 leading-none">{t('dropdown.profileDesc', 'Personal details')}</span>
                                        </div>
                                    </button>

                                    <button onClick={() => { navigate('/settings/general'); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors group">
                                        <div className="p-1.5 bg-gray-50 group-hover:bg-blue-100 rounded-md transition-colors">
                                            <Settings className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col items-start translate-y-[-1px]">
                                            <span>{t('dropdown.generalPref', 'General Preferences')}</span>
                                            <span className="text-[10px] font-medium text-gray-400 leading-none">{t('dropdown.generalDesc', 'Language & Timezone')}</span>
                                        </div>
                                    </button>

                                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors group">
                                        <div className="p-1.5 bg-gray-50 group-hover:bg-orange-100 rounded-md transition-colors">
                                            <Shield className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col items-start translate-y-[-1px]">
                                            <span>{t('dropdown.security', 'Security & Access')}</span>
                                            <span className="text-[10px] font-medium text-gray-400 leading-none">{t('dropdown.securityDesc', 'Passcodes & MFA')}</span>
                                        </div>
                                        <span className="ms-auto text-[9px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">{t('dropdown.new', 'NEW')}</span>
                                    </button>
                                </div>

                                <div className="p-1 border-t border-gray-100 mt-1">
                                    <p className="text-[10px] font-bold text-gray-400 px-3 pt-2 pb-1 uppercase tracking-widest">{t('dropdown.orgRoles', 'Roles & Org')}</p>
                                    <div className="px-3 py-1 flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                        <span className="text-[11px] font-bold text-indigo-600">{user?.role}</span>
                                        <span className="text-[10px] text-gray-400 font-medium italic">{t('dropdown.activeSession', 'JWT Auth Active')}</span>
                                    </div>

                                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors group">
                                        <div className="p-1.5 bg-gray-50 group-hover:bg-indigo-100 rounded-md transition-colors text-indigo-400">
                                            <Users className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col items-start translate-y-[-1px]">
                                            <span>{t('dropdown.manageUsers', 'Manage Users')}</span>
                                            <span className="text-[10px] font-medium text-gray-400 leading-none">{t('dropdown.usersDesc', 'Roles & Permissions')}</span>
                                        </div>
                                    </button>
                                </div>

                                <div className="p-1 border-t border-gray-100 mt-1">
                                    <p className="text-[10px] font-bold text-gray-400 px-3 pt-2 pb-1 uppercase tracking-widest">{t('dropdown.preferences', 'Preferences')}</p>
                                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group">
                                        <Bell className="w-4 h-4 text-gray-400" />
                                        <span>{t('dropdown.notifications', 'Alert Notifications')}</span>
                                    </button>
                                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group">
                                        <HelpCircle className="w-4 h-4 text-gray-400" />
                                        <span>{t('dropdown.help', 'Help & Docs')}</span>
                                    </button>
                                </div>

                                <div className="p-2 bg-gray-50 border-t border-gray-100 mt-2">
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-rose-100 text-rose-600 font-bold rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95 group"
                                    >
                                        <LogOut className="w-4 h-4 rotate-180 group-hover:translate-x-1 duration-200" />
                                        {t('dropdown.signOut', 'Secure Sign Out')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

function MenuSection({ label, labelColor = "text-gray-400", children }) {
    return (
        <div className="px-2 py-1">
            <p className={clsx("px-3 py-1 text-[10px] font-bold uppercase tracking-wider mb-0.5", labelColor)}>{label}</p>
            {children}
        </div>
    );
}

function MenuAction({ icon: Icon, label, subtitle, badge, badgeColor, onClick }) {
    return (
        <button onClick={onClick} className="w-full text-start px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors flex justify-between items-center group">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-indigo-50 flex items-center justify-center text-gray-400 group-hover:text-indigo-600 transition-colors shrink-0">
                    <Icon className="w-4 h-4" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{label}</p>
                    {subtitle && <p className="text-[10px] font-medium text-gray-400">{subtitle}</p>}
                </div>
            </div>
            {badge && <span className={clsx("text-[9px] font-bold px-2 py-1 rounded-full", badgeColor)}>{badge}</span>}
        </button>
    );
}
