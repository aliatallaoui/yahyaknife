import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const CATEGORIES = ['Fabric', 'Metal', 'Electronics', 'Packaging', 'Plastic', 'Chemicals', 'Wood', 'Other'];
const UOMS = ['kg', 'meters', 'units', 'liters', 'rolls', 'sheets', 'boxes'];

export default function RawMaterialModal({ isOpen, onClose, onSubmit, initialData, suppliers = [] }) {
    const isEdit = !!initialData;

    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [costPerUnit, setCostPerUnit] = useState('');
    const [unitOfMeasure, setUnitOfMeasure] = useState(UOMS[0]);
    const [minimumStockLevel, setMinimumStockLevel] = useState('');
    const [supplierId, setSupplierId] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (isEdit && initialData) {
                setName(initialData.name);
                setSku(initialData.sku);
                setCategory(initialData.category || CATEGORIES[0]);
                setCostPerUnit(initialData.costPerUnit || '');
                setUnitOfMeasure(initialData.unitOfMeasure || UOMS[0]);
                setMinimumStockLevel(initialData.minimumStock || '');
                setSupplierId(initialData.supplier?._id || initialData.supplier || '');
            } else {
                setName('');
                setSku(`RM-${Math.floor(Math.random() * 10000)}`);
                setCategory(CATEGORIES[0]);
                setCostPerUnit('');
                setUnitOfMeasure(UOMS[0]);
                setMinimumStockLevel('');
                setSupplierId('');
            }
        }
    }, [isOpen, isEdit, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        const payload = {
            name, sku, category, unitOfMeasure,
            costPerUnit: Number(costPerUnit),
            minimumStock: Number(minimumStockLevel),
            supplier: supplierId || null
        };

        onSubmit(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEdit ? 'Edit Raw Material' : 'Add New Raw Material'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <form id="rmForm" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                                <input required type="text" placeholder="e.g. Cotton Fabric" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">SKU / Code</label>
                                <input required type="text" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={sku} onChange={e => setSku(e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                                <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={category} onChange={e => setCategory(e.target.value)}>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Unit of Measure (UoM)</label>
                                <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={unitOfMeasure} onChange={e => setUnitOfMeasure(e.target.value)}>
                                    {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Cost Per Unit ($)</label>
                                <input required type="number" step="0.01" min="0" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Min. Stock Level</label>
                                <input required type="number" min="0" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={minimumStockLevel} onChange={e => setMinimumStockLevel(e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Preferred Supplier (Optional)</label>
                            <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                                <option value="">None Selected</option>
                                {suppliers.map(s => (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="rmForm" className="px-5 py-2.5 text-sm font-semibold text-white bg-yellow-600 hover:bg-yellow-700 rounded-xl shadow-sm shadow-yellow-600/20 transition-all">
                        {isEdit ? 'Save Changes' : 'Add Material'}
                    </button>
                </div>
            </div>
        </div>
    );
}
