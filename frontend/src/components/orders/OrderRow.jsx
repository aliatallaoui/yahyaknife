import React, { useState, useContext } from 'react';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { FileText, Edit3, PhoneCall, MessageCircle, CheckCircle2, Truck, AlertTriangle, PackageOpen, Ban, X, Plus, Trash2, RotateCcw, Undo2, Copy } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { ORDER_STATUS_COLORS } from '../../constants/statusColors';

const PRIORITY_STYLES = {
    'Normal': '',
    'High Priority': 'border-l-4 border-l-orange-400 bg-orange-50/10',
    'Urgent': 'border-l-4 border-l-red-500 bg-red-50/20'
};

const STATUS_STYLES = ORDER_STATUS_COLORS;

const COD_STATUSES = ['New', 'Call 1', 'Call 2', 'Call 3', 'No Answer', 'Out of Coverage', 'Postponed', 'Wrong Number', 'Cancelled by Customer', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'];

const OrderRow = React.memo(({
    order,
    index,
    isSelected,
    isExpanded,
    visibleColumns,
    hiddenColumns,
    activeStage,
    toggleSelect,
    toggleRowExpansion,
    getAge,
    onStatusChange,
    onAgentChange,
    onCourierChange,
    agents,
    couriers,
    setFocusedOrderId,
    onBulkActionConfirm,
    onBulkActionCourier,
    onBulkActionCancel,
    onQuickDispatch,
    onEditClick,
    onTagUpdate,
    onPriorityChange,
    onDelete,
    onRestore,
    onPurge,
    onPostpone,
    virtualMeasureRef,
    virtualIndex
}) => {
    const { t } = useTranslation();
    const { hasPermission } = useContext(AuthContext);
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [copiedPhone, setCopiedPhone] = useState(false);

    const copyPhone = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const phone = order.customer?.phone || order.shipping?.phone1;
        if (!phone) return;
        navigator.clipboard.writeText(phone).then(() => {
            setCopiedPhone(true);
            setTimeout(() => setCopiedPhone(false), 1500);
        }).catch(() => {});
    };

    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.stopPropagation();
            onTagUpdate(order._id, [...(order.tags || []), tagInput.trim()]);
            setTagInput('');
            setIsEditingTags(false);
        } else if (e.key === 'Escape') {
            setTagInput('');
            setIsEditingTags(false);
        }
    };

    const handleRemoveTag = (e, tagToRemove) => {
        e.stopPropagation();
        onTagUpdate(order._id, (order.tags || []).filter(t => t !== tagToRemove));
    };

    const ageHours = order.createdAt ? (Date.now() - new Date(order.createdAt).getTime()) / 3600000 : 0;
    const isStaleNew = order.status === 'New' && ageHours > 24;
    const isHighRisk = order.customer?.blacklisted || (order.customer?.riskScore ?? 0) > 70;

    return (
        <tbody
            ref={virtualMeasureRef}
            data-index={virtualIndex}
            className="text-sm border-b border-gray-100"
        >
            <tr
                onClick={() => toggleRowExpansion(order._id)}
                className={clsx(
                    "group cursor-pointer transition-all divide-x divide-x-reverse divide-gray-100/60",
                    isSelected
                        ? "bg-blue-50 hover:bg-blue-100"
                        : isExpanded
                            ? "bg-gray-50/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                            : isStaleNew
                                ? "bg-amber-50/60 hover:bg-amber-50"
                                : isHighRisk
                                    ? "bg-rose-50/40 hover:bg-rose-50/60"
                                    : "hover:bg-gray-50/80 bg-white",
                    PRIORITY_STYLES[order.priority] || ''
                )}
            >
                <td className="px-4 py-2 border-r border-transparent group-hover:border-blue-100 transition-colors" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(order._id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </td>

                {/* Dynamic Columns Rendering based on order */}
                {visibleColumns.map((col) => {
                    switch (col.id) {
                        case 'index':
                            return (
                                <td key={col.id} className="px-4 py-2 text-center text-xs font-black text-gray-300 w-12">
                                    {index}
                                </td>
                            );
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
                                                        <span className="text-[10px] text-gray-400 font-mono mt-1">{moment(order.createdAt).format('DD MMM, HH:mm')}</span>
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

                                    </div>
                                </td>
                            );
                        case 'status':
                            return (
                                <td key={col.id} className="px-4 py-2" onClick={e => e.stopPropagation()}>
                                    <div className="flex flex-col gap-1.5 items-start">
                                        {/* Editable — all pre-dispatch + cancelled statuses */}
                                        {!['Dispatched', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned'].includes(order.status) ? (
                                            <select
                                                disabled={!hasPermission('orders.status.change')}
                                                value={order.status}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'Postponed') {
                                                        onPostpone && onPostpone(order._id);
                                                    } else {
                                                        onStatusChange(order._id, val);
                                                    }
                                                }}
                                                className={clsx(
                                                    "appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 rounded-full text-[11px] font-black uppercase tracking-wide border px-2.5 py-1 transition-colors pr-6 relative max-w-[140px] truncate",
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
                                                    if (activeStage === 'pre-dispatch') {
                                                        return ['New', 'Call 1', 'Call 2', 'Call 3', 'No Answer', 'Out of Coverage', 'Postponed', 'Wrong Number', 'Cancelled by Customer', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Cancelled'].includes(s);
                                                    }
                                                    if (activeStage === 'returns') {
                                                        return ['Refused', 'Returned', 'New', 'Confirmed'].includes(s);
                                                    }
                                                    return true; // 'all' stage shows everything
                                                }).map(s => (
                                                    <option key={s} value={s} className="bg-white text-gray-900 font-bold">
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
                                    </div>
                                </td>
                            );
                        case 'tags': {
                            const priorities = ['Normal', 'High Priority', 'Urgent'];
                            const currentPriIdx = priorities.indexOf(order.priority || 'Normal');
                            const nextPriority = priorities[(currentPriIdx + 1) % priorities.length];
                            return (
                                <td key={col.id} className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                    <div className="flex flex-wrap items-center gap-1 min-w-[110px]">
                                        {/* Inline Priority Select */}
                                        <select
                                            disabled={!hasPermission('orders.edit')}
                                            value={order.priority || 'Normal'}
                                            onChange={(e) => { e.stopPropagation(); onPriorityChange && onPriorityChange(order._id, e.target.value); }}
                                            onClick={(e) => e.stopPropagation()}
                                            className={clsx(
                                                "appearance-none cursor-pointer outline-none text-[10px] font-black uppercase tracking-wide border rounded-full px-2 py-0.5 pr-5 transition-colors shrink-0",
                                                order.priority === 'Urgent'
                                                    ? "bg-red-100 text-red-700 border-red-200 animate-pulse"
                                                    : order.priority === 'High Priority'
                                                        ? "bg-orange-100 text-orange-700 border-orange-200"
                                                        : "bg-gray-100 text-gray-500 border-gray-200"
                                            )}
                                            style={{
                                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'/%3e%3c/svg%3e")`,
                                                backgroundPosition: 'right 0.2rem center',
                                                backgroundRepeat: 'no-repeat',
                                                backgroundSize: '1em 1em',
                                            }}
                                        >
                                            <option value="Normal">— Normal</option>
                                            <option value="High Priority">⚡ High</option>
                                            <option value="Urgent">🔥 Urgent</option>
                                        </select>
                                        {/* Tags */}
                                        {(order.tags || []).map(tag_item => (
                                            <div key={tag_item} className="group/tag flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider pl-1.5 pr-0.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 truncate max-w-[90px]" title={tag_item}>
                                                <span>{tag_item}</span>
                                                <button onClick={(e) => handleRemoveTag(e, tag_item)} className="opacity-0 group-hover/tag:opacity-100 hover:text-red-500 transition-opacity ml-0.5">
                                                    <X className="w-2.5 h-2.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {hasPermission('orders.edit') && (isEditingTags ? (
                                            <input
                                                type="text"
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                onKeyDown={handleAddTag}
                                                onBlur={() => { setIsEditingTags(false); setTagInput(''); }}
                                                onClick={(e) => e.stopPropagation()}
                                                autoFocus
                                                className="w-16 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border border-blue-300 rounded outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                                placeholder="TAG+"
                                            />
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setIsEditingTags(true); }}
                                                className="px-1 py-0.5 rounded border border-dashed border-gray-300 text-gray-400 hover:text-blue-500 hover:border-blue-300 text-[9px] font-black uppercase cursor-pointer transition-colors"
                                                title="Add Tag"
                                            >
                                                <Plus className="w-2.5 h-2.5 inline-block" />
                                            </button>
                                        ))}
                                    </div>
                                </td>
                            );
                        }
                        case 'actions':
                            return (
                                <td key={col.id} className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                        {hasPermission('orders.edit') && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); onEditClick && onEditClick(order); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.edit', { defaultValue: 'Edit Order' })}>
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                        {hasPermission('orders.status.change') && (
                                            <button onClick={(e) => { e.stopPropagation(); onQuickDispatch(order._id); }} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.dispatch', { defaultValue: 'Dispatch Order' })}>
                                                <PackageOpen className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); const phone = order.customer?.phone || order.shipping?.phone1; if (phone) window.open(`tel:${phone}`); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.call', { defaultValue: 'Call' })}>
                                            <PhoneCall className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => { 
                                            e.stopPropagation(); 
                                            const phone = order.customer?.phone || order.shipping?.phone1; 
                                            if (phone) {
                                                const cleanPhone = phone.replace(/[^0-9]/g, '');
                                                const waPhone = cleanPhone.startsWith('0') ? '213' + cleanPhone.substring(1) : cleanPhone;
                                                window.open(`https://wa.me/${waPhone}`, '_blank');
                                            }
                                        }} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded bg-white border border-gray-200 shadow-sm transition-colors" title={t('ordersControl.actions.whatsapp', { defaultValue: 'WhatsApp' })}>
                                            <MessageCircle className="w-4 h-4" />
                                        </button>
                                        {activeStage === 'trash' ? (
                                            <>
                                                {hasPermission('orders.restore') && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onRestore && onRestore(order._id); }}
                                                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded bg-white border border-gray-200 shadow-sm transition-colors"
                                                        title="Restore Order"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {hasPermission('orders.purge') && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onPurge && onPurge(order._id); }}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded bg-white border border-red-100 shadow-sm transition-colors"
                                                        title="Delete Permanently"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </>
                                        ) : activeStage === 'post-dispatch' ? (
                                            // Post-dispatch: only allow recall if courier hasn't validated (no tracking number)
                                            !order.trackingNumber ? (
                                                hasPermission('orders.status.change') && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onStatusChange && onStatusChange(order._id, 'Ready for Pickup'); }}
                                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded bg-white border border-gray-200 shadow-sm transition-colors"
                                                        title="Recall to Pre-Dispatch (not yet validated by courier)"
                                                    >
                                                        <Undo2 className="w-4 h-4" />
                                                    </button>
                                                )
                                            ) : (
                                                // Locked — validated by courier, cannot recall or delete
                                                <span className="px-1.5 py-1 text-[9px] font-black uppercase tracking-wider text-gray-300 border border-gray-100 rounded" title="Locked: validated by courier">
                                                    Locked
                                                </span>
                                            )
                                        ) : (
                                            hasPermission('orders.delete') && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDelete && onDelete(order._id); }}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded bg-white border border-gray-200 shadow-sm transition-colors"
                                                    title="Move to Trash"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )
                                        )}
                                    </div>
                                </td>
                            );
                        case 'customer':
                            return (
                                <td key={col.id} className="px-4 py-2">
                                    <div className="flex flex-col relative group/customer">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-gray-900 truncate max-w-[150px]">{order.customer?.name || t('ordersControl.customerCard.unknown')}</span>
                                            {/* Priority Icon beside name */}
                                            {order.priority === 'Urgent' && (
                                                <span title="URGENT" className="text-red-500 animate-pulse text-[11px]">🔥</span>
                                            )}
                                            {order.priority === 'High Priority' && (
                                                <span title="High Priority" className="text-orange-500 text-[11px]">⚡</span>
                                            )}
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
                                    <div className="flex items-center gap-1">
                                        <a
                                            href={`tel:${order.customer?.phone || order.shipping?.phone1 || ''}`}
                                            className="flex items-center gap-1.5 w-fit px-2 py-1 bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-md border border-emerald-100/50 cursor-pointer"
                                            title={t('ordersControl.grid.callCustomer', { defaultValue: 'Call Customer' })}
                                        >
                                            <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="font-bold text-emerald-800 text-[13px] tracking-wider">{order.customer?.phone || order.shipping?.phone1 || '-'}</span>
                                        </a>
                                        <button
                                            onClick={copyPhone}
                                            className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                            title="Copy number"
                                        >
                                            {copiedPhone
                                                ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                : <Copy className="w-3 h-3" />}
                                        </button>
                                    </div>
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
                                <td key={col.id} className="px-4 py-2" onClick={e => e.stopPropagation()}>
                                    <select
                                        disabled={!hasPermission('orders.edit')}
                                        value={order.courier?._id || 'unassigned'}
                                        onChange={(e) => onCourierChange && onCourierChange(order._id, e.target.value)}
                                        className="appearance-none cursor-pointer outline-none rounded text-xs font-bold border border-transparent hover:border-gray-200 bg-transparent hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-2 py-1 transition-colors relative truncate max-w-[120px]"
                                    >
                                        <option value="unassigned">{t('ordersControl.filters.unassigned', { defaultValue: 'Unassigned' })}</option>
                                        {couriers?.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                    </select>
                                </td>
                            );
                        case 'agent':
                            return (
                                <td key={col.id} className="px-4 py-2" onClick={e => e.stopPropagation()}>
                                    <select
                                        disabled={!hasPermission('orders.edit')}
                                        value={order.assignedAgent?._id || 'unassigned'}
                                        onChange={(e) => onAgentChange && onAgentChange(order._id, e.target.value)}
                                        className="appearance-none cursor-pointer outline-none rounded text-[11px] font-bold border border-transparent hover:border-gray-200 bg-transparent hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-2 py-1 transition-colors relative truncate max-w-[120px]"
                                    >
                                        <option value="unassigned">{t('ordersControl.filters.unassigned', { defaultValue: 'Unassigned' })}</option>
                                        {agents?.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                                    </select>
                                </td>
                            );
                        case 'date':
                            return (
                                <td key={col.id} className="px-4 py-2 text-xs w-28 whitespace-nowrap overflow-hidden text-ellipsis">
                                    <div className="flex flex-col">
                                        <span className={clsx("font-bold", moment().diff(moment(order.createdAt), 'hours') > 24 && order.status === 'New' ? "text-rose-600" : "text-gray-600")} title={moment(order.createdAt).format('PPpp')}>
                                            {getAge(order.createdAt)} {t('ordersControl.grid.ago')}
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
                            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                                {hasPermission('orders.delete') && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(order._id);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 text-[11px] font-black tracking-wider uppercase rounded border border-red-200 hover:border-red-600 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                                    </button>
                                )}
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
    // Skip re-render only if nothing meaningful changed
    if (prevProps.isSelected !== nextProps.isSelected) return false;
    if (prevProps.isExpanded !== nextProps.isExpanded) return false;
    if (prevProps.activeStage !== nextProps.activeStage) return false;
    if (prevProps.virtualIndex !== nextProps.virtualIndex) return false;

    // Compare column configuration by serializing column ids — cheap and reliable
    const prevColKey = prevProps.visibleColumns.map(c => c.id).join(',');
    const nextColKey = nextProps.visibleColumns.map(c => c.id).join(',');
    if (prevColKey !== nextColKey) return false;

    // Check if order object changed
    if (prevProps.order._id !== nextProps.order._id) return false;
    if (prevProps.order.status !== nextProps.order.status) return false;
    if (prevProps.order.priority !== nextProps.order.priority) return false;
    if ((prevProps.order.tags || []).join(',') !== (nextProps.order.tags || []).join(',')) return false;
    if (prevProps.order.agent?._id !== nextProps.order.agent?._id) return false;
    if (prevProps.order.courier?._id !== nextProps.order.courier?._id) return false;

    return true;
});

export default OrderRow;
