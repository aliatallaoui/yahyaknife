import { useContext, useState } from 'react';
import { MessageSquare, Bell, ChevronDown, LogOut } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

export default function Header() {
    const { user, logout } = useContext(AuthContext);
    const [dropdownOpen, setDropdownOpen] = useState(false);
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
                    <div className="relative">
                        <div
                            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 py-1.5 px-2 rounded-lg transition-colors"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden font-bold text-blue-600">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="flex flex-col mr-2">
                                <span className="text-sm font-bold text-gray-900 leading-tight">{user?.name || 'User'}</span>
                                <span className="text-xs text-gray-500 capitalize">{user?.role || 'user'}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </div>

                        {/* Dropdown */}
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-lg shadow-lg py-1 z-50">
                                <button
                                    onClick={logout}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
