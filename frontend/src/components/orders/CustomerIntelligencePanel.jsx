import { AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fromNow } from '../../utils/dateUtils';

export default function CustomerIntelligencePanel({ data, isSearching }) {
    const { t } = useTranslation();

    if (isSearching) {
        return (
            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-xl p-4 flex items-center justify-center min-h-[100px] animate-pulse">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide">{t('customerIntel.searching')}</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/50 rounded-xl p-4 flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-sm text-blue-800/80 dark:text-blue-300/80">
                    {t('customerIntel.hint')}
                </p>
            </div>
        );
    }

    const { exists, customer, activeDuplicateOrders, riskIndicator, warning } = data;

    const RiskBadge = () => {
        if (riskIndicator === 'High') {
            return (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> {t('customerIntel.highRisk')}
                </div>
            );
        }
        if (riskIndicator === 'Medium') {
            return (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-bold border border-orange-200 dark:border-orange-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> {t('customerIntel.mediumRisk')}
                </div>
            );
        }
        return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="w-3.5 h-3.5" /> {t('customerIntel.trusted')}
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-sm rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {exists ? customer.name : t('customerIntel.newCustomer')}
                        {exists && <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">ID: {customer._id.substring(customer._id.length - 6)}</span>}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {exists ? t('customerIntel.joined', { time: fromNow(customer.joinDate) }) : t('customerIntel.noRecords')}
                    </p>
                </div>
                <RiskBadge />
            </div>

            {warning && (
                <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 p-3 rounded-lg flex items-start gap-2 text-sm text-orange-800 dark:text-orange-300">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="font-medium leading-tight">{t(`customerIntel.${warning}`)}</p>
                </div>
            )}

            {exists && (
                <div className="grid grid-cols-4 gap-4 pt-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{t('customerIntel.orders')}</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{customer.totalOrders}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{t('customerIntel.delivered')}</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{customer.deliveredOrders}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{t('customerIntel.returnRate')}</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{customer.returnRate || customer.refusalRate?.toFixed(1) || 0}%</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{t('customerIntel.ltv')}</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">{customer.lifetimeValue?.toLocaleString()} <span className="text-xs">{t('common.dzd', 'DZD')}</span></span>
                    </div>
                </div>
            )}

            {activeDuplicateOrders && activeDuplicateOrders.length > 0 && (
                <div className="mt-4 pt-3 border-t dark:border-gray-700">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">{t('customerIntel.duplicates')}</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                        {activeDuplicateOrders.map(dup => (
                            <div key={dup._id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 text-xs flex items-center justify-between border border-gray-100 dark:border-gray-700">
                                <div>
                                    <span className="font-semibold text-gray-900 dark:text-white block">{dup.orderId}</span>
                                    <span className="text-gray-500 dark:text-gray-400 block">{fromNow(dup.date)}</span>
                                </div>
                                <div className="text-right">
                                    <span className="font-semibold text-blue-600 block text-right" dir="ltr">{Number(dup.totalAmount).toLocaleString()} <span className="text-[10px] text-blue-500">{t('common.dzd', 'DZD')}</span></span>
                                    <span className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px] font-bold mt-1 inline-block">{dup.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
