import React from 'react';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { FileText, Edit3, PhoneCall, MessageCircle, CheckCircle2, Truck, AlertTriangle, PackageOpen, Ban } from 'lucide-react';

const PRIORITY_STYLES = {
    'Normal': '',
    'High Priority': 'border-l-4 border-l-orange-400 bg-orange-50/10',
    'Urgent': 'border-l-4 border-l-red-500 bg-red-50/20'
};

const STATUS_STYLES = {
    'New': 'bg-gray-100 text-gray-700 border-gray-200',
    'Confirmed': 'bg-blue-50 text-blue-700 border-blue-200',
    'Preparing': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Ready for Pickup': 'bg-violet-50 text-violet-700 border-violet-200',
    'Dispatched': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'Shipped': 'bg-amber-50 text-amber-700 border-amber-200',
    'Out for Delivery': 'bg-orange-50 text-orange-700 border-orange-200',
    'Delivered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Paid': 'bg-green-50 text-green-700 border-green-200',
    'Refused': 'bg-red-50 text-red-700 border-red-200',
    'Returned': 'bg-rose-50 text-rose-700 border-rose-200',
    'Cancelled': 'bg-gray-50 text-gray-400 border-gray-200 line-through',
};

const COD_STATUSES = ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'];

const OrderRow = React.memo(({
    order,
    isSelected,
    isExpanded,
    visibleColumns,
    hiddenColumns,
    activeStage,
    toggleSelect,
    toggleRowExpansion,
    getAge,
    onStatusChange,
    setFocusedOrderId,
    onBulkActionConfirm,
    onBulkActionCourier,
    onBulkActionCancel,
    onQuickDispatch,
    onEditClick,
    virtualMeasureRef,
    virtualIndex
}) => {
    const { t } = useTranslation();

    return (
        <tbody 
            ref={virtualMeasureRef} 
            data-index={virtualIndex} 
            className="text-sm border-b border-gray-100"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '68px' }}
        >
            <tr
                onClick={() => toggleRowExpansion(order._id)}
                className={clsx(
                    "group cursor-pointer transition-all divide-x divide-x-reverse divide-gray-100/60",
                    isSelected ? "bg-blue-50 hover:bg-blue-100" : (isExpanded ? "bg-gray-50/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]" : "hover:bg-gray-50/80 bg-white"),
                    PRIORITY_STYLES[order.priority] || ''
                )}
            >
                <td className="px-4 py-2 border-r border-transparent group-hover:border-blue-100 transition-colors" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(order._id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </td>

                {/* Dynamic Columns Rendering based on order */}
                {visibleColumns.map((col) => {
                    switch (col.id) {
                        case 'orderId':
                            return (
                                <td key={col.id} className="px-4 py-2">
                                    <div className="flex flex-col gap-1 items-start relative group/timeline">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-black text-gray-800 tracking-tight text-[13px] border-b border-dashed border-gray-400 hover:text-blue-600 transition-colors cursor-help">{order.orderId}</span>
                                            {['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(order.status) && activeStage === 'all' && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Pre Dispatch Stage"></span>
                                            )}
                                            {['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid'].includes(order.status) && activeStage === 'all' && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Post Dispatch Stage"></span>
                                            )}
                                        </div>

                                        {/* Timeline Hover Card */}
                                        <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 rounded-xl shadow-xl border border-gray-700 p-4 opacity-0 invisible group-hover/timeline:opacity-100 group-hover/timeline:visible transition-all z-[60] text-white cursor-default" onClick={e => e.stopPropagation()}>
                                            <div className="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest border-b border-gray-700 pb-2">{t('ordersControl.timeline.title')}</div>
                                            <div className="flex flex-col gap-4 relative before:absolute before:inset-y-1 before:left-1.5 before:w-0.5 before:bg-gray-700">
                                                <div className="flex items-start gap-4 relative">
                                                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                    <div className="flex flex-col text-xs leading-none">
                                                        <span className="font-bold text-gray-100">{t('ordersControl.timeline.created')}</span>
                                                        <span className="text-[10px] text-gray-400 font-mono mt-1">{moment(order.date).format('DD MMM, HH:mm')}</span>
                                                    </div>
                                                </div>
                                                {order.status !== 'New' && (
                                                    <div className="flex items-start gap-4 relative">
                                                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                        <div className="flex flex-col text-xs leading-none">
                                                            <span className="font-bold text-gray-100">{t(`sales.statusConfirmed`) || 'Confirmed'}</span>
                                                            <span className="text-[10px] text-gray-400 font-mono mt-1">{t('ordersControl.timeline.processed')}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned'].includes(order.status) && (
                                                    <div className="flex items-start gap-4 relative">
                                                        <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                        <div className="flex flex-col text-xs leading-none">
                                                            <span className="font-bold text-gray-100">{t('ordersControl.timeline.sentToCourier')}</span>
                                                            <span className="text-[10px] text-gray-400 mt-1">{order.courier?.name || t('ordersControl.timeline.assignedCourier')}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {['Delivered', 'Paid'].includes(order.status) && (
                                                    <div className="flex items-start gap-4 relative">
                                                        <div className="w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                        <div className="flex flex-col text-xs leading-none">
                                                            <span className="font-bold text-gray-100">{t(`sales.status${order.status.replace(/\s+/g, '')}`) || order.status}</span>
                                                            <span className="text-[10px] text-emerald-400 mt-1">{t('ordersControl.timeline.successfulDelivery')}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {['Refused', 'Returned', 'Cancelled'].includes(order.status) && (
                                                    <div className="flex items-start gap-4 relative">
                                                        <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-gray-900 z-10 shrink-0 mt-0.5"></div>
                                                        <div className="flex flex-col text-xs leading-none">
                                                            <span className="font-bold text-gray-100">{t('ordersControl.timeline.unsuccessful')}</span>
                                                            <span className="text-[10px] text-rose-400 mt-1">{t(`sales.status${order.status.replace(/\s+/g, '')}`) || order.status}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {order.priority && order.priority !== 'Normal' && (
                                            <span className={clsx("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded animate-pulse mt-1", order.priority === 'Urgent' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700")}>
                                                {order.priority}
                                            </span>
                                        )}
                                    </div>
                                </td>
                            );
                        case 'status':
                            return (
                                <td key={col.id} className="px-4 py-2" onClick={e => e.stopPropagation()}>
                                    <div className="flex flex-col gap-1.5 items-start">
                                        {['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(order.status) ? (
                                            <select
                                                value={order.status}
                                                onChange={(e) => onStatusChange(order._id, e.target.value)}
                                                className={clsx(
                                                    "appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 rounded-full text-[11px] font-black uppercase tracking-wide border px-2.5 py-1 transition-colors pr-6 relative",
                                                    STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-600 border-gray-200 focus:ring-gray-300'
                                                )}
                                                style={{
                                                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'/%3e%3c/svg%3e")`,
                                                    backgroundPosition: `right 0.2rem center`,
                                                    backgroundRepeat: `no-repeat`,
                                                    backgroundSize: `1.2em 1.2em`,
                                                }}
                                            >
                                                {COD_STATUSES.filter(s => {
                                                    if (activeStage === 'pre-dispatch') return ['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(s);
                                                    return ['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(s);
                                                }).map(s => (
                                                    <option key={s} value={s} className="bg-white text-gray-900 font-bold max-w-full">
                                                        {t(`sales.status${s.replace(/\s+/g, '')}`) || s}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span
                                                className={clsx("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide border cursor-not-allowed opacity-90", STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-600 border-gray-200')}
                                                title={t('ordersControl.messages.syncOnly', { defaultValue: 'Status controlled by Courier Sync' })}
                                            >
                                                {t(`sales.status${order.status.replace(/\s+/g, '')}`) || order.status}
                                            </span>
                                        )}
                                        {order.tags && order.tags.length > 0 && (
                                            <div className="flex items-center gap-1 flex-wrap max-w-[120px]">
                                                {order.tags.map(tag_item => (
                                                    <span key={tag_item} className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600 truncate max-w-[80px]" title={tag_item}>
                                                        {tag_item}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                            );
                        case 'actions':
                            return (
                                <td key={col.id} className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); onEditClick && onEditClick(order); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.edit', { defaultValue: 'Edit Order' })}>
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => { const phone = order.customer?.phone || order.shipping?.phone1; if (phone) window.open(`tel:${phone}`); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.call')}>
                                            <PhoneCall className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onBulkActionConfirm(order._id); }} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.confirm')}>
                                            <CheckCircle2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onQuickDispatch(order._id); }} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.dispatch', { defaultValue: 'Dispatch Order' })}>
                                            <PackageOpen className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onBulkActionCourier(order._id); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.assignCourier')}>
                                            <Truck className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setFocusedOrderId(order._id)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.details')}>
                                            <FileText className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onBulkActionCancel(order._id); }} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.cancel')}>
                                            <Ban className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            );
                        case 'customer':
                            return (
                                <td key={col.id} className="px-4 py-2">
                                    <div className="flex flex-col relative group/customer">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-gray-900 truncate max-w-[150px]">{order.customer?.name || t('ordersControl.customerCard.unknown')}</span>
                                            {order.customer?.fraudProbability > 60 && (
                                                <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" title="High Fraud Probability" />
                                            )}
                                            {order.customer?.refusalRate > 25 && (
                                                <span className="flex w-2 h-2 rounded-full bg-orange-500" title="High Return Rate"></span>
                                            )}
                                        </div>

                                        {/* Customer Hover Card */}
                                        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 opacity-0 invisible group-hover/customer:opacity-100 group-hover/customer:visible transition-all z-50">
                                            <div className="flex items-center gap-3 border-b border-gray-100 pb-3 mb-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-lg">
                                                    {(order.customer?.name || t('ordersControl.customerCard.unknown')).charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-gray-900 text-sm leading-none">{order.customer?.name || t('ordersControl.customerCard.unknown')}</span>
                                                    <span className="font-mono text-[10px] text-gray-500 mt-1">{order.customer?.phone || '-'}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">{t('ordersControl.customerCard.lifetimeOrders')}</span>
                                                    <span className="font-black text-gray-800">{order.customer?.totalOrders || 0}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">{t('ordersControl.customerCard.trustScore')}</span>
                                                    <span className={clsx("font-black", (order.customer?.trustScore || 100) < 50 ? "text-rose-600" : "text-emerald-600")}>
                                                        {order.customer?.trustScore || 100}/100
                                                    </span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">{t('ordersControl.customerCard.delivered')}</span>
                                                    <span className="font-black text-emerald-600">{order.customer?.deliveredOrders || 0}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">{t('ordersControl.customerCard.returned')}</span>
                                                    <span className="font-black text-rose-600">{order.customer?.totalRefusals || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            );
                        case 'phone':
                            return (
                                <td key={col.id} className="px-4 py-2 font-mono" onClick={e => e.stopPropagation()}>
                                    <a
                                        href={`tel:${order.customer?.phone || order.shipping?.phone1 || ''}`}
                                        className="flex items-center gap-1.5 w-fit px-2 py-1 bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-md border border-emerald-100/50 cursor-pointer"
                                        title={t('ordersControl.grid.callCustomer', { defaultValue: 'Call Customer' })}
                                    >
                                        <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="font-bold text-emerald-800 text-[13px] tracking-wider">{order.customer?.phone || order.shipping?.phone1 || '-'}</span>
                                    </a>
                                </td>
                            );
                        case 'location':
                            return (
                                <td key={col.id} className="px-4 py-2 text-xs">
                                    <p className="font-bold text-gray-700 truncate max-w-[130px]" title={order.wilaya || order.shipping?.wilayaName || ''}>{order.wilaya || order.shipping?.wilayaName || t('ordersControl.grid.unspecifiedZone', { defaultValue: 'Unspecified Zone' })}</p>
                                    <p className="text-gray-400 truncate max-w-[130px]">{order.commune || order.shipping?.commune || ''}</p>
                                </td>
                            );
                        case 'products':
                            return (
                                <td key={col.id} className="px-4 py-2 text-xs">
                                    {order.products?.length > 0 ? (
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 truncate max-w-[160px]">{order.products[0].name || 'Product Item'}</span>
                                            {order.products.length > 1 && <span className="text-[10px] text-gray-400 font-bold">+{order.products.length - 1} {t('ordersControl.grid.moreTypes')} ({t('ordersControl.grid.qty')}: {order.products.reduce((acc, p) => acc + p.quantity, 0)})</span>}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic">{t('ordersControl.grid.noItems')}</span>
                                    )}
                                </td>
                            );
                        case 'total':
                            return (
                                <td key={col.id} className="px-4 py-2 text-right">
                                    {order.totalAmount >= 100000 ? (
                                        <div className="inline-flex items-center bg-gradient-to-r from-amber-100 to-yellow-200 text-amber-900 px-2 py-1 rounded shadow-sm border border-amber-300 transform hover:scale-105 transition-transform" title="Gold Highlight: Over 100k DZD">
                                            <span className="font-black mr-1 text-[13px]">{order.totalAmount.toLocaleString()}</span>
                                            <span className="text-[9px] font-black uppercase">DZD</span>
                                        </div>
                                    ) : order.totalAmount >= 50000 ? (
                                        <div className="inline-flex items-center bg-purple-100 text-purple-900 px-2 py-1 rounded shadow-sm border border-purple-200 transform hover:scale-105 transition-transform" title="Purple Highlight: Over 50k DZD">
                                            <span className="font-black mr-1 text-[13px]">{order.totalAmount.toLocaleString()}</span>
                                            <span className="text-[9px] font-black uppercase">DZD</span>
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center">
                                            <span className="font-black text-gray-900 mr-1">{(order.totalAmount || 0).toLocaleString()}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">DZD</span>
                                        </div>
                                    )}
                                </td>
                            );
                        case 'courier':
                            return (
                                <td key={col.id} className="px-4 py-2">
                                    {order.courier?.name ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-[11px] font-black tracking-wide truncate max-w-[100px]">
                                            {order.courier.name}
                                        </span>
                                    ) : <span className="text-[11px] text-gray-400 font-medium">—</span>}
                                </td>
                            );
                        case 'agent':
                            return (
                                <td key={col.id} className="px-4 py-2">
                                    {order.assignedAgent?.name ? (
                                        <span className="text-xs font-bold text-gray-700 truncate max-w-[100px] block">{order.assignedAgent.name}</span>
                                    ) : <span className="text-[11px] text-gray-400 font-medium block">Unassigned</span>}
                                </td>
                            );
                        case 'date':
                            return (
                                <td key={col.id} className="px-4 py-2 text-xs w-28 whitespace-nowrap overflow-hidden text-ellipsis">
                                    <div className="flex flex-col">
                                        <span className={clsx("font-bold", moment().diff(moment(order.date), 'hours') > 24 && order.status === 'New' ? "text-rose-600" : "text-gray-600")} title={moment(order.date).format('PPpp')}>
                                            {getAge(order.date)} {t('ordersControl.grid.ago')}
                                        </span>
                                    </div>
                                </td>
                            );
                        default:
                            return null;
                    }
                })}
            </tr>
            {isExpanded && (
                <tr className="bg-gray-50/40 shadow-[inset_0_4px_6px_-1px_rgba(0,0,0,0.03)] border-b border-gray-200">
                    <td colSpan={visibleColumns.filter(c => !hiddenColumns.has(c.id)).length + 1} className="p-0">
                        <div className="flex flex-col animate-in slide-in-from-top-1 px-8 py-5 gap-4">
                            <div className="grid grid-cols-4 gap-6">
                                {/* Customer Details Panel */}
                                <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                    <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">{t('ordersControl.expanded.customerInfo')}</h4>
                                    <div className="flex flex-col gap-1.5 text-xs">
                                        <div className="flex items-center justify-between"><span className="text-gray-500 font-medium whitespace-nowrap">{t('ordersControl.expanded.primaryPhone')}</span> <span className="font-mono font-bold text-gray-800">{order.customer?.phone || order.shipping?.phone1 || '-'}</span></div>
                                        <div className="flex items-center justify-between"><span className="text-gray-500 font-medium whitespace-nowrap">{t('ordersControl.expanded.secondaryPhone')}</span> <span className="font-mono font-bold text-gray-800">{order.shipping?.phone2 || '-'}</span></div>
                                        <div className="flex items-start justify-between mt-1 gap-2">
                                            <span className="text-gray-500 font-medium whitespace-nowrap leading-tight">{t('ordersControl.expanded.shippingAddress')}</span>
                                            <span className="font-semibold text-gray-800 leading-tight text-right line-clamp-2" title={order.shipping?.address}>{order.shipping?.address || order.commune}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Product Details Panel */}
                                <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                    <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">{t('ordersControl.expanded.productInfo')}</h4>
                                    <div className="flex flex-col gap-2 max-h-[100px] overflow-y-auto pr-1">
                                        {order.products?.map((prod, i) => (
                                            <div key={i} className="flex flex-col text-xs bg-gray-50/50 p-1.5 rounded border border-gray-100">
                                                <span className="font-bold text-gray-800 truncate" title={prod.name}>{prod.name}</span>
                                                <div className="flex items-center justify-between mt-1 text-[11px]">
                                                    <span className="text-gray-500 font-mono">{prod.sku || t('ordersControl.expanded.noSku')}</span>
                                                    <span className="font-black text-gray-700">{t('ordersControl.expanded.qty')} {prod.quantity}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Operational Intelligence Panel */}
                                <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                    <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">{t('ordersControl.expanded.customerIntelligence')}</h4>
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-xs">
                                        <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">{t('ordersControl.expanded.totalOrders')}</span><span className="font-black text-gray-800">{order.customer?.totalOrders || 0}</span></div>
                                        <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">{t('ordersControl.expanded.delivered')}</span><span className="font-black text-emerald-600">{order.customer?.deliveredOrders || 0}</span></div>
                                        <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">{t('ordersControl.expanded.returns')}</span><span className="font-black text-rose-600">{order.customer?.totalRefusals || 0}</span></div>
                                        <div className="flex flex-col"><span className="text-gray-400 font-semibold text-[10px]">{t('ordersControl.expanded.returnRate')}</span><span className={clsx("font-black", (order.customer?.refusalRate || 0) > 30 ? "text-orange-500" : "text-gray-800")}>{Math.round(order.customer?.refusalRate || 0)}%</span></div>
                                    </div>
                                </div>

                                {/* Logistics & Delivery Panel */}
                                <div className="flex flex-col bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                    <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2 border-b border-gray-50 pb-2">{t('ordersControl.expanded.deliveryTrack')}</h4>
                                    <div className="flex flex-col gap-1.5 text-xs">
                                        <div className="flex items-center justify-between"><span className="text-gray-500 font-medium">{t('ordersControl.expanded.provider')}</span> <span className="font-bold text-indigo-700">{order.courier?.name || t('ordersControl.filters.unassigned')}</span></div>
                                        <div className="flex items-center justify-between mt-0.5"><span className="text-gray-500 font-medium">{t('ordersControl.expanded.trackingCode')}</span> <span className="font-mono font-bold text-gray-800">{order.trackingNumber || '-'}</span></div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-gray-500 font-medium">{t('ordersControl.expanded.timelineStage')}</span>
                                            <span className="font-bold text-gray-800 mt-0.5">{t(`sales.status${order.status.replace(/\s+/g, '')}`) || order.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Level 3 action trigger */}
                            <div className="flex items-center justify-end border-t border-gray-100 pt-3">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setFocusedOrderId(order._id); }}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-gray-900 text-white text-[11px] font-black tracking-wider uppercase rounded hover:bg-gray-800 transition-colors shadow-sm"
                                >
                                    <FileText className="w-3.5 h-3.5" /> {t('ordersControl.expanded.viewFull')}
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </tbody>
    );
}, (prevProps, nextProps) => {
    // Custom comparator for ultra performance
    if (prevProps.isSelected !== nextProps.isSelected) return false;
    if (prevProps.isExpanded !== nextProps.isExpanded) return false;
    if (prevProps.activeStage !== nextProps.activeStage) return false;
    if (prevProps.visibleColumns !== nextProps.visibleColumns) return false;
    if (prevProps.hiddenColumns !== nextProps.hiddenColumns) return false;
    
    // Check if order object changed (deep enough for our needs)
    if (prevProps.order._id !== nextProps.order._id) return false;
    if (prevProps.order.status !== nextProps.order.status) return false;
    
    // Virtualization Checks
    if (prevProps.virtualIndex !== nextProps.virtualIndex) return false;

    return true;
});

export default OrderRow;
