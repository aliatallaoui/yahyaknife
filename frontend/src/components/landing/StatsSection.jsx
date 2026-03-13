import { useTranslation } from 'react-i18next';
import { Package, Users, Truck, TrendingUp } from 'lucide-react';

export default function StatsSection() {
    const { t } = useTranslation();

    const stats = [
        { icon: Package, value: '50K+', label: t('landing.stat1', 'طلبية تمت معالجتها'), color: 'blue' },
        { icon: Users, value: '200+', label: t('landing.stat2', 'متجر يثق بنا'), color: 'indigo' },
        { icon: Truck, value: '15+', label: t('landing.stat3', 'شركة شحن متصلة'), color: 'violet' },
        { icon: TrendingUp, value: '90%', label: t('landing.stat4', 'توفير في الوقت'), color: 'emerald' },
    ];

    return (
        <section className="py-16 bg-white border-y border-gray-100">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
                    {stats.map((stat, i) => (
                        <div key={i} className="text-center group">
                            <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-${stat.color}-50 flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                            </div>
                            <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 mb-1 tabular-nums">{stat.value}</p>
                            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
