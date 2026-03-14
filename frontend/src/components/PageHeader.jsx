import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

/**
 * Standardized Page Header Component
 * @param {Object} props
 * @param {string} props.title - Main title text
 * @param {string} props.subtitle - Subtitle text (optional)
 * @param {React.ReactNode} props.actions - Action buttons/controls (optional)
 */
const PageHeader = ({ title, subtitle, actions, variant = 'default' }) => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    const variants = {
        default: "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700",
        finance: "bg-gradient-to-br from-indigo-50/70 to-white dark:from-indigo-900/30 dark:to-gray-800 border-indigo-100 dark:border-indigo-800",
        inventory: "bg-gradient-to-br from-amber-50/70 to-white dark:from-amber-900/30 dark:to-gray-800 border-amber-100 dark:border-amber-800",
        hr: "bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-900/30 dark:to-gray-800 border-emerald-100 dark:border-emerald-800",
        sales: "bg-gradient-to-br from-rose-50/70 to-white dark:from-rose-900/30 dark:to-gray-800 border-rose-100 dark:border-rose-800",
        projects: "bg-gradient-to-br from-blue-50/70 to-white dark:from-blue-900/30 dark:to-gray-800 border-blue-100 dark:border-blue-800",
        production: "bg-gradient-to-br from-slate-50/80 to-white dark:from-slate-900/30 dark:to-gray-800 border-slate-200 dark:border-slate-700",
        procurement: "bg-gradient-to-br from-purple-50/70 to-white dark:from-purple-900/30 dark:to-gray-800 border-purple-100 dark:border-purple-800",
        customers: "bg-gradient-to-br from-sky-50/70 to-white dark:from-sky-900/30 dark:to-gray-800 border-sky-100 dark:border-sky-800",
    };

    return (
        <div className={clsx(
            "flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 rounded-2xl border shadow-sm gap-4 mb-6 transition-all duration-300",
            variants[variant] || variants.default
        )}>
            <div className={clsx("flex flex-col gap-1 w-full md:w-auto", isRTL ? "text-right" : "text-left")}>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {title}
                </h2>
                {subtitle && (
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                        {subtitle}
                    </p>
                )}
            </div>

            {actions && (
                <div className={clsx(
                    "flex flex-wrap items-center gap-3 w-full md:w-auto",
                    isRTL ? "md:flex-row-reverse" : ""
                )}>
                    {actions}
                </div>
            )}
        </div>
    );
};

export default PageHeader;
