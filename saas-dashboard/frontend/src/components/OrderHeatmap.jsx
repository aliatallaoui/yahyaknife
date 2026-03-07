import { FileBarChart2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

export default function OrderHeatmap({ heatmap }) {
    const { t } = useTranslation();
    if (!heatmap || heatmap.length === 0) return null;

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const hours = ['9.00', '10.00', '11.00', '12.00', '13.00', '14.00'];

    // Map intensity (0-100) to Tailwind BG colors
    const getColor = (value) => {
        if (value >= 90) return 'bg-[#C58AF9] border-[#C58AF9] shadow-sm z-10'; // Center dark purple/blue
        if (value >= 70) return 'bg-blue-600 border-blue-600';
        if (value >= 40) return 'bg-blue-400 border-blue-400';
        if (value >= 15) return 'bg-blue-200 border-blue-200';
        if (value >= 5) return 'bg-blue-50 border-blue-50';
        return 'bg-white border-white';
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)] p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center">
                        <FileBarChart2 className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">{t('widgets.heatmapHeader')}</h2>
                </div>

                <select className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg px-3 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-blue-100 font-medium">
                    <option>{t('widgets.heatmapThisWeek')}</option>
                    <option>{t('widgets.heatmapLastWeek')}</option>
                </select>
            </div>

            {/* Matrix Area */}
            <div className="flex-1 overflow-x-auto custom-scrollbar">
                <div className="min-w-[400px]">
                    {/* Header Row (Days) */}
                    <div className="grid grid-cols-[60px_repeat(7,1fr)] mb-2">
                        <div></div>
                        {days.map((day, i) => (
                            <div key={i} className="text-center text-sm font-semibold text-gray-500 pb-2">{day}</div>
                        ))}
                    </div>

                    {/* Data Rows (Hours) */}
                    <div className="flex flex-col gap-1.5">
                        {hours.map((hour, rIndex) => (
                            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] gap-1.5 items-center">
                                <div className="text-xs font-semibold text-gray-400 tabular-nums">{hour}</div>
                                {days.map((day, cIndex) => {
                                    const cell = heatmap.find(h => h.day === day && h.hour === hour);
                                    const val = cell ? cell.value : 0;
                                    return (
                                        <div
                                            key={`heatmap-cell-${day}-${hour}-${rIndex}-${cIndex}`}
                                            className={clsx(
                                                "aspect-square rounded shadow-sm border cursor-pointer hover:border-gray-300 transition-colors relative",
                                                getColor(val)
                                            )}
                                            title={`${day} @ ${hour} - Value: ${val}`}
                                        ></div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}
