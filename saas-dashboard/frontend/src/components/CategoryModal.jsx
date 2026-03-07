import { useState, useContext, useEffect } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CategoryModal({ isOpen, onClose, category }) {
    const { t } = useTranslation();
    const { createCategory, updateCategory } = useContext(InventoryContext);

    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (category) {
            setFormData({
                name: category.name || '',
                description: category.description || ''
            });
        } else {
            setFormData({ name: '', description: '' });
        }
    }, [category, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            if (category) {
                await updateCategory(category._id, formData);
            } else {
                await createCategory(formData);
            }
            onClose();
        } catch (err) {
            setError(err.message || t('modals.errorSavingCat', "An error occurred while saving the category."));
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-auto overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {category ? t('modals.catTitleEdit', 'Edit Category') : t('modals.catTitleAdd', 'Add New Category')}
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.catName', 'Category Name *')}</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                                placeholder={t('modals.catNamePlaceholder', "e.g. Raw Materials")}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.catDesc', 'Description')}</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all resize-none"
                                placeholder={t('modals.catDescPlaceholder', "Short description...")}
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
                            {isSubmitting ? t('modals.saving', 'Saving...') : (category ? t('modals.btnSave', 'Save Changes') : t('modals.catBtnCreate', 'Create Category'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
