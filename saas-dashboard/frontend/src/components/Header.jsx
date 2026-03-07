import { useContext, useState, useEffect, useRef } from 'react';
import {
    MessageSquare, Bell, ChevronDown, LogOut,
    User, Settings, Shield, Users, BellRing, HelpCircle,
    CheckCircle2
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

export default function Header() {
    const { user, logout } = useContext(AuthContext);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    // Setup an admin mock based on role
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    // Click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const handleSignOut = () => {
        if (window.confirm('Are you sure you want to sign out? Your session will be closed.')) {
            logout();
        }
    };

    return (
        <header className="h-[88px] px-8 flex flex-col justify-center">
            <div className="flex items-center justify-between">
                {/* Breadcrumb / Title */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Overview</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Key metrics of business performance</p>
                </div>

                {/* Global Controls */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-100">
                            <MessageSquare className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-100 relative">
                            <Bell className="w-5 h-5" />
                            {/* Notification Dot */}
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                    </div>

                    <div className="h-8 w-px bg-gray-200"></div>

                    {/* User Profile */}
                    <div className="relative" ref={dropdownRef}>
                        <div
                            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 py-1.5 px-2 rounded-lg transition-colors"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden font-bold text-indigo-700 border border-indigo-200 shadow-sm">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="flex flex-col mr-2">
                                <span className="text-sm font-bold text-gray-900 leading-tight">{user?.name || 'User'}</span>
                                <span className="text-[11px] text-gray-500 capitalize font-medium">{user?.role || 'user'} • {user?.department || 'Operations'}</span>
                            </div>
                            <ChevronDown className={clsx("w-4 h-4 text-gray-400 transition-transform", dropdownOpen && "rotate-180")} />
                        </div>

                        {/* Mega Dropdown */}
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">

                                {/* 1. Profile Header */}
                                <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-lg border border-indigo-200 shadow-sm shrink-0">
                                        {user?.name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="font-bold text-gray-900 truncate">{user?.name || 'User Account'}</h4>
                                        <p className="text-xs text-gray-500 truncate">{user?.email || 'user@company.com'}</p>
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={() => { setDropdownOpen(false); navigate('/settings/profile'); }} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors">View Profile</button>
                                            <button onClick={() => { setDropdownOpen(false); navigate('/settings/profile'); }} className="text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-2 py-1 rounded hover:bg-gray-50 transition-colors">Edit</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="max-h-[60vh] overflow-y-auto styled-scrollbar">
                                    {/* 2. Account Settings */}
                                    <div className="px-2 py-2">
                                        <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account Settings</p>
                                        <MenuAction onClick={() => { setDropdownOpen(false); navigate('/settings/general'); }} icon={Settings} label="General Settings" subtitle="Language, Timezone" />
                                        <MenuAction onClick={() => { setDropdownOpen(false); navigate('/settings/security'); }} icon={Shield} label="Security & Logins" subtitle="Password, 2FA, Sessions" badge="2FA Off" badgeColor="bg-amber-100 text-amber-700" />
                                    </div>

                                    <div className="h-px bg-gray-100 my-1 mx-4"></div>

                                    {/* 3. Roles & Permissions */}
                                    <div className="px-2 py-2">
                                        <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role & Access</p>
                                        <div className="px-3 py-2 flex items-start gap-3">
                                            <div className="mt-0.5 text-indigo-500"><CheckCircle2 className="w-4 h-4" /></div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900 capitalize leading-tight">Current: {user?.role || 'User'}</p>
                                                <p className="text-[10px] text-gray-500 mt-1">Access to Module layers granted via JWT Policy scope.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-gray-100 my-1 mx-4"></div>

                                    {/* 4. User Management (Admin Only) */}
                                    {isAdmin && (
                                        <>
                                            <div className="px-2 py-2">
                                                <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-indigo-500">Admin Tools</p>
                                                <MenuAction onClick={() => { setDropdownOpen(false); navigate('/settings/users'); }} icon={Users} label="User Management" subtitle="Add users, enforce roles & policies" />
                                            </div>
                                            <div className="h-px bg-gray-100 my-1 mx-4"></div>
                                        </>
                                    )}

                                    {/* 5. Notification Settings */}
                                    <div className="px-2 py-2">
                                        <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Preferences</p>
                                        <MenuAction onClick={() => { setDropdownOpen(false); navigate('/settings/alerts'); }} icon={BellRing} label="Notification Alerts" subtitle="Orders, Low Stock, Tasks" />
                                    </div>

                                    <div className="h-px bg-gray-100 my-1 mx-4"></div>

                                    {/* 6. Help & Support */}
                                    <div className="px-2 py-2">
                                        <MenuAction onClick={() => { setDropdownOpen(false); }} icon={HelpCircle} label="Help & Documentation" />
                                    </div>
                                </div>

                                {/* 7. Sign Out */}
                                <div className="p-2 border-t border-gray-100 bg-gray-50/50">
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full text-left px-3 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center gap-2 transition-colors border border-transparent hover:border-rose-100"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Secure Sign Out
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

function MenuAction({ icon: Icon, label, subtitle, badge, badgeColor, onClick }) {
    return (
        <button onClick={onClick} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex justify-between items-center group">
            <div className="flex items-center gap-3">
                <div className="text-gray-400 group-hover:text-indigo-500 transition-colors">
                    <Icon className="w-4 h-4" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{label}</p>
                    {subtitle && <p className="text-[10px] font-medium text-gray-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {badge && (
                <span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded", badgeColor)}>
                    {badge}
                </span>
            )}
        </button>
    );
}
