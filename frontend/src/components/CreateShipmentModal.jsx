import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Search, MapPin, DollarSign, Package, AlertTriangle, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import * as leblad from '@dzcode-io/leblad';

export default function CreateShipmentModal({ isOpen, onClose, onSuccess }) {
    const { t } = useTranslation();

    // Form State mapped to ECOTRACK
    const [formData, setFormData] = useState({
        orderId: '',
        isCustomOrder: false,
        customerName: '',
        phone1: '',
        phone2: '',
        address: '',
        commune: '',
        wilayaCode: '',
        wilayaName: '',
        postalCode: '',
        productName: '',
        quantity: 1,
        weight: 1,
        codAmount: 0,
        remark: '',
        operationType: 1, // 1 = delivery
        deliveryType: 0,  // 0 = home, 1 = stop desk
        stopDeskFlag: false,
        fragileFlag: false
    });

    const [orders, setOrders] = useState([]);
    const [searchOrder, setSearchOrder] = useState('');
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchPendingOrders();
            // Reset state
            setFormData({
                orderId: '', isCustomOrder: false, customerName: '', phone1: '', phone2: '',
                address: '', commune: '', wilayaCode: '', wilayaName: '', postalCode: '',
                productName: '', quantity: 1, weight: 1, codAmount: 0, remark: '',
                operationType: 1, deliveryType: 0, stopDeskFlag: false, fragileFlag: false
            });
            setError('');
        }
    }, [isOpen]);

    const fetchPendingOrders = async () => {
        setLoadingOrders(true);
        try {
            const token = localStorage.getItem('token');
            const [stdRes, custRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${import.meta.env.VITE_API_URL || ''}/api/custom-orders`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            // Filter out already dispatched orders
            const standardOrders = stdRes.data.orders || stdRes.data;
            const pendingStd = standardOrders.filter(o => ['New', 'Confirmed', 'Preparing', 'Ready for Pickup'].includes(o.status)).map(o => ({
                id: o._id,
                displayId: o.orderId,
                customer: o.customer?.name || 'Unknown',
                phone: o.customer?.phone || o.shipping?.phone1 || '',
                product: o.products?.map(i => i.name).join(', ') || 'Mixed Items',
                total: o.totalAmount,
                isCustom: false,
                shipping: o.shipping || {}
            }));

            const pendingCust = custRes.data.filter(o => ['Pending', 'Confirmed', 'In Production'].includes(o.status)).map(o => ({
                id: o._id,
                displayId: o.customOrderId,
                customer: o.clientName,
                phone: o.phone || '',
                product: `Custom: ${o.knifeModel || 'Blade'}`,
                total: o.agreedPrice,
                isCustom: true
            }));

            setOrders([...pendingStd, ...pendingCust].sort((a, b) => b.displayId.localeCompare(a.displayId)));
        } catch (error) {
            console.error('Could not fetch orders for dispatch', error);
            setError('Could not load pending orders.');
        } finally {
            setLoadingOrders(false);
        }
    };

    const handleOrderSelect = (order) => {
        // Pre-fill form from order + shipping data
        const s = order.shipping || {};
        setFormData(prev => ({
            ...prev,
            orderId: order.id,
            isCustomOrder: order.isCustom,
            customerName: s.recipientName || order.customer,
            phone1: s.phone1 || order.phone,
            phone2: s.phone2 || '',
            wilayaCode: s.wilayaCode || '',
            wilayaName: s.wilayaName || '',
            commune: s.commune || '',
            address: s.address || '',
            productName: order.product,
            codAmount: order.total,
            weight: s.weight || 1,
            fragileFlag: s.fragile || false,
            deliveryType: s.deliveryType || 0
        }));
        setSearchOrder(order.displayId);
        // Hide list after selection by clearing search slightly or managing a focus state
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.orderId || !formData.customerName || !formData.phone1 || !formData.wilayaName || !formData.commune) {
            setError('Please fill all required operational fields (Order, Customer, Phone, Wilaya, Commune).');
            return;
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            // Clean up flags before sending
            const payload = {
                ...formData,
                stopDeskFlag: formData.deliveryType === 1
            };

            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/shipments`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Shipment creation failed', error);
            setError(error.response?.data?.message || 'Failed to dispatch shipment to courier.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const filteredOrders = orders.filter(o =>
        (o.displayId && o.displayId.toLowerCase().includes(searchOrder.toLowerCase())) ||
        (o.customer && o.customer.toLowerCase().includes(searchOrder.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center">
                            <Send className="w-5 h-5 mr-2 text-blue-600" />
                            {t('dispatch.modal.title', 'Dispatch New Shipment')}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">{t('dispatch.modal.subtitle', 'Map an internal order directly to the ECOTRACK courier network.')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-700 flex items-start gap-3 rounded-xl border border-red-100">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <form id="dispatchForm" onSubmit={handleSubmit} className="space-y-8">

                        {/* 1. Internal Order Selection */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">{t('dispatch.modal.step1', '1. Select Internal Order')}</h3>
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dispatch.modal.searchLabel', 'Search Pending Orders')}</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        value={searchOrder}
                                        onChange={(e) => setSearchOrder(e.target.value)}
                                        placeholder={t('dispatch.modal.searchPlaceholder', 'Order ID or Customer Name...')}
                                        className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>

                                {searchOrder && !formData.orderId && (
                                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-lg border border-gray-100 max-h-48 overflow-y-auto">
                                        {loadingOrders ? (
                                            <div className="p-3 text-sm text-gray-500 text-center">Searching...</div>
                                        ) : filteredOrders.length === 0 ? (
                                            <div className="p-3 text-sm text-gray-500 text-center">No pending orders found.</div>
                                        ) : (
                                            filteredOrders.map(order => (
                                                <button
                                                    key={order.id}
                                                    type="button"
                                                    onClick={() => handleOrderSelect(order)}
                                                    className="w-full text-left p-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 flex justify-between items-center group transition-colors"
                                                >
                                                    <div>
                                                        <span className="font-semibold text-gray-900 group-hover:text-blue-700">{order.displayId}</span>
                                                        <span className="text-xs text-gray-500 ml-2">{order.customer}</span>
                                                    </div>
                                                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                                                        {order.total.toLocaleString()} DZD
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Customer & Destination */}
                        <div className="space-y-4 opacity-100 transition-opacity" style={{ opacity: formData.orderId ? 1 : 0.4 }}>
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center">
                                <MapPin className="w-4 h-4 mr-2 text-gray-400" /> {t('dispatch.modal.step2', '2. EcoTrack Routing Details')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">{t('dispatch.modal.recipient', 'Recipient Name')} *</label>
                                    <input required type="text" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700">{t('dispatch.modal.phone1', 'Primary Phone')} *</label>
                                        <input required type="text" value={formData.phone1} onChange={e => setFormData({ ...formData, phone1: e.target.value })} className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700">{t('dispatch.modal.phone2', 'Phone 2 (Opt)')}</label>
                                        <input type="text" value={formData.phone2} onChange={e => setFormData({ ...formData, phone2: e.target.value })} className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700">{t('dispatch.modal.wilaya', 'Wilaya Name')} *</label>
                                    <select
                                        required
                                        value={formData.wilayaCode}
                                        onChange={e => {
                                            const wCode = e.target.value;
                                            const wilayaObj = leblad.getWilayaList().find(w => w.mattricule === Number(wCode));
                                            setFormData({
                                                ...formData,
                                                wilayaCode: wCode,
                                                wilayaName: wilayaObj ? wilayaObj.name : '',
                                                commune: ''
                                            });
                                        }}
                                        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                    >
                                        <option value="">Select Wilaya...</option>
                                        {leblad.getWilayaList().map(wilaya => (
                                            <option key={wilaya.mattricule} value={wilaya.mattricule}>
                                                {String(wilaya.mattricule).padStart(2, '0')} - {wilaya.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">{t('dispatch.modal.commune', 'Commune')} *</label>
                                    <select
                                        required
                                        disabled={!formData.wilayaCode}
                                        value={formData.commune}
                                        onChange={e => setFormData({ ...formData, commune: e.target.value })}
                                        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        <option value="">{formData.wilayaCode ? 'Select Commune...' : 'Select Wilaya first'}</option>
                                        {formData.wilayaCode && leblad.getBaladyiatsForWilaya(Number(formData.wilayaCode))?.map(commune => (
                                            <option key={commune.code} value={commune.name}>
                                                {commune.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700">{t('dispatch.modal.address', 'Detailed Address')} *</label>
                                    <textarea required rows="2" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"></textarea>
                                </div>
                            </div>
                        </div>

                        {/* 3. Package & Financials */}
                        <div className="space-y-4 opacity-100 transition-opacity" style={{ opacity: formData.orderId ? 1 : 0.4 }}>
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center">
                                <Package className="w-4 h-4 mr-2 text-gray-400" /> {t('dispatch.modal.step3', '3. Payload & Payment')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700">{t('dispatch.modal.desc', 'Shipping Item Description')} *</label>
                                    <input required type="text" value={formData.productName} onChange={e => setFormData({ ...formData, productName: e.target.value })} className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">{t('dispatch.modal.cod', 'Total COD Amount (DZD)')} *</label>
                                    <div className="relative mt-1 border border-gray-300 rounded-md shadow-sm overflow-hidden flex focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                                        <div className="flex-1">
                                            <input required type="number" min="0" value={formData.codAmount} onChange={e => setFormData({ ...formData, codAmount: Number(e.target.value) })} className="w-full border-0 focus:ring-0 text-sm font-medium py-2 px-3" />
                                        </div>
                                        <div className="bg-gray-100 text-gray-500 px-3 flex items-center justify-center flex-shrink-0 text-xs font-bold border-l border-gray-300 cursor-default">DZD</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('dispatch.modal.deliveryType', 'Delivery Type')}</label>
                                    <select value={formData.deliveryType} onChange={e => setFormData({ ...formData, deliveryType: Number(e.target.value) })} className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500 py-1.5">
                                        <option value={0}>Home Delivery (0)</option>
                                        <option value={1}>Stop Desk / Point (1)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('dispatch.modal.weight', 'Weight (kg)')}</label>
                                    <input type="number" step="0.1" value={formData.weight} onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })} className="w-full rounded-md border-gray-300 shadow-sm text-sm py-1.5 focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                                <div className="flex items-center mt-6">
                                    <input type="checkbox" id="fragile" checked={formData.fragileFlag} onChange={e => setFormData({ ...formData, fragileFlag: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4" />
                                    <label htmlFor="fragile" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer">{t('dispatch.modal.fragile', 'Fragile Package')}</label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700">{t('dispatch.modal.remark', 'Delivery Instructions / Remarks')}</label>
                                <input type="text" placeholder={t('dispatch.modal.remarkPlaceholder', 'e.g. Call before delivery')} value={formData.remark} onChange={e => setFormData({ ...formData, remark: e.target.value })} className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                            </div>
                        </div>

                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                        {t('dispatch.modal.cancel', 'Cancel')}
                    </button>
                    <button
                        type="submit"
                        form="dispatchForm"
                        disabled={!formData.orderId || submitting}
                        className="inline-flex items-center px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {submitting ? t('dispatch.modal.submitting', 'Pushing to EcoTrack...') : t('dispatch.modal.submit', 'Dispatch to Courier')}
                    </button>
                </div>
            </div>
        </div>
    );
}
