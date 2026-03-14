import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingFooter() {
    const { t } = useTranslation();

    return (
        <footer className="bg-gray-50 border-t border-gray-200/60 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mb-12">

                    {/* Brand */}
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                                <Package className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 uppercase tracking-tighter">
                                COD <span className="text-indigo-600">Flow</span>
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 font-medium max-w-sm leading-relaxed">
                            {t('landing.footerTagline', 'الحل الشامل والموثوق لتبسيط تجارة التجارة الإلكترونية وإدارة شركات الشحن.')}
                        </p>
                    </div>

                    {/* Links */}
                    <div>
                        <span className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-4 block">{t('landing.links', 'روابط مهمة')}</span>
                        <ul className="space-y-3">
                            <li><a href="#features" className="text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors">{t('landing.navFeatures', 'المميزات')}</a></li>
                            <li><a href="#comparison" className="text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors">{t('landing.navCompare', 'المقارنة')}</a></li>
                            <li><a href="#pricing" className="text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors">{t('landing.navPricing', 'الأسعار')}</a></li>
                            <li><Link to="/login" className="text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors">{t('landing.login', 'تسجيل الدخول')}</Link></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <span className="font-bold text-gray-900 text-xs uppercase tracking-widest mb-4 block">{t('landing.support', 'الدعم')}</span>
                        <ul className="space-y-3">
                            <li><a href="#" className="text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors">{t('landing.contact', 'اتصل بنا')}</a></li>
                            <li><a href="#" className="text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors">{t('landing.privacy', 'سياسة الخصوصية')}</a></li>
                            <li><a href="#" className="text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors">{t('landing.terms', 'شروط الاستخدام')}</a></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-gray-200/60 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-medium text-gray-400">
                    <p>&copy; {new Date().getFullYear()} COD Flow. {t('landing.copyright', 'جميع الحقوق محفوظة.')}</p>
                    <p>{t('landing.madeWith', 'صُنع بكل حب لخدمة التجارة الإلكترونية.')}</p>
                </div>
            </div>
        </footer>
    );
}
