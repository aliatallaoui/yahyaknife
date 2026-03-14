import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    MapPin, Truck, AlertTriangle, CheckCircle, RefreshCw,
    Building2, Home, Navigation, Info, ShieldAlert, XCircle, Loader2
} from 'lucide-react';
import clsx from 'clsx';
import { apiFetch } from '../../utils/apiFetch';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
    resolved:                      { color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', icon: CheckCircle, label: 'Resolved' },
    needs_review:                  { color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', icon: AlertTriangle, label: 'Needs Review' },
    pending:                       { color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400', icon: Info, label: 'Pending' },
    unsupported_wilaya:            { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: XCircle, label: 'Unsupported Wilaya' },
    unsupported_commune:           { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: XCircle, label: 'Unsupported Commune' },
    unsupported_delivery_type:     { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: XCircle, label: 'Unsupported Delivery' },
    stop_desk_not_available:       { color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', icon: Building2, label: 'No Stop Desk' },
    nearest_office_suggested:      { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', icon: Navigation, label: 'Office Suggested' },
    fallback_courier_suggested:    { color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400', icon: Truck, label: 'Fallback Courier' },
    low_confidence_location_match: { color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', icon: ShieldAlert, label: 'Low Confidence' },
    no_courier_assigned:           { color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400', icon: Truck, label: 'No Courier' },
    no_pricing_rule:               { color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', icon: AlertTriangle, label: 'No Pricing' }
};

function Row({ label, value, className = '' }) {
    if (!value) return null;
    return (
        <div className={clsx('flex justify-between items-start text-xs', className)}>
            <span className="text-gray-500 dark:text-gray-400 font-medium shrink-0">{label}</span>
            <span className="text-gray-900 dark:text-white font-semibold text-right ml-2 break-words">{value}</span>
        </div>
    );
}

export default function LogisticsPanel({ order, onRefresh }) {
    const { t } = useTranslation();
    const [resolving, setResolving] = useState(false);

    const logistics = order?.logistics || {};
    const rawSource = order?.rawSource || {};
    const internalGeo = order?.internalGeography || {};
    const courierGeo = order?.courierGeography || {};
    const status = logistics.resolutionStatus;

    // Don't render if no logistics data
    if (!status && !rawSource.wilaya && !rawSource.commune) return null;

    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const StatusIcon = cfg.icon;

    const handleReResolve = async () => {
        setResolving(true);
        try {
            const res = await apiFetch(`/api/logistics/orders/${order._id}/re-resolve`, { method: 'POST' });
            if (res.ok) {
                toast.success(t('logistics.reResolved', 'Logistics re-resolved'));
                onRefresh?.();
            } else {
                const json = await res.json().catch(() => ({}));
                toast.error(json.message || 'Re-resolve failed');
            }
        } catch { toast.error('Re-resolve failed'); }
        finally { setResolving(false); }
    };

    const handleOverride = async () => {
        setResolving(true);
        try {
            const res = await apiFetch(`/api/logistics/orders/${order._id}/override`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolutionStatus: 'resolved', warningMessage: '' })
            });
            if (res.ok) {
                toast.success(t('logistics.overridden', 'Marked as resolved'));
                onRefresh?.();
            } else {
                const json = await res.json().catch(() => ({}));
                toast.error(json.message || 'Override failed');
            }
        } catch { toast.error('Override failed'); }
        finally { setResolving(false); }
    };

    const normStatusLabel = {
        exact_match: 'Exact',
        alias_match: 'Alias',
        fuzzy_match: 'Fuzzy',
        unresolved:  'Unresolved'
    };

    const confidencePct = internalGeo.confidenceScore != null
        ? `${Math.round(internalGeo.confidenceScore * 100)}%`
        : null;

    return (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <Route className="w-3.5 h-3.5 text-gray-500" />
                    {t('logistics.panel.title', 'Logistics Resolution')}
                </h4>
                <div className="flex items-center gap-1.5">
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1', cfg.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                    </span>
                </div>
            </div>

            <div className="p-3 space-y-3">
                {/* Warning Message */}
                {logistics.warningMessage && status !== 'resolved' && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{logistics.warningMessage}</p>
                    </div>
                )}

                {/* Raw Source */}
                {(rawSource.wilaya || rawSource.commune) && (
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('logistics.panel.rawSource', 'Raw Source')}</p>
                        <Row label="Wilaya" value={rawSource.wilaya} />
                        <Row label="Commune" value={rawSource.commune} />
                    </div>
                )}

                {/* Internal Match */}
                {internalGeo.normalizationStatus && (
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('logistics.panel.internalMatch', 'Internal Match')}</p>
                        <Row label="Wilaya" value={internalGeo.wilayaId?.officialFrName || internalGeo.wilayaId} />
                        <Row label="Commune" value={internalGeo.communeId?.officialFrName || internalGeo.communeId} />
                        <div className="flex items-center gap-2 mt-1">
                            <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded',
                                internalGeo.normalizationStatus === 'exact_match' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                internalGeo.normalizationStatus === 'alias_match' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                internalGeo.normalizationStatus === 'fuzzy_match' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            )}>
                                {normStatusLabel[internalGeo.normalizationStatus] || internalGeo.normalizationStatus}
                            </span>
                            {confidencePct && (
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                    Confidence: {confidencePct}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Courier Geography */}
                {(courierGeo.courierWilayaName || courierGeo.courierCommuneName) && (
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {t('logistics.panel.courierGeo', 'Courier Format')}
                        </p>
                        <Row label="Wilaya" value={`${courierGeo.courierWilayaName}${courierGeo.courierWilayaCode ? ` (${courierGeo.courierWilayaCode})` : ''}`} />
                        <Row label="Commune" value={courierGeo.courierCommuneName} />
                        <div className="flex items-center gap-2 mt-1">
                            {courierGeo.stopDeskAvailable != null && (
                                <span className={clsx('text-[10px] font-medium flex items-center gap-0.5',
                                    courierGeo.stopDeskAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'
                                )}>
                                    <Building2 className="w-3 h-3" />
                                    {courierGeo.stopDeskAvailable ? 'Stop Desk ✓' : 'No Stop Desk'}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Nearest Office Suggestion */}
                {courierGeo.nearestOfficeCommuneName && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <Navigation className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                            {t('logistics.panel.nearestOffice', 'Nearest office')}: <strong>{courierGeo.nearestOfficeCommuneName}</strong>
                        </p>
                    </div>
                )}

                {/* Fallback Courier */}
                {logistics.fallbackCourierUsed && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                        <Truck className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-violet-700 dark:text-violet-400">
                            {t('logistics.panel.fallbackUsed', 'Fallback courier was used for this order')}
                        </p>
                    </div>
                )}

                {/* Actions */}
                {status !== 'resolved' && (
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={handleReResolve}
                            disabled={resolving}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-blue-200 dark:border-blue-800 disabled:opacity-50"
                        >
                            {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            {t('logistics.panel.reResolve', 'Re-resolve')}
                        </button>
                        <button
                            onClick={handleOverride}
                            disabled={resolving}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-600 disabled:opacity-50"
                        >
                            <CheckCircle className="w-3 h-3" />
                            {t('logistics.panel.markResolved', 'Mark Resolved')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
