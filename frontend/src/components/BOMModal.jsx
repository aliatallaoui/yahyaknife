import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function BOMModal({ isOpen, onClose, onSubmit, initialData, variants = [], rawMaterials = [] }) {
    const { t } = useTranslation();
    const isEdit = !!initialData;

    const [variantId, setVariantId] = useState('');
    const [version, setVersion] = useState('1.0');
    const [components, setComponents] = useState([{ rawMaterialId: '', quantityRequired: 1 }]);
    const [validationError, setValidationError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (isEdit && initialData) {
                setVariantId(initialData.variantId?._id || initialData.variantId || '');
                setVersion(initialData.version || '1.0');
                setComponents(
                    initialData.components?.length > 0
                        ? initialData.components.map(c => ({
                            rawMaterialId: c.rawMaterialId?._id || c.rawMaterialId || '',
                            quantityRequired: c.quantityRequired || 1
                        }))
                        : [{ rawMaterialId: '', quantityRequired: 1 }]
                );
            } else {
                setVariantId('');
                setVersion('1.0');
                setComponents([{ rawMaterialId: '', quantityRequired: 1 }]);
            }
        }
    }, [isOpen, isEdit, initialData]);

    if (!isOpen) return null;

    const handleComponentChange = (index, field, value) => {
        const newComps = [...components];
        newComps[index][field] = value;
        setComponents(newComps);
    };

    const addComponentLine = () => {
        setComponents([...components, { rawMaterialId: '', quantityRequired: 1 }]);
    };

    const removeComponentLine = (index) => {
        if (components.length > 1) {
            setComponents(components.filter((_, i) => i !== index));
        }
    };

    const calculateEstimatedCost = () => {
        return components.reduce((sum, comp) => {
            if (!comp.rawMaterialId) return sum;
            const mat = rawMaterials.find(m => m._id === comp.rawMaterialId);
            if (!mat) return sum;
            return sum + (mat.costPerUnit * Number(comp.quantityRequired));
        }, 0);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setValidationError(null);

        if (!variantId) {
            setValidationError(t('modals.bomErrNoVariant', 'Please select a target Product Variant.'));
            return;
        }

        const validComponents = components.filter(c => c.rawMaterialId && Number(c.quantityRequired) > 0);
        if (validComponents.length === 0) {
            setValidationError(t('modals.bomErrNoComponents', 'BOM must contain at least one valid raw material component.'));
            return;
        }

        const payload = {
            variantId,
            version,
            components: validComponents.map(c => ({
                material: c.rawMaterialId,
                quantityRequired: Number(c.quantityRequired)
            }))
        };

        onSubmit(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEdit ? t('modals.bomTitleEdit', 'Edit Bill of Materials (BOM)') : t('modals.bomTitleAdd', 'Create BOM Recipe')}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <form id="bomForm" onSubmit={handleSubmit} className="space-y-6">

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('modals.bomTargetVariant', 'Target Product Variant')}</label>
                                <select required className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={variantId} onChange={e => setVariantId(e.target.value)}>
                                    <option value="" disabled>{t('modals.bomSelectVariant', 'Select Variant (SKU)')}</option>
                                    {variants.map(v => (
                                        <option key={v._id || v.variantId} value={v._id || v.variantId}>
                                            {v.sku} - {v.displayName || v.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('modals.bomVersion', 'BOM Version')}</label>
                                <input required type="text" placeholder={t('modals.bomVersionPlaceholder', "e.g. 1.0 or 2026-A")} className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={version} onChange={e => setVersion(e.target.value)} />
                            </div>
                        </div>

                        {/* Components Section */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-gray-900">{t('modals.bomRecipeMaterials', 'Recipe Materials')}</h3>
                                <button type="button" onClick={addComponentLine} className="flex items-center gap-1 text-xs font-semibold text-yellow-600 bg-yellow-100/50 px-3 py-1.5 rounded-lg hover:bg-yellow-100 transition-colors">
                                    <Plus className="w-3 h-3" /> {t('modals.bomAddComponent', 'Add Component')}
                                </button>
                            </div>

                            <div className="space-y-3">
                                {components.map((comp, index) => (
                                    <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                        <div className="flex-1">
                                            <select
                                                required
                                                className="w-full bg-transparent outline-none border-b border-gray-200 focus:border-yellow-500 py-1 text-sm font-medium"
                                                value={comp.rawMaterialId}
                                                onChange={e => handleComponentChange(index, 'rawMaterialId', e.target.value)}
                                            >
                                                <option value="" disabled>{t('modals.bomSelectMaterial', 'Select Raw Material...')}</option>
                                                {rawMaterials.map(rm => (
                                                    <option key={rm._id} value={rm._id}>
                                                        {rm.name} [{rm.sku}] - ${rm.costPerUnit}/{rm.unitOfMeasure}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-32">
                                            <label className="text-xs text-gray-500 block mb-1">{t('modals.bomQtyRequired', 'Qty Required')}</label>
                                            <input required type="number" step="0.01" min="0.01" className="w-full bg-gray-50 outline-none border border-gray-200 focus:border-yellow-500 py-1 px-2 rounded text-sm" value={comp.quantityRequired} onChange={e => handleComponentChange(index, 'quantityRequired', e.target.value)} />
                                        </div>
                                        <button type="button" onClick={() => removeComponentLine(index)} disabled={components.length === 1} className="mt-4 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded disabled:opacity-50 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end mt-4 pt-4 border-t border-gray-200/60">
                                <p className="text-sm text-gray-500 font-medium">{t('modals.bomNetCost', 'Estimated Net Cost:')} <span className="text-lg font-bold text-gray-900">${calculateEstimatedCost().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                            </div>
                        </div>

                    </form>
                </div>

                {validationError && (
                    <div className="mx-6 mb-0 mt-2 flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {validationError}
                    </div>
                )}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                        {t('modals.btnCancel', 'Cancel')}
                    </button>
                    <button type="submit" form="bomForm" className="px-5 py-2.5 text-sm font-semibold text-white bg-yellow-600 hover:bg-yellow-700 rounded-xl shadow-sm shadow-yellow-600/20 transition-all">
                        {isEdit ? t('modals.bomBtnSave', 'Save BOM') : t('modals.bomBtnCreate', 'Create BOM')}
                    </button>
                </div>
            </div>
        </div>
    );
}
