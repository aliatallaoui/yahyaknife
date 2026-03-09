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
const PageHeader = ({ title, subtitle, actions }) => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4 mb-6">
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
