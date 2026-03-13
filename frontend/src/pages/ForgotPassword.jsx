import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import AuthLangToggle from '../components/AuthLangToggle';

const API = import.meta.env.VITE_API_URL || '';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resetLink, setResetLink] = useState(null);
    const { t, i18n } = useTranslation('translation', { keyPrefix: 'auth' });
    const isAr = i18n.language === 'ar';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const res = await fetch(`${API}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Something went wrong');

            setSuccess(true);
            if (data.resetToken) {
                setResetLink(`${window.location.origin}/reset-password/${data.resetToken}`);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const inputClass = clsx(
        "w-full rounded-xl border border-white/[0.08] bg-white/[0.05] text-white placeholder-white/25 text-sm py-3 transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/30 focus:bg-white/[0.08]",
        "hover:bg-white/[0.07] hover:border-white/[0.15]"
    );

    return (
        <div className="min-h-screen relative flex flex-col overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950" />
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/30 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/30 blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
                <div className="absolute top-[30%] left-[20%] w-[30%] h-[30%] rounded-full bg-blue-500/20 blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
            </div>

            {/* Grid pattern overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            />

            {/* Header */}
            <header className="relative z-20 w-full px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5 group">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">COD Flow</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <AuthLangToggle />
                        <Link
                            to="/login"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] border border-white/[0.1] text-white/80 hover:text-white hover:bg-white/[0.12] transition-all text-sm font-medium"
                        >
                            {t('signIn')}
                        </Link>
                    </div>
                </div>
            </header>

            {/* Card centered */}
            <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-md">
                    {/* Logo / Brand */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 mb-4">
                            <Mail className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{t('forgotTitle')}</h1>
                        <p className="text-indigo-200/60 text-sm mt-1">{t('forgotSubtitle')}</p>
                    </div>

                    {/* Glass card */}
                    <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.1] rounded-2xl p-8 shadow-2xl shadow-black/20">
                        {success ? (
                            <div className="space-y-5">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-4 rounded-xl text-sm flex items-start gap-3">
                                    <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
                                    <span>{t('forgotSuccess')}</span>
                                </div>
                                {resetLink && (
                                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
                                        <p className="text-xs text-indigo-300 font-medium mb-1">{t('forgotDevLink')}</p>
                                        <a
                                            href={resetLink}
                                            className="text-sm text-indigo-400 underline break-all hover:text-indigo-300 transition-colors"
                                        >
                                            {resetLink}
                                        </a>
                                    </div>
                                )}
                                <Link
                                    to="/login"
                                    className="flex items-center justify-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    <ArrowLeft className={clsx("h-4 w-4", isAr && "rotate-180")} />
                                    {t('backToLogin')}
                                </Link>
                            </div>
                        ) : (
                            <form className="space-y-5" onSubmit={handleSubmit}>
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                                        <span className="shrink-0 mt-0.5">&#9888;</span>
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Email */}
                                <div>
                                    <label className={clsx("block text-sm font-medium text-indigo-100/80 mb-1.5", isAr ? "text-right" : "text-left")}>
                                        {t('emailAddress')}
                                    </label>
                                    <div className="relative group">
                                        <div className={clsx("absolute inset-y-0 flex items-center pointer-events-none z-10 text-indigo-300/50 group-focus-within:text-indigo-400 transition-colors", isAr ? "right-0 pr-3.5" : "left-0 pl-3.5")}>
                                            <Mail className="h-5 w-5" />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            className={clsx(inputClass, isAr ? "pr-12 pl-4 text-right" : "pl-12 pr-4 text-left")}
                                            placeholder={t('phEmail')}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={clsx(
                                        "group w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200",
                                        "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25",
                                        "hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/30 hover:shadow-xl",
                                        "active:scale-[0.98]",
                                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                                    )}
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin h-5 w-5" />
                                    ) : (
                                        t('forgotSend')
                                    )}
                                </button>

                                <Link
                                    to="/login"
                                    className="flex items-center justify-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors pt-1"
                                >
                                    <ArrowLeft className={clsx("h-4 w-4", isAr && "rotate-180")} />
                                    {t('backToLogin')}
                                </Link>
                            </form>
                        )}
                    </div>

                    {/* Footer text */}
                    <p className="text-center text-xs text-white/20 mt-6">
                        &copy; {new Date().getFullYear()} COD Flow
                    </p>
                </div>
            </div>
        </div>
    );
}
