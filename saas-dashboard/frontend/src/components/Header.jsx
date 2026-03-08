import { useContext, useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Bell, ChevronDown, LogOut,
    Settings, Shield, Users, BellRing, HelpCircle,
    CheckCircle2, Globe, Check
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
    { code: 'ar', label: 'العربية', flag: '🇩🇿', dir: 'rtl' },
    { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
];

export default function Header() {
    const { user, logout } = useContext(AuthContext);
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

    const handleLangChange = (code) => {
        i18n.changeLanguage(code);
        setLangOpen(false);
    };

    return (
        <header className="h-[72px] px-8 flex items-center border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
            <div className="flex items-center justify-between w-full">
                {/* Left: Page Title */}
                <div>
                    <h1 className="text-xl font-black text-gray-900 tracking-tight leading-tight">{t('dashboard.title', 'لوحة التحكم')}</h1>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">{t('dashboard.subtitle', 'المؤشرات الرئيسية للأداء')}</p>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-2">

                    {/* Language Selector */}
                    <div className="relative" ref={langRef}>
                        <button
                            onClick={() => setLangOpen(!langOpen)}
                            className={clsx(
                                "flex items-center gap-2 h-9 px-3 rounded-xl border font-semibold text-sm transition-all duration-200",
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
                    <div className="h-7 w-px bg-gray-200 mx-1" />

                    {/* Notification Bell */}
                    <button className="relative w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-2 end-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                    </button>

                    {/* Messages */}
                    <button className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200">
                        <MessageSquare className="w-5 h-5" />
                    </button>

                    {/* Divider */}
                    <div className="h-7 w-px bg-gray-200 mx-1" />

                    {/* User Profile */}
                    <div className="relative" ref={profileRef}>
                        <button
                            onClick={() => setProfileOpen(!profileOpen)}
                            className={clsx(
                                "flex items-center gap-3 h-10 pl-2 pr-3 rounded-xl border transition-all duration-200",
                                profileOpen ? "bg-gray-50 border-gray-200 shadow-sm" : "bg-transparent border-transparent hover:bg-gray-50 hover:border-gray-200"
                            )}
                        >
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-sm">
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
                                <div className="p-4 flex items-center gap-3 border-b border-gray-100 bg-gradient-to-br from-indigo-50/50 to-blue-50/30">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-bold text-white text-lg shadow-md">
                                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <h4 className="font-bold text-gray-900 truncate">{user?.name || 'User Account'}</h4>
                                        <p className="text-xs text-gray-500 truncate">{user?.email || 'user@company.com'}</p>
                                        <div className="mt-2 flex gap-1.5">
                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full capitalize">{user?.role || 'User'}</span>
                                            {user?.department && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{user?.department}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="py-2">
                                    <MenuSection label={t('header.sectionAccountSettings', 'Account Settings')}>
                                        <MenuAction onClick={() => { setProfileOpen(false); navigate('/settings/general'); }} icon={Settings} label={t('header.itemGeneralSettings', 'General Settings')} subtitle={t('header.itemGeneralSettingsSub', 'Language, Timezone')} />
                                        <MenuAction onClick={() => { setProfileOpen(false); navigate('/settings/security'); }} icon={Shield} label={t('header.itemSecurity', 'Security & Logins')} subtitle={t('header.itemSecuritySub', 'Password, 2FA')} badge={t('header.item2FAOff', '2FA Off')} badgeColor="bg-amber-100 text-amber-700" />
                                    </MenuSection>

                                    <div className="h-px bg-gray-100 mx-3 my-1" />

                                    <MenuSection label={t('header.sectionRoleAccess', 'Role & Access')}>
                                        <div className="px-3 py-2 flex items-start gap-3">
                                            <div className="mt-0.5 text-blue-500 shrink-0"><CheckCircle2 className="w-4 h-4" /></div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900 capitalize">{user?.role || 'User'}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{t('header.itemRoleAccessSub', 'Access granted via JWT scope policy')}</p>
                                            </div>
                                        </div>
                                    </MenuSection>

                                    {isAdmin && (
                                        <>
                                            <div className="h-px bg-gray-100 mx-3 my-1" />
                                            <MenuSection label={t('header.sectionAdminTools', 'Admin Tools')} labelColor="text-indigo-600">
                                                <MenuAction onClick={() => { setProfileOpen(false); navigate('/settings/users'); }} icon={Users} label={t('header.itemUserManagement', 'User Management')} subtitle={t('header.itemUserManagementSub', 'Roles, permissions & policies')} />
                                            </MenuSection>
                                        </>
                                    )}

                                    <div className="h-px bg-gray-100 mx-3 my-1" />

                                    <MenuSection label={t('header.sectionPreferences', 'Preferences')}>
                                        <MenuAction onClick={() => { setProfileOpen(false); navigate('/settings/alerts'); }} icon={BellRing} label={t('header.itemNotifications', 'Notification Alerts')} subtitle={t('header.itemNotificationsSub', 'Orders, Low Stock, Tasks')} />
                                        <MenuAction onClick={() => { setProfileOpen(false); }} icon={HelpCircle} label={t('header.itemHelp', 'Help & Documentation')} />
                                    </MenuSection>
                                </div>

                                {/* Sign Out */}
                                <div className="p-2 border-t border-gray-100">
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 border border-transparent hover:border-rose-100"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        {t('header.signout', 'تسجيل الخروج')}
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
