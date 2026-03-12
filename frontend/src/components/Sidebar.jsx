import React, { useContext, useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Search, LayoutDashboard, Wallet, Box, Truck, Factory, ShoppingCart, ShoppingBag,
    Users, Briefcase, Settings as Gear, HelpCircle, LogOut, PanelLeftClose, PanelLeftOpen,
    Star, Clock, ChevronDown, X, Layers, UserCircle, Hammer, PhoneCall, Headset, AlertTriangle
} from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';

function SidebarItem({ icon: Icon, label, path, isCollapsed, onClick, onFavorite, isFavorite, itemIcon: ItemIcon }) {
    const location = useLocation();
    const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    const RenderIcon = ItemIcon || Icon;

    return (
        <div className="group relative flex items-center px-2 mb-1">
            <NavLink
                to={path}
                onClick={onClick}
                title={isCollapsed ? label : undefined}
                className={clsx(
                    "flex-1 flex items-center h-[44px] transition-all duration-300 rounded-2xl relative",
                    isCollapsed ? "justify-center w-12 h-12" : "px-3",
                    isActive
                        ? "bg-[#F0F7FF] text-blue-600 shadow-sm border border-blue-100/50"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
            >
                <div className={clsx(
                    "shrink-0 flex items-center justify-center rounded-xl transition-all duration-300",
                    isCollapsed ? "w-10 h-10" : "w-9 h-9",
                    isActive
                        ? "bg-blue-100/80 text-blue-600 shadow-inner"
                        : "bg-gray-100/50 text-gray-400 group-hover:bg-gray-100 group-hover:text-gray-600"
                )}>
                    {RenderIcon && <RenderIcon className={clsx(
                        isCollapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
                        isActive && "stroke-[2.5px]"
                    )} />}
                </div>

                {!isCollapsed && (
                    <span className={clsx(
                        "ms-3 truncate text-[14px] tracking-tight transition-all",
                        isActive ? "font-bold text-blue-700" : "font-medium text-gray-600"
                    )}>{label}</span>
                )}
            </NavLink>

            {!isCollapsed && onFavorite && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onFavorite(path, label);
                    }}
                    className={clsx(
                        "absolute end-6 p-1.5 rounded-md transition-all z-10",
                        isFavorite
                            ? "text-yellow-500 opacity-100"
                            : "text-gray-300 opacity-0 group-hover:opacity-100 hover:text-yellow-400 hover:bg-gray-100"
                    )}
                >
                    <Star className={clsx("w-3.5 h-3.5", isFavorite && "fill-current")} />
                </button>
            )}
        </div>
    );
}

