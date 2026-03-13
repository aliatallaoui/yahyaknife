import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { ShieldOff, LogOut, Package, Mail } from 'lucide-react';
import clsx from 'clsx';

export default function SubscriptionExpired() {
    const { user, logout } = useContext(AuthContext);
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';

    const sub = user?.subscription;
    const isTrial = sub?.status === 'expired' && !sub?.currentPeriodEnd;

    return (
        <div className="min-h-screen relative flex flex-col overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950" />
            <div className="absolute inset-0 opacity-20">
                <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-red-500/30 blur-[120px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/30 blur-[120px]" />
            </div>

            {/* Header */}
            <header className="relative z-20 w-full px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">COD Flow</span>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] border border-white/[0.1] text-white/80 hover:text-white hover:bg-white/[0.12] transition-all text-sm font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        {t('dropdown.signOut', 'Sign Out')}
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-lg text-center">
                    {/* Icon */}
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/20 mb-6">
                        <ShieldOff className="w-10 h-10 text-red-400" />
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-3">
                        {isTrial
                            ? t('subscription.trialExpiredTitle', 'Your Free Trial Has Ended')
                            : t('subscription.expiredTitle', 'Subscription Expired')
                        }
                    </h1>

                    <p className="text-indigo-200/60 text-base mb-8 max-w-md mx-auto">
                        {isTrial
                            ? t('subscription.trialExpiredDesc', 'Your 14-day free trial is over. Upgrade to a paid plan to continue managing your business with COD Flow.')
                            : t('subscription.expiredDesc', 'Your subscription has expired. Renew your plan to regain access to all features.')
                        }
                    </p>

                    {/* Pricing cards placeholder */}
                    <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.1] rounded-2xl p-8 shadow-2xl shadow-black/20 mb-6">
                        <h2 className={clsx("text-lg font-bold text-white mb-4", isAr && "text-right")}>
                            {t('subscription.choosePlan', 'Choose Your Plan')}
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Basic Plan */}
                            <div className="rounded-xl border border-white/[0.1] bg-white/[0.05] p-5 text-start hover:bg-white/[0.08] transition-colors">
                                <p className="text-sm font-bold text-indigo-300 mb-1">{t('subscription.planBasic', 'Basic')}</p>
                                <p className="text-2xl font-black text-white mb-2">2,900 <span className="text-sm font-medium text-white/40">DA/{t('subscription.month', 'mo')}</span></p>
                                <ul className="text-xs text-white/50 space-y-1">
                                    <li>- {t('subscription.featureOrders', 'Unlimited orders')}</li>
                                    <li>- {t('subscription.featureUsers', 'Up to 5 users')}</li>
                                    <li>- {t('subscription.featureSupport', 'Email support')}</li>
                                </ul>
                            </div>

                            {/* Pro Plan */}
                            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-5 text-start ring-1 ring-indigo-500/20">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-bold text-indigo-300">{t('subscription.planPro', 'Pro')}</p>
                                    <span className="text-[10px] font-bold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full">{t('subscription.popular', 'Popular')}</span>
                                </div>
                                <p className="text-2xl font-black text-white mb-2">5,900 <span className="text-sm font-medium text-white/40">DA/{t('subscription.month', 'mo')}</span></p>
                                <ul className="text-xs text-white/50 space-y-1">
                                    <li>- {t('subscription.featureEverything', 'Everything in Basic')}</li>
                                    <li>- {t('subscription.featureUnlimitedUsers', 'Unlimited users')}</li>
                                    <li>- {t('subscription.featureAnalytics', 'Advanced analytics')}</li>
                                    <li>- {t('subscription.featurePriority', 'Priority support')}</li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-6">
                            <a
                                href="mailto:support@codflow.dz"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-purple-500 transition-all"
                            >
                                <Mail className="w-4 h-4" />
                                {t('subscription.contactSales', 'Contact Us to Upgrade')}
                            </a>
                        </div>
                    </div>

                    <p className="text-center text-xs text-white/20">
                        &copy; {new Date().getFullYear()} COD Flow
                    </p>
                </div>
            </div>
        </div>
    );
}
