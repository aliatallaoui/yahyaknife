import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, AlertCircle, Truck, Save, RefreshCw, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import moment from 'moment';
import * as leblad from '@dzcode-io/leblad';
import axios from 'axios';
import { useOrderFormStore } from '../stores/useOrderFormStore';
import CustomerIntelligencePanel from './orders/CustomerIntelligencePanel';

// Assuming global api config or proxy is set up
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
    config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
    return config;
});

const CHANNELS = ['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'WhatsApp', 'Facebook', 'TikTok', 'Instagram', 'Manual', 'Other'];
const STATUSES = ['New', 'Calling', 'No Answer', 'Postponed', 'Wrong Number', 'Confirmed'];
const PRIORITIES = ['Normal', 'High', 'Urgent', 'VIP'];

const getSafeCommunesForWilaya = (wilayaCode) => {
    if (!wilayaCode) return [];
    const w = leblad.getWilayaByCode(Number(wilayaCode));
    if (!w || !w.dairats) return [];
    const communes = [];
    w.dairats.forEach(d => {
        if (d.baladyiats && Array.isArray(d.baladyiats)) {
            communes.push(...d.baladyiats);
        }
    });
    return communes.sort((a, b) => a.name.localeCompare(b.name));
};

export default function OrderModal({ isOpen, onClose, onSubmit, initialData, inventoryProducts = [], couriers = [] }) {
    const { t } = useTranslation();
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

    // Initialize Store
    useEffect(() => {
        if (isOpen) {
            setFormError('');
            setIntelligenceData(null);
            if (isEdit) {
                store.setInitialData(initialData);
            } else {
                store.resetForm();
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

    // 1. Phone Lookup Engine (Debounced)
    useEffect(() => {
        const phone = store.customerPhone;
        // Basic Algerian length check before lookup
        if (phone && phone.length >= 9) {
            const timer = setTimeout(async () => {
                setIsLookingUpPhone(true);
                try {
                    const { data } = await api.get(`/customers/lookup?phone=${encodeURIComponent(phone)}`);
                    setIntelligenceData(data);

                    // Autofill if new and found
                    if (!isEdit && data.exists && data.customer) {
                        if (!store.customerName) store.updateField('customerName', data.customer.name);
                        store.updateField('customerId', data.customer._id);
                    }
                } catch (err) {
                    console.error('Phone lookup failed', err);
                } finally {
                    setIsLookingUpPhone(false);
                }
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setIntelligenceData(null);
        }
    }, [store.customerPhone, isEdit]);

    // 2. Dynamic Commune & Courier Coverage Logic
    useEffect(() => {
        const updateCoverage = async () => {
            if (!store.shippingWilayaCode) {
                setAvailableCommunes([]);
                return;
            }

            let allCommunes = getSafeCommunesForWilaya(store.shippingWilayaCode);

            // If a courier is selected OR delivery type is Stop Desk, we need to verify coverage
            if (store.courierId || store.shippingDeliveryType === 1) {
                try {
                    const query = new URLSearchParams({
                        wilayaCode: store.shippingWilayaCode,
                        deliveryType: String(store.shippingDeliveryType)
                    });
                    if (store.courierId) query.append('courierId', store.courierId);

                    const { data } = await api.get(`/couriers/engine/coverage?${query.toString()}`);

                    if (data && data.length > 0) {
                        // Filter standard communes to only those covered by returned rules
                        const coveredCommunes = data.map(c => c.commune.toLowerCase());

                        // If there is a catch-all wilaya rule without specific commune limits
                        const hasFullWilayaCoverage = data.some(c => !c.commune || c.commune.trim() === '');

                        if (!hasFullWilayaCoverage) {
                            allCommunes = allCommunes.filter(c => coveredCommunes.includes(c.name.toLowerCase()));
                        }
                    } else if (store.shippingDeliveryType === 1) {
                        // If Stop Desk and no coverage rules returned, typically assume none supported unless defined
                        allCommunes = [];
                    }
                } catch (err) {
                    console.error("Failed to fetch coverage", err);
                }
            }

            setAvailableCommunes(allCommunes);

            // Auto reset commune if the newly fetched list doesn't contain the currently selected commune
            if (store.shippingCommune && !allCommunes.find(c => c.name === store.shippingCommune)) {
                store.updateField('shippingCommune', '');
            }
        };

        if (isOpen) updateCoverage();
    }, [store.shippingWilayaCode, store.courierId, store.shippingDeliveryType, isOpen]);

    // 3. Dynamic Courier Recommendation & Pricing Engine
    useEffect(() => {
        const calculatePrice = async () => {
            if (!store.shippingWilayaCode || !store.shippingCommune) {
                if (!store.manualPricing) store.updateField('courierFee', 0);
                setRecommendedCourier(null);
                return;
            }

            setIsCalculatingPrice(true);
            try {
                // First get recommendation
                const recRes = await api.get('/couriers/engine/recommend', {
                    params: {
                        wilayaCode: store.shippingWilayaCode,
                        commune: store.shippingCommune,
                        deliveryType: store.shippingDeliveryType
                    }
                });

                if (recRes.data.recommended) {
                    setRecommendedCourier(recRes.data.recommended);
                } else {
                    setRecommendedCourier(null);
                }

                // If courier is assigned, calculate exact price
                if (store.courierId && !store.manualPricing) {
                    const priceRes = await api.post('/couriers/engine/calculate-price', {
                        courierId: store.courierId,
                        wilayaCode: store.shippingWilayaCode,
                        commune: store.shippingCommune,
                        deliveryType: store.shippingDeliveryType,
                        totalWeight: store.shippingWeight,
                        productIds: store.products.map(p => p.variantId || p.baseProductId).filter(Boolean)
                    });
                    if (priceRes.data && priceRes.data.price !== undefined) {
                        store.updateField('courierFee', priceRes.data.price);
                    }
                } else if (!store.courierId && recRes.data.recommended && !store.manualPricing) {
                    // Auto suggest price if no courier selected but we have a recommendation
                     store.updateField('courierFee', recRes.data.recommended.price);
                }
            } catch (err) {
                console.error("Pricing calc failed", err);
            } finally {
                setIsCalculatingPrice(false);
            }
        };

        const timer = setTimeout(() => {
            if (isOpen) calculatePrice();
        }, 300);
        return () => clearTimeout(timer);
    }, [store.shippingWilayaCode, store.shippingCommune, store.courierId, store.shippingDeliveryType, store.manualPricing, isOpen]);


    const handleSubmit = async (e, saveAndContinue = false) => {
        e.preventDefault();
        setFormError('');

        // Validations
        const validProducts = store.products.filter(p => (p.variantId || p.name.trim() !== '') && Number(p.quantity) > 0 && Number(p.unitPrice) >= 0);
        if (validProducts.length === 0) {
            setFormError(t('orderModal.errorNoProducts'));
            return;
        }

        if (store.shippingDeliveryType === 1 && !store.shippingCommune) {
            setFormError(t('orderModal.errorNoCommune'));
            return;
        }

        if (intelligenceData?.warning && !confirm(t('orderModal.warningConfirm', { warning: intelligenceData.warning }))) {
            return;
        }

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
            products: validProducts
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white md:rounded-2xl shadow-xl w-full max-w-5xl flex flex-col h-[100dvh] md:h-auto md:max-h-[96vh] overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-2 rounded-lg shadow-sm shadow-blue-600/20">
                            <Plus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {isEdit ? t('orderModal.editTitle') : t('orderModal.createTitle')}
                            </h2>
                            <p className="text-sm text-gray-500 font-medium tracking-wide">{t('orderModal.subtitle')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    <form id="orderForm" onSubmit={e => handleSubmit(e, false)} className="space-y-8">

                        {formError && (
                            <div className="p-4 bg-red-50/50 text-red-700 rounded-xl text-sm font-medium border border-red-200/50 flex items-start gap-3 shadow-sm animate-pulse-once">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                                <span>{formError}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                            {/* Left Column (Customer & Config) */}
                            <div className="lg:col-span-7 space-y-6">

                                {/* Section A: Intelligence Panel */}
                                <CustomerIntelligencePanel data={intelligenceData} isSearching={isLookingUpPhone} />

                                {/* Section B: Customer & Delivery */}
                                <div className="bg-white border rounded-xl p-5 shadow-sm">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Truck className="w-4 h-4 text-blue-500" /> {t('orderModal.customerDetails')}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('orderModal.primaryPhone')} *</label>
                                            <input required autoFocus type="tel" placeholder="05/06/07..." className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-medium" value={store.customerPhone} onChange={e => store.updateField('customerPhone', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('orderModal.fullName')} *</label>
                                            <input required type="text" placeholder="John Doe" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-medium" value={store.customerName} onChange={e => store.updateField('customerName', e.target.value)} />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('orderModal.wilaya')} *</label>
                                            <select required className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:bg-white transition-all font-medium appearance-none cursor-pointer" value={store.shippingWilayaCode} onChange={e => { const wCode = e.target.value; const w = leblad.getWilayaList().find(w => w.mattricule === Number(wCode)); store.updateField('shippingWilayaCode', wCode); store.updateField('shippingWilayaName', w ? w.name : ''); store.updateField('shippingCommune', ''); }}>
                                                <option value="" disabled>{t('orderModal.selectWilaya')}</option>
                                                {leblad.getWilayaList().map(w => (
                                                    <option key={w.mattricule} value={w.mattricule}>{String(w.mattricule).padStart(2, '0')} - {w.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between uppercase tracking-wide">
                                                <span>{t('orderModal.commune')} *</span>
                                                {store.shippingWilayaCode && <span className="text-[10px] text-blue-600 font-medium normal-case bg-blue-50 px-1.5 rounded">{t('orderModal.communeOptions', { count: availableCommunes.length })}</span>}
                                            </label>
                                            <select required disabled={!store.shippingWilayaCode || availableCommunes.length === 0} className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:bg-white transition-all font-medium appearance-none disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer" value={store.shippingCommune} onChange={e => store.updateField('shippingCommune', e.target.value)}>
                                                <option value="" disabled>{store.shippingWilayaCode ? t('orderModal.selectCommune') : t('orderModal.selectWilayaFirst')}</option>
                                                {availableCommunes.map(c => (
                                                    <option key={c.code} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('orderModal.detailedAddress')}</label>
                                            <input type="text" placeholder={t('orderModal.addressPlaceholder')} className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-medium" value={store.shippingAddress} onChange={e => store.updateField('shippingAddress', e.target.value)} />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 md:col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('orderModal.deliveryMode')}</label>
                                                <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                                                    <button type="button" onClick={() => store.updateField('shippingDeliveryType', 0)} className={clsx("flex-1 text-xs py-1.5 rounded-md font-bold transition-all", store.shippingDeliveryType === 0 ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50")}>{t('orderModal.deliveryHome')}</button>
                                                    <button type="button" onClick={() => store.updateField('shippingDeliveryType', 1)} className={clsx("flex-1 text-xs py-1.5 rounded-md font-bold transition-all", store.shippingDeliveryType === 1 ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50")}>{t('orderModal.deliveryStopDesk')}</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('orderModal.courierPriority')}</label>
                                                <select className="w-full bg-white border border-gray-200 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-all font-medium appearance-none cursor-pointer" value={store.courierId} onChange={e => store.updateField('courierId', e.target.value)}>
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
                                </div>
                            </div>

                            {/* Right Column (Products, Config, Pricing) */}
                            <div className="lg:col-span-5 space-y-6 flex flex-col">

                                {/* Section C: Meta */}
                                <div className="bg-white border rounded-xl p-5 shadow-sm grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('orderModal.orderId')}</label>
                                        <input required type="text" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-1.5 text-sm font-bold text-gray-600" value={store.orderId} onChange={e => store.updateField('orderId', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('orderModal.channel')}</label>
                                        <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-1.5 text-sm font-bold text-gray-800 appearance-none cursor-pointer" value={store.channel} onChange={e => store.updateField('channel', e.target.value)}>
                                            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Section D: Products */}
                                <div className="bg-white border rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                                    <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wide">
                                            {t('orderModal.cartItems')}
                                        </h3>
                                        <button type="button" onClick={store.addProduct} className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                                            <Plus className="w-3 h-3" /> {t('orderModal.addItem')}
                                        </button>
                                    </div>

                                    <div className="p-4 space-y-3 overflow-y-auto max-h-[250px] custom-scrollbar bg-gray-50/20">
                                        {store.products.map((product, index) => (
                                            <div key={index} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-gray-100 shadow-sm relative group">
                                                <div className="flex gap-2 w-full">
                                                    <div className="flex-1">
                                                        <select
                                                            required
                                                            className="w-full bg-gray-50 outline-none border border-gray-200 focus:border-blue-500 focus:bg-white rounded px-2 py-1.5 text-sm font-semibold appearance-none cursor-pointer transition-colors"
                                                            value={product.variantId || ''}
                                                            onChange={e => {
                                                                const selectedId = e.target.value;
                                                                const selectedVariant = availableVariants.find(v => v.variantId === selectedId);
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
                                                            {availableVariants.map(v => (
                                                                <option key={v.variantId} value={v.variantId}>
                                                                    {v.displayName}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        {product.availableStock !== null && (
                                                            <div className="flex items-center justify-between mt-1 px-1">
                                                                <span className={clsx("text-[10px] font-medium", product.availableStock <= 5 ? "text-red-500" : "text-green-600")}>
                                                                    {t('orderModal.inStock', { count: product.availableStock })}
                                                                </span>
                                                                {product.sku && <span className="text-[10px] text-gray-400 font-medium font-mono">{product.sku}</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <div className="w-20">
                                                        <div className="flex items-center border border-gray-200 rounded overflow-hidden">
                                                            <button type="button" onClick={() => store.updateProduct(index, 'quantity', Math.max(1, product.quantity - 1))} className="px-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium">-</button>
                                                            <input required type="number" min="1" max={product.availableStock || undefined} className="w-full bg-white outline-none py-1 text-center text-sm font-bold appearance-none" value={product.quantity} onChange={e => store.updateProduct(index, 'quantity', Number(e.target.value))} />
                                                            <button type="button" onClick={() => store.updateProduct(index, 'quantity', product.quantity + 1)} className="px-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium">+</button>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <span className="absolute left-2 top-1.5 text-gray-400 text-xs font-bold">$</span>
                                                        <input required type="number" min="0" step="0.01" className="w-full bg-gray-50 outline-none border border-gray-200 focus:border-blue-500 focus:bg-white py-1 pl-5 pr-2 rounded text-sm font-bold transition-colors" value={product.unitPrice} onChange={e => store.updateProduct(index, 'unitPrice', e.target.value)} />
                                                    </div>
                                                    <div className="w-20 text-right pr-2">
                                                        <span className="text-sm font-bold text-gray-900">${(product.quantity * product.unitPrice).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <button type="button" onClick={() => store.removeProduct(index)} disabled={store.products.length === 1} className="absolute -right-2 -top-2 p-1.5 bg-white shadow-sm border border-gray-100 text-gray-400 hover:text-red-500 rounded-full disabled:opacity-0 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Section E: Pricing Summary */}
                                <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

                                    <div className="space-y-2 mb-4 relative z-10">
                                        <div className="flex justify-between text-sm items-center">
                                            <span className="text-gray-300 font-medium">{t('orderModal.subtotal')}</span>
                                            <span className="font-bold tracking-wide">${store.calculateSubtotal().toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-300 font-medium">{t('orderModal.delivery')}</span>
                                                {isCalculatingPrice && <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" checked={store.manualPricing} onChange={e => store.updateField('manualPricing', e.target.checked)} className="rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-offset-gray-900 w-3 h-3" title={t('orderModal.overrideFee')} />
                                                {store.manualPricing ? (
                                                    <input type="number" className="w-16 bg-white/10 outline-none border border-white/20 rounded px-1.5 py-0.5 text-right text-xs font-bold" value={store.courierFee} onChange={e => store.updateField('courierFee', e.target.value)} />
                                                ) : (
                                                    <span className="font-bold text-blue-300 tracking-wide">${Number(store.courierFee).toFixed(2)}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-sm items-center">
                                            <span className="text-gray-300 font-medium">{t('orderModal.discount')}</span>
                                            <input type="number" className="w-16 bg-white/10 outline-none border border-white/20 rounded px-1.5 py-0.5 text-right text-xs font-bold text-green-400 focus:bg-white/20 transition-colors" value={store.discount} onChange={e => store.updateField('discount', e.target.value)} placeholder="0" />
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-700 pt-3 mt-1 flex justify-between items-end relative z-10">
                                        <div>
                                            <span className="block text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-0.5">{t('orderModal.finalCollection')}</span>
                                            <span className="text-2xl font-black text-white leading-none">${store.calculateFinalTotal().toFixed(2)}</span>
                                        </div>
                                        <div className="text-right">
                                            <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold block mb-1">{t('orderModal.overrideCod')}</label>
                                            <input type="number" className="w-20 bg-black/30 outline-none border border-gray-600 focus:border-blue-500 rounded px-2 py-1 text-right text-sm font-bold transition-colors" value={store.codAmount || store.calculateFinalTotal()} onChange={e => store.updateField('codAmount', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                         {/* Bottom Row (Notes & Initial Status) */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-gray-100">
                             <div className="md:col-span-8">
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('orderModal.notesLabel')}</label>
                                <textarea rows="2" placeholder={t('orderModal.notesPlaceholder')} className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:bg-white resize-none transition-colors" value={store.notes} onChange={e => store.updateField('notes', e.target.value)}></textarea>
                            </div>
                            <div className="md:col-span-4 flex flex-col justify-end">
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('orderModal.saveAsStatus')}</label>
                                <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-2.5 text-sm focus:border-blue-500 focus:bg-white transition-all font-bold text-blue-900 appearance-none cursor-pointer" value={store.status} onChange={e => store.updateField('status', e.target.value)}>
                                    {STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                                </select>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer Controls */}
                <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0 safe-bottom">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
                        {t('orderModal.discard')}
                    </button>
                    <div className="flex gap-3">
                        {!isEdit && (
                            <button type="submit" form="orderForm" disabled={isSubmitting} onClick={(e) => handleSubmit(e, true)} className="px-5 py-2 text-sm font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors flex items-center gap-2 border border-blue-200/50">
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
        </div>
    );
}
