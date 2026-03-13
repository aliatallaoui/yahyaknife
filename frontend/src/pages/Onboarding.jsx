import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Phone, MapPin, Package, Truck, CreditCard,
    ArrowRight, ArrowLeft, Check, Rocket, Sparkles, Shield,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';

export default function Onboarding() {
    const { user, refetchUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('translation', { keyPrefix: 'onboarding' });
    const isAr = i18n.language === 'ar';

    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);

    // Form state
    const [companyName, setCompanyName] = useState(user?.tenantName || '');
    const [businessPhone, setBusinessPhone] = useState('');
    const [businessAddress, setBusinessAddress] = useState('');
    const [currency, setCurrency] = useState('DZD');

    const STEPS = [
        { id: 'welcome', label: t('stepWelcome') },
        { id: 'business', label: t('stepBusiness') },
        { id: 'launch', label: t('stepLaunch') },
    ];

    const canProceed = () => {
        if (step === 1) return companyName.trim().length >= 2;
        return true;
    };

    const handleComplete = async () => {
        setSaving(true);
        try {
            const res = await apiFetch('/api/auth/onboarding', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName: companyName.trim(),
                    businessPhone: businessPhone.trim(),
                    businessAddress: businessAddress.trim(),
                    currency,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save');
            }
            if (refetchUser) await refetchUser();
            toast.success(t('toastSuccess'));
            navigate('/orders-hub', { replace: true });
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const next = () => {
        if (step === STEPS.length - 1) {
            handleComplete();
        } else {
            setStep(s => s + 1);
        }
    };

    const back = () => setStep(s => Math.max(0, s - 1));

    const inputClass = clsx(
        "w-full rounded-xl border border-white/[0.08] bg-white/[0.05] text-white placeholder-white/25 text-sm py-3 transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/30 focus:bg-white/[0.08]",
        "hover:bg-white/[0.07] hover:border-white/[0.15]"
    );

    const iconSide = isAr ? 'right-3.5' : 'left-3.5';
    const inputPad = isAr ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left';
    const labelAlign = isAr ? 'text-right' : 'text-left';

    return (
        <div className="min-h-screen relative flex flex-col overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950" />
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/30 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/30 blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
            </div>
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            />

            {/* Content */}
            <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-lg">
                    {/* Logo */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 mb-3">
                            <Package className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-white">COD Flow</h1>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {STEPS.map((s, i) => (
                            <div key={s.id} className="flex items-center gap-2">
                                <div className={clsx(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                                    i < step && 'bg-emerald-500 text-white',
                                    i === step && 'bg-indigo-500 text-white ring-4 ring-indigo-500/20',
                                    i > step && 'bg-white/10 text-white/40'
                                )}>
                                    {i < step ? <Check className="w-4 h-4" /> : i + 1}
                                </div>
                                <span className={clsx(
                                    'text-xs font-medium hidden sm:block',
                                    i <= step ? 'text-white/80' : 'text-white/30'
                                )}>
                                    {s.label}
                                </span>
                                {i < STEPS.length - 1 && (
                                    <div className={clsx(
                                        'w-8 h-0.5 rounded-full mx-1',
                                        i < step ? 'bg-emerald-500' : 'bg-white/10'
                                    )} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Card */}
                    <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.1] rounded-2xl p-8 shadow-2xl shadow-black/20">

                        {/* ── Step 0: Welcome ───────────────────────── */}
                        {step === 0 && (
                            <div className="text-center space-y-6">
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 mb-2">
                                    <Sparkles className="w-10 h-10 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">
                                        {t('welcomeTitle', { name: user?.name ? ` ${user.name.split(' ')[0]}` : '' })}
                                    </h2>
                                    <p className="text-indigo-200/60 text-sm leading-relaxed max-w-sm mx-auto">
                                        {t('welcomeDesc')}
                                    </p>
                                </div>

                                {/* Feature highlights */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                    {[
                                        { icon: Package, text: t('featureOrders'), color: 'text-blue-400' },
                                        { icon: Truck, text: t('featureCourier'), color: 'text-emerald-400' },
                                        { icon: Shield, text: t('featureTrial'), color: 'text-amber-400' },
                                    ].map(f => (
                                        <div key={f.text} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                            <f.icon className={clsx('w-5 h-5', f.color)} />
                                            <span className="text-[11px] text-white/60 font-medium">{f.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Step 1: Business Info ──────────────────── */}
                        {step === 1 && (
                            <div className="space-y-5">
                                <div className="text-center mb-2">
                                    <h2 className="text-xl font-bold text-white mb-1">{t('businessTitle')}</h2>
                                    <p className="text-indigo-200/50 text-sm">{t('businessDesc')}</p>
                                </div>

                                {/* Company Name */}
                                <div>
                                    <label className={clsx("block text-sm font-medium text-indigo-100/80 mb-1.5", labelAlign)}>
                                        {t('companyLabel')}
                                    </label>
                                    <div className="relative">
                                        <Building2 className={clsx("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300/50", iconSide)} />
                                        <input
                                            type="text"
                                            required
                                            className={clsx(inputClass, inputPad)}
                                            placeholder={t('companyPlaceholder')}
                                            value={companyName}
                                            onChange={e => setCompanyName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className={clsx("block text-sm font-medium text-indigo-100/80 mb-1.5", labelAlign)}>
                                        {t('phoneLabel')}
                                    </label>
                                    <div className="relative">
                                        <Phone className={clsx("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300/50", iconSide)} />
                                        <input
                                            type="tel"
                                            className={clsx(inputClass, inputPad)}
                                            placeholder={t('phonePlaceholder')}
                                            value={businessPhone}
                                            onChange={e => setBusinessPhone(e.target.value)}
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                {/* Address */}
                                <div>
                                    <label className={clsx("block text-sm font-medium text-indigo-100/80 mb-1.5", labelAlign)}>
                                        {t('addressLabel')}
                                    </label>
                                    <div className="relative">
                                        <MapPin className={clsx("absolute top-3 w-4 h-4 text-indigo-300/50", iconSide)} />
                                        <input
                                            type="text"
                                            className={clsx(inputClass, inputPad)}
                                            placeholder={t('addressPlaceholder')}
                                            value={businessAddress}
                                            onChange={e => setBusinessAddress(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Currency */}
                                <div>
                                    <label className={clsx("block text-sm font-medium text-indigo-100/80 mb-1.5", labelAlign)}>
                                        {t('currencyLabel')}
                                    </label>
                                    <div className="relative">
                                        <CreditCard className={clsx("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300/50", iconSide)} />
                                        <select
                                            className={clsx(inputClass, inputPad, 'appearance-none cursor-pointer')}
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value)}
                                        >
                                            <option value="DZD">{t('currencyDZD')}</option>
                                            <option value="MAD">{t('currencyMAD')}</option>
                                            <option value="TND">{t('currencyTND')}</option>
                                            <option value="EUR">{t('currencyEUR')}</option>
                                            <option value="USD">{t('currencyUSD')}</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Step 2: Launch ────────────────────────── */}
                        {step === 2 && (
                            <div className="text-center space-y-6">
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20 mb-2">
                                    <Rocket className="w-10 h-10 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">{t('launchTitle')}</h2>
                                    <p className="text-indigo-200/60 text-sm leading-relaxed max-w-sm mx-auto">
                                        {t('launchDesc')}
                                    </p>
                                </div>

                                {/* Summary */}
                                {companyName && (
                                    <div className={clsx("bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 space-y-2", labelAlign)}>
                                        <p className="text-xs text-white/40 uppercase font-semibold mb-2">{t('yourSetup')}</p>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/50">{t('company')}</span>
                                            <span className="text-white font-medium">{companyName}</span>
                                        </div>
                                        {businessPhone && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-white/50">{t('phone')}</span>
                                                <span className="text-white font-medium" dir="ltr">{businessPhone}</span>
                                            </div>
                                        )}
                                        {businessAddress && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-white/50">{t('address')}</span>
                                                <span className="text-white font-medium">{businessAddress}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/50">{t('currency')}</span>
                                            <span className="text-white font-medium">{currency}</span>
                                        </div>
                                        <div className="flex justify-between text-sm pt-1 border-t border-white/[0.06]">
                                            <span className="text-white/50">{t('plan')}</span>
                                            <span className="text-emerald-400 font-medium">{t('freeTrial')}</span>
                                        </div>
                                    </div>
                                )}

                                {/* What's next */}
                                <div className={clsx("space-y-2", labelAlign)}>
                                    <p className="text-xs text-white/40 uppercase font-semibold">{t('whatsNext')}</p>
                                    {[t('nextProduct'), t('nextCourier'), t('nextOrder')].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 text-sm text-white/60">
                                            <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] text-indigo-400 font-bold">{i + 1}</span>
                                            </div>
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/[0.06]">
                            {step > 0 ? (
                                <button
                                    onClick={back}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
                                >
                                    {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                                    {t('btnBack')}
                                </button>
                            ) : (
                                <button
                                    onClick={() => { handleComplete(); }}
                                    className="text-sm text-white/30 hover:text-white/50 transition-colors"
                                >
                                    {t('btnSkip')}
                                </button>
                            )}

                            <button
                                onClick={next}
                                disabled={!canProceed() || saving}
                                className={clsx(
                                    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                                    "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25",
                                    "hover:from-indigo-500 hover:to-purple-500 hover:shadow-xl",
                                    "disabled:opacity-40 disabled:cursor-not-allowed"
                                )}
                            >
                                {saving ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : step === STEPS.length - 1 ? (
                                    <>
                                        {t('btnLaunch')}
                                        <Rocket className="w-4 h-4" />
                                    </>
                                ) : (
                                    <>
                                        {t('btnContinue')}
                                        {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-xs text-white/20 mt-6">
                        &copy; {new Date().getFullYear()} COD Flow
                    </p>
                </div>
            </div>
        </div>
    );
}
