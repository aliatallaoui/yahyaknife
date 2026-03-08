import { useContext, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Search, HelpCircle, Settings, LogOut, ChevronDown,
    LayoutDashboard, ShoppingBag, Box, LineChart, FileText, RefreshCw, Layers, PackageOpen, Truck,
    Users, Briefcase, Flag, Archive
} from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';

function NavSection({ title, icon: Icon, activePrefixes = [], children }) {
    const location = useLocation();
    const isActive = activePrefixes.some(prefix => location.pathname.startsWith(prefix));
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isActive) setIsOpen(true);
    }, [isActive]);

    return (
        <div className="mb-0.5">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all duration-200 text-sm",
                    isOpen ? "text-blue-700 bg-blue-50" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", isOpen ? "bg-blue-100" : "bg-gray-100")}>
                        <Icon className={clsx("w-4 h-4", isOpen ? "text-blue-600" : "text-gray-500")} />
                    </div>
                    <span>{title}</span>
                </div>
                <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform duration-200", isOpen ? "rotate-180 text-blue-400" : "text-gray-300")} />
            </button>
            <div className={clsx("grid transition-all duration-300 ease-in-out", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden">
                    <div className="flex flex-col py-1 ms-7 ps-4 border-s-2 border-gray-100 mt-1 mb-2 gap-0.5">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Sidebar() {
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);
    const { t } = useTranslation();

    const hasAccess = (allowedRoles) => {
        if (!user) return false;
        if (user.role === 'Super Admin') return true;
        return allowedRoles.includes(user.role);
    };

    const isPath = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

    const mainLink = ({ isActive }) => clsx(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
        isActive ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100/80" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    );

    const subLink = ({ isActive }) => clsx(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        isActive ? "text-blue-700 bg-blue-50 font-semibold" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:translate-x-0.5 rtl:hover:-translate-x-0.5"
    );

    return (
        <div className="flex bg-white h-screen border-e border-gray-100/80 flex-shrink-0 fixed start-0 top-0 z-50 shadow-sm">
            {/* 1) Mini Strip */}
            <div className="w-[72px] flex flex-col items-center py-5 border-e border-gray-100 flex-shrink-0 bg-gray-50/50">
                {/* Logo */}
                <div className="w-11 h-11 bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 rounded-xl flex items-center justify-center text-white mb-8 shadow-lg cursor-pointer hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5" />
                </div>

                {/* Icon Links */}
                <div className="flex flex-col gap-3 flex-1 items-center">
                    {[
                        { Icon: LayoutDashboard, path: '_dashboard' },
                        { Icon: ShoppingBag, path: '/sales' },
                        { Icon: Archive, path: '/inventory' },
                        { Icon: Box, path: '/warehouses' },
                        { Icon: LineChart, path: '/financial' },
                    ].map(({ Icon, path }, i) => (
                        <div key={i} className={clsx("w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200", i === 0 ? "bg-blue-600 text-white shadow-md shadow-blue-200" : isPath(path) ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100")}>
                            <Icon className="w-5 h-5" />
                        </div>
                    ))}
                </div>

                {/* Bottom Utils */}
                <div className="flex flex-col gap-3 mt-auto items-center">
                    <div className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer transition-all">
                        <HelpCircle className="w-5 h-5" />
                    </div>
                    <NavLink to="/settings/users" className={({ isActive }) => clsx("w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer transition-all", isActive ? "text-blue-600 bg-blue-50 shadow-sm" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100")}>
                        <Settings className="w-5 h-5" />
                    </NavLink>
                    <button onClick={logout} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer transition-all">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* 2) Main Nav Drawer */}
            <div className="w-[248px] flex flex-col pt-5 pb-4 bg-white/60">
                {/* Search */}
                <div className="px-4 mb-7">
                    <div className="relative group">
                        <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder={t('sidebar.searchMenu', 'البحث في القائمة')}
                            className="w-full bg-gray-100/80 hover:bg-gray-100 focus:bg-white border border-transparent focus:border-blue-300 focus:ring-4 focus:ring-blue-50 outline-none rounded-xl py-2.5 ps-10 pe-4 text-sm font-medium text-gray-800 placeholder:text-gray-400 transition-all"
                        />
                    </div>
                </div>

                {/* Nav */}
                <div className="flex-1 overflow-y-auto px-3 custom-scrollbar space-y-6">

                    {/* Main Views */}
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5 px-2">{t('sidebar.mainMenu', 'نظرة عامة')}</p>
                        <div className="flex flex-col gap-0.5">
                            <NavLink to="/" end className={mainLink}>
                                <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", isPath('/') && location.pathname === '/' ? "bg-blue-100" : "bg-gray-100")}><LayoutDashboard className={clsx("w-4 h-4", isPath('/') && location.pathname === '/' ? "text-blue-600" : "text-gray-500")} /></div>
                                {t('sidebar.dashboard', 'لوحة التحكم')}
                            </NavLink>
                            {hasAccess(['Finance Controller', 'Super Admin']) && (
                                <NavLink to="/financial" className={mainLink}>
                                    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", isPath('/financial') ? "bg-blue-100" : "bg-gray-100")}><FileText className={clsx("w-4 h-4", isPath('/financial') ? "text-blue-600" : "text-gray-500")} /></div>
                                    {t('sidebar.financial', 'المالية')}
                                </NavLink>
                            )}
                            {hasAccess(['Finance Controller', 'Sales Representative', 'Super Admin']) && (
                                <NavLink to="/sales" className={mainLink}>
                                    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", isPath('/sales') ? "bg-blue-100" : "bg-gray-100")}><RefreshCw className={clsx("w-4 h-4", isPath('/sales') ? "text-blue-600" : "text-gray-500")} /></div>
                                    {t('sidebar.sales', 'محرك المبيعات')}
                                </NavLink>
                            )}
                            {hasAccess(['Finance Controller', 'Warehouse Supervisor', 'Production Lead', 'Sales Representative', 'Super Admin']) && (
                                <NavLink to="/inventory" className={mainLink}>
                                    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", isPath('/inventory') ? "bg-blue-100" : "bg-gray-100")}><Box className={clsx("w-4 h-4", isPath('/inventory') ? "text-blue-600" : "text-gray-500")} /></div>
                                    {t('sidebar.inventory', 'تتبع المخزون')}
                                </NavLink>
                            )}
                            {hasAccess(['Warehouse Supervisor', 'Production Lead', 'Super Admin']) && (
                                <NavLink to="/warehouses" className={mainLink}>
                                    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", isPath('/warehouses') ? "bg-blue-100" : "bg-gray-100")}><Layers className={clsx("w-4 h-4", isPath('/warehouses') ? "text-blue-600" : "text-gray-500")} /></div>
                                    {t('sidebar.warehouses', 'المستودعات والخدمات اللوجستية')}
                                </NavLink>
                            )}
                            {hasAccess(['Warehouse Supervisor', 'Sales Representative', 'Super Admin']) && (
                                <NavLink to="/couriers" className={mainLink}>
                                    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", isPath('/couriers') ? "bg-blue-100" : "bg-gray-100")}><Truck className={clsx("w-4 h-4", isPath('/couriers') ? "text-blue-600" : "text-gray-500")} /></div>
                                    {t('sidebar.couriers', 'الإرسال والمندوبين')}
                                </NavLink>
                            )}
                        </div>
                    </div>

                    {/* Department Accordions */}
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5 px-2">{t('sidebar.departments', 'الأقسام والتشغيل')}</p>
                        <div className="flex flex-col gap-0.5">
                            {hasAccess(['Finance Controller', 'Sales Representative', 'Super Admin']) && (
                                <NavSection title={t('sidebar.crm', 'دعم العملاء')} icon={Users} activePrefixes={['/customers', '/support']}>
                                    <NavLink to="/customers" className={subLink}>{t('sidebar.crm_acquisition', 'الاستحواذ والملاحظات')}</NavLink>
                                    <NavLink to="/support" className={subLink}>{t('sidebar.crm_support', 'الدعم والمرتجعات')}</NavLink>
                                </NavSection>
                            )}
                            {hasAccess(['Production Lead', 'Warehouse Supervisor', 'Super Admin']) && (
                                <NavSection title={t('sidebar.manufacturing', 'أرضية التصنيع')} icon={PackageOpen} activePrefixes={['/production', '/procurement']}>
                                    <NavLink to="/production" className={subLink}>{t('sidebar.mfg_production', 'الإنتاج وقوائم المواد')}</NavLink>
                                    <NavLink to="/procurement" className={subLink}>{t('sidebar.procurement', 'مركز المشتريات')}</NavLink>
                                </NavSection>
                            )}
                            {hasAccess(['HR Manager', 'Super Admin']) && (
                                <NavSection title={t('sidebar.hr', 'الموارد البشرية')} icon={Briefcase} activePrefixes={['/hr']}>
                                    <NavLink to="/hr" end className={subLink}>{t('sidebar.hr_directory', 'الدليل والإجازات')}</NavLink>
                                    <NavLink to="/hr/attendance" className={subLink}>{t('sidebar.hr_attendance', 'الحضور اليومي')}</NavLink>
                                    <NavLink to="/hr/payroll" className={subLink}>{t('sidebar.hr_payroll', 'الرواتب الشهرية')}</NavLink>
                                    <NavLink to="/hr/reports" className={subLink}>{t('sidebar.hr_reports', 'التقارير والبيانات')}</NavLink>
                                </NavSection>
                            )}
                            {hasAccess(['Production Lead', 'Super Admin']) && (
                                <NavSection title={t('sidebar.projects', 'حالة المشاريع')} icon={Flag} activePrefixes={['/projects']}>
                                    <NavLink to="/projects" end className={subLink}>{t('sidebar.projects_portfolio', 'المحفظة النشطة')}</NavLink>
                                    <NavLink to="/projects/tasks" className={subLink}>{t('sidebar.projects_tasks', 'لوحة المهام العالمية')}</NavLink>
                                </NavSection>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
