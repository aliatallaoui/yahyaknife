import { TrendingUp, TrendingDown, Calendar, AlertCircle, PieChart, Target, Inbox, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

export default function KPICards({ kpis, channels }) {
    if (!kpis) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <SalesCard data={kpis.totalSales} />
            <NetProfitCard data={kpis.netProfit} dateRange={kpis.totalSales?.dateRange} />
            <InventoryCard data={kpis.inventoryValues} />
            <OrdersCard data={kpis.totalOrders} channels={channels} />
        </div>
    );
}

function CardWrapper({ title, icon: Icon, children, trend, trendType = 'up' }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)] p-6 flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                    <span>{title}</span>
                    {Icon && <Icon className="w-4 h-4 text-gray-400" />}
                </div>

                {trend !== undefined && (
                    <div className={clsx(
                        "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                        trendType === 'up'
                            ? "bg-blue-50 text-blue-600"
                            : "bg-[#FFE2E5] text-[#D93025]"
                    )}>
                        {trendType === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{Math.abs(trend)}%</span>
                    </div>
                )}
            </div>
            <div className="flex-1 flex flex-col justify-between">
                {children}
            </div>
        </div>
    );
}

/* 1. Total Sales */
function SalesCard({ data }) {
    const { t } = useTranslation();
    if (!data) return null;
    return (
        <CardWrapper title={t('widgets.kpiTotalSales')} icon={PieChart} trend={data.trend} trendType="up">
            <div>
                <h2 className="text-4xl font-black text-gray-900 tabular-nums">
                    {data.value.toLocaleString()} <span className="text-xl text-gray-400 font-bold ml-1">{t('widgets.currencyDZ')}</span>
                </h2>
                <div className="flex items-center gap-2 mt-4 text-gray-500 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>{data.dateRange}</span>
                </div>
            </div>
            <button className="mt-8 w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
                {t('widgets.btnViewDetails')}
            </button>
        </CardWrapper>
    );
}

/* 2. Net Profit */
function NetProfitCard({ data, dateRange }) {
    const { t } = useTranslation();
    if (!data) return null;
    return (
        <CardWrapper title={t('widgets.kpiNetProfit')} icon={DollarSign} trend={data.trend} trendType={data.trend >= 0 ? "up" : "down"}>
            <div>
                <h2 className="text-4xl font-black text-emerald-600 tabular-nums">
                    {data.value.toLocaleString()} <span className="text-xl text-gray-400 font-bold ml-1">{t('widgets.currencyDZ')}</span>
                </h2>
                <div className="flex items-center gap-2 mt-4 text-gray-500 text-sm font-medium">
                    <Calendar className="w-4 h-4" />
                    <span>{dateRange}</span>
                </div>
            </div>
            <button className="mt-8 w-full py-2.5 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 text-sm font-bold shadow-sm hover:bg-emerald-100 hover:text-emerald-800 transition-colors">
                {t('widgets.btnViewReport')}
            </button>
        </CardWrapper>
    );
}

/* 3. Inventory Values */
function InventoryCard({ data }) {
    const { t } = useTranslation();
    if (!data) return null;
    return (
        <CardWrapper title={t('widgets.kpiInventoryValues')} icon={Target} trend={data.trend} trendType="down">
            <div>
                <h2 className="text-4xl font-black text-gray-900 tabular-nums">
                    {data.value.toLocaleString()} <span className="text-xl text-gray-400 font-bold ml-1">{t('widgets.currencyDZ')}</span>
                </h2>
                <div className="flex items-center gap-2 mt-4 text-[#D93025] text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    <span>{data.warning}</span>
                </div>
            </div>
            <button className="mt-8 w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
                {t('widgets.btnViewDetails')}
            </button>
        </CardWrapper>
    );
}

/* 3. Total Orders & Channels */
function OrdersCard({ data, channels }) {
    const { t } = useTranslation();
    if (!data || !channels) return null;
    return (
        <CardWrapper title={t('widgets.kpiTotalOrders')} icon={Inbox} trend={data.trend} trendType="up">
            <div>
                <h2 className="text-4xl font-black text-gray-900 tabular-nums mb-6">{data.value.toLocaleString()}</h2>

                {/* Horizontal Progress Separated Blocks */}
                <div className="flex w-full h-12 gap-1.5 mb-5">
                    {channels.map((ch, i) => (
                        <div
                            key={i}
                            className={clsx(
                                "h-full rounded-md shadow-inner transition-transform hover:-translate-y-0.5"
                            )}
                            style={{ width: `${ch.percentage}%`, backgroundColor: ch.color }}
                            title={`${ch.name}: ${ch.percentage}%`}
                        />
                    ))}
                </div>

                {/* Channels Legend Grid */}
                <div className="grid grid-cols-2 gap-y-3 mb-6">
                    {channels.map((ch, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-900">{ch.name === 'Website' ? t('modals.chWebsite') : ch.name === 'Amazon' ? t('modals.chAmazon') : ch.name === 'Alibaba' ? t('modals.chAlibaba') : ch.name === 'Tokopedia' ? t('modals.chTokopedia') : ch.name === 'Shopee' ? t('modals.chShopee') : ch.name === 'Other' ? t('modals.chOther') : ch.name}</span>
                                <span className="text-xs text-gray-500 tabular-nums">{ch.value.toLocaleString()} ({ch.percentage}%)</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between text-sm font-semibold">
                <a href="#" className="text-blue-600 hover:text-blue-700 underline underline-offset-4">{t('widgets.trackOrderChannel')}</a>
                <button className="px-4 py-2 rounded-xl border border-gray-200 text-gray-900 hover:bg-gray-50 transition-colors">
                    {t('widgets.btnViewDetails')}
                </button>
            </div>
        </CardWrapper>
    );
}
