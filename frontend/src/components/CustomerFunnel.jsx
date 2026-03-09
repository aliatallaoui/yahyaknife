import { Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

export default function CustomerFunnel({ funnel }) {
    const { t } = useTranslation();
    if (!funnel || funnel.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)] p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#C58AF9] flex items-center justify-center">
                    <Filter className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">{t('widgets.funnelHeader')}</h2>
                    <p className="text-sm text-gray-500">{t('widgets.funnelSubtitle')}</p>
                </div>
            </div>

            {/* Funnel Pipeline */}
            <div className="flex-1 flex items-center justify-between gap-4 pb-4">
                {funnel.map((step, index) => {
                    return (
                        <div
                            key={index}
                            className="h-14 flex-1 flex items-center justify-center border border-blue-100 rounded-xl transition-all duration-300 bg-white hover:border-blue-300 hover:shadow-sm shrink-0"
                        >
                            <span className="font-extrabold text-[#1A73E8] text-lg tabular-nums tracking-tight">
                                {step.percentage}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
