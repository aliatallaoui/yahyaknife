import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, BarChart3, Package, Truck, Users, TrendingUp, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HeroSection() {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    return (
        <section className="relative pt-28 pb-16 lg:pt-40 lg:pb-28 overflow-hidden">
            {/* Abstract Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-20 left-[10%] w-72 h-72 bg-blue-400/15 rounded-full blur-3xl animate-pulse-slow"></div>
                <div className="absolute top-40 right-[10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-t from-blue-50/80 to-transparent rounded-full blur-3xl"></div>
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50/80 border border-blue-100 shadow-sm mb-8 animate-fade-in-up">
                        <span className="flex w-2 h-2 rounded-full bg-emerald-500 relative">
                            <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 animate-ping opacity-40"></span>
                        </span>
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-widest">
                            {t('landing.versionBadge', 'الإصدار 2.0 متاح الآن')}
                        </span>
                    </div>

                    <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black text-gray-900 tracking-tight leading-[1.08] mb-5 sm:mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                        {t('landing.heroTitle1', 'ارتق بتجارتك الإلكترونية')} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">
                            {t('landing.heroTitle2', 'إلى المستوى التالي')}
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg text-gray-500 mb-8 sm:mb-10 max-w-2xl mx-auto font-medium leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        {t('landing.heroSubtitle', 'منصة شاملة توفر لك 90% من وقتك ومجهودك. أتمتة المراكز، تتبع المخزون، وتوجيه شركات الشحن في مكان واحد.')}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                        <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/25 hover:shadow-2xl hover:shadow-blue-600/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 text-base">
                            {t('landing.ctaPrimary', 'احصل على 14 يوم مجاناً')}
                            <ArrowRight className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
                        </Link>
                        <a href="#features" className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2">
                            {t('landing.ctaSecondary', 'اكتشف المميزات')}
                        </a>
                    </div>

                    {/* Trust Indicators */}
                    <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-gray-500 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('landing.trust1', 'لا يلزم بطاقة ائتمان')}</div>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('landing.trust2', 'إعداد في دقيقتين')}</div>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('landing.trust3', 'دعم فني 24/7')}</div>
                    </div>
                </div>

                {/* Dashboard Preview */}
                <div className="mt-16 lg:mt-20 relative animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                    <div className="relative mx-auto max-w-5xl">
                        {/* Browser Chrome */}
                        <div className="bg-gray-900 rounded-t-2xl px-4 py-3 flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                            </div>
                            <div className="flex-1 mx-4">
                                <div className="bg-gray-800 rounded-lg px-4 py-1.5 text-xs text-gray-400 font-mono text-center max-w-xs mx-auto">
                                    app.codflow.dz/dashboard
                                </div>
                            </div>
                        </div>

                        {/* Dashboard Mockup */}
                        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 border-t-0 rounded-b-2xl p-6 sm:p-8 shadow-2xl shadow-gray-900/10">
                            {/* Top stats row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                                {[
                                    { icon: Package, label: t('landing.mockOrders', 'الطلبات'), value: '1,248', color: 'blue', change: '+12%' },
                                    { icon: TrendingUp, label: t('landing.mockRevenue', 'الإيرادات'), value: '847K', color: 'emerald', change: '+24%' },
                                    { icon: Truck, label: t('landing.mockDelivered', 'تم التوصيل'), value: '892', color: 'indigo', change: '+8%' },
                                    { icon: Users, label: t('landing.mockCustomers', 'العملاء'), value: '3,421', color: 'violet', change: '+18%' },
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
                                            <span className="text-xs font-bold text-emerald-600">{stat.change}</span>
                                        </div>
                                        <p className="text-2xl font-black text-gray-900 tabular-nums">{stat.value}</p>
                                        <p className="text-xs font-medium text-gray-400 mt-1">{stat.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Chart placeholder + sidebar */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2 bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-gray-900">{t('landing.mockChart', 'نظرة عامة على المبيعات')}</h4>
                                        <BarChart3 className="w-4 h-4 text-gray-400" />
                                    </div>
                                    {/* Fake chart bars */}
                                    <div className="flex items-end gap-2 h-28">
                                        {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                                            <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-blue-500 to-blue-400 opacity-80 transition-all hover:opacity-100" style={{ height: `${h}%` }} />
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                                    <h4 className="text-sm font-bold text-gray-900 mb-4">{t('landing.mockRecent', 'آخر الطلبات')}</h4>
                                    <div className="space-y-3">
                                        {[
                                            { status: 'bg-emerald-500', name: '#1248' },
                                            { status: 'bg-blue-500', name: '#1247' },
                                            { status: 'bg-amber-500', name: '#1246' },
                                            { status: 'bg-emerald-500', name: '#1245' },
                                        ].map((order, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${order.status}`} />
                                                <div className="flex-1">
                                                    <div className="h-2 bg-gray-100 rounded-full w-full"></div>
                                                </div>
                                                <span className="text-xs font-mono text-gray-400">{order.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating badges */}
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 hidden lg:flex items-center gap-3 animate-float">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">99.9%</p>
                                <p className="text-xs text-gray-500">{t('landing.uptime', 'وقت التشغيل')}</p>
                            </div>
                        </div>

                        <div className="absolute -right-4 top-1/3 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 hidden lg:flex items-center gap-3 animate-float" style={{ animationDelay: '1s' }}>
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <Truck className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">+15</p>
                                <p className="text-xs text-gray-500">{t('landing.couriers', 'شركة شحن')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
