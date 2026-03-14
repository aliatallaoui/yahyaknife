import { useContext, useState, useEffect, useRef } from 'react';
import {
    Bell, ChevronDown, LogOut,
    Settings, Shield, Users, HelpCircle,
    Globe, Check, Menu, Sun, Moon, Monitor,
    Package, AlertTriangle, TrendingUp, UserPlus, Truck, X
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../utils/apiFetch';

const LANGUAGES = [
    { code: 'ar', label: 'العربية', flag: '🇩🇿', dir: 'rtl' },
    { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
    { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
];

// Mock notifications — replace with real API data later
const MOCK_NOTIFICATIONS = [
    { id: 1, type: 'order', icon: Package, color: 'text-blue-600 bg-blue-100', title: 'New order #1247', desc: 'Customer placed a new order worth 4,500 DA', time: '2m ago', unread: true },
    { id: 2, type: 'alert', icon: AlertTriangle, color: 'text-amber-600 bg-amber-100', title: 'Low stock alert', desc: 'Product "Knife Set Pro" is below reorder point', time: '15m ago', unread: true },
    { id: 3, type: 'shipping', icon: Truck, color: 'text-green-600 bg-green-100', title: 'Shipment delivered', desc: 'Order #1243 was delivered successfully', time: '1h ago', unread: true },
    { id: 4, type: 'sales', icon: TrendingUp, color: 'text-indigo-600 bg-indigo-100', title: 'Daily target reached', desc: 'Sales target of 50,000 DA achieved for today', time: '2h ago', unread: false },
    { id: 5, type: 'user', icon: UserPlus, color: 'text-purple-600 bg-purple-100', title: 'New user registered', desc: 'Ahmed B. joined as Call Center Agent', time: '3h ago', unread: false },
];

export default function Header({ setMobileMenuOpen }) {
    const { user, logout, updateContextPreferences, hasPermission } = useContext(AuthContext);
    const { theme, toggleTheme, effectiveMode } = useContext(ThemeContext);
    const { t, i18n } = useTranslation();
    const [profileOpen, setProfileOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
    const profileRef = useRef(null);
    const langRef = useRef(null);
    const notifRef = useRef(null);
    const navigate = useNavigate();

    const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];
    const unreadCount = notifications.filter(n => n.unread).length;

    useEffect(() => {
        const handler = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
            if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
            if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLangChange = async (code) => {
        i18n.changeLanguage(code);
        setLangOpen(false);
        if (user) {
            updateContextPreferences({ ...(user.preferences || {}), language: code });
        }
        if (user) {
            try {
                await apiFetch(`/api/users/preferences`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ language: code })
                });
            } catch { /* non-fatal */ }
        }
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    };

    const markOneRead = (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
    };

    const handleThemeToggle = () => {
        // Add transition class briefly for smooth theme switch
        document.documentElement.classList.add('theme-transitioning');
        toggleTheme();
        setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
    };

    const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

    return (
        <header className="h-[72px] px-3 sm:px-8 flex items-center border-b border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-40">
            <div className="flex items-center justify-between w-full">
                {/* Left: Page Title */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                        onClick={() => setMobileMenuOpen?.(true)}
                        title={t('header.openMenu', 'Open menu')}
                        className="p-1 -ms-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg md:hidden shrink-0"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="min-w-0 flex flex-col">
                        <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight leading-tight truncate">{t('dashboard.title', 'Dashboard')}</h1>
                        <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">{t('dashboard.subtitle', 'Key performance indicators')}</p>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">

                    {/* Theme Toggle */}
                    <button
                        onClick={handleThemeToggle}
                        title={t('header.theme', `Theme: ${theme}`)}
                        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 shrink-0"
                    >
                        <ThemeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    {/* Language Selector */}
                    <div className="relative" ref={langRef}>
                        <button
                            onClick={() => setLangOpen(!langOpen)}
                            className={clsx(
                                "flex items-center gap-1.5 sm:gap-2 h-9 px-2 sm:px-3 rounded-xl border font-semibold text-sm transition-all duration-200 shrink-0",
                                langOpen
                                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 shadow-sm"
                                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400"
                            )}
                        >
                            <Globe className="w-4 h-4" />
                            <span className="text-base leading-none">{currentLang.flag}</span>
                            <span className="hidden sm:block">{currentLang.label}</span>
                            <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform duration-200", langOpen && "rotate-180")} />
                        </button>

                        {langOpen && (
                            <div className="absolute end-0 mt-2 w-44 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 py-1.5">
                                {LANGUAGES.map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => handleLangChange(lang.code)}
                                        className={clsx(
                                            "w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-colors",
                                            lang.code === i18n.language
                                                ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                                                : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
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
                    <div className="hidden sm:block h-7 w-px bg-gray-200 dark:bg-gray-600 mx-1" />

                    {/* Notification Bell */}
                    <div className="relative" ref={notifRef}>
                        <button
                            onClick={() => setNotifOpen(!notifOpen)}
                            className={clsx(
                                "relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 shrink-0",
                                notifOpen
                                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                        >
                            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 end-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-gray-800 px-1">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Notification Dropdown */}
                        {notifOpen && (
                            <div className="absolute end-0 mt-2 w-[calc(100vw-2rem)] sm:w-[380px] max-w-[380px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Header */}
                                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t('notifications.title', 'Notifications')}</h3>
                                        {unreadCount > 0 && (
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                                {t('notifications.unread', '{{count}} unread').replace('{{count}}', unreadCount)}
                                            </p>
                                        )}
                                    </div>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                        >
                                            {t('notifications.markAllRead', 'Mark all read')}
                                        </button>
                                    )}
                                </div>

                                {/* Notification List */}
                                <div className="max-h-[360px] overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="py-12 text-center">
                                            <Bell className="w-8 h-8 text-gray-300 dark:text-gray-500 mx-auto mb-2" />
                                            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">{t('notifications.empty', 'No notifications yet')}</p>
                                        </div>
                                    ) : (
                                        notifications.map(notif => {
                                            const NotifIcon = notif.icon;
                                            return (
                                                <button
                                                    key={notif.id}
                                                    onClick={() => markOneRead(notif.id)}
                                                    className={clsx(
                                                        "w-full flex items-start gap-3 px-5 py-3.5 text-start transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700 last:border-0",
                                                        notif.unread && "bg-blue-50/30 dark:bg-blue-900/20"
                                                    )}
                                                >
                                                    <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", notif.color)}>
                                                        <NotifIcon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className={clsx("text-sm truncate", notif.unread ? "font-bold text-gray-900 dark:text-white" : "font-medium text-gray-700 dark:text-gray-200")}>
                                                                {notif.title}
                                                            </p>
                                                            {notif.unread && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                                                        </div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{notif.desc}</p>
                                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">{notif.time}</p>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="border-t border-gray-100 dark:border-gray-700 p-2">
                                    <button
                                        onClick={() => { navigate('/settings/alerts'); setNotifOpen(false); }}
                                        className="w-full py-2.5 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
                                    >
                                        {t('notifications.viewAll', 'View all notifications')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="hidden sm:block h-7 w-px bg-gray-200 dark:bg-gray-600 mx-1" />

                    {/* User Profile */}
                    <div className="relative" ref={profileRef}>
                        <button
                            onClick={() => setProfileOpen(!profileOpen)}
                            className={clsx(
                                "flex items-center gap-2 sm:gap-3 h-9 sm:h-10 pl-1.5 pr-1.5 sm:pl-2 sm:pr-3 rounded-xl border transition-all duration-200 shrink-0",
                                profileOpen ? "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 shadow-sm" : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                            )}
                        >
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-sm shrink-0">
                                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="flex-col items-start hidden sm:flex">
                                <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{user?.name || 'User'}</span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium capitalize">{user?.role || 'user'}</span>
                            </div>
                            <ChevronDown className={clsx("w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200 hidden sm:block", profileOpen && "rotate-180")} />
                        </button>

                        {profileOpen && (
                            <div className="absolute end-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Profile Header */}
                                <div className="px-2 py-1 flex flex-col gap-1 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/30">
                                    <div className="flex items-center gap-3 px-3 py-2">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-inner">
                                            {user?.name?.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white leading-none mb-1">{user?.name}</span>
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 truncate max-w-[140px] leading-none">{user?.email}</span>
                                        </div>
                                    </div>
                                    <div className="px-3 pb-2 flex">
                                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-full border border-indigo-100 dark:border-indigo-800">
                                            {user?.role === 'Super Admin' ? t('roles.superAdmin', 'Super Admin') : user?.role}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-1 space-y-0.5">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 px-3 pt-2 pb-1 uppercase tracking-widest">{t('dropdown.accountSettings', 'Account Settings')}</p>
                                    <ProfileMenuItem
                                        icon={Users}
                                        label={t('dropdown.myProfile', 'My Profile')}
                                        subtitle={t('dropdown.profileDesc', 'Personal details')}
                                        hoverColor="hover:bg-indigo-50 hover:text-indigo-600"
                                        iconHoverBg="group-hover:bg-indigo-100"
                                        onClick={() => { navigate('/settings/profile'); setProfileOpen(false); }}
                                    />
                                    <ProfileMenuItem
                                        icon={Settings}
                                        label={t('dropdown.generalPref', 'General Preferences')}
                                        subtitle={t('dropdown.generalDesc', 'Language, Theme & Timezone')}
                                        hoverColor="hover:bg-blue-50 hover:text-blue-600"
                                        iconHoverBg="group-hover:bg-blue-100"
                                        onClick={() => { navigate('/settings/general'); setProfileOpen(false); }}
                                    />
                                    <ProfileMenuItem
                                        icon={Shield}
                                        label={t('dropdown.security', 'Security & Access')}
                                        subtitle={t('dropdown.securityDesc', 'Passcodes & MFA')}
                                        hoverColor="hover:bg-orange-50 hover:text-orange-600"
                                        iconHoverBg="group-hover:bg-orange-100"
                                        onClick={() => { navigate('/settings/security'); setProfileOpen(false); }}
                                    />
                                </div>

                                {hasPermission('system.users') && (
                                <div className="p-1 border-t border-gray-100 dark:border-gray-700 mt-1">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 px-3 pt-2 pb-1 uppercase tracking-widest">{t('dropdown.orgRoles', 'Roles & Org')}</p>
                                    <div className="px-3 py-1 flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                        <span className="text-[11px] font-bold text-indigo-600">{user?.role}</span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium italic">{t('dropdown.activeSession', 'Active Session')}</span>
                                    </div>

                                    <ProfileMenuItem
                                        icon={Users}
                                        label={t('dropdown.manageUsers', 'Manage Users')}
                                        subtitle={t('dropdown.usersDesc', 'Roles & Permissions')}
                                        hoverColor="hover:bg-indigo-50 hover:text-indigo-600"
                                        iconHoverBg="group-hover:bg-indigo-100"
                                        onClick={() => { navigate('/settings/users'); setProfileOpen(false); }}
                                    />
                                </div>
                                )}

                                <div className="p-1 border-t border-gray-100 dark:border-gray-700 mt-1">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 px-3 pt-2 pb-1 uppercase tracking-widest">{t('dropdown.preferences', 'Preferences')}</p>
                                    <ProfileMenuItem
                                        icon={Bell}
                                        label={t('dropdown.notifications', 'Alert Notifications')}
                                        hoverColor="hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => { navigate('/settings/alerts'); setProfileOpen(false); }}
                                        compact
                                    />
                                    <ProfileMenuItem
                                        icon={HelpCircle}
                                        label={t('dropdown.help', 'Help & Docs')}
                                        hoverColor="hover:bg-gray-100 dark:hover:bg-gray-700"
                                        compact
                                    />
                                </div>

                                <div className="p-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 mt-2">
                                    <button
                                        onClick={logout}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-gray-800 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold rounded-xl hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white transition-all shadow-sm active:scale-95 group"
                                    >
                                        <LogOut className="w-4 h-4 rotate-180 group-hover:translate-x-1 duration-200" />
                                        {t('dropdown.signOut', 'Sign Out')}
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

function ProfileMenuItem({ icon: Icon, label, subtitle, hoverColor, iconHoverBg, onClick, compact }) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "w-full flex items-center gap-3 px-3 rounded-lg transition-colors group",
                compact ? "py-2 text-sm font-bold text-gray-600 dark:text-gray-300" : "py-2 text-sm font-bold text-gray-600 dark:text-gray-300",
                hoverColor
            )}
        >
            <div className={clsx(
                "p-1.5 bg-gray-50 dark:bg-gray-700 rounded-md transition-colors shrink-0",
                iconHoverBg
            )}>
                <Icon className="w-4 h-4" />
            </div>
            {subtitle ? (
                <div className="flex flex-col items-start translate-y-[-1px]">
                    <span>{label}</span>
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 leading-none">{subtitle}</span>
                </div>
            ) : (
                <span>{label}</span>
            )}
        </button>
    );
}
