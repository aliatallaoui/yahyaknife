import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Plus, Trash2, AlertCircle, AlertTriangle, Truck, Save, RefreshCw, CheckCircle, ChevronDown, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { apiFetch } from '../utils/apiFetch';
import { useOrderFormStore } from '../stores/useOrderFormStore';
import useModalDismiss from '../hooks/useModalDismiss';
import CustomerIntelligencePanel from './orders/CustomerIntelligencePanel';
import { getOrderStatusLabel } from '../constants/statusColors';
import { getWilayaList, getWilayaByCode, getCommunesForWilaya } from '../constants/algeria_communes_wilayas';

const CHANNELS = ['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'WhatsApp', 'Facebook', 'TikTok', 'Instagram', 'Manual', 'Other'];
const STATUSES = ['New', 'Call 1', 'Call 2', 'Call 3', 'No Answer', 'Out of Coverage', 'Postponed', 'Wrong Number', 'Confirmed'];
const PRIORITIES = ['Normal', 'High', 'Urgent', 'VIP'];

export default function OrderModal({ isOpen, onClose, onSubmit, initialData, inventoryProducts = [], couriers = [] }) {
    const { t } = useTranslation();
    const { backdropProps, panelProps } = useModalDismiss(onClose);
    const isEdit = !!initialData && !initialData._prefill;

    const store = useOrderFormStore();
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLookingUpPhone, setIsLookingUpPhone] = useState(false);
    const [intelligenceData, setIntelligenceData] = useState(null);
    const [availableCommunes, setAvailableCommunes] = useState([]);

    // Courier Engine State
    const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
    const [recommendedCourier, setRecommendedCourier] = useState(null);

    // UX: collapsible sections
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [codOverride, setCodOverride] = useState(false);

    // Initialize Store
    useEffect(() => {
        if (isOpen) {
            setFormError('');
            setIntelligenceData(null);
            setProductSearch('');
            setCodOverride(false);
            setShowMoreOptions(false);
            if (isEdit) {
                store.setInitialData(initialData);
                // Show more options if edit has values in optional fields
                if (initialData?.shipping?.phone2 || initialData?.shipping?.weight > 1 || initialData?.shipping?.fragile || initialData?.priority !== 'Normal') {
                    setShowMoreOptions(true);
                }
            } else {
                store.resetForm();
                // Auto-select first courier
                if (couriers.length > 0) {
                    store.updateField('courierId', couriers[0]._id);
                }
                // Pre-fill from CustomerProfile deep-link
                if (initialData?._prefill) {
                    if (initialData.customerPhone) store.updateField('customerPhone', initialData.customerPhone);
                    if (initialData.customerName) store.updateField('customerName', initialData.customerName);
                }
            }
        }
    }, [isOpen, isEdit, initialData]);

    // Flatten inventory products
    const availableVariants = inventoryProducts.flatMap(p => {
        if (!p.variants || p.variants.length === 0) return [];
        return p.variants.map(v => {
            let attrStr = '';
            if (v.attributes) {
                attrStr = Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ');
            }
            const stock = (v.totalStock || 0) - (v.reservedStock || 0);
            return {
                variantId: v._id,
                baseProductId: p._id,
                productName: p.name,
                displayName: `${p.name} ${attrStr ? `(${attrStr})` : ''}`,
                price: v.price,
                sku: v.sku,
                availableStock: stock
            };
        });
    });

    // Filtered variants for product search
    const filteredVariants = useMemo(() => {
        if (!productSearch.trim()) return availableVariants;
        const q = productSearch.toLowerCase();
        return availableVariants.filter(v =>
            v.displayName.toLowerCase().includes(q) ||
            (v.sku && v.sku.toLowerCase().includes(q))
        );
    }, [availableVariants, productSearch]);

    // 1. Phone Lookup Engine (Debounced)
    useEffect(() => {
        const phone = store.customerPhone;
        // Basic Algerian length check before lookup
        if (phone && phone.length >= 9) {
            const timer = setTimeout(async () => {
                setIsLookingUpPhone(true);
                try {
                    const res = await apiFetch(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
                    if (!res.ok) throw new Error('lookup failed');
                    const json = await res.json();
                    const data = json.data ?? json;
                    setIntelligenceData(data);

                    // Autofill if new and found
                    if (!isEdit && data.exists && data.customer) {
                        if (!store.customerName) store.updateField('customerName', data.customer.name);
                        store.updateField('customerId', data.customer._id);
                    }
                } catch (err) {
                    // Phone lookup is best-effort; silently ignore failures
                } finally {
                    setIsLookingUpPhone(false);
                }
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setIntelligenceData(null);
        }
    }, [store.customerPhone, isEdit]);

    // 2. Courier coverage cache — fetch once per courier, filter locally
    const selectedCourier = couriers.find(c => c._id === store.courierId);
    const isCourierApiConnected = selectedCourier?.integrationType === 'API';
    const [courierCoverageCache, setCourierCoverageCache] = useState([]);

    // Fetch full coverage when courier changes (one API call per courier selection)
    useEffect(() => {
        if (!store.courierId || !isCourierApiConnected) {
            setCourierCoverageCache([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await apiFetch(`/api/couriers/${store.courierId}/coverage`);
                if (!res.ok) throw new Error('coverage fetch failed');
                const json = await res.json();
                const data = json.data ?? json;
                if (!cancelled) setCourierCoverageCache(Array.isArray(data) ? data : []);
            } catch {
                if (!cancelled) setCourierCoverageCache([]);
            }
        })();
        return () => { cancelled = true; };
    }, [store.courierId, isCourierApiConnected]);

    // Filter communes locally from cached coverage data
    useEffect(() => {
        if (!store.shippingWilayaCode) {
            setAvailableCommunes([]);
            return;
        }

        let allCommunes = getCommunesForWilaya(store.shippingWilayaCode).map(name => ({ name }));

        // Only filter if courier is API-connected and has coverage data
        if (isCourierApiConnected && courierCoverageCache.length > 0) {
            const wCode = String(store.shippingWilayaCode);

            // Filter coverage entries for this wilaya
            let wilayaCoverage = courierCoverageCache.filter(c =>
                String(c.wilayaCode) === wCode
            );

            // For Stop Desk: only communes where officeSupported is true
            if (store.shippingDeliveryType === 1) {
                wilayaCoverage = wilayaCoverage.filter(c => c.officeSupported);
            }

            if (wilayaCoverage.length > 0) {
                // Check if there's a catch-all wilaya entry (no specific commune)
                const hasFullWilayaCoverage = wilayaCoverage.some(c => !c.commune || c.commune.trim() === '');

                if (!hasFullWilayaCoverage) {
                    const coveredCommunes = new Set(wilayaCoverage.map(c => c.commune.toLowerCase()));
                    allCommunes = allCommunes.filter(c => coveredCommunes.has(c.name.toLowerCase()));
                }
            } else {
                // No coverage entries for this wilaya at all
                if (store.shippingDeliveryType === 1) {
                    // Stop Desk + no offices = empty
                    allCommunes = [];
                }
                // Home delivery + no coverage = could mean not covered, but show all as fallback
            }
        }
        // Manual courier → no filtering, show all communes

        setAvailableCommunes(allCommunes);

        // Reset commune if no longer in filtered list
        if (store.shippingCommune && !allCommunes.find(c => c.name === store.shippingCommune)) {
            store.updateField('shippingCommune', '');
        }
    }, [store.shippingWilayaCode, store.shippingDeliveryType, isCourierApiConnected, courierCoverageCache, isOpen]);

    // 3. Auto Pricing Calculation — fires when commune/courier/deliveryType changes
    const [priceError, setPriceError] = useState('');

    useEffect(() => {
        if (!store.shippingWilayaCode || !store.shippingCommune || store.manualPricing) return;

        let cancelled = false;
        const calculate = async () => {
            setIsCalculatingPrice(true);
            setPriceError('');
            try {
                if (store.courierId) {
                    const priceRes = await apiFetch('/api/couriers/engine/calculate-price', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            courierId: store.courierId,
                            wilayaCode: store.shippingWilayaCode,
                            commune: store.shippingCommune,
                            deliveryType: store.shippingDeliveryType,
                            totalWeight: store.shippingWeight,
                            productIds: store.products.map(p => p.variantId || p.baseProductId).filter(Boolean)
                        })
                    });
                    if (cancelled) return;
                    const priceJson = await priceRes.json();
                    const priceData = priceJson.data ?? priceJson;
                    if (priceRes.ok && priceData.price !== undefined) {
                        store.updateField('courierFee', priceData.price);
                    } else {
                        setPriceError(priceData.message || t('orderModal.priceNotFound', 'No pricing rule found'));
                    }
                } else {
                    const recQuery = new URLSearchParams({
                        wilayaCode: store.shippingWilayaCode,
                        commune: store.shippingCommune,
                        deliveryType: String(store.shippingDeliveryType)
                    });
                    const recRes = await apiFetch(`/api/couriers/engine/recommend?${recQuery.toString()}`);
                    if (cancelled) return;
                    if (!recRes.ok) throw new Error('recommend failed');
                    const recJson = await recRes.json();
                    const recData = recJson.data ?? recJson;
                    if (recData.recommended) {
                        setRecommendedCourier(recData.recommended);
                        store.updateField('courierFee', recData.recommended.price);
                    } else {
                        setPriceError(t('orderModal.noCourierRecommendation', 'No courier covers this area'));
                    }
                }
            } catch (err) {
                if (!cancelled) setPriceError(err.message || t('orderModal.calcError', 'Price calculation failed'));
            } finally {
                if (!cancelled) setIsCalculatingPrice(false);
            }
        };
        calculate();
        return () => { cancelled = true; };
    }, [store.shippingWilayaCode, store.shippingCommune, store.courierId, store.shippingDeliveryType, store.manualPricing]);


    const [warningConfirmOpen, setWarningConfirmOpen] = useState(false);
    const [pendingSubmitEvent, setPendingSubmitEvent] = useState(null);

    const handleSubmit = async (e, saveAndContinue = false) => {
        e.preventDefault();
        setFormError('');

        // Validations
        const validProducts = store.products.filter(p => (p.isCustom ? p.name.trim() !== '' : p.variantId) && Number(p.quantity) > 0 && Number(p.unitPrice) >= 0);
        if (validProducts.length === 0) {
            setFormError(t('orderModal.errorNoProducts'));
            return;
        }

        if (store.shippingDeliveryType === 1 && !store.shippingCommune) {
            setFormError(t('orderModal.errorNoCommune'));
            return;
        }

        if (intelligenceData?.warning && !warningConfirmOpen) {
            setPendingSubmitEvent({ saveAndContinue, validProducts });
            setWarningConfirmOpen(true);
            return;
        }

        executeSubmit(saveAndContinue, validProducts);
    };

    const executeSubmit = async (saveAndContinue, validProducts) => {
        const payload = {
            orderId: store.orderId,
            customerId: store.customerId,
            customerName: store.customerName,
            customerPhone: store.customerPhone,
            channel: store.channel,
            status: store.status,
            priority: store.priority,
            tags: store.tags,
            notes: store.notes,
            courier: store.courierId || null,
            financials: {
                codAmount: Number(store.codAmount),
                courierFee: Number(store.courierFee),
                discount: Number(store.discount)
            },
            shipping: {
                recipientName: store.customerName,
                phone1: store.customerPhone,
                phone2: store.shippingPhone2,
                wilayaCode: store.shippingWilayaCode,
                wilayaName: store.shippingWilayaName,
                commune: store.shippingCommune,
                address: store.shippingAddress,
                weight: Number(store.shippingWeight),
                fragile: store.shippingFragile,
                deliveryType: Number(store.shippingDeliveryType)
            },
            products: validProducts.map(p => {
                const prod = { ...p };
                if (!prod.variantId) delete prod.variantId;
                return prod;
            })
        };

        setIsSubmitting(true);
        const result = await onSubmit(payload);
        setIsSubmitting(false);

        if (result && result.success === false) {
            setFormError(result.error);
        } else if (saveAndContinue) {
            store.resetForm();
        } else {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-gray-900/60 backdrop-blur-sm" {...backdropProps}>
            <div className="bg-white dark:bg-gray-800 md:rounded-2xl shadow-xl w-full max-w-5xl flex flex-col h-[100dvh] md:h-auto md:max-h-[96vh] overflow-hidden" {...panelProps}>

                {/* Header */}
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-2 rounded-lg shadow-sm shadow-blue-600/20">
                            <Plus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {isEdit ? t('orderModal.editTitle') : t('orderModal.createTitle')}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide">{t('orderModal.subtitle')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    <form id="orderForm" onSubmit={e => handleSubmit(e, false)} className="space-y-8">

                        {formError && (
                            <div className="p-4 bg-red-50/50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl text-sm font-medium border border-red-200/50 dark:border-red-800/50 flex items-start gap-3 shadow-sm animate-pulse-once">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                                <span>{formError}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                            {/* Left Column — Customer & Shipping (essential) */}
                            <div className="lg:col-span-7 space-y-5">

                                {/* Intelligence Panel */}
                                <CustomerIntelligencePanel data={intelligenceData} isSearching={isLookingUpPhone} />

                                {/* Customer & Shipping — essential fields only */}
                                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-5 shadow-sm">
                                    {/* Order ID badge (auto-generated, not an input) */}
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Truck className="w-4 h-4 text-blue-500" /> {t('orderModal.customerDetails')}
                                        </h3>
                                        <span className="text-[11px] font-mono font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{store.orderId}</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Phone — first field, autofocus */}
                                        <div>
                                            <label htmlFor="order-phone" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">{t('orderModal.primaryPhone')} *</label>
                                            <input id="order-phone" required autoFocus type="tel" autoComplete="tel" dir="ltr" placeholder="05/06/07..." className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-3 py-2 text-sm dark:text-gray-100 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all font-medium" value={store.customerPhone} onChange={e => store.updateField('customerPhone', e.target.value)} />
                                        </div>
                                        {/* Name */}
                                        <div>
                                            <label htmlFor="order-name" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">{t('orderModal.fullName')} *</label>
                                            <input id="order-name" required type="text" autoComplete="name" placeholder="..." className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-3 py-2 text-sm dark:text-gray-100 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all font-medium" value={store.customerName} onChange={e => store.updateField('customerName', e.target.value)} />
                                        </div>
                                        {/* Wilaya */}
                                        <div>
                                            <label htmlFor="order-wilaya" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">{t('orderModal.wilaya')} *</label>
                                            <select id="order-wilaya" required className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-3 py-2 text-sm dark:text-gray-100 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-600 transition-all font-medium appearance-none cursor-pointer" value={store.shippingWilayaCode} onChange={e => { const wCode = e.target.value; const w = getWilayaByCode(wCode); store.updateField('shippingWilayaCode', wCode); store.updateField('shippingWilayaName', w ? w.name : ''); store.updateField('shippingCommune', ''); }}>
                                                <option value="" disabled>{t('orderModal.selectWilaya')}</option>
                                                {getWilayaList().map(w => (
                                                    <option key={w.code} value={w.code}>{String(w.code).padStart(2, '0')} - {w.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {/* Commune */}
                                        <div>
                                            <label htmlFor="order-commune" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between uppercase tracking-wide">
                                                <span>{t('orderModal.commune')} *</span>
                                                {store.shippingWilayaCode && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium normal-case bg-blue-50 dark:bg-blue-900/40 px-1.5 rounded">{availableCommunes.length}</span>}
                                            </label>
                                            <select id="order-commune" required disabled={!store.shippingWilayaCode || availableCommunes.length === 0} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-3 py-2 text-sm dark:text-gray-100 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-600 transition-all font-medium appearance-none disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed cursor-pointer" value={store.shippingCommune} onChange={e => store.updateField('shippingCommune', e.target.value)}>
                                                <option value="" disabled>{store.shippingWilayaCode ? t('orderModal.selectCommune') : t('orderModal.selectWilayaFirst')}</option>
                                                {availableCommunes.map(c => (
                                                    <option key={c.name} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {/* Address */}
                                        <div className="md:col-span-2">
                                            <label htmlFor="order-address" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">{t('orderModal.detailedAddress')}</label>
                                            <input id="order-address" type="text" placeholder={t('orderModal.addressPlaceholder')} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-3 py-2 text-sm dark:text-gray-100 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all font-medium" value={store.shippingAddress} onChange={e => store.updateField('shippingAddress', e.target.value)} />
                                        </div>
                                        {/* Delivery mode + Courier — inline */}
                                        <div className="grid grid-cols-2 gap-3 md:col-span-2">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">{t('orderModal.deliveryMode')}</label>
                                                <div className="flex bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-0.5">
                                                    <button type="button" onClick={() => store.updateField('shippingDeliveryType', 0)} className={clsx("flex-1 text-xs py-1.5 rounded-md font-bold transition-all", store.shippingDeliveryType === 0 ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600")}>{t('orderModal.deliveryHome')}</button>
                                                    <button type="button" onClick={() => store.updateField('shippingDeliveryType', 1)} className={clsx("flex-1 text-xs py-1.5 rounded-md font-bold transition-all", store.shippingDeliveryType === 1 ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600")}>{t('orderModal.deliveryStopDesk')}</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label htmlFor="order-courier" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">{t('orderModal.courierPriority')}</label>
                                                <select id="order-courier" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-3 py-2 text-sm dark:text-gray-100 focus:border-blue-500 transition-all font-medium appearance-none cursor-pointer" value={store.courierId} onChange={e => store.updateField('courierId', e.target.value)}>
                                                    <option value="">{t('orderModal.systemRecommended')}</option>
                                                    {couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                                </select>
                                                {!store.courierId && recommendedCourier && (
                                                    <p className="text-[10px] text-green-600 font-medium mt-1 inline-flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3"/> {t('orderModal.suggested', { name: recommendedCourier.name })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* More Options toggle — Channel, Priority, Phone2, Weight, Fragile, Notes */}
                                    <button type="button" onClick={() => setShowMoreOptions(!showMoreOptions)} className="mt-4 w-full flex items-center justify-center gap-1 text-xs font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1">
                                        <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform", showMoreOptions && "rotate-180")} />
                                        {showMoreOptions ? t('orderModal.lessOptions', 'Less options') : t('orderModal.moreOptions', 'More options')}
                                    </button>

                                    {showMoreOptions && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-200">
                                            <div>
                                                <label htmlFor="order-channel" className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t('orderModal.channel')}</label>
                                                <select id="order-channel" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-2 py-1.5 text-xs font-bold text-gray-800 dark:text-gray-100 appearance-none cursor-pointer" value={store.channel} onChange={e => store.updateField('channel', e.target.value)}>
                                                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="order-priority" className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t('orderModal.priority', 'Priority')}</label>
                                                <select id="order-priority" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-2 py-1.5 text-xs font-bold text-gray-800 dark:text-gray-100 appearance-none cursor-pointer" value={store.priority} onChange={e => store.updateField('priority', e.target.value)}>
                                                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="order-phone2" className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t('orderModal.phone2', 'Phone 2')}</label>
                                                <input id="order-phone2" type="tel" dir="ltr" placeholder="Optional" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-2 py-1.5 text-xs dark:text-gray-100 font-medium" value={store.shippingPhone2} onChange={e => store.updateField('shippingPhone2', e.target.value)} />
                                            </div>
                                            <div className="flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <label htmlFor="order-weight" className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t('orderModal.weight', 'Weight')}</label>
                                                    <input id="order-weight" type="number" min="0.1" step="0.1" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-2 py-1.5 text-xs dark:text-gray-100 font-medium" value={store.shippingWeight} onChange={e => store.updateField('shippingWeight', Number(e.target.value))} />
                                                </div>
                                                <label className="flex items-center gap-1.5 pb-1 cursor-pointer">
                                                    <input type="checkbox" checked={store.shippingFragile} onChange={e => store.updateField('shippingFragile', e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-blue-500 w-3.5 h-3.5" />
                                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{t('orderModal.fragile', 'Fragile')}</span>
                                                </label>
                                            </div>
                                            <div className="col-span-2 md:col-span-4">
                                                <label htmlFor="order-notes" className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t('orderModal.notesLabel')}</label>
                                                <textarea id="order-notes" rows="1" placeholder={t('orderModal.notesPlaceholder')} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-2 py-1.5 text-xs dark:text-gray-100 resize-none font-medium" value={store.notes} onChange={e => store.updateField('notes', e.target.value)}></textarea>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column — Products & Pricing */}
                            <div className="lg:col-span-5 space-y-5 flex flex-col">

                                {/* Products with search */}
                                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                                    <div className="p-3 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t('orderModal.cartItems')}</h3>
                                            <button type="button" onClick={store.addProduct} className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
                                                <Plus className="w-3 h-3" /> {t('orderModal.addItem')}
                                            </button>
                                        </div>
                                        {/* Product search bar */}
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                            <input type="text" placeholder={t('orderModal.searchProduct', 'Search products...')} className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg pl-8 pr-3 py-1.5 text-xs dark:text-gray-100 focus:border-blue-500 transition-colors" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="p-3 space-y-2.5 overflow-y-auto max-h-[280px] custom-scrollbar">
                                        {store.products.map((product, index) => (
                                            <div key={product.variantId || product.name || index} className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 relative group">
                                                {/* Toggle: inventory vs custom */}
                                                <div className="flex items-center gap-2">
                                                    {product.isCustom ? (
                                                        /* Custom product: free-text name input */
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder={t('orderModal.customProductName', 'Product name...')}
                                                            className="flex-1 bg-white dark:bg-gray-700 outline-none border border-amber-300 dark:border-amber-600 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-sm dark:text-gray-100 font-semibold transition-colors"
                                                            value={product.name}
                                                            onChange={e => store.updateProduct(index, 'name', e.target.value)}
                                                        />
                                                    ) : (
                                                        /* Inventory product: dropdown */
                                                        <select
                                                            required
                                                            className="flex-1 bg-white dark:bg-gray-700 outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-sm dark:text-gray-100 font-semibold appearance-none cursor-pointer transition-colors"
                                                            value={product.variantId || ''}
                                                            onChange={e => {
                                                                const selectedVariant = availableVariants.find(v => v.variantId === e.target.value);
                                                                if (selectedVariant) {
                                                                    store.updateProductMulti(index, {
                                                                        variantId: selectedVariant.variantId,
                                                                        name: selectedVariant.displayName,
                                                                        unitPrice: selectedVariant.price,
                                                                        sku: selectedVariant.sku,
                                                                        availableStock: selectedVariant.availableStock
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <option value="" disabled>{t('orderModal.selectVariant')}</option>
                                                            {filteredVariants.map(v => (
                                                                <option key={v.variantId} value={v.variantId}>{v.displayName}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    {/* Custom toggle button */}
                                                    <button
                                                        type="button"
                                                        title={product.isCustom ? t('orderModal.switchToInventory', 'Switch to inventory') : t('orderModal.switchToCustom', 'Custom item')}
                                                        onClick={() => store.updateProductMulti(index, {
                                                            isCustom: !product.isCustom,
                                                            variantId: ''
                                                        })}
                                                        className={clsx("shrink-0 px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors",
                                                            product.isCustom
                                                                ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                                                                : "bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-400 border-gray-200 dark:border-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-600"
                                                        )}
                                                    >
                                                        {product.isCustom ? '📦' : '✏️'}
                                                    </button>
                                                </div>
                                                {!product.isCustom && product.availableStock !== null && (
                                                    <div className="flex items-center justify-between px-1">
                                                        <span className={clsx("text-[10px] font-medium", product.availableStock <= 5 ? "text-red-500" : "text-green-600")}>
                                                            {t('orderModal.inStock', { count: product.availableStock })}
                                                        </span>
                                                        {product.sku && <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{product.sku}</span>}
                                                    </div>
                                                )}
                                                <div className="flex gap-2 items-center">
                                                    <div className="w-20">
                                                        <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded overflow-hidden bg-white dark:bg-gray-700">
                                                            <button type="button" onClick={() => store.updateProduct(index, 'quantity', Math.max(1, product.quantity - 1))} className="px-2 bg-gray-50 dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-300 font-medium">-</button>
                                                            <input required type="number" min="1" max={(!product.isCustom && product.availableStock) || undefined} className="w-full bg-white dark:bg-gray-700 dark:text-gray-100 outline-none py-1 text-center text-sm font-bold appearance-none" value={product.quantity} onChange={e => store.updateProduct(index, 'quantity', Number(e.target.value))} />
                                                            <button type="button" onClick={() => store.updateProduct(index, 'quantity', product.quantity + 1)} className="px-2 bg-gray-50 dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-300 font-medium">+</button>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <span className="absolute left-2 top-1.5 text-gray-400 dark:text-gray-500 text-xs font-bold">{t('common.dzd', 'DZD')}</span>
                                                        <input required type="number" min="0" step="0.01" className="w-full bg-white dark:bg-gray-700 outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-500 py-1 pl-10 pr-2 rounded text-sm dark:text-gray-100 font-bold transition-colors" value={product.unitPrice} onChange={e => store.updateProduct(index, 'unitPrice', e.target.value)} />
                                                    </div>
                                                    <span className="w-20 text-right text-sm font-bold text-gray-900 dark:text-white">{(product.quantity * product.unitPrice).toLocaleString()} {t('common.dzd', 'DZD')}</span>
                                                </div>
                                                <button type="button" onClick={() => store.removeProduct(index)} disabled={store.products.length === 1} className="absolute -right-1.5 -top-1.5 p-1 bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 text-gray-400 hover:text-red-500 rounded-full disabled:opacity-0 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Pricing Summary — cleaner */}
                                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>

                                    <div className="space-y-1.5 mb-3 relative z-10 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400">{t('orderModal.subtotal')}</span>
                                            <span className="font-bold">{store.calculateSubtotal().toLocaleString()} {t('common.dzd', 'DZD')}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-gray-400">{t('orderModal.delivery')}</span>
                                                {isCalculatingPrice && <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <input type="checkbox" checked={store.manualPricing} onChange={e => store.updateField('manualPricing', e.target.checked)} className="rounded bg-gray-800 border-gray-600 text-blue-500 w-3 h-3" title={t('orderModal.overrideFee')} />
                                                {store.manualPricing ? (
                                                    <input type="number" className="w-16 bg-white/10 outline-none border border-white/20 rounded px-1.5 py-0.5 text-right text-xs font-bold" value={store.courierFee} onChange={e => store.updateField('courierFee', e.target.value)} />
                                                ) : (
                                                    <span className="font-bold text-blue-300">{Number(store.courierFee).toLocaleString()} {t('common.dzd', 'DZD')}</span>
                                                )}
                                            </div>
                                        </div>
                                        {priceError && (
                                            <div className="text-[10px] text-amber-400 px-1">{priceError}</div>
                                        )}
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400">{t('orderModal.discount')}</span>
                                            <input type="number" className="w-14 bg-white/10 outline-none border border-white/20 rounded px-1.5 py-0.5 text-right text-xs font-bold text-green-400" value={store.discount} onChange={e => store.updateField('discount', e.target.value)} placeholder="0" />
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-700 pt-2.5 flex justify-between items-end relative z-10">
                                        <div>
                                            <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">{t('orderModal.finalCollection')}</span>
                                            <span className="text-xl font-black leading-none">{store.calculateFinalTotal().toLocaleString()} <span className="text-xs">{t('common.dzd', 'DZD')}</span></span>
                                        </div>
                                        {/* COD override — only show input when clicked */}
                                        <div className="text-right">
                                            {codOverride ? (
                                                <div>
                                                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-0.5">{t('orderModal.overrideCod')}</label>
                                                    <input type="number" autoFocus className="w-20 bg-black/30 outline-none border border-gray-600 focus:border-blue-500 rounded px-2 py-1 text-right text-sm font-bold" value={store.codAmount || store.calculateFinalTotal()} onChange={e => store.updateField('codAmount', e.target.value)} onBlur={() => { if (!store.codAmount || Number(store.codAmount) === store.calculateFinalTotal()) { store.updateField('codAmount', 0); setCodOverride(false); } }} />
                                                </div>
                                            ) : (
                                                <button type="button" onClick={() => setCodOverride(true)} className="text-[10px] text-gray-500 hover:text-gray-300 font-bold uppercase tracking-wide transition-colors">
                                                    {t('orderModal.overrideCod')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Save as status — inline compact */}
                                <div className="flex items-center gap-3">
                                    <label htmlFor="order-status" className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">{t('orderModal.saveAsStatus')}</label>
                                    <select id="order-status" className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-all font-bold text-blue-900 dark:text-blue-300 appearance-none cursor-pointer" value={store.status} onChange={e => store.updateField('status', e.target.value)}>
                                        {STATUSES.map(st => <option key={st} value={st}>{getOrderStatusLabel(t, st)}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer Controls */}
                <div className="p-4 md:p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center shrink-0 safe-bottom">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
                        {t('orderModal.discard')}
                    </button>
                    <div className="flex gap-3">
                        {!isEdit && (
                            <button type="submit" form="orderForm" disabled={isSubmitting} onClick={(e) => handleSubmit(e, true)} className="px-5 py-2 text-sm font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 rounded-lg transition-colors flex items-center gap-2 border border-blue-200/50 dark:border-blue-800/50">
                                {isSubmitting ? <div className="w-4 h-4 rounded-full border-2 border-blue-700/30 border-t-blue-700 animate-spin"></div> : <Save className="w-4 h-4 shrink-0" />}
                                {t('orderModal.saveAndAdd')}
                            </button>
                        )}
                        <button type="submit" form="orderForm" disabled={isSubmitting} onClick={(e) => handleSubmit(e, false)} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-600/30 transition-colors flex items-center gap-2">
                             {isSubmitting ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div> : <CheckCircle className="w-4 h-4 shrink-0" />}
                             {isEdit ? t('orderModal.saveChanges') : t('orderModal.confirmOrder')}
                        </button>
                    </div>
                </div>

            </div>

             {/* Custom Warning Dialog */}
            {warningConfirmOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-amber-100 dark:bg-amber-900/40">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('orderModal.warningTitle', 'تحديث حالة')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 font-medium leading-relaxed">
                            {intelligenceData?.warning && t(`intelligence.${intelligenceData.warning}`)}
                            <br/><br/>
                            {t('orderModal.warningConfirm', 'هل تريد المتابعة في حفظ هذا الطلب؟')}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setWarningConfirmOpen(false); setPendingSubmitEvent(null); }}
                                className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                {t('orderModal.cancel', 'إلغاء')}
                            </button>
                            <button
                                onClick={() => {
                                    setWarningConfirmOpen(false);
                                    if (pendingSubmitEvent) {
                                        executeSubmit(pendingSubmitEvent.saveAndContinue, pendingSubmitEvent.validProducts);
                                        setPendingSubmitEvent(null);
                                    }
                                }}
                                className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm shadow-amber-600/20"
                            >
                                {t('orderModal.confirm', 'متابعة الحفظ')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
