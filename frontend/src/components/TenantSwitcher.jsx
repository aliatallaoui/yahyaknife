import { useState, useEffect, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check, Building2 } from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';

export default function TenantSwitcher({ isCollapsed }) {
    const { t } = useTranslation();
    const { user, switchTenant } = useContext(AuthContext);
    const [tenants, setTenants] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!user?.hasMultipleTenants) return;

        apiFetch('/api/auth/tenants')
            .then(res => res.ok ? res.json() : [])
            .then(data => setTenants(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, [user?.hasMultipleTenants, user?.tenant]);

    // Close dropdown on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    if (!user?.hasMultipleTenants || tenants.length <= 1) return null;

    const currentTenant = tenants.find(t => t.isCurrent) || tenants[0];

    const handleSwitch = async (tenantId) => {
        if (tenantId === currentTenant?._id) {
            setIsOpen(false);
            return;
        }
        setSwitching(true);
        try {
            await switchTenant(tenantId);
            setIsOpen(false);
        } catch {
            // switchTenant handles error toast
        } finally {
            setSwitching(false);
        }
    };

    if (isCollapsed) {
        return (
            <div className="flex justify-center px-2 py-2 border-b border-gray-100 dark:border-gray-700/60">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 hover:shadow-md transition-all"
                    title={currentTenant?.name || t('sidebar.switchWorkspace', 'Switch workspace')}
                >
                    {currentTenant?.logo ? (
                        <img src={currentTenant.logo} alt="" className="w-6 h-6 rounded object-cover" />
                    ) : (
                        <Building2 className="w-5 h-5" />
                    )}
                </button>
            </div>
        );
    }

    return (
        <div ref={dropdownRef} className="relative px-3 py-2 border-b border-gray-100 dark:border-gray-700/60">
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={switching}
                className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                    "bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20",
                    "hover:from-violet-100 hover:to-indigo-100 dark:hover:from-violet-900/30 dark:hover:to-indigo-900/30",
                    "border border-violet-100/60 dark:border-violet-800/40",
                    switching && "opacity-60 cursor-wait"
                )}
            >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
                    {currentTenant?.logo ? (
                        <img src={currentTenant.logo} alt="" className="w-5 h-5 rounded object-cover" />
                    ) : (
                        <span className="text-xs font-bold">{(currentTenant?.name || '?')[0].toUpperCase()}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0 text-start">
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">
                        {currentTenant?.name || t('sidebar.workspace', 'Workspace')}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 capitalize">
                        {currentTenant?.planTier || 'Free'}
                    </p>
                </div>
                <ChevronDown className={clsx(
                    "w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform shrink-0",
                    isOpen && "rotate-180"
                )} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute start-3 end-3 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200/80 dark:border-gray-600/80 z-50 py-1 max-h-[240px] overflow-y-auto">
                    {tenants.map(tenant => (
                        <button
                            key={tenant._id}
                            onClick={() => handleSwitch(tenant._id)}
                            disabled={switching}
                            className={clsx(
                                "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-start",
                                tenant.isCurrent && "bg-violet-50/50 dark:bg-violet-900/20"
                            )}
                        >
                            <div className={clsx(
                                "w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0",
                                tenant.isCurrent
                                    ? "bg-gradient-to-br from-violet-500 to-indigo-600"
                                    : "bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700"
                            )}>
                                <span className="text-[10px] font-bold">{(tenant.name || '?')[0].toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{tenant.name}</p>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 capitalize">{tenant.role || 'Member'}</p>
                            </div>
                            {tenant.isCurrent && (
                                <Check className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
