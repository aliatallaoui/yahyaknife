import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Box } from 'lucide-react';
import clsx from 'clsx';
import { useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';

export default function BOMBuilder({ value = [], onChange, readOnly = false }) {
    const { t } = useTranslation();
    const { rawMaterials: materials } = useContext(InventoryContext);

    const handleAdd = () => {
        onChange([...value, { material: '', quantityRequired: 1, unit: '', estimatedCost: 0 }]);
    };

    const handleRemove = (index) => {
        const newVal = [...value];
        newVal.splice(index, 1);
        onChange(newVal);
    };

    const handleChange = (index, field, val) => {
        const newVal = [...value];
        const item = { ...newVal[index] };
        item[field] = val;

        // Auto-fill and calculate cost if material changes or quantity changes
        if (field === 'material' || field === 'quantityRequired') {
            const matId = field === 'material' ? val : item.material;
            const matItem = materials.find(m => m._id === matId || m.id === matId);
            if (matItem) {
                if (field === 'material') {
                    item.unit = matItem.unitOfMeasure;
                }
                const qty = field === 'quantityRequired' ? Number(val) : item.quantityRequired;
                item.estimatedCost = (matItem.costPerUnit || 0) * (qty || 0);
            }
        }

        newVal[index] = item;
        onChange(newVal);
    };

    const totalCost = value.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);

    return (
        <div className="bg-white border text-sm border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h4 className="font-bold flex items-center gap-2 text-gray-700">
                    <Box className="w-4 h-4 text-indigo-500" />
                    {t('bom.title', 'Bill of Materials (BOM)')}
                </h4>
                <div className="text-sm font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-200 cursor-default transition-colors">
                    {t('bom.totalCost', 'Total Est. Cost')}: {totalCost.toFixed(2)} DZD
                </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
                {value.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 font-medium">
                        {t('bom.empty', 'No materials added yet. Add ingredients to calculate costs.')}
                    </div>
                ) : (
                    value.map((item, index) => (
                        <div key={index} className="flex flex-col xl:flex-row gap-3 items-start xl:items-center bg-gray-50/50 p-3 rounded-lg border border-gray-100 group">
                            <div className="flex-1 w-full">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">
                                    {t('bom.material', 'Material')}
                                </label>
                                <select
                                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                                    value={item.material || (item.material?._id) || ''}
                                    onChange={(e) => handleChange(index, 'material', e.target.value)}
                                    disabled={readOnly}
                                >
                                    <option value="">{t('bom.selectMaterial', '— Select Material —')}</option>
                                    {materials.map(m => (
                                        <option key={m._id} value={m._id}>
                                            {m.name} ({m.category}) - {m.costPerUnit} DZD/{m.unitOfMeasure}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full xl:w-24">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">
                                    {t('bom.qty', 'Qty')}
                                </label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                                    value={item.quantityRequired || ''}
                                    onChange={(e) => handleChange(index, 'quantityRequired', e.target.value)}
                                    disabled={readOnly}
                                />
                            </div>

                            <div className="w-full xl:w-16">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">
                                    {t('bom.unit', 'Unit')}
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-100 font-bold border border-gray-200 text-gray-400 rounded-lg p-2 text-sm outline-none cursor-not-allowed"
                                    value={item.unit || '-'}
                                    disabled
                                    readOnly
                                />
                            </div>

                            <div className="w-full xl:w-32 bg-white rounded-lg border border-gray-200 shadow-sm p-2 flex flex-col justify-center">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                                    {t('bom.cost', 'Cost (DZD)')}
                                </label>
                                <div className="font-bold text-gray-900 leading-none">
                                    {item.estimatedCost?.toFixed(2) || '0.00'}
                                </div>
                            </div>

                            {!readOnly && (
                                <button
                                    onClick={() => handleRemove(index)}
                                    className="mt-4 xl:mt-5 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                    title={t('bom.remove', 'Remove')}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))
                )}

                {!readOnly && (
                    <button
                        onClick={handleAdd}
                        className="mt-2 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 border-dashed rounded-lg p-3 text-sm font-bold transition-colors w-full"
                    >
                        <Plus className="w-4 h-4" /> {t('bom.addIngredient', 'Add Ingredient')}
                    </button>
                )}
            </div>
        </div>
    );
}
