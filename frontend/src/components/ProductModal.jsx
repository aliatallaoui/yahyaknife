import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, Trash2, Upload, ImagePlus, GripVertical, AlertCircle, Zap, Copy, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useModalDismiss from '../hooks/useModalDismiss';

const API_BASE = import.meta.env.VITE_API_URL || '';
const MAX_IMAGES = 8;

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Generate SKU from product name + attribute values */
function generateSku(productName, attrs) {
    const base = (productName || 'SKU')
        .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '')
        .slice(0, 6)
        .toUpperCase() || 'SKU';
    const suffix = Object.values(attrs)
        .map(v => (v || '').replace(/\s+/g, '').slice(0, 4).toUpperCase())
        .join('-');
    const rand = Math.floor(Math.random() * 900 + 100);
    return `${base}-${suffix || 'DEF'}-${rand}`;
}

/** Cartesian product of arrays */
function cartesian(...arrays) {
    return arrays.reduce((a, b) => a.flatMap(x => b.map(y => [...x, y])), [[]]);
}

export default function ProductModal({ isOpen, onClose, onSubmit, initialData, suppliers, categories }) {
    const { t } = useTranslation();
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { backdropProps, panelProps } = useModalDismiss(onClose);
    const isEdit = !!initialData;
    const fileInputRef = useRef(null);

    // Base Product State
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [brand, setBrand] = useState('');
    const [description, setDescription] = useState('');
    const [supplier, setSupplier] = useState('');

    // Images: { url, file?, isExisting }
    const [images, setImages] = useState([]);
    const [dragOver, setDragOver] = useState(false);
    const [dragIdx, setDragIdx] = useState(null);

    // ── Variant Builder State ───────────────────────────────────────────────────
    // Attributes: [{ key: 'Size', values: 'S, M, L, XL' }, ...]
    const [attributes, setAttributes] = useState([{ key: 'Size', values: 'Default' }]);
    // Generated variants with pricing
    const [variants, setVariants] = useState([]);
    // Bulk defaults
    const [bulkPrice, setBulkPrice] = useState('');
    const [bulkCost, setBulkCost] = useState('');
    const [bulkStock, setBulkStock] = useState('');
    const [bulkReorder, setBulkReorder] = useState('10');
    const [showBulk, setShowBulk] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormError('');
            setSubmitting(false);
            if (isEdit && initialData) {
                setName(initialData.name || '');
                setCategory(initialData.category?._id || initialData.category || '');
                setBrand(initialData.brand || '');
                setDescription(initialData.description || '');
                setSupplier(initialData.supplier?._id || initialData.supplier || '');
                setImages((initialData.images || []).map(url => ({ url, isExisting: true })));
            } else {
                setName('');
                setCategory(categories?.length > 0 ? categories[0]._id : '');
                setBrand('');
                setDescription('');
                setSupplier(suppliers?.length > 0 ? suppliers[0]._id : '');
                setImages([]);
                setAttributes([{ key: 'Size', values: 'Default' }]);
                setVariants([]);
                setBulkPrice(''); setBulkCost(''); setBulkStock(''); setBulkReorder('10');
                setShowBulk(false);
            }
        }
    }, [isOpen, isEdit, initialData, suppliers, categories]);

    if (!isOpen) return null;

    // ── Image handling ──────────────────────────────────────────────────────────

    const addFiles = (fileList) => {
        const remaining = MAX_IMAGES - images.length;
        if (remaining <= 0) return;
        const newFiles = Array.from(fileList).slice(0, remaining);
        const newImages = newFiles
            .filter(f => f.type.startsWith('image/'))
            .map(f => ({ url: URL.createObjectURL(f), file: f, isExisting: false }));
        setImages(prev => [...prev, ...newImages]);
    };

    const handleFileSelect = (e) => { addFiles(e.target.files); e.target.value = ''; };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    };

    const removeImage = (index) => {
        setImages(prev => {
            const img = prev[index];
            if (!img.isExisting && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleDragStart = (idx) => setDragIdx(idx);
    const handleDragOverImg = (e, idx) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === idx) return;
        setImages(prev => {
            const next = [...prev];
            const [moved] = next.splice(dragIdx, 1);
            next.splice(idx, 0, moved);
            return next;
        });
        setDragIdx(idx);
    };
    const handleDragEnd = () => setDragIdx(null);

    // ── Attribute & Variant Generation ──────────────────────────────────────────

    const updateAttr = (index, field, value) => {
        setAttributes(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
    };

    const addAttribute = () => {
        const usedKeys = new Set(attributes.map(a => a.key));
        const suggestions = ['Color', 'Material', 'Style', 'Weight', 'Length', 'Type', 'Edition'];
        const nextKey = suggestions.find(s => !usedKeys.has(s)) || `Attribute ${attributes.length + 1}`;
        setAttributes(prev => [...prev, { key: nextKey, values: '' }]);
    };

    const removeAttribute = (index) => {
        if (attributes.length <= 1) return;
        setAttributes(prev => prev.filter((_, i) => i !== index));
    };

    const generateVariants = () => {
        // Parse each attribute's values
        const parsed = attributes
            .filter(a => a.key.trim() && a.values.trim())
            .map(a => ({
                key: a.key.trim(),
                vals: a.values.split(',').map(v => v.trim()).filter(Boolean)
            }))
            .filter(a => a.vals.length > 0);

        if (parsed.length === 0) {
            setFormError(t('inventory.errorNoAttributes', 'Add at least one attribute with values.'));
            return;
        }

        // Cartesian product
        const combos = cartesian(...parsed.map(a => a.vals));

        const newVariants = combos.map(combo => {
            const attrs = {};
            parsed.forEach((a, i) => { attrs[a.key] = combo[i]; });
            return {
                sku: generateSku(name, attrs),
                attributes: attrs,
                price: bulkPrice ? Number(bulkPrice) : 0,
                cost: bulkCost ? Number(bulkCost) : 0,
                stock: bulkStock ? Number(bulkStock) : 0,
                reorderLevel: bulkReorder ? Number(bulkReorder) : 10
            };
        });

        setVariants(newVariants);
        setFormError('');
    };

    const updateVariant = (index, field, value) => {
        setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: field === 'sku' ? value : Number(value) || 0 } : v));
    };

    const removeVariant = (index) => {
        setVariants(prev => prev.filter((_, i) => i !== index));
    };

    const applyBulkValues = () => {
        setVariants(prev => prev.map(v => ({
            ...v,
            ...(bulkPrice !== '' ? { price: Number(bulkPrice) || 0 } : {}),
            ...(bulkCost !== '' ? { cost: Number(bulkCost) || 0 } : {}),
            ...(bulkStock !== '' ? { stock: Number(bulkStock) || 0 } : {}),
            ...(bulkReorder !== '' ? { reorderLevel: Number(bulkReorder) || 10 } : {})
        })));
    };

    // Variant count preview
    const previewCount = useMemo(() => {
        const parsed = attributes.filter(a => a.key.trim() && a.values.trim());
        return parsed.reduce((n, a) => n * a.values.split(',').filter(v => v.trim()).length, parsed.length ? 1 : 0);
    }, [attributes]);

    // Attribute keys from generated variants (for table headers)
    const attrKeys = useMemo(() => {
        if (!variants.length) return [];
        return Object.keys(variants[0].attributes || {});
    }, [variants]);

    // ── Submit ──────────────────────────────────────────────────────────────────

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!name.trim()) return setFormError(t('inventory.errorProductName', 'Product name is required.'));
        if (!category) return setFormError(t('inventory.errorCategory', 'Please select a category.'));

        if (!isEdit) {
            if (variants.length === 0) return setFormError(t('inventory.errorNoVariants', 'Generate at least one variant before creating.'));
            for (let i = 0; i < variants.length; i++) {
                const v = variants[i];
                if (!v.sku?.trim()) return setFormError(t('inventory.errorVariantSku', `Variant #${i + 1} needs a SKU.`));
                if (!Number.isFinite(v.price) || v.price < 0) return setFormError(t('inventory.errorVariantPrice', `Variant #${i + 1} needs a valid price.`));
            }
        }

        // Build FormData for multipart upload
        const fd = new FormData();
        fd.append('name', name);
        fd.append('category', category);
        if (brand) fd.append('brand', brand);
        if (description) fd.append('description', description);
        fd.append('supplier', supplier || '');
        if (!isEdit) {
            fd.append('variants', JSON.stringify(variants));
        }

        const existingUrls = images.filter(i => i.isExisting).map(i => i.url);
        fd.append('existingImages', JSON.stringify(existingUrls));
        images.filter(i => !i.isExisting && i.file).forEach(i => { fd.append('images', i.file); });

        setSubmitting(true);
        try {
            await onSubmit(fd, isEdit);
        } catch (err) {
            setFormError(err.message || 'Failed to save');
        } finally {
            setSubmitting(false);
        }
    };

    const imgUrl = (img) => img.isExisting ? `${API_BASE}${img.url}` : img.url;

    // ── Shared input classes ────────────────────────────────────────────────────
    const inputCls = 'w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 transition-colors';
    const labelCls = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1';
    const tinyLabelCls = 'text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-0.5';

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-gray-900/50 backdrop-blur-sm" {...backdropProps}>
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-5xl flex flex-col max-h-[95vh] sm:max-h-[90vh]" {...panelProps}>

                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {isEdit ? t('inventory.editBaseProduct', 'Edit Product') : t('inventory.addNewProductVariants', 'Add New Product')}
                    </h2>
                    <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {formError && (
                        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {formError}
                        </div>
                    )}
                    <form id="productForm" onSubmit={handleSubmit} className="space-y-8">

                        {/* ═══ Product Images ═══════════════════════════════════════ */}
                        <div>
                            <h3 className="text-sm border-b pb-2 mb-4 font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                {t('inventory.productImages', 'Product Images')}
                                <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ms-2">{images.length}/{MAX_IMAGES}</span>
                            </h3>
                            <div
                                className={`relative border-2 border-dashed rounded-xl p-4 transition-colors ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                            >
                                {images.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                                        <Upload className="w-10 h-10 mb-3" />
                                        <p className="text-sm font-semibold mb-1">{t('inventory.dragDropImages', 'Drag & drop product images here')}</p>
                                        <p className="text-xs mb-3">{t('inventory.orClickToUpload', 'or click to browse files')}</p>
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors">
                                            <ImagePlus className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                                            {t('inventory.selectImages', 'Select Images')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                        {images.map((img, idx) => (
                                            <div key={img.url} draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOverImg(e, idx)} onDragEnd={handleDragEnd}
                                                className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${idx === 0 ? 'border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-600'} ${dragIdx === idx ? 'opacity-50 scale-95' : ''}`}>
                                                <img src={imgUrl(img)} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                                    <button type="button" onClick={() => removeImage(idx)} title={t('inventory.removeImage', 'Remove image')} className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-500 text-white rounded-full shadow-lg transition-opacity hover:bg-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-80 transition-opacity"><GripVertical className="w-4 h-4 text-white drop-shadow" /></div>
                                                {idx === 0 && <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-md">{t('inventory.mainImage', 'MAIN')}</span>}
                                            </div>
                                        ))}
                                        {images.length < MAX_IMAGES && (
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                                                <Plus className="w-6 h-6" /><span className="text-[10px] font-bold">{t('inventory.addMore', 'ADD')}</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t('inventory.imageHint', 'First image is the main product photo. Drag to reorder. JPEG, PNG, WebP supported.')}</p>
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleFileSelect} />
                        </div>

                        {/* ═══ Base Details ═════════════════════════════════════════ */}
                        <div>
                            <h3 className="text-sm border-b pb-2 mb-4 font-bold text-gray-900 dark:text-white uppercase tracking-wider">{t('inventory.baseInformation', 'Base Information')}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="md:col-span-2">
                                    <label htmlFor="prod-name" className={labelCls}>{t('inventory.productName', 'Product Name')}</label>
                                    <input id="prod-name" required type="text" placeholder={t('inventory.productNamePlaceholder', 'e.g. Premium T-Shirt')} className={inputCls} value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div>
                                    <label htmlFor="prod-category" className={labelCls}>{t('inventory.colCategory', 'Category')}</label>
                                    <select id="prod-category" required className={inputCls + ' appearance-none'} value={category} onChange={e => setCategory(e.target.value)}>
                                        <option value="" disabled>{t('inventory.selectCategory', 'Select Category')}</option>
                                        {categories?.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="prod-brand" className={labelCls}>{t('inventory.brand', 'Brand')}</label>
                                    <input id="prod-brand" type="text" placeholder={t('inventory.brandPlaceholder', 'e.g. FashionCo')} className={inputCls} value={brand} onChange={e => setBrand(e.target.value)} />
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="prod-desc" className={labelCls}>{t('inventory.description', 'Description')}</label>
                                    <textarea id="prod-desc" rows={3} placeholder={t('inventory.descriptionPlaceholder', 'Describe your product... This helps AI generate better landing pages.')} className={inputCls + ' resize-none'} value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="prod-supplier" className={labelCls}>{t('inventory.supplier', 'Supplier')}</label>
                                    <select id="prod-supplier" className={inputCls + ' appearance-none'} value={supplier} onChange={e => setSupplier(e.target.value)}>
                                        <option value="">{t('inventory.selectSupplierOptional', 'Select a specific supplier (Optional)')}</option>
                                        {suppliers?.map(sup => <option key={sup._id} value={sup._id}>{sup.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* ═══ Variant Builder (Create only) ═══════════════════════ */}
                        {!isEdit && (
                            <div>
                                <h3 className="text-sm border-b pb-2 mb-4 font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                    {t('inventory.productVariants', 'Product Variants')}
                                </h3>

                                {/* Step 1: Define Attributes */}
                                <div className="space-y-3 mb-4">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {t('inventory.defineAttrsHelp', 'Define attributes and their values (comma-separated). Then generate all combinations.')}
                                    </p>
                                    {attributes.map((attr, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <div className="w-36 shrink-0">
                                                <input
                                                    type="text"
                                                    placeholder={t('inventory.attrKeyPlaceholder', 'Size, Color...')}
                                                    className="w-full text-sm outline-none px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-400 font-semibold"
                                                    value={attr.key}
                                                    onChange={e => updateAttr(idx, 'key', e.target.value)}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    placeholder={t('inventory.attrValuesPlaceholder', 'S, M, L, XL  (comma-separated)')}
                                                    className="w-full text-sm outline-none px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-400"
                                                    value={attr.values}
                                                    onChange={e => updateAttr(idx, 'values', e.target.value)}
                                                />
                                            </div>
                                            {attributes.length > 1 && (
                                                <button type="button" onClick={() => removeAttribute(idx)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={addAttribute} className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> {t('inventory.addAttribute', 'Add Attribute')}
                                        </button>
                                        <button type="button" onClick={generateVariants}
                                            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                                            <Zap className="w-3.5 h-3.5" />
                                            {t('inventory.generateVariants', 'Generate')}
                                            {previewCount > 0 && <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded-full ms-1">{previewCount}</span>}
                                        </button>
                                    </div>
                                </div>

                                {/* Bulk Defaults (collapsible) */}
                                {variants.length > 0 && (
                                    <div className="mb-4">
                                        <button type="button" onClick={() => setShowBulk(v => !v)}
                                            className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5 mb-2 hover:text-gray-900 dark:hover:text-white transition-colors">
                                            <Settings2 className="w-3.5 h-3.5" />
                                            {t('inventory.bulkSetValues', 'Bulk Set Values')}
                                        </button>
                                        {showBulk && (
                                            <div className="flex items-end gap-2 flex-wrap bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-600">
                                                <div className="w-24">
                                                    <label className={tinyLabelCls}>{t('inventory.price', 'Price')}</label>
                                                    <input type="number" min="0" step="0.01" placeholder="—" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} />
                                                </div>
                                                <div className="w-24">
                                                    <label className={tinyLabelCls}>{t('inventory.costText', 'Cost')}</label>
                                                    <input type="number" min="0" step="0.01" placeholder="—" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={bulkCost} onChange={e => setBulkCost(e.target.value)} />
                                                </div>
                                                <div className="w-24">
                                                    <label className={tinyLabelCls}>{t('inventory.initStock', 'Stock')}</label>
                                                    <input type="number" min="0" placeholder="—" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={bulkStock} onChange={e => setBulkStock(e.target.value)} />
                                                </div>
                                                <div className="w-24">
                                                    <label className={tinyLabelCls + ' !text-red-500 dark:!text-red-400'}>{t('inventory.reorder', 'Reorder')}</label>
                                                    <input type="number" min="0" placeholder="10" className="w-full text-sm outline-none px-2 py-1.5 rounded-md border border-red-200 dark:border-red-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={bulkReorder} onChange={e => setBulkReorder(e.target.value)} />
                                                </div>
                                                <button type="button" onClick={applyBulkValues}
                                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1">
                                                    <Copy className="w-3 h-3" /> {t('inventory.applyAll', 'Apply All')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Step 2: Variant Table */}
                                {variants.length > 0 && (
                                    <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                                                        <th className="px-3 py-2 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 w-8">#</th>
                                                        {attrKeys.map(k => (
                                                            <th key={k} className="px-3 py-2 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">{k}</th>
                                                        ))}
                                                        <th className="px-3 py-2 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">{t('inventory.sku', 'SKU')}</th>
                                                        <th className="px-3 py-2 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 w-24">{t('inventory.price', 'Price')}</th>
                                                        <th className="px-3 py-2 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 w-24">{t('inventory.costText', 'Cost')}</th>
                                                        <th className="px-3 py-2 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 w-20">{t('inventory.initStock', 'Stock')}</th>
                                                        <th className="px-3 py-2 text-[10px] uppercase font-bold text-red-500 dark:text-red-400 w-20">{t('inventory.reorder', 'Reorder')}</th>
                                                        <th className="px-3 py-2 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                    {variants.map((v, idx) => (
                                                        <tr key={idx} className="group hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                                            <td className="px-3 py-1.5 text-xs text-gray-400 font-mono">{idx + 1}</td>
                                                            {attrKeys.map(k => (
                                                                <td key={k} className="px-3 py-1.5">
                                                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded-md">{v.attributes[k]}</span>
                                                                </td>
                                                            ))}
                                                            <td className="px-3 py-1.5">
                                                                <input type="text" className="w-full min-w-[100px] text-xs outline-none px-2 py-1 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-400 bg-transparent text-gray-900 dark:text-white font-mono" value={v.sku} onChange={e => updateVariant(idx, 'sku', e.target.value)} />
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <input type="number" min="0" step="0.01" className="w-full text-xs outline-none px-2 py-1 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-400 bg-transparent text-gray-900 dark:text-white" value={v.price} onChange={e => updateVariant(idx, 'price', e.target.value)} />
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <input type="number" min="0" step="0.01" className="w-full text-xs outline-none px-2 py-1 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-400 bg-transparent text-gray-900 dark:text-white" value={v.cost} onChange={e => updateVariant(idx, 'cost', e.target.value)} />
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <input type="number" min="0" className="w-full text-xs outline-none px-2 py-1 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-400 bg-transparent text-gray-900 dark:text-white" value={v.stock} onChange={e => updateVariant(idx, 'stock', e.target.value)} />
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <input type="number" min="0" className="w-full text-xs outline-none px-2 py-1 rounded-md border border-transparent hover:border-red-200 dark:hover:border-red-700 focus:border-red-400 bg-transparent text-gray-900 dark:text-white" value={v.reorderLevel} onChange={e => updateVariant(idx, 'reorderLevel', e.target.value)} />
                                                            </td>
                                                            <td className="px-3 py-1.5 text-center">
                                                                <button type="button" onClick={() => removeVariant(idx)} className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
                                            <span>{variants.length} {t('inventory.variantCount', 'variant(s)')}</span>
                                            <span className="font-mono">
                                                {t('inventory.priceRange', 'Price')}: {Math.min(...variants.map(v => v.price))} — {Math.max(...variants.map(v => v.price))} DA
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {variants.length === 0 && (
                                    <div className="text-center py-6 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl">
                                        <p className="text-sm font-medium">{t('inventory.noVariantsYet', 'No variants yet')}</p>
                                        <p className="text-xs mt-1">{t('inventory.configureAndGenerate', 'Configure attributes above and click Generate')}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {isEdit && (
                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl">
                                <p className="text-sm text-orange-800 dark:text-orange-300">{t('inventory.variantEditNote', 'Note: Variant configurations cannot be changed from this base edit screen in the current version.')}</p>
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} disabled={submitting} className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button type="submit" form="productForm" disabled={submitting}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-t from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 rounded-xl shadow-md shadow-gray-900/10 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {isEdit ? t('common.saveChanges', 'Save Changes') : t('inventory.createProduct', 'Create Product')}
                    </button>
                </div>
            </div>
        </div>
    );
}
