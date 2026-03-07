import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

export default function ProductModal({ isOpen, onClose, onSubmit, initialData, suppliers, categories }) {
    const isEdit = !!initialData;

    // Base Product State
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [brand, setBrand] = useState('');
    const [description, setDescription] = useState('');
    const [supplier, setSupplier] = useState('');

    // Variants State (Only really used for Creation for now)
    const [variants, setVariants] = useState([
        { sku: '', attrKey: 'Size', attrVal: 'Default', price: 0, cost: 0, stock: 0, reorderLevel: 10 }
    ]);

    useEffect(() => {
        if (isOpen) {
            if (isEdit && initialData) {
                setName(initialData.name || '');
                setCategory(initialData.category?._id || initialData.category || '');
                setBrand(initialData.brand || '');
                setDescription(initialData.description || '');
                setSupplier(initialData.supplier?._id || initialData.supplier || '');
                // We won't edit variants in this basic modal for now, this would be a separate complex UI
            } else {
                setName('');
                setCategory(categories?.length > 0 ? categories[0]._id : '');
                setBrand('');
                setDescription('');
                setSupplier(suppliers?.length > 0 ? suppliers[0]._id : '');
                setVariants([
                    { sku: `SKU-${Math.floor(Math.random() * 10000)}`, attrKey: 'Size', attrVal: 'Default', price: 0, cost: 0, stock: 0, reorderLevel: 10 }
                ]);
            }
        }
    }, [isOpen, isEdit, initialData, suppliers, categories]);

    if (!isOpen) return null;

    const handleAddVariant = () => {
        setVariants([...variants, { sku: `SKU-${Math.floor(Math.random() * 10000)}`, attrKey: 'Size', attrVal: '', price: 0, cost: 0, stock: 0, reorderLevel: 10 }]);
    };

    const handleRemoveVariant = (index) => {
        setVariants(variants.filter((_, i) => i !== index));
    };

    const updateVariant = (index, field, value) => {
        const newVariants = [...variants];
        newVariants[index][field] = value;
        setVariants(newVariants);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Map UI variants to Backend expected variants
        const formattedVariants = variants.map(v => ({
            sku: v.sku,
            attributes: { [v.attrKey]: v.attrVal },
            price: Number(v.price),
            cost: Number(v.cost),
            stock: Number(v.stock),
            reorderLevel: Number(v.reorderLevel)
        }));

        const payload = {
            name,
            category,
            brand,
            description,
            supplier: supplier || null,
            variants: isEdit ? undefined : formattedVariants // Only send variants on create
        };

        onSubmit(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">

                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEdit ? 'Edit Base Product' : 'Add New Product & Variants'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <form id="productForm" onSubmit={handleSubmit} className="space-y-8">

                        {/* Base Details */}
                        <div>
                            <h3 className="text-sm border-b pb-2 mb-4 font-bold text-gray-900 uppercase tracking-wider">Base Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Product Name</label>
                                    <input required type="text" placeholder="e.g. Premium T-Shirt" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                                    <select required className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none" value={category} onChange={e => setCategory(e.target.value)}>
                                        <option value="" disabled>Select Category</option>
                                        {categories?.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Brand</label>
                                    <input type="text" placeholder="e.g. FashionCo" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors" value={brand} onChange={e => setBrand(e.target.value)} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Supplier</label>
                                    <select className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none" value={supplier} onChange={e => setSupplier(e.target.value)}>
                                        <option value="">Select a specific supplier (Optional)</option>
                                        {suppliers?.map(sup => (
                                            <option key={sup._id} value={sup._id}>{sup.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Variants Generator (Only on Create) */}
                        {!isEdit && (
                            <div>
                                <div className="flex justify-between items-center border-b pb-2 mb-4">
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Product Variants</h3>
                                    <button type="button" onClick={handleAddVariant} className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition-colors">
                                        <Plus className="w-3.5 h-3.5" /> Add Variant
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {variants.map((v, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 border border-gray-100 p-2 inset-shadow-sm rounded-xl">
                                            <div className="col-span-2">
                                                <label className="text-[10px] uppercase font-bold text-gray-500 ml-1 block">SKU</label>
                                                <input required type="text" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-gray-200 bg-white focus:border-blue-400" value={v.sku} onChange={e => updateVariant(index, 'sku', e.target.value)} />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] uppercase font-bold text-gray-500 ml-1 block">Attr Key</label>
                                                <input required type="text" placeholder="Size, Color, etc" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-gray-200 bg-white focus:border-blue-400" value={v.attrKey} onChange={e => updateVariant(index, 'attrKey', e.target.value)} />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] uppercase font-bold text-gray-500 ml-1 block">Attr Value</label>
                                                <input required type="text" placeholder="M, L, Red" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-gray-200 bg-white focus:border-blue-400" value={v.attrVal} onChange={e => updateVariant(index, 'attrVal', e.target.value)} />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="text-[10px] uppercase font-bold text-gray-500 ml-1 block">Price</label>
                                                <input required type="number" min="0" step="0.01" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-gray-200 bg-white focus:border-blue-400" value={v.price} onChange={e => updateVariant(index, 'price', e.target.value)} />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="text-[10px] uppercase font-bold text-gray-500 ml-1 block">Cost</label>
                                                <input required type="number" min="0" step="0.01" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-gray-200 bg-white focus:border-blue-400" value={v.cost} onChange={e => updateVariant(index, 'cost', e.target.value)} />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] uppercase font-bold text-gray-500 ml-1 block">Init Stock</label>
                                                <input required type="number" min="0" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-gray-200 bg-white focus:border-blue-400" value={v.stock} onChange={e => updateVariant(index, 'stock', e.target.value)} />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="text-[10px] uppercase font-bold text-red-500 ml-1 block">Reorder</label>
                                                <input required type="number" min="0" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-red-200 bg-white focus:border-red-400" value={v.reorderLevel} onChange={e => updateVariant(index, 'reorderLevel', e.target.value)} />
                                            </div>
                                            <div className="col-span-1 flex justify-center mt-4">
                                                {variants.length > 1 && (
                                                    <button type="button" onClick={() => handleRemoveVariant(index)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isEdit && (
                            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                                <p className="text-sm text-orange-800">Note: Variant configurations cannot be changed from this base edit screen in the current version.</p>
                            </div>
                        )}
                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="productForm" className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-t from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 rounded-xl shadow-md shadow-gray-900/10 hover:-translate-y-0.5 transition-all">
                        {isEdit ? 'Save Changes' : 'Create Product'}
                    </button>
                </div>
            </div>
        </div>
    );
}
