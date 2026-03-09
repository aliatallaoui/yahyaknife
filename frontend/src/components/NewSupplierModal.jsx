import React, { useState } from 'react';
import axios from 'axios';
import { X, Users, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NewSupplierModal({ isOpen, onClose, onSuccess }) {
    const { t } = useTranslation();
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
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/procurement/suppliers`, {
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
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                        {t('procurement.addSupplier', 'Add Supplier')}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors">
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
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('procurement.colVendorName', 'Vendor Name')} *</label>
                            <input
                                type="text"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('procurement.category', 'Category')}</label>
                            <input
                                type="text"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('procurement.colContactPerson', 'Contact Name')} *</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={contactName}
                                    onChange={e => setContactName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('customer.phone', 'Phone')}</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={contactPhone}
                                    onChange={e => setContactPhone(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('customer.email', 'Email')} *</label>
                            <input
                                type="email"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                value={contactEmail}
                                onChange={e => setContactEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('customer.city', 'City')}</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                                    value={city}
                                    onChange={e => setCity(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('customer.country', 'Country')}</label>
                                <input
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
