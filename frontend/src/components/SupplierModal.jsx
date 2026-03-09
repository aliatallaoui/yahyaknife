import { useState, useContext, useEffect } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function SupplierModal({ isOpen, onClose, supplierArray = [] }) {
    const { t } = useTranslation();
    const { createSupplier, updateSupplier } = useContext(InventoryContext);

    const [formData, setFormData] = useState({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: ''
    });
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // We assume if 'supplierArray' has length > 0, we're editing the first item.
    // Since we typically pass a single supplier here to edit, let's treat it as editMode if supplier is passed.
    // Wait, let's make the prop a single 'supplier' object instead for simplicity.

    const [editSupplier, setEditSupplier] = useState(null);

    useEffect(() => {
        if (supplierArray && supplierArray.name !== undefined) {
            setEditSupplier(supplierArray);
            setFormData({
                name: supplierArray.name || '',
                contactPerson: supplierArray.contactPerson || '',
                email: supplierArray.email || '',
                phone: supplierArray.phone || '',
                address: supplierArray.address || ''
            });
        } else {
            setEditSupplier(null);
            setFormData({ name: '', contactPerson: '', email: '', phone: '', address: '' });
        }
    }, [supplierArray, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            if (editSupplier) {
                await updateSupplier(editSupplier._id, formData);
            } else {
                await createSupplier(formData);
            }
            onClose();
        } catch (err) {
            setError(err.message || t('modals.errorSavingSup', "An error occurred while saving the supplier."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {editSupplier ? t('modals.supTitleEdit', 'Edit Supplier') : t('modals.supTitleAdd', 'Add New Supplier')}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.supName', 'Company Name *')}</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                                placeholder={t('modals.supNamePlaceholder', "e.g. Acme Corp")}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.supContact', 'Contact Person')}</label>
                            <input
                                type="text"
                                name="contactPerson"
                                value={formData.contactPerson}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                                placeholder={t('modals.supContactPlaceholder', "e.g. John Doe")}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.supEmail', 'Email')}</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                                    placeholder={t('modals.supEmailPlaceholder', "contact@company.com")}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.supPhone', 'Phone')}</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                                    placeholder={t('modals.supPhonePlaceholder', "(555) 123-4567")}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.supAddress', 'Address')}</label>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                                placeholder={t('modals.supAddressPlaceholder', "123 Industrial Pkwy")}
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-800 transition-colors"
                        >
                            {t('modals.btnCancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 active:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? t('modals.saving', 'Saving...') : (editSupplier ? t('modals.btnSave', 'Save Changes') : t('modals.supBtnCreate', 'Create Supplier'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
