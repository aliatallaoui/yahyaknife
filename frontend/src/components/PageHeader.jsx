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
        default: "bg-white border-gray-100",
        finance: "bg-gradient-to-br from-indigo-50/70 to-white border-indigo-100",
        inventory: "bg-gradient-to-br from-amber-50/70 to-white border-amber-100",
        hr: "bg-gradient-to-br from-emerald-50/80 to-white border-emerald-100", // Soft Emerald for eyes
        sales: "bg-gradient-to-br from-rose-50/70 to-white border-rose-100",
        projects: "bg-gradient-to-br from-blue-50/70 to-white border-blue-100",
        production: "bg-gradient-to-br from-slate-50/80 to-white border-slate-200", // Soft Slate
        procurement: "bg-gradient-to-br from-purple-50/70 to-white border-purple-100",
        customers: "bg-gradient-to-br from-sky-50/70 to-white border-sky-100",
    };

    return (
        <div className={clsx(
            "flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 rounded-2xl border shadow-sm gap-4 mb-6 transition-all duration-300",
            variants[variant] || variants.default
        )}>
            <div className={clsx("flex flex-col gap-1 w-full md:w-auto", isRTL ? "text-right" : "text-left")}>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                    {title}
                </h2>
                {subtitle && (
                    <p className="text-xs sm:text-sm text-gray-500 font-medium">
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
