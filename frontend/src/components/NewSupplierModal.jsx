import React, { useState } from 'react';
import { apiFetch } from '../utils/apiFetch';
import { X, Users, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useModalDismiss from '../hooks/useModalDismiss';

export default function NewSupplierModal({ isOpen, onClose, onSuccess }) {
    const { t } = useTranslation();
    const { backdropProps, panelProps } = useModalDismiss(onClose);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Form state
    const [name, setName] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [category, setCategory] = useState('General Hardware');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('Algeria');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!name || !contactName || !contactEmail) {
            return setError(t('procurement.errRequiredFields', 'Please fill in all required fields.'));
        }

        setSubmitting(true);
        try {
            const res = await apiFetch('/api/procurement/suppliers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    supplierCategory: category,
                    contactPerson: {
                        name: contactName,
                        email: contactEmail,
                        phone: contactPhone
                    },
                    address: {
                        city,
                        country
                    }
                })
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to add supplier');
            }
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" {...backdropProps}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" {...panelProps}>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                        {t('procurement.addSupplier', 'Add Supplier')}
                    </h2>
                    <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {error && (
                        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-sm font-bold">
                            {error}
                        </div>
                    )}

                    <form id="new-supplier-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="sup-name" className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('procurement.colVendorName', 'Vendor Name')} *</label>
                            <input
                                id="sup-name"
                                type="text"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="sup-category" className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('procurement.category', 'Category')}</label>
                            <input
                                id="sup-category"
                                type="text"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="sup-contact" className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('procurement.colContactPerson', 'Contact Name')} *</label>
                                <input
                                    id="sup-contact"
                                    type="text"
                                    autoComplete="name"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={contactName}
                                    onChange={e => setContactName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="sup-phone" className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('customer.phone', 'Phone')}</label>
                                <input
                                    id="sup-phone"
                                    type="tel"
                                    autoComplete="tel"
                                    dir="ltr"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={contactPhone}
                                    onChange={e => setContactPhone(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="sup-email" className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('customer.email', 'Email')} *</label>
                            <input
                                id="sup-email"
                                type="email"
                                autoComplete="email"
                                dir="ltr"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                value={contactEmail}
                                onChange={e => setContactEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="sup-city" className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('customer.city', 'City')}</label>
                                <input
                                    id="sup-city"
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={city}
                                    onChange={e => setCity(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="sup-country" className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('customer.country', 'Country')}</label>
                                <input
                                    id="sup-country"
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={country}
                                    onChange={e => setCountry(e.target.value)}
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        form="new-supplier-form"
                        type="submit"
                        disabled={submitting}
                        className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-lg shadow-indigo-500/30 flex items-center gap-2 disabled:opacity-70"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                        {t('procurement.addSupplier', 'Add Supplier')}
                    </button>
                </div>
            </div>
        </div>
    );
}
