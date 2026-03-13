import { useTranslation } from 'react-i18next';
import { PhoneCall, Truck, Warehouse, PieChart, Bot, Users } from 'lucide-react';

export default function FeaturesBento() {
    const { t } = useTranslation();

    return (
        <section id="features" className="py-24 bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-6">

                <div className="text-center max-w-2xl mx-auto mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-bold text-blue-700 uppercase tracking-widest mb-4">
                        {t('landing.featuresBadge', 'المميزات')}
                    </div>
                    <h2 className="text-3xl lg:text-5xl font-black text-gray-900 mb-4 tracking-tight">
                        {t('landing.featuresTitle', 'كل ما تحتاجه لإدارة تجارتك')}
                    </h2>
                    <p className="text-gray-500 font-medium text-lg">
                        {t('landing.featuresSubtitle', 'واجهات سريعة، أدوات ذكية، وتحليلات دقيقة.')}
                    </p>
                </div>

                {/* Bento Grid layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 auto-rows-auto sm:auto-rows-[260px]">

                    {/* Feature 1 - Call Center (Wide) */}
                    <div className="md:col-span-2 group relative bg-white border border-gray-100/80 rounded-2xl sm:rounded-3xl p-5 sm:p-8 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-50 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none group-hover:from-blue-100 transition-colors duration-500"></div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
                                <PhoneCall className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('landing.callCenterTitle', 'مركز اتصال متطور')}</h3>
                            <p className="text-gray-500 max-w-md leading-relaxed font-medium">
                                {t('landing.callCenterDesc', 'تأكيد الطلبات بنقرة واحدة، توزيع ذكي للمكالمات، وتتبع أداء موظفي خدمة العملاء لحظة بلحظة.')}
                            </p>
                        </div>
                    </div>

                    {/* Feature 2 - Shipping Engine (Dark) */}
                    <div className="group relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-white">
                        <div className="absolute bottom-0 right-0 w-40 h-40 bg-indigo-500/15 rounded-full blur-2xl -mr-8 -mb-8 pointer-events-none group-hover:bg-indigo-500/25 transition-colors duration-500"></div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-5 group-hover:bg-white/15 transition-colors">
                                <Truck className="w-6 h-6 text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{t('landing.courierTitle', 'محرك شحن آلي')}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed font-medium">
                                {t('landing.courierDesc', 'توجيه آلي للطلبيات، مقارنة الأسعار، وتتبع فوري للشحنات مع شركات التوصيل.')}
                            </p>
                        </div>
                    </div>

                    {/* Feature 3 - Inventory */}
                    <div className="group relative bg-white border border-gray-100/80 rounded-2xl sm:rounded-3xl p-5 sm:p-8 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-emerald-50 to-transparent rounded-full -ml-10 -mt-10 pointer-events-none group-hover:from-emerald-100 transition-colors duration-500"></div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5 group-hover:bg-emerald-100 transition-colors">
                                <Warehouse className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">{t('landing.inventoryTitle', 'إدارة المخزون')}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed font-medium">
                                {t('landing.inventoryDesc', 'تتبع دقيق للمنتجات عبر مستودعات مختلفة وتنبيهات تلقائية عند انخفاض المخزون.')}
                            </p>
                        </div>
                    </div>

                    {/* Feature 4 - Analytics (Wide) */}
                    <div className="md:col-span-2 group relative bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl sm:rounded-3xl p-5 sm:p-8 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-white">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-5 group-hover:bg-white/20 transition-colors">
                                <PieChart className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold mb-3">{t('landing.analyticsTitle', 'تحليلات ذكية و Ecosystem')}</h3>
                            <p className="text-indigo-100 max-w-md leading-relaxed font-medium">
                                {t('landing.analyticsDesc', 'تقارير مالية دقيقة، تحليل أداء المندوبين، وذكاء اصطناعي لكشف العملاء ذوي المخاطر العالية.')}
                            </p>
                        </div>
                    </div>

                    {/* Feature 5 - AI Copilot */}
                    <div className="group relative bg-white border border-gray-100/80 rounded-2xl sm:rounded-3xl p-5 sm:p-8 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-amber-50 to-transparent rounded-full -mr-10 -mb-10 pointer-events-none group-hover:from-amber-100 transition-colors duration-500"></div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-5 group-hover:bg-amber-100 transition-colors">
                                <Bot className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">{t('landing.aiTitle', 'مساعد ذكي AI')}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed font-medium">
                                {t('landing.aiDesc', 'مساعد ذكاء اصطناعي يساعدك في اتخاذ القرارات وتحليل البيانات بسرعة.')}
                            </p>
                        </div>
                    </div>

                    {/* Feature 6 - CRM */}
                    <div className="md:col-span-2 group relative bg-white border border-gray-100/80 rounded-2xl sm:rounded-3xl p-5 sm:p-8 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-rose-50 to-transparent rounded-full -ml-16 -mt-16 pointer-events-none group-hover:from-rose-100 transition-colors duration-500"></div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-5 group-hover:bg-rose-100 transition-colors">
                                <Users className="w-6 h-6 text-rose-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('landing.crmTitle', 'إدارة علاقات العملاء')}</h3>
                            <p className="text-gray-500 max-w-md leading-relaxed font-medium">
                                {t('landing.crmDesc', 'ملفات عملاء شاملة، تتبع سجل الطلبات، وتصنيف ذكي للعملاء حسب الموثوقية والقيمة.')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
