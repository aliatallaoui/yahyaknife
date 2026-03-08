import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

export default function KnifeStageTracker({ status, compact = false }) {
    const { t } = useTranslation();

    const stages = [
        { key: 'Design', label: t('knives.stages.design', 'Design'), icon: '✏️' },
        { key: 'In Production', label: t('knives.stages.inProduction', 'In Prod'), icon: '🔨' },
        { key: 'Heat Treatment', label: t('knives.stages.heatTreatment', 'Heat Treat'), icon: '🔥' },
        { key: 'Grinding', label: t('knives.stages.grinding', 'Grinding'), icon: '⚙️' },
        { key: 'Handle Installation', label: t('knives.stages.handleInstallation', 'Handle'), icon: '🪵' },
        { key: 'Finishing', label: t('knives.stages.finishing', 'Finishing'), icon: '✨' },
        { key: 'Sharpening', label: t('knives.stages.sharpening', 'Sharpen'), icon: '🗡️' },
        { key: 'Completed', label: t('knives.stages.completed', 'Done'), icon: '✅' },
    ];

    const currentIdx = stages.findIndex(s => s.key === status);

    if (compact) {
        // Minimal inline progress bar for table/card views
        return (
            <div className="flex items-center gap-1.5 w-full">
                {stages.slice(0, 8).map((stage, idx) => (
                    <div
                        key={stage.key}
                        title={stage.label}
                        className={clsx(
                            'h-1.5 flex-1 rounded-full transition-all duration-300',
                            idx < currentIdx ? 'bg-emerald-400' :
                                idx === currentIdx ? 'bg-blue-500 animate-pulse' :
                                    'bg-gray-200'
                        )}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <div className="flex items-center min-w-max gap-0">
                {stages.map((stage, idx) => {
                    const isDone = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    const isFuture = idx > currentIdx;

                    return (
                        <div key={stage.key} className="flex items-center">
                            {/* Stage node */}
                            <div className="flex flex-col items-center gap-1">
                                <div className={clsx(
                                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300',
                                    isDone ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' :
                                        isCurrent ? 'bg-blue-600 border-blue-600 text-white shadow-lg ring-4 ring-blue-100' :
                                            'bg-white border-gray-200 text-gray-400'
                                )}>
                                    {isDone ? '✓' : stage.icon}
                                </div>
                                <span className={clsx(
                                    'text-[10px] font-semibold whitespace-nowrap',
                                    isDone ? 'text-emerald-600' :
                                        isCurrent ? 'text-blue-700' :
                                            'text-gray-400'
                                )}>
                                    {stage.label}
                                </span>
                            </div>

                            {/* Connector line */}
                            {idx < stages.length - 1 && (
                                <div className={clsx(
                                    'h-0.5 w-8 mx-1 mb-4 rounded-full transition-all duration-500',
                                    idx < currentIdx ? 'bg-emerald-400' : 'bg-gray-200'
                                )} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
