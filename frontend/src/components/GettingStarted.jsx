import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, Truck, ShoppingCart, Check, X, ChevronRight, Rocket } from 'lucide-react';
import clsx from 'clsx';
import { apiFetch } from '../utils/apiFetch';

export default function GettingStarted() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('translation', { keyPrefix: 'gettingStarted' });
    const isAr = i18n.language === 'ar';

    const [progress, setProgress] = useState(null);
    const [dismissed, setDismissed] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Don't show if user dismissed it this session
        if (sessionStorage.getItem('gs_dismissed')) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDismissed(true);
            setLoading(false);
            return;
        }

        (async () => {
            try {
                const res = await apiFetch('/api/dashboard/setup-progress');
                if (res.ok) {
                    const data = await res.json();
                    setProgress(data);
                }
            } catch { /* non-fatal */ }
            setLoading(false);
        })();
    }, []);

    if (loading || dismissed || !progress) return null;

    const steps = [
        { key: 'profile', done: progress.profileCompleted, icon: Rocket, label: t('stepProfile'), path: '/settings/workspace', color: 'indigo' },
        { key: 'product', done: progress.hasProducts, icon: Package, label: t('stepProduct'), path: '/inventory', color: 'blue' },
        { key: 'courier', done: progress.hasCourier, icon: Truck, label: t('stepCourier'), path: '/couriers', color: 'emerald' },
        { key: 'order', done: progress.hasOrders, icon: ShoppingCart, label: t('stepOrder'), path: '/orders-hub', color: 'amber' },
    ];

    const completedCount = steps.filter(s => s.done).length;
    const allDone = completedCount === steps.length;

    // Hide if everything is done
    if (allDone) return null;

    const pct = Math.round((completedCount / steps.length) * 100);

    const handleDismiss = () => {
        sessionStorage.setItem('gs_dismissed', '1');
        setDismissed(true);
    };

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Rocket className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            {t('title')}
                        </h3>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                            {t('subtitle', { count: completedCount, total: steps.length })}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title={t('dismiss')}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Progress bar */}
            <div className="px-5 pb-3">
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            {/* Steps */}
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {steps.map(step => (
                    <button
                        key={step.key}
                        onClick={() => !step.done && navigate(step.path)}
                        disabled={step.done}
                        className={clsx(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-start transition-all group",
                            step.done
                                ? "bg-gray-50 dark:bg-gray-750 cursor-default"
                                : "hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer"
                        )}
                    >
                        <div className={clsx(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                            step.done
                                ? "bg-emerald-100 dark:bg-emerald-900/30"
                                : `bg-${step.color}-50 dark:bg-${step.color}-900/20`
                        )}>
                            {step.done ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                                <step.icon className={clsx("w-3.5 h-3.5", `text-${step.color}-500`)} />
                            )}
                        </div>
                        <span className={clsx(
                            "text-xs font-medium flex-1",
                            step.done
                                ? "text-gray-400 dark:text-gray-500 line-through"
                                : "text-gray-700 dark:text-gray-300"
                        )}>
                            {step.label}
                        </span>
                        {!step.done && (
                            <ChevronRight className={clsx(
                                "w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors",
                                isAr && "rotate-180"
                            )} />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
