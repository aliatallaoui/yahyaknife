import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import moment from 'moment';
import { useCustomer } from '../context/CustomerContext';

const CHANNELS = ['Amazon', 'Alibaba', 'Tokopedia', 'Shopee', 'Website', 'Other'];
const STATUSES = ['New', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Shipped', 'Out for Delivery', 'Delivered', 'Paid', 'Refused', 'Returned', 'Cancelled'];
const PAYMENT_STATUSES = ['Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded'];

export default function OrderModal({ isOpen, onClose, onSubmit, initialData, inventoryProducts = [], customers = [], couriers = [] }) {
    const { t } = useTranslation();
    const { createCustomer } = useCustomer();
    const isEdit = !!initialData;

    // Inline Customer Creation State
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [isCreatingCustomerLoading, setIsCreatingCustomerLoading] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', city: '' });

    const handleQuickCreateCustomer = async () => {
        if (!newCustomer.name || !newCustomer.phone) {
            alert(t('modals.orderCustomerRequired', 'Name and Phone are required'));
            return;
        }
        setIsCreatingCustomerLoading(true);
        try {
            const created = await createCustomer({
                name: newCustomer.name,
                phone: newCustomer.phone,
                city: newCustomer.city,
                email: '',
                address: ''
            });
            setCustomerId(created._id);
            setIsCreatingCustomer(false);
            setNewCustomer({ name: '', phone: '', city: '' });
        } catch (error) {
            alert(t('modals.orderCustomerError', 'Failed to create customer. Please check your data.'));
        } finally {
            setIsCreatingCustomerLoading(false);
        }
    };

    // Form state
    const [orderId, setOrderId] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [courierId, setCourierId] = useState('');
    const [channel, setChannel] = useState('Website');
    const [status, setStatus] = useState('New');
    const [paymentStatus, setPaymentStatus] = useState('Unpaid');
    const [fulfillmentStatus, setFulfillmentStatus] = useState('Unfulfilled');
    const [fulfillmentPipeline, setFulfillmentPipeline] = useState('Pending');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(moment().format('YYYY-MM-DD'));
    const [codAmount, setCodAmount] = useState(0);
    const [courierFee, setCourierFee] = useState(0);

    // Submission states
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Dynamic products array
    const [products, setProducts] = useState([{ variantId: '', name: '', quantity: 1, unitPrice: 0, availableStock: null }]);

    // Flatten inventory products to variants
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

    useEffect(() => {
        if (isOpen) {
            if (isEdit && initialData) {
                setOrderId(initialData.orderId);
                setCustomerId(initialData.customer?._id || initialData.customer || '');
                setCourierId(initialData.courier?._id || initialData.courier || '');
                setChannel(initialData.channel);
                setStatus(initialData.status);
                setPaymentStatus(initialData.paymentStatus || 'Unpaid');
                setNotes(initialData.notes || '');
                setDate(moment(initialData.date).format('YYYY-MM-DD'));
                setCodAmount(initialData.financials?.codAmount || 0);
                setCourierFee(initialData.financials?.courierFee || 0);
                setProducts(
                    initialData.products?.length > 0
                        ? initialData.products.map(p => ({
                            variantId: p.variantId?._id || p.variantId || '',
                            name: p.name || 'Unknown Item',
                            quantity: p.quantity,
                            unitPrice: p.unitPrice,
                            availableStock: null
                        }))
                        : [{ variantId: '', name: '', quantity: 1, unitPrice: 0, availableStock: null }]
                );
            } else {
                // Reset form for create
                setOrderId(`ORD-${Math.floor(Math.random() * 100000)}`);
                setCustomerId('');
                setCourierId('');
                setChannel('Website');
                setStatus('New');
                setPaymentStatus('Unpaid');
                setNotes('');
                setDate(moment().format('YYYY-MM-DD'));
                setCodAmount(0);
                setCourierFee(0);
                setProducts([{ variantId: '', name: '', quantity: 1, unitPrice: 0, availableStock: null }]);
                setFormError('');
                setIsSubmitting(false);
            }
        }
    }, [isOpen, isEdit, initialData]);

    if (!isOpen) return null;

    const handleProductChange = (index, field, value) => {
        const newProducts = [...products];
        newProducts[index][field] = value;
        setProducts(newProducts);
    };

    const handleProductChangeMulti = (index, updates) => {
        const newProducts = [...products];
        newProducts[index] = { ...newProducts[index], ...updates };
        setProducts(newProducts);
    };

    const addProductLine = () => {
        setProducts([...products, { variantId: '', name: '', quantity: 1, unitPrice: 0, availableStock: null }]);
    };

    const removeProductLine = (index) => {
        if (products.length > 1) {
            setProducts(products.filter((_, i) => i !== index));
        }
    };

    const calculateTotal = () => {
        return products.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        // Filter out empty lines
        const validProducts = products.filter(p => (p.variantId || p.name.trim() !== '') && Number(p.quantity) > 0 && Number(p.unitPrice) >= 0);

        if (validProducts.length === 0) {
            setFormError("Order must contain at least one valid product.");
            return;
        }

        const payload = {
            orderId,
            customerId,
            courier: courierId || null,
            channel,
            status,
            paymentStatus,
            notes,
            financials: {
                codAmount: Number(codAmount),
                courierFee: Number(courierFee),
                cogs: initialData?.financials?.cogs || 0,
                marketplaceFees: initialData?.financials?.marketplaceFees || 0,
                gatewayFees: initialData?.financials?.gatewayFees || 0
            },
            date: new Date(date),
            products: validProducts,
            totalAmount: calculateTotal()
        };

        setIsSubmitting(true);
        const result = await onSubmit(payload);
        setIsSubmitting(false);

        if (result && result.success === false) {
            setFormError(result.error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEdit ? t('modals.orderTitleEdit') : t('modals.orderTitleNew')}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    <form id="orderForm" onSubmit={handleSubmit} className="space-y-6">

                        {formError && (
                            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200 break-words flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <span>{formError}</span>
                            </div>
                        )}

                        {/* Two column grid for basic info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('modals.orderIdLabel')}</label>
                                <input required type="text" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors" value={orderId} onChange={e => setOrderId(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('modals.orderDate')}</label>
                                <input required type="date" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors" value={date} onChange={e => setDate(e.target.value)} />
                            </div>

                            {/* Dynamic Customer Field */}
                            <div className="col-span-1 md:col-span-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-semibold text-gray-700">{t('modals.orderCustomer')}</label>
                                    {!isCreatingCustomer ? (
                                        <button type="button" onClick={() => setIsCreatingCustomer(true)} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                            <Plus className="w-3 h-3" /> {t('modals.orderBtnNewCustomer', 'New Customer')}
                                        </button>
                                    ) : (
                                        <button type="button" onClick={() => setIsCreatingCustomer(false)} className="text-xs font-bold text-gray-500 hover:text-gray-700">
                                            {t('modals.orderBtnCancelNew', 'Cancel')}
                                        </button>
                                    )}
                                </div>

                                {!isCreatingCustomer ? (
                                    <select required className="w-full bg-white border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none shadow-sm" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                                        <option value="" disabled>{t('modals.orderSelectCustomer')}</option>
                                        {customers.map(c => <option key={c._id} value={c._id}>{c.name} {c.phone ? `(${c.phone})` : c.email ? `(${c.email})` : ''}</option>)}
                                    </select>
                                ) : (
                                    <div className="space-y-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-1">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <input type="text" placeholder={t('modals.orderCustomerName', 'Full Name *')} required={isCreatingCustomer} className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                                            <input type="tel" placeholder={t('modals.orderCustomerPhone', 'Phone Number *')} required={isCreatingCustomer} className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                                        </div>
                                        <div className="flex gap-3 items-center">
                                            <input type="text" placeholder={t('modals.orderCustomerCity', 'City / Wilaya (Optional)')} className="flex-1 bg-gray-50 border border-gray-200 outline-none rounded-lg px-3 py-2 text-sm focus:border-blue-500" value={newCustomer.city} onChange={e => setNewCustomer({ ...newCustomer, city: e.target.value })} />
                                            <button type="button" onClick={handleQuickCreateCustomer} disabled={isCreatingCustomerLoading} className="px-4 py-2 bg-blue-600 shrink-0 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                                                {isCreatingCustomerLoading ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : t('modals.orderBtnSaveCustomer', 'Save & Select')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('modals.orderSalesChannel')}</label>
                                <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none" value={channel} onChange={e => setChannel(e.target.value)}>
                                    {CHANNELS.map(ch => <option key={ch} value={ch}>
                                        {ch === 'Amazon' ? t('modals.chAmazon') : ch === 'Alibaba' ? t('modals.chAlibaba') : ch === 'Tokopedia' ? t('modals.chTokopedia') : ch === 'Shopee' ? t('modals.chShopee') : ch === 'Website' ? t('modals.chWebsite') : t('modals.chOther')}
                                    </option>)}
                                </select>
                            </div>
                        </div>

                        {/* Line Items Section */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-semibold text-gray-900">{t('modals.orderLineItems')}</h3>
                                    <a href="/inventory" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline font-medium">
                                        {t('modals.orderManageProducts')}
                                    </a>
                                </div>
                                <button type="button" onClick={addProductLine} className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                                    <Plus className="w-3 h-3" /> {t('modals.orderAddProduct')}
                                </button>
                            </div>

                            <div className="space-y-3">
                                {products.map((product, index) => (
                                    <div key={index} className="flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                        <div className="flex-1">
                                            {availableVariants.length > 0 ? (
                                                <select
                                                    required
                                                    className="w-full bg-transparent outline-none border-b border-gray-200 focus:border-blue-500 py-1 text-sm font-medium appearance-none"
                                                    value={product.variantId || ''}
                                                    onChange={e => {
                                                        const selectedId = e.target.value;
                                                        const selectedVariant = availableVariants.find(v => v.variantId === selectedId);
                                                        if (selectedVariant) {
                                                            handleProductChangeMulti(index, {
                                                                variantId: selectedVariant.variantId,
                                                                name: selectedVariant.displayName,
                                                                unitPrice: selectedVariant.price,
                                                                availableStock: selectedVariant.availableStock
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <option value="" disabled>{t('modals.orderSelectVariant')}</option>
                                                    {availableVariants.map(v => (
                                                        <option key={v.variantId} value={v.variantId}>
                                                            {v.displayName} - ${v.price?.toFixed(2) || 0} ({t('modals.orderAvail')} {v.availableStock})
                                                        </option>
                                                    ))}
                                                    {/* Display fallback for legacy orders */}
                                                    {product.name && !product.variantId && (
                                                        <option value="" disabled>{product.name} {t('modals.orderLegacy')}</option>
                                                    )}
                                                </select>
                                            ) : (
                                                <input required type="text" placeholder={t('modals.orderNoInventory')} className="w-full bg-transparent outline-none border-b border-gray-200 focus:border-blue-500 py-1 text-sm font-medium" value={product.name} onChange={e => handleProductChangeMulti(index, { name: e.target.value })} />
                                            )}
                                        </div>
                                        <div className="w-24">
                                            <label className="text-xs text-gray-500 block mb-1">{t('modals.orderQuantity')}</label>
                                            <input required type="number" min="1" max={product.availableStock !== null ? product.availableStock : undefined} className="w-full bg-gray-50 outline-none border border-gray-200 focus:border-blue-500 py-1 px-2 rounded text-sm" value={product.quantity} onChange={e => handleProductChange(index, 'quantity', e.target.value)} />
                                            {product.availableStock !== null && (
                                                <p className="text-[10px] text-gray-500 mt-1 font-medium">{t('modals.orderAvail')} {product.availableStock}</p>
                                            )}
                                        </div>
                                        <div className="w-32">
                                            <label className="text-xs text-gray-500 block mb-1">{t('modals.orderUnitPrice')}</label>
                                            <input required type="number" min="0" step="0.01" className="w-full bg-gray-50 outline-none border border-gray-200 focus:border-blue-500 py-1 px-2 rounded text-sm" value={product.unitPrice} onChange={e => handleProductChange(index, 'unitPrice', e.target.value)} />
                                        </div>
                                        <button type="button" onClick={() => removeProductLine(index)} disabled={products.length === 1} className="mt-5 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded disabled:opacity-50 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end mt-4">
                                <p className="text-sm text-gray-500 font-medium">{t('modals.orderTotal')} <span className="text-lg font-bold text-gray-900">${calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                            </div>
                        </div>

                        {/* Status Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                            <div className="flex flex-col justify-end h-full">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('modals.orderCodStatus')}</label>
                                <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none font-bold text-blue-800" value={status} onChange={e => setStatus(e.target.value)}>
                                    {STATUSES.map(st => <option key={st} value={st}>
                                        {st === 'New' ? t('modals.stNew') :
                                            st === 'Confirmed' ? t('modals.stConfirmed') :
                                                st === 'Preparing' ? t('modals.stPreparing') :
                                                    st === 'Ready for Pickup' ? t('modals.stReady') :
                                                        st === 'Shipped' ? t('modals.stShipped') :
                                                            st === 'Out for Delivery' ? t('modals.stOutForDelivery') :
                                                                st === 'Delivered' ? t('modals.stDelivered') :
                                                                    st === 'Paid' ? t('modals.stPaid') :
                                                                        st === 'Refused' ? t('modals.stRefused') :
                                                                            st === 'Returned' ? t('modals.stReturned') :
                                                                                st === 'Cancelled' ? t('modals.stCancelled') : st}
                                    </option>)}
                                </select>
                            </div>
                            <div className="flex flex-col justify-end h-full">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('modals.orderDispatchCourier')}</label>
                                <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none" value={courierId} onChange={e => setCourierId(e.target.value)}>
                                    <option value="">{t('modals.orderUnassigned')}</option>
                                    {couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col justify-end h-full">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('modals.orderExpectedCod')}</label>
                                <input type="number" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors" value={codAmount} onChange={e => setCodAmount(e.target.value)} />
                            </div>
                            <div className="flex flex-col justify-end h-full">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('modals.orderCourierFee')}</label>
                                <input type="number" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors" value={courierFee} onChange={e => setCourierFee(e.target.value)} />
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('modals.orderInternalNotes')}</label>
                            <textarea rows="3" placeholder={t('modals.orderNotesPlaceholder')} className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors resize-none" value={notes} onChange={e => setNotes(e.target.value)}></textarea>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50">
                        {t('modals.orderBtnCancel')}
                    </button>
                    <button type="submit" form="orderForm" disabled={isSubmitting} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/20 transition-all flex items-center gap-2 disabled:opacity-50">
                        {isSubmitting ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div> : null}
                        {isEdit ? t('modals.orderBtnSave') : t('modals.orderBtnCreate')}
                    </button>
                </div>
            </div>
        </div>
    );
}
