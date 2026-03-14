import { useState, useEffect } from 'react';
import {
    MapPin, Phone, Truck, CheckCircle, Package, Clock, AlertTriangle,
    MessageSquare, ArrowRight, Loader2, RefreshCw, XCircle
} from 'lucide-react';
import clsx from 'clsx';
import { apiFetch } from '../../utils/apiFetch';

const EVENT_ICONS = {
    status: {
        'New': Package,
        'Confirmed': CheckCircle,
        'Dispatched': Truck,
        'Shipped': Truck,
        'Out for Delivery': MapPin,
        'Delivered': CheckCircle,
        'Cancelled': XCircle,
        'Cancelled by Customer': XCircle,
        'Refused': XCircle,
        'Returned': RefreshCw,
        'Failed Attempt': AlertTriangle,
        default: ArrowRight,
    },
    call: Phone,
    shipment: Truck,
    message: MessageSquare,
};

const EVENT_COLORS = {
    'Order Created': 'text-blue-500 bg-blue-50 dark:bg-blue-500/15',
    'Confirmed': 'text-green-600 bg-green-50 dark:bg-green-500/15',
    'Dispatched': 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/15',
    'Shipped': 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/15',
    'Out for Delivery': 'text-amber-600 bg-amber-50 dark:bg-amber-500/15',
    'Delivered': 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15',
    'Failed Attempt': 'text-red-500 bg-red-50 dark:bg-red-500/15',
    'Cancelled': 'text-red-600 bg-red-50 dark:bg-red-500/15',
    'Returned': 'text-orange-500 bg-orange-50 dark:bg-orange-500/15',
    call: 'text-sky-600 bg-sky-50 dark:bg-sky-500/15',
    shipment: 'text-purple-600 bg-purple-50 dark:bg-purple-500/15',
    default: 'text-gray-500 bg-gray-100 dark:bg-gray-500/15',
};

function getEventIcon(item) {
    if (item.type === 'call') return Phone;
    if (item.type === 'shipment') return Truck;
    // Status type — match by the status name in the event
    const statusIcons = EVENT_ICONS.status;
    for (const [key, Icon] of Object.entries(statusIcons)) {
        if (key !== 'default' && item.event?.includes(key)) return Icon;
    }
    return statusIcons.default;
}

function getEventColor(item) {
    if (item.type === 'call') return EVENT_COLORS.call;
    if (item.type === 'shipment') return EVENT_COLORS.shipment;
    for (const [key, cls] of Object.entries(EVENT_COLORS)) {
        if (key !== 'default' && item.event?.includes(key)) return cls;
    }
    return EVENT_COLORS.default;
}

function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;

    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function TrackingTimeline({ orderId, isOpen }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchTracking = async () => {
        if (!orderId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/call-center/tracking/${orderId}`);
            const json = await res.json();
            setData(json.data ?? json);
        } catch (err) {
            setError(err.message || 'Failed to load tracking information. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && orderId) fetchTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId, isOpen]);

    if (!isOpen) return null;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-6">
                <p className="text-sm text-red-400 mb-2">{error}</p>
                <button onClick={fetchTracking} className="text-xs text-indigo-500 hover:text-indigo-400 font-medium">
                    Retry
                </button>
            </div>
        );
    }

    if (!data) return null;

    const { shipment, timeline } = data;

    return (
        <div className="space-y-4">
            {/* Shipment status bar */}
            {shipment && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                    <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                            {shipment.status}
                        </span>
                    </div>
                    {shipment.trackingId && (
                        <span className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/20 px-2 py-0.5 rounded-md">
                            {shipment.trackingId}
                        </span>
                    )}
                </div>
            )}

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-600" />

                <div className="space-y-0">
                    {timeline?.map((item, i) => {
                        const Icon = getEventIcon(item);
                        const colorCls = getEventColor(item);
                        const isLast = i === timeline.length - 1;

                        return (
                            <div key={i} className="relative flex items-start gap-3 py-2">
                                {/* Icon dot */}
                                <div className={clsx(
                                    'relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0 ring-2 ring-white dark:ring-gray-800',
                                    colorCls,
                                    isLast && 'ring-4'
                                )}>
                                    <Icon className="h-3.5 w-3.5" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={clsx(
                                            'text-sm font-medium truncate',
                                            isLast ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                                        )}>
                                            {item.event}
                                        </p>
                                        <time className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap tabular-nums">
                                            {formatDate(item.date)}
                                        </time>
                                    </div>

                                    {(item.note || item.actor || item.location) && (
                                        <div className="mt-0.5 space-y-0.5">
                                            {item.note && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.note}</p>
                                            )}
                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                                                {item.actor && <span>{item.actor}</span>}
                                                {item.location && (
                                                    <>
                                                        <span>·</span>
                                                        <span className="flex items-center gap-0.5">
                                                            <MapPin className="h-2.5 w-2.5" />
                                                            {item.location}
                                                        </span>
                                                    </>
                                                )}
                                                {item.attempt && (
                                                    <>
                                                        <span>·</span>
                                                        <span>Attempt #{item.attempt}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Refresh */}
            <button
                onClick={fetchTracking}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-indigo-500 dark:text-gray-400 dark:hover:text-indigo-400 py-1.5 transition-colors"
            >
                <RefreshCw className="h-3 w-3" />
                Refresh tracking
            </button>
        </div>
    );
}
