import { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Package, Globe, Menu, X, LayoutDashboard } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';

export default function LandingHeader() {
    const { t, i18n } = useTranslation();
    const { user } = useContext(AuthContext);
    const [mobileOpen, setMobileOpen] = useState(false);

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
    };

    const navLinks = [
        { href: '#features', label: t('landing.navFeatures', 'المميزات') },
        { href: '#comparison', label: t('landing.navCompare', 'المقارنة') },
        { href: '#pricing', label: t('landing.navPricing', 'الأسعار') },
    ];

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
                <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">

                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 uppercase tracking-tighter">
                            COD <span className="text-indigo-600">Flow</span>
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden lg:flex items-center gap-8">
                        {navLinks.map(link => (
                            <a key={link.href} href={link.href} className="text-sm font-semibold text-gray-600 hover:text-blue-600 transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-blue-600 after:transition-all hover:after:w-full">
                                {link.label}
                            </a>
                        ))}
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button onClick={toggleLanguage} className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all hidden sm:flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">{i18n.language === 'ar' ? 'EN' : 'عربي'}</span>
                        </button>

                        {user ? (
                            /* Logged-in state */
                            <Link to="/dashboard" className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                                <LayoutDashboard className="w-4 h-4" />
                                {t('landing.goToDashboard', 'لوحة التحكم')}
                            </Link>
                        ) : (
                            /* Guest state */
                            <>
                                <Link to="/login" className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors hidden sm:block px-4 py-2.5 rounded-xl hover:bg-gray-50">
                                    {t('landing.login', 'تسجيل الدخول')}
                                </Link>
                                <Link to="/register" className="px-5 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-xl shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all hidden sm:block">
                                    {t('landing.startFree', 'ابدأ مجاناً')}
                                </Link>
                            </>
                        )}

                        {/* Mobile hamburger */}
                        <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                            <Menu className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-[60] lg:hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <div className="absolute top-0 right-0 w-80 max-w-[85vw] h-full bg-white shadow-2xl animate-slide-in-right">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-8">
                                <span className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                                    COD <span className="text-blue-600">Flow</span>
                                </span>
                                <button onClick={() => setMobileOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <nav className="flex flex-col gap-2 mb-8">
                                {navLinks.map(link => (
                                    <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="px-4 py-3 text-base font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                        {link.label}
                                    </a>
                                ))}
                            </nav>

                            <div className="border-t border-gray-100 pt-6 flex flex-col gap-3">
                                <button onClick={() => { toggleLanguage(); setMobileOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition-colors w-full">
                                    <Globe className="w-4 h-4" />
                                    {i18n.language === 'ar' ? 'English' : 'العربية'}
                                </button>

                                {user ? (
                                    <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md">
                                        <LayoutDashboard className="w-4 h-4" />
                                        {t('landing.goToDashboard', 'لوحة التحكم')}
                                    </Link>
                                ) : (
                                    <>
                                        <Link to="/login" onClick={() => setMobileOpen(false)} className="px-5 py-3 text-sm font-semibold text-gray-700 text-center hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors">
                                            {t('landing.login', 'تسجيل الدخول')}
                                        </Link>
                                        <Link to="/register" onClick={() => setMobileOpen(false)} className="px-5 py-3 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-xl shadow-md text-center transition-all">
                                            {t('landing.startFree', 'ابدأ مجاناً')}
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
