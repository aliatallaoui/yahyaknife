import { useContext, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    Search, Grid, DollarSign, ShoppingCart, Archive,
    Users, UserCheck, MessageSquare, Briefcase,
    ListTodo, Flag, HelpCircle, Settings, LogOut, ChevronDown,
    LayoutDashboard, ShoppingBag, Box, LineChart, FileText, RefreshCw, Layers, PackageOpen, Truck
} from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';

export default function Sidebar() {
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);

    // Helper to determine if a route is active
    const isActive = (path) => {
        if (path === '/' && location.pathname !== '/') return false;
        return location.pathname.startsWith(path);
    };

    const hasAccess = (allowedRoles) => {
        if (!user) return false;
        if (user.role === 'Super Admin') return true;
        return allowedRoles.includes(user.role);
    };

    return (
        <div className="flex bg-white h-screen border-r border-gray-100 fixed left-0 top-0 z-50">

            {/* 1) Mini Left Strip */}
            <div className="w-[80px] flex flex-col items-center py-6 border-r border-gray-100 flex-shrink-0 bg-gray-50/20">
                {/* Brand / Logo */}
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white mb-8 shadow-sm cursor-pointer">
                    <Layers className="w-5 h-5" />
                </div>

                {/* Primary App Icons */}
                <div className="flex flex-col gap-4 flex-1 items-center w-full">
                    <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white cursor-pointer shadow-md">
                        <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-900 cursor-pointer transition-colors">
                        <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-900 cursor-pointer transition-colors">
                        <Archive className="w-5 h-5" />
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-900 cursor-pointer transition-colors">
                        <Box className="w-5 h-5" />
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-900 cursor-pointer transition-colors">
                        <LineChart className="w-5 h-5" />
                    </div>
                </div>

                {/* Bottom Utils */}
                <div className="flex flex-col gap-4 mt-auto items-center w-full">
                    <div className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-900 cursor-pointer transition-colors">
                        <HelpCircle className="w-5 h-5" />
                    </div>
                    <NavLink to="/settings/users" className={({ isActive }) => clsx("w-10 h-10 flex items-center justify-center cursor-pointer transition-colors", isActive ? "text-blue-600 bg-blue-50 rounded-xl" : "text-gray-400 hover:text-gray-900")}>
                        <Settings className="w-5 h-5" />
                    </NavLink>
                    <div
                        onClick={logout}
                        className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 cursor-pointer transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* 2) Main Navigation Drawer */}
            <div className="w-[240px] flex flex-col pt-6 pb-4 bg-white/50">
                {/* Search */}
                <div className="px-5 mb-6">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search Menu"
                            className="w-full bg-white border border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none rounded-lg py-2 pl-9 pr-4 text-sm font-medium transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
                    <div className="mb-2">
                        {/* Active Overview or Parent Link */}
                        <NavLink to="/" end className={({ isActive }) => clsx("flex items-center gap-3 px-3 py-2 rounded-lg font-bold transition-colors mb-2 text-sm", isActive ? "bg-blue-50/80 text-blue-600" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
                            <LayoutDashboard className="w-4 h-4" />
                            <span>Overview</span>
                        </NavLink>
                        {/* Overview Sub-items */}
                        <div className="flex flex-col ml-3 py-1 gap-0.5 mb-4">
                            {hasAccess(['Finance Controller', 'Super Admin']) && (
                                <NavLink to="/financial" className={({ isActive }) => clsx("flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                    <FileText className={clsx("w-4 h-4", isActive ? "text-blue-500" : "text-gray-400")} />
                                    <span>Financial</span>
                                </NavLink>
                            )}
                            {hasAccess(['Finance Controller', 'Sales Representative', 'Super Admin']) && (
                                <NavLink to="/sales" className={({ isActive }) => clsx("flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                    <RefreshCw className={clsx("w-4 h-4", isActive ? "text-blue-500" : "text-gray-400")} />
                                    <span>Sales</span>
                                </NavLink>
                            )}
                            {hasAccess(['Finance Controller', 'Warehouse Supervisor', 'Production Lead', 'Sales Representative', 'Super Admin']) && (
                                <NavLink to="/inventory" className={({ isActive }) => clsx("flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                    <Box className={clsx("w-4 h-4", isActive ? "text-blue-500" : "text-gray-400")} />
                                    <span>Inventory Tracking</span>
                                </NavLink>
                            )}
                            {hasAccess(['Warehouse Supervisor', 'Production Lead', 'Super Admin']) && (
                                <NavLink to="/warehouses" className={({ isActive }) => clsx("flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                    <Layers className={clsx("w-4 h-4", isActive ? "text-blue-500" : "text-gray-400")} />
                                    <span>Warehouses & Logistics</span>
                                </NavLink>
                            )}
                            {hasAccess(['Warehouse Supervisor', 'Sales Representative', 'Super Admin']) && (
                                <NavLink to="/couriers" className={({ isActive }) => clsx("flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                    <Truck className={clsx("w-4 h-4", isActive ? "text-blue-500" : "text-gray-400")} />
                                    <span>Dispatch & Couriers</span>
                                </NavLink>
                            )}
                        </div>
                    </div>

                    {hasAccess(['Finance Controller', 'Sales Representative', 'Super Admin']) && (
                        <NavSection title="Customer Insight" icon={Users}>
                            <NavLink to="/customers" className={({ isActive }) => clsx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                Acquisition & Feedback
                            </NavLink>
                            <NavLink to="/support" className={({ isActive }) => clsx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                Support & RMAs
                            </NavLink>
                        </NavSection>
                    )}

                    {hasAccess(['Production Lead', 'Warehouse Supervisor', 'Super Admin']) && (
                        <NavSection title="Manufacturing Floor" icon={PackageOpen}>
                            <NavLink to="/production" className={({ isActive }) => clsx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                Production & BOMs
                            </NavLink>
                            <NavLink to="/procurement" className={({ isActive }) => clsx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                Procurement / Suppy
                            </NavLink>
                        </NavSection>
                    )}

                    {hasAccess(['HR Manager', 'Super Admin']) && (
                        <NavSection title="HR Snapshot" icon={Briefcase}>
                            <NavLink to="/hr" end className={({ isActive }) => clsx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                Directory & Leave
                            </NavLink>
                            <NavLink to="/hr/attendance" className={({ isActive }) => clsx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                Daily Pointage
                            </NavLink>
                            <NavLink to="/hr/payroll" className={({ isActive }) => clsx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                Monthly Payroll
                            </NavLink>
                            <NavLink to="/hr/reports" className={({ isActive }) => clsx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                Reports & Data
                            </NavLink>
                        </NavSection>
                    )}

                    {hasAccess(['Production Lead', 'Super Admin']) && (
                        <NavSection title="Project Status" icon={Flag}>
                            <NavLink to="/projects" className={({ isActive }) => clsx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                Active Portfolio
                            </NavLink>
                            <NavLink to="/projects/tasks" className={({ isActive }) => clsx("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", isActive ? "text-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50")}>
                                Global Task Board
                            </NavLink>
                        </NavSection>
                    )}
                </div>
            </div>
        </div>
    );
}

function NavSection({ title, icon: Icon, children }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="mb-2">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg font-bold cursor-pointer transition-colors text-sm"
            >
                <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-gray-400" />
                    <span>{title}</span>
                </div>
                <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform text-gray-400", isOpen && "rotate-180")} />
            </div>
            {isOpen && (
                <div className="flex flex-col ml-9 py-1 gap-1 pl-2 mt-1 mb-2 border-l border-gray-100">
                    {children}
                </div>
            )}
        </div>
    );
}
