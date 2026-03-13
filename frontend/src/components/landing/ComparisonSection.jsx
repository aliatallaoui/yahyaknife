import { useTranslation } from 'react-i18next';
import { XCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function ComparisonSection() {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    const oldWay = [
        t('landing.old1', 'بيانات مبعثرة في ملفات إكسل'),
        t('landing.old2', 'إدخال يدوي لطلبات الشحن'),
        t('landing.old3', 'لا يوجد تتبع لأداء موظفي الاتصال'),
        t('landing.old4', 'عمليات استرجاع عشوائية وغير موثقة'),
        t('landing.old5', 'حسابات مالية معقدة وتأخير في التحصيل')
    ];

    const ourWay = [
        t('landing.new1', 'لوحة تحكم مركزية واحدة لكل العمليات'),
        t('landing.new2', 'توجيه شحن آلي مع اختيار أفضل سعر'),
        t('landing.new3', 'مراقبة وتقييم لحظي لأداء كل موظف'),
        t('landing.new4', 'نظام RTO آلي لتسهيل إعادة توجيه المرتجعات'),
        t('landing.new5', 'محفظة مالية شفافة وتقارير أرباح فورية')
    ];

    return (
        <section id="comparison" className="py-24 bg-white">
            <div className="max-w-5xl mx-auto px-6">

                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-widest mb-4">
                        {t('landing.compareBadge', 'المقارنة')}
                    </div>
                    <h2 className="text-3xl lg:text-5xl font-black text-gray-900 mb-4 tracking-tight">
                        {t('landing.compareTitle', 'الفارق الذي تبحث عنه')}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">

                    {/* The Old Way */}
                    <div className="bg-gray-50 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-200/60 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-50/50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-200">
                                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                                    <XCircle className="w-5 h-5 text-red-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-600">
                                    {t('landing.oldWayTitle', 'الطريقة التقليدية')}
                                </h3>
                            </div>
                            <ul className="space-y-4">
                                {oldWay.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-gray-500 font-medium">
                                        <XCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                                        <span className="line-through decoration-gray-300">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Our Platform */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl shadow-blue-600/20 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/15">
                                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                                </div>
                                <h3 className="text-xl font-bold">
                                    {t('landing.ourWayTitle', 'باستخدام منصتنا')}
                                </h3>
                            </div>
                            <ul className="space-y-4">
                                {ourWay.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3 font-semibold text-blue-50">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                </div>

                {/* Bottom CTA */}
                <div className="text-center mt-12">
                    <a href="#pricing" className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors group">
                        {t('landing.compareCtA', 'اكتشف خططنا')}
                        <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
                    </a>
                </div>
            </div>
        </section>
    );
}
