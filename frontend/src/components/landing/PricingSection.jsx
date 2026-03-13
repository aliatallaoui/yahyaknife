import { useTranslation } from 'react-i18next';
import { Check, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PricingSection() {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    const tiers = [
        {
            name: t('landing.plan1Name', 'البداية'),
            price: t('landing.plan1Price', '4,200'),
            period: t('landing.periodQuaterly', 'دج / 3 أشهر'),
            description: t('landing.plan1Desc', 'مثالي للمتاجر الجديدة لدخول السوق بقوة.'),
            features: [
                t('landing.feat600', '600 طلبية صالحة لمدة 90 يوم'),
                t('landing.featBasic', 'لوحة تحكم أساسية للمبيعات'),
                t('landing.featSupport', 'دعم فني خلال أوقات العمل')
            ],
            isPopular: false,
            accent: 'gray'
        },
        {
            name: t('landing.plan2Name', 'النمو'),
            price: t('landing.plan2Price', '6,500'),
            period: t('landing.periodQuaterly', 'دج / 3 أشهر'),
            description: t('landing.plan2Desc', 'للمتاجر المتنامية التي تحتاج لأدوات احترافية.'),
            features: [
                t('landing.feat1000', '1000 طلبية صالحة لمدة 90 يوم'),
                t('landing.featCallCenter', 'حساب لموظف خدمة عملاء (Call Center)'),
                t('landing.featCourier', 'تتبع متقدم عبر شركات الشحن')
            ],
            isPopular: true,
            accent: 'blue'
        },
        {
            name: t('landing.plan3Name', 'الريادة'),
            price: t('landing.plan3Price', '20,000'),
            period: t('landing.periodBiAnnual', 'دج / 6 أشهر'),
            description: t('landing.plan3Desc', 'للشركات الكبرى بحثاً عن التوسع والأتمتة الشاملة.'),
            features: [
                t('landing.feat10000', '10,000 طلبية صالحة لمدة 180 يوم'),
                t('landing.featUnlimitedUsers', 'حسابات غير محدودة للموظفين'),
                t('landing.featAI', 'ذكاء اصطناعي لكشف العملاء الوهميين'),
                t('landing.featApi', 'ربط API مخصص')
            ],
            isPopular: false,
            accent: 'gray'
        }
    ];

    return (
        <section id="pricing" className="py-24 bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-6">

                <div className="text-center max-w-2xl mx-auto mb-16 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-100/40 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-bold text-blue-700 uppercase tracking-widest mb-4 relative z-10">
                        {t('landing.pricingBadge', 'الأسعار')}
                    </div>
                    <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black text-gray-900 mb-4 tracking-tight relative z-10">
                        {t('landing.pricingTitle', 'أسعار تتناسب مع نموك')}
                    </h2>
                    <p className="text-gray-500 font-medium text-lg relative z-10">
                        {t('landing.pricingSubtitle', 'ابدأ مجاناً لمدة 14 يوم، ولا تدفع إلا عندما تتأكد من القيمة.')}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6 max-w-6xl mx-auto items-start">
                    {tiers.map((tier, idx) => (
                        <div key={idx} className={`relative bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 transition-all duration-300 flex flex-col ${tier.isPopular
                            ? 'border-2 border-blue-500 shadow-2xl shadow-blue-500/10 md:scale-105 z-10 ring-1 ring-blue-500/20'
                            : 'border border-gray-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1'
                            }`}>

                            {tier.isPopular && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-blue-500/30">
                                    <Star className="w-3.5 h-3.5 fill-current" /> {t('landing.mostPopular', 'الأكثر طلباً')}
                                </div>
                            )}

                            <h3 className="text-xl font-bold text-gray-900 mb-2 mt-1">{tier.name}</h3>
                            <p className="text-sm text-gray-500 mb-6 font-medium leading-relaxed">{tier.description}</p>

                            <div className="mb-6 pb-6 border-b border-gray-100 flex items-baseline gap-2">
                                <span className="text-4xl font-black text-gray-900 tabular-nums">{tier.price}</span>
                                <span className="text-sm font-medium text-gray-400">{tier.period}</span>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {tier.features.map((feat, fIdx) => (
                                    <li key={fIdx} className="flex items-start gap-3">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${tier.isPopular ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                            <Check className={`w-3.5 h-3.5 ${tier.isPopular ? 'text-blue-600' : 'text-gray-500'}`} />
                                        </div>
                                        <span className="text-gray-600 font-medium text-sm">{feat}</span>
                                    </li>
                                ))}
                            </ul>

                            <Link to="/register" className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${tier.isPopular
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20 hover:shadow-xl'
                                : 'bg-gray-50 text-gray-900 hover:bg-gray-100 border border-gray-200'
                                }`}>
                                {t('landing.startTrial', 'ابدأ تجربتك الآن')}
                                <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                            </Link>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
}
