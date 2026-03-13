import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CTASection() {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    return (
        <section className="py-24 bg-white">
            <div className="max-w-5xl mx-auto px-6">
                <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl sm:rounded-[2rem] p-6 sm:p-10 md:p-16 overflow-hidden text-center">
                    {/* Background decorations */}
                    <div className="absolute top-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none"></div>
                    <div className="absolute bottom-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mb-20 pointer-events-none"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 mb-8">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-bold text-white/80 uppercase tracking-widest">
                                {t('landing.ctaBadge', '10 أيام مجاناً')}
                            </span>
                        </div>

                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white mb-5 sm:mb-6 tracking-tight leading-tight">
                            {t('landing.ctaTitle', 'جاهز لتطوير تجارتك؟')}
                        </h2>

                        <p className="text-base sm:text-lg text-gray-400 mb-8 sm:mb-10 max-w-xl mx-auto font-medium leading-relaxed">
                            {t('landing.ctaSubtitle', 'انضم لمئات المتاجر التي وثقت بنا. ابدأ تجربتك المجانية اليوم بدون أي التزام.')}
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2 text-base">
                                {t('landing.ctaStart', 'ابدأ الآن مجاناً')}
                                <ArrowRight className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
                            </Link>
                            <a href="#pricing" className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/15 text-white border border-white/10 font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
                                {t('landing.ctaPlans', 'استعرض الخطط')}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
