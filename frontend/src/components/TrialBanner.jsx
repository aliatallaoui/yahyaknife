import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Clock, Sparkles } from 'lucide-react';
import clsx from 'clsx';

export default function TrialBanner() {
    const { user } = useContext(AuthContext);
    const { t } = useTranslation();

    const sub = user?.subscription;
    if (!sub || sub.status !== 'trialing' || !sub.trialEndsAt) return null;

    const now = new Date();
    const end = new Date(sub.trialEndsAt);
    const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

    if (daysLeft <= 0) return null;

    const urgent = daysLeft <= 3;

    return (
        <div
            className={clsx(
                "flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors",
                urgent
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                    : "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
            )}
        >
            {urgent ? <Clock className="w-4 h-4 shrink-0" /> : <Sparkles className="w-4 h-4 shrink-0" />}
            <span>
                {t('trial.bannerText', {
                    defaultValue: daysLeft === 1
                        ? 'Your free trial ends tomorrow — upgrade now to keep your data'
                        : `${daysLeft} days left in your free trial`,
                    count: daysLeft,
                })}
            </span>
        </div>
    );
}