function SidebarDomain({ title, icon: Icon, items, isCollapsed, searchTerm, onClick, onFavorite, favorites, isOpen, onToggle }) {
    const location = useLocation();

    // Check if domain is active based on children paths
    const isActive = items.some(item =>
        item.path === '/' ? location.pathname === '/' : (location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
    );

    const filteredItems = useMemo(() => {
        if (!searchTerm) return items;
        return items.filter(item =>
            item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [items, searchTerm, title]);

    if (filteredItems.length === 0 && searchTerm) return null;

    if (isCollapsed) {
        const firstPath = items[0]?.path || '/';
        const isDomainActive = isActive;

        return (
            <NavLink
                to={firstPath}
                title={title}
                onClick={onClick}
                className={clsx(
                    "flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all duration-200 group relative mb-2",
                    isDomainActive
                        ? "bg-[#EEF4FF] text-blue-600 border border-blue-100 shadow-sm"
                        : "text-gray-500 hover:bg-[#F6F8FC] hover:text-gray-900"
                )}
            >
                {/* Visual indicator for active domain in collapsed mode */}
                {isDomainActive && (
                    <div className="absolute start-[-4px] top-1.5 bottom-1.5 w-[4px] bg-blue-600 rounded-e-md shadow-sm" />
                )}
                <Icon className={clsx("w-5 h-5 shrink-0", isDomainActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600")} />
            </NavLink>
        );
    }

    return (
        <div className="mb-2 px-2">
            {/* Domain Header */}
            <button
                onClick={onToggle}
                className={clsx(
                    "w-full flex items-center justify-between h-[44px] px-3 group transition-all rounded-2xl mb-1",
                    isActive ? "text-blue-600 bg-blue-50/30" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                )}
            >
                <div className="flex items-center gap-2">
                    <div className={clsx(
                        "w-9 h-9 shrink-0 flex items-center justify-center rounded-xl transition-all duration-300",
                        isActive
                            ? "bg-blue-100/80 text-blue-600 shadow-inner"
                            : "bg-gray-100/50 text-gray-400 group-hover:bg-gray-100 group-hover:text-gray-600"
                    )}>
                        <Icon className={clsx("w-[18px] h-[18px] transition-colors", isActive && "stroke-[2.5px]")} />
                    </div>
                    <span className={clsx("ms-1 text-[13px] tracking-tight transition-colors", isActive ? "text-blue-700 font-bold" : "text-gray-700 font-medium")}>{title}</span>
                </div>
                {items.length > 1 && (
                    <ChevronDown className={clsx(
                        "w-3.5 h-3.5 transition-all duration-200",
                        isActive ? "text-blue-400" : "text-gray-400",
                        isOpen ? "rotate-180" : ""
                    )} />
                )}
            </button>

            {/* Pages */}
            <div className={clsx(
                "grid transition-all duration-300 ease-in-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
                <div className="overflow-hidden flex flex-col gap-0.5">
                    {filteredItems.map((item, idx) => {
                        const isItemActive = item.path === '/'
                            ? location.pathname === '/'
                            : (location.pathname === item.path || (
                                location.pathname.startsWith(item.path + '/') &&
                                !items.some(other => other.path !== item.path && location.pathname.startsWith(other.path))
                            ));

                        const isFavorite = favorites?.some(f => f.path === item.path);
                        const ItemIcon = item.icon;

                        return (
                            <div key={idx} className="group/item relative flex items-center">
                                <NavLink
                                    to={item.path}
                                    onClick={onClick}
                                    className={clsx(
                                        "flex-1 flex items-center h-[38px] pe-4 ps-12 transition-all duration-200 group relative rounded-xl mx-2",
                                        isItemActive
                                            ? "bg-blue-50/50 text-blue-800 font-semibold"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer"
                                    )}
                                >
                                    {isItemActive && (
                                        <div className="absolute start-0 top-2 bottom-2 w-[3px] bg-blue-600 rounded-e-full" />
                                    )}

                                    {ItemIcon && (
                                        <ItemIcon className={clsx(
                                            "w-4 h-4 me-3 shrink-0 transition-colors",
                                            isItemActive ? "text-blue-600" : "text-gray-400 group-hover/item:text-gray-600"
                                        )} />
                                    )}

                                    <span className={clsx(
                                        "truncate text-[13px] tracking-tight transition-transform duration-200"
                                    )}>
                                        {item.label}
                                    </span>
                                </NavLink>

                                {onFavorite && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onFavorite(item.path, item.label);
                                        }}
                                        className={clsx(
                                            "absolute end-4 p-1 rounded-md transition-all z-10",
                                            isFavorite
                                                ? "text-yellow-500 opacity-100"
                                                : "text-gray-300 opacity-0 group-hover/item:opacity-100 hover:text-yellow-400 hover:bg-gray-100"
                                        )}
                                    >
                                        <Star className={clsx("w-3 h-3", isFavorite && "fill-current")} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function Sidebar({ open = true, setOpen, mobileOpen, setMobileOpen }) {
    const location = useLocation();
    const { user, logout, hasPermission } = useContext(AuthContext);
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [favorites, setFavorites] = useState([]);
    const [openDomain, setOpenDomain] = useState(null);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const toggleFavorite = (path, label) => {
        setFavorites(prev => {
            const isFav = prev.find(f => f.path === path);
            let next;
            if (isFav) {
                next = prev.filter(f => f.path !== path);
            } else {
                next = [...prev, { path, label }];
            }
            localStorage.setItem('favorite_pages', JSON.stringify(next));
            return next;
        });
    };

    const hasAnyPermission = (permissionsArr) => {
        if (!user) return false;
        if (!permissionsArr || permissionsArr.length === 0) return true;
        return permissionsArr.some(p => hasPermission(p));
    };

    const isCollapsed = !open && !mobileOpen;

    const DOMAINS = useMemo(() => [
        {
            title: t('sidebar.dashboard_domain', 'Dashboard'),
            icon: LayoutDashboard,
            permissions: ['overview.read'],
            items: [
                { label: t('sidebar.dashboard', 'Overview'), path: '/', icon: LayoutDashboard, permission: 'overview.read' }
            ]
        },
        {
            title: t('sidebar.sales_logistics_domain', 'Sales & Logistics'),
            icon: ShoppingBag,
            permissions: ['sales.read', 'orders.view', 'dispatch.read'],
            items: [
                { label: t('sidebar.orders_hub', 'Orders Control Center'), path: '/orders-hub', icon: Layers, permission: 'orders.view' },
                { label: t('sidebar.sales', 'Sales CRM'), path: '/sales', icon: ShoppingCart, permission: 'sales.read' },
                { label: t('sidebar.logistics_dispatch', 'Delivery Tracking'), path: '/couriers/dispatch', icon: Truck, permission: 'dispatch.read' },
                { label: t('sidebar.logistics_analytics', 'Shipping & Couriers'), path: '/couriers', icon: Truck, permission: 'dispatch.read' }
            ]
        },
        {
            title: t('sidebar.callcenter_domain', 'Call Center Hub'),
            icon: Headset,
            permissions: ['callcenter.process_orders', 'callcenter.view_reports', 'overview.read'],
            items: [
                { label: t('sidebar.callcenter_agent', 'Agent Workspace'), path: '/call-center', icon: PhoneCall, permission: 'overview.read' },
                { label: t('sidebar.callcenter_manager', 'Manager Analytics'), path: '/call-center/manager', icon: LayoutDashboard, permission: 'overview.read' }
            ]
        },
        {
            title: t('sidebar.hr_domain', 'Human Resources'),
            icon: UserCircle,
            permissions: ['hr.read', 'hr.manage_attendance', 'hr.manage_payroll', 'hr.view_reports'],
            items: [
                { label: t('sidebar.hr_directory', 'Employees'), path: '/hr', icon: Users, permission: 'hr.read' },
                { label: t('sidebar.hr_attendance', 'Attendance'), path: '/hr/attendance', icon: Clock, permission: 'hr.manage_attendance' },
                { label: t('sidebar.hr_payroll', 'Payroll'), path: '/hr/payroll', icon: Wallet, permission: 'hr.manage_payroll' },
                { label: t('sidebar.hr_reports', 'HR Reports'), path: '/hr/reports', icon: Search, permission: 'hr.view_reports' }
            ]
        },
        {
            title: t('sidebar.finance_domain', 'Finance'),
            icon: Wallet,
            permissions: ['financial.read'],
            items: [
                { label: t('sidebar.financial', 'Financial Tracker'), path: '/financial', icon: Wallet, permission: 'financial.read' }
            ]
        },
        {
            title: t('sidebar.inventory_domain', 'Inventory'),
            icon: Box,
            permissions: ['inventory.read', 'warehouse.read', 'procurement.read'],
            items: [
                { label: t('sidebar.inventory', 'Inventory Tracking'), path: '/inventory', icon: Box, permission: 'inventory.read' },
                { label: t('sidebar.warehousing', 'Warehouse Control'), path: '/warehouses', icon: Factory, permission: 'warehouse.read' },
                { label: t('sidebar.procurement', 'Purchase Center'), path: '/procurement', icon: ShoppingCart, permission: 'procurement.read' }
            ]
        },
        {
            title: t('sidebar.customers_domain', 'Customers'),
            icon: Users,
            permissions: ['customer.read'],
            items: [
                { label: t('sidebar.crm_acquisition', 'Customer Insights'), path: '/customers', icon: Users, permission: 'customer.read' },
                { label: t('sidebar.crm_support', 'Returns & Complaints'), path: '/support', icon: HelpCircle, permission: 'customer.read' }
            ]
        }
    ], [t]);

    // Filter domains & their internal children securely
    const accessibleDomains = useMemo(() => {
        return DOMAINS
            .filter(d => hasAnyPermission(d.permissions))
            .map(domain => ({
                ...domain,
                items: domain.items.filter(item => hasPermission(item.permission))
            }))
            .filter(domain => domain.items.length > 0);
    }, [DOMAINS, user, hasPermission]);

    // Initialize Favorites
    useEffect(() => {
        try {
            const storedFavs = localStorage.getItem('favorite_pages');
            if (storedFavs) {
                setFavorites(JSON.parse(storedFavs));
            } else {
                setFavorites([
                    { path: '/inventory', label: t('sidebar.inventory', 'Inventory Tracking') },
                    { path: '/customers', label: t('sidebar.crm_acquisition', 'Customer Insights') }
                ]);
            }
        } catch (e) {
            console.error(e);
        }
    }, [t]);

    // Auto-open active domain on mount or location change
    useEffect(() => {
        const activeDomain = accessibleDomains.find(d =>
            d.items.some(item =>
                item.path === '/' ? location.pathname === '/' : (location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
            )
        );
        if (activeDomain && !searchTerm) {
            setOpenDomain(activeDomain.title);
        }
    }, [location.pathname, accessibleDomains, searchTerm]);

    const handleLinkClick = () => {
        if (setMobileOpen) setMobileOpen(false);
    };

    const handleSignOut = () => setShowLogoutConfirm(true);

    return (
        <>
            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setMobileOpen?.(false)}
                />
            )}

            {/* Sidebar Container */}
            <div className={clsx(
                "flex flex-col bg-gradient-to-b from-white via-white to-slate-50/50 h-screen border-e border-gray-100/80 flex-shrink-0 fixed start-0 top-0 z-50 transition-all duration-500 ease-in-out shadow-[0_0_40px_rgba(0,0,0,0.02)]",
                mobileOpen
                    ? "translate-x-0 w-[280px]"
                    : isCollapsed
                        ? "-translate-x-full rtl:translate-x-full md:translate-x-0 md:rtl:translate-x-0 md:w-[72px]"
                        : "-translate-x-full rtl:translate-x-full md:translate-x-0 md:rtl:translate-x-0 md:w-[260px]"
            )}>

                {/* Header / Brand */}
                <div className={clsx(
                    "flex items-center h-[72px] flex-shrink-0 border-b border-gray-200/60 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                    isCollapsed ? "justify-center px-0" : "px-5"
                )}>
                    <Link to="/" onClick={handleLinkClick} className={clsx("flex items-center gap-3", isCollapsed ? "" : "w-full")}>
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
                            <Layers className="w-4 h-4" />
                        </div>
                        {!isCollapsed && (
                            <span className="font-bold text-gray-900 tracking-tight text-[15px] truncate">{t('app_name', 'TechCorp OS')}</span>
                        )}
                    </Link>
                    {/* Mobile Close Button */}
                    {mobileOpen && (
                        <button onClick={() => setMobileOpen?.(false)} className="md:hidden p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shrink-0">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>



                {/* Scrollable Nav Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 pt-2">

                    {/* Favorites Section */}
                    {!isCollapsed && !searchTerm && favorites.length > 0 && (
                        <div className="mb-6">
                            <p className="px-4 mb-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                                {t('sidebar.favorites_header', 'Favorites')}
                                <Star className="w-3 h-3 text-yellow-500/40" />
                            </p>
                            <div className="flex flex-col">
                                {favorites.map((fav, i) => (
                                    <NavLink
                                        key={i}
                                        to={fav.path}
                                        onClick={handleLinkClick}
                                        className="flex items-center h-[34px] px-4 hover:bg-[#F6F8FC] text-gray-600 hover:text-gray-900 group transition-colors"
                                    >
                                        <div className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-yellow-400 me-4 transition-colors" />
                                        <span className="text-[13px] tracking-tight truncate">{fav.label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    )}


                    {/* Core Domains */}
                    <div className="flex flex-col gap-1">
                        {!isCollapsed && !searchTerm && (
                            <p className="px-4 mb-2 mt-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest">{t('sidebar.modules_header', 'Modules')}</p>
                        )}
                        {accessibleDomains.map((domain, i) => {
                            // If it's a single item domain, render it as a primary link (SidebarItem)
                            // This removes the "Dashboard -> Overview" repetition
                            if (domain.items.length === 1 && !searchTerm) {
                                return (
                                    <SidebarItem
                                        key={i}
                                        icon={domain.icon}
                                        label={domain.items[0].label}
                                        path={domain.items[0].path}
                                        isCollapsed={isCollapsed}
                                        onClick={handleLinkClick}
                                        onFavorite={toggleFavorite}
                                        isFavorite={favorites.some(f => f.path === domain.items[0].path)}
                                        itemIcon={domain.items[0].icon}
                                    />
                                );
                            }
                            // Otherwise render as a collapsible group
                            return (
                                <SidebarDomain
                                    key={i}
                                    {...domain}
                                    isCollapsed={isCollapsed}
                                    searchTerm={searchTerm}
                                    onClick={handleLinkClick}
                                    onFavorite={toggleFavorite}
                                    favorites={favorites}
                                    isOpen={openDomain === domain.title || (searchTerm && domain.items.some(it => it.label.toLowerCase().includes(searchTerm.toLowerCase())))}
                                    onToggle={() => setOpenDomain(openDomain === domain.title ? null : domain.title)}
                                />
                            );
                        })}
                    </div>

                </div>

                {/* Footer / System Controls */}
                <div className="mt-auto px-2 pb-4 pt-2 border-t border-gray-200/80 bg-white flex flex-col shrink-0">
                    <SidebarItem
                        icon={Gear}
                        label={t('sidebar.settings_nav', 'Settings')}
                        path="/settings"
                        isCollapsed={isCollapsed}
                        onClick={handleLinkClick}
                    />

                    {/* Visual Spacer */}
                    <div className="my-1 border-t border-gray-100/50" />

                    {/* Collapse Toggle (Desktop only) */}
                    {setOpen && (
                        <button
                            onClick={() => setOpen(!open)}
                            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            className={clsx(
                                "hidden md:flex items-center text-gray-400 hover:text-gray-900 group transition-all",
                                isCollapsed ? "justify-center w-10 h-10 mx-auto rounded-lg hover:bg-gray-100" : "h-[34px] px-3 mx-2 rounded-lg hover:bg-gray-100"
                            )}
                        >
                            {isCollapsed ? (
                                <PanelLeftOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            ) : (
                                <>
                                    <PanelLeftClose className="w-[18px] h-[18px] me-3 group-hover:text-indigo-600 transition-colors" />
                                    <span className="text-[12px] font-bold tracking-tight uppercase">{t('sidebar.collapse', 'Collapse Menu')}</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Logout confirm dialog */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                            </div>
                            <h3 className="font-bold text-gray-900">{t('sidebar.confirmLogout', 'Sign out?')}</h3>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowLogoutConfirm(false)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button onClick={() => { setShowLogoutConfirm(false); logout(); }} className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1.5">
                                <LogOut className="w-3.5 h-3.5" /> {t('sidebar.signOut', 'Sign Out')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
