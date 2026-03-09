import { useState, useContext } from 'react';
import { Package, AlertTriangle, DollarSign, Search, Shield, ArrowRight, Plus, Pencil, Trash2, Box } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';
import { InventoryContext } from '../context/InventoryContext';
import ProductModal from '../components/ProductModal';
import SupplierModal from '../components/SupplierModal';
import CategoryModal from '../components/CategoryModal';
import StockLedgerModal from '../components/StockLedgerModal';
import PurchaseOrdersModal from '../components/PurchaseOrdersModal';
import { useTranslation } from 'react-i18next';

export default function Inventory() {
    const { t } = useTranslation();
    const {
        products, rawMaterials, suppliers, categories, metrics, loading, completedKnives,
        createProduct, updateProduct, deleteProduct,
        deleteSupplier, deleteCategory
    } = useContext(InventoryContext);

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('finished');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [materialCategoryFilter, setMaterialCategoryFilter] = useState('All');
    // Inline editing: { id: variantId, productId, field, value }
    const [editingVariant, setEditingVariant] = useState(null);

    const startVariantEdit = (variant, field) =>
        setEditingVariant({ id: variant._id, productId: variant.baseProductId, field, value: variant[field] ?? '' });

    const handleVariantInlineSave = async (variant) => {
        if (!editingVariant || editingVariant.id !== variant._id) return;
        try {
            // Find the parent product, clone it, patch the matching variant inside its variants array
            const parentProduct = products.find(p => p._id === variant.baseProductId);
            if (!parentProduct) return;
            const updatedVariants = parentProduct.variants.map(v =>
                v._id === variant._id
                    ? { ...v, [editingVariant.field]: Number(editingVariant.value) }
                    : v
            );
            await updateProduct(variant.baseProductId, { ...parentProduct, variants: updatedVariants });
        } catch (err) {
            console.error('Variant inline save failed', err);
        } finally {
            setEditingVariant(null);
        }
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);

    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);

    const [isLedgerOpen, setIsLedgerOpen] = useState(false);
    const [selectedLedgerProduct, setSelectedLedgerProduct] = useState(null);

    const [isPOModalOpen, setIsPOModalOpen] = useState(false);

    const handleCreateClick = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (id) => {
        if (window.confirm(t('inventory.confirmArchiveProduct', "Are you sure you want to completely archive this product? This will remove it from active stock."))) {
            try {
                await deleteProduct(id);
            } catch (error) {
                alert("Failed to archive product. Check console.");
                console.error(error);
            }
        }
    };

    const handleCreateSupplier = () => { setEditingSupplier(null); setIsSupplierModalOpen(true); };
    const handleEditSupplier = (supplier) => { setEditingSupplier(supplier); setIsSupplierModalOpen(true); };
    const handleDeleteSupplier = async (id) => {
        if (window.confirm(t('inventory.confirmArchiveSupplier', "Archive this supplier?"))) await deleteSupplier(id);
    };

    const handleCreateCategory = () => { setEditingCategory(null); setIsCategoryModalOpen(true); };
    const handleEditCategory = (category) => { setEditingCategory(category); setIsCategoryModalOpen(true); };
    const handleDeleteCategory = async (id) => {
        if (window.confirm(t('inventory.confirmArchiveCategory', "Archive this category?"))) await deleteCategory(id);
    };

    const handleModalSubmit = async (payload) => {
        try {
            if (editingProduct) await updateProduct(editingProduct._id, payload);
            else await createProduct(payload);
            setIsModalOpen(false);
        } catch (error) {
            alert(`Failed to save product: ${error.message}`);
            console.error(error);
        }
    };

    if (loading && products.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    const flattenedVariants = products.flatMap(p => {
        if (!p.variants || p.variants.length === 0) return [];
        return p.variants.map(v => ({
            ...v,
            baseProductId: p._id,
            productName: p.name,
            category: p.category,
            brand: p.brand
        }));
    });

    const flattenedKnives = (completedKnives || []).map(k => ({
        _id: k._id,
        isKnife: true,
        baseProductId: k._id,
        productName: k.name,
        attributes: { Steel: k.steelType || 'N/A', Handle: k.handleMaterial || 'N/A' },
        sku: k.knifeId,
        category: `Knife - ${k.type}`,
        price: k.suggestedPrice || 0,
        cost: k.totalProductionCost || 0,
        totalStock: 1,
        reservedStock: 0,
        availableStock: 1,
        reorderLevel: 0,
        totalSold: 0
    }));

    const unifiedFinishedGoods = [...flattenedVariants, ...flattenedKnives];

    const filteredVariants = unifiedFinishedGoods.filter(v =>
        v.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof v.category === 'object' ? v.category?.name : v.category)?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalVariantPages = Math.max(1, Math.ceil(filteredVariants.length / perPage));
    const paginatedVariants = filteredVariants.slice((currentPage - 1) * perPage, currentPage * perPage);

    const filteredMaterials = rawMaterials.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.sku.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = materialCategoryFilter === 'All' || m.category === materialCategoryFilter;
        return matchesSearch && matchesCat;
    });

    const materialCategories = ['All', 'Steel', 'Handle', 'Pins', 'Leather', 'Belt', 'Epoxy', 'Packaging', 'Other'];

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6">

            {/* Top Header */}
            <PageHeader
                title={t('inventory.title', 'Inventory Tracking')}
                subtitle={t('inventory.subtitle', 'Manage product catalog, track stock levels, and monitor supplier flow.')}
                variant="inventory"
                actions={
                    <div className="flex gap-2">
                        {activeTab === 'categories' ? (
                            <button onClick={handleCreateCategory} className="flex items-center gap-2 px-6 py-2.5 bg-[#5D5DFF] hover:bg-[#4D4DFF] text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 leading-none">
                                <Plus className="w-5 h-5" /> {t('inventory.addCategoryBtn', 'Add Category')}
                            </button>
                        ) : (
                            <button onClick={handleCreateClick} className="flex items-center gap-2 px-6 py-2.5 bg-[#5D5DFF] hover:bg-[#4D4DFF] text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 leading-none">
                                <Plus className="w-5 h-5" /> {t('inventory.addProductBtn', 'Add New Product')}
                            </button>
                        )}
                        <button onClick={() => setIsPOModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors border border-white/10">
                            <Package className="w-4 h-4" /> {t('inventory.receivePoBtn', 'Receive PO')}
                        </button>
                    </div>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InventoryCard
                    title={t('inventory.totalProducts', 'Total Products')}
                    value={metrics?.totalProducts || 0}
                    icon={Package}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <InventoryCard
                    title={t('inventory.totalValuation', 'Total Stock Valuation')}
                    value={`${(metrics?.totalInventoryValue || 0).toLocaleString()}`}
                    icon={DollarSign}
                    color="text-green-600"
                    bg="bg-green-50"
                />
                <InventoryCard
                    title={t('inventory.lowStockAlerts', 'Low Stock Alerts')}
                    value={metrics?.lowStockCount || 0}
                    icon={AlertTriangle}
                    color="text-red-600"
                    bg="bg-red-50"
                    highlight={(metrics?.lowStockCount || 0) > 0}
                />
            </div>

            {/* Main Layout — full width table */}
            <div className="flex flex-col gap-6">

                {/* Product Catalog Table — full width */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center p-4 sm:p-6 border-b border-gray-100 pb-4 gap-4">
                        <div className="flex flex-wrap gap-1 bg-gray-50/80 p-1.5 rounded-xl border border-gray-100 shadow-inner w-full xl:w-auto">
                            <button
                                onClick={() => setActiveTab('finished')}
                                className={clsx("flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-200 text-center whitespace-nowrap", activeTab === 'finished' ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50")}
                            >
                                {t('inventory.tabFinished', 'Finished Goods')}
                            </button>
                            <button
                                onClick={() => setActiveTab('raw')}
                                className={clsx("flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-200 text-center whitespace-nowrap", activeTab === 'raw' ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50")}
                            >
                                {t('inventory.tabRaw', 'Workshop Materials')}
                            </button>
                            <button
                                onClick={() => setActiveTab('categories')}
                                className={clsx("flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-200 text-center whitespace-nowrap", activeTab === 'categories' ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50")}
                            >
                                {t('inventory.tabCategories', 'Categories')}
                            </button>
                        </div>
                        <div className="relative group w-full xl:w-72">
                            <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder={t('inventory.searchPlaceholder', 'Search SKU or Name...')}
                                className="bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none rounded-xl py-2.5 ps-10 pe-4 text-sm w-full transition-all duration-200 font-medium placeholder:text-gray-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    {activeTab === 'raw' && (
                        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/30 flex gap-2 overflow-x-auto">
                            {materialCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setMaterialCategoryFilter(cat)}
                                    className={clsx(
                                        "px-3 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap",
                                        materialCategoryFilter === cat
                                            ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30 ring-offset-1"
                                            : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-indigo-600"
                                    )}
                                >
                                    {cat === 'All' ? t('inventory.allCategories', 'All Materials') : cat}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-start border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="p-4 font-semibold">{t('inventory.colItem', 'Item')}</th>
                                    <th className="p-4 font-semibold">{t('inventory.colSku', 'SKU')}</th>
                                    <th className="p-4 font-semibold">{t('inventory.colCategory', 'Category')}</th>
                                    <th className="p-4 font-semibold text-end">{activeTab === 'finished' ? t('inventory.colPriceCost', 'Price/Cost') : t('inventory.colUnitCost', 'Unit Cost')}</th>
                                    {activeTab === 'finished' ? (
                                        <>
                                            <th className="p-4 font-semibold text-end">{t('inventory.colTotal', 'Total')}</th>
                                            <th className="p-4 font-semibold text-end text-orange-600">{t('inventory.colReserved', 'Reserved')}</th>
                                            <th className="p-4 font-semibold text-end text-green-600">{t('inventory.colAvailable', 'Available')}</th>
                                            <th className="p-4 font-semibold text-end text-purple-600">{t('inventory.colSold', 'Sold')}</th>
                                        </>
                                    ) : (
                                        <th className="p-4 font-semibold text-end">{t('inventory.colStock', 'Stock')}</th>
                                    )}
                                    <th className="p-4 font-semibold text-center">{t('inventory.colStatus', 'Status')}</th>
                                    <th className="p-4 font-semibold text-end">{t('inventory.colActions', 'Actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {activeTab === 'finished' && (
                                    filteredVariants.length === 0 ? (
                                        <tr><td colSpan="9" className="p-8 text-center text-gray-500">{t('inventory.noProducts', 'No active products found matching criteria.')}</td></tr>
                                    ) : (
                                        paginatedVariants.map((variant) => {
                                            const isLowStock = variant.availableStock <= variant.reorderLevel;

                                            // Format Attributes
                                            let attrString = '';
                                            if (variant.attributes) {
                                                attrString = Object.entries(variant.attributes).map(([k, v]) => `${k}: ${v}`).join(', ');
                                            }

                                            return (
                                                <tr key={variant._id} className="hover:bg-gray-50/50 transition-colors group">
                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors group-hover:translate-x-1 duration-200" onClick={() => { setSelectedLedgerProduct(variant); setIsLedgerOpen(true); }}>
                                                                {variant.productName}
                                                            </span>
                                                            <span className="text-xs text-indigo-600 font-semibold mt-0.5">{attrString || t('inventory.attrBase', 'Base')}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-gray-500 font-mono text-xs tracking-wider font-semibold">{variant.sku}</td>
                                                    <td className="p-4">
                                                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold uppercase tracking-wider rounded-md border border-gray-200/60 shadow-sm whitespace-nowrap">
                                                            {typeof variant.category === 'object' ? variant.category?.name : variant.category}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-end">
                                                        {/* Price — inline edit */}
                                                        {editingVariant?.id === variant._id && editingVariant?.field === 'price' && !variant.isKnife ? (
                                                            <input autoFocus type="number" step="0.01"
                                                                value={editingVariant.value}
                                                                onChange={e => setEditingVariant(prev => ({ ...prev, value: e.target.value }))}
                                                                onBlur={() => handleVariantInlineSave(variant)}
                                                                onKeyDown={e => { if (e.key === 'Enter') handleVariantInlineSave(variant); if (e.key === 'Escape') setEditingVariant(null); }}
                                                                className="w-24 border border-blue-400 rounded-lg px-2 py-1 text-sm font-bold text-end outline-none shadow-sm ml-auto block" />
                                                        ) : (
                                                            <div onClick={() => { if (!variant.isKnife) startVariantEdit(variant, 'price'); }} className={clsx("group/p", !variant.isKnife && "cursor-pointer")} title={!variant.isKnife ? "Click to edit price" : ""}>
                                                                <div className={clsx("font-bold text-gray-900 transition-colors", !variant.isKnife && "group-hover/p:text-blue-600")}>${variant.price?.toLocaleString()}</div>
                                                                {/* Cost — inline edit */}
                                                                {editingVariant?.id === variant._id && editingVariant?.field === 'cost' && !variant.isKnife ? (
                                                                    <input autoFocus type="number" step="0.01"
                                                                        value={editingVariant.value}
                                                                        onChange={e => setEditingVariant(prev => ({ ...prev, value: e.target.value }))}
                                                                        onBlur={() => handleVariantInlineSave(variant)}
                                                                        onKeyDown={e => { if (e.key === 'Enter') handleVariantInlineSave(variant); if (e.key === 'Escape') setEditingVariant(null); }}
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="w-20 border border-blue-400 rounded-lg px-1 py-0.5 text-xs font-bold text-end outline-none shadow-sm mt-0.5 ml-auto block" />
                                                                ) : (
                                                                    <div onClick={e => { e.stopPropagation(); if (!variant.isKnife) startVariantEdit(variant, 'cost'); }} className={clsx("text-[11px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5", !variant.isKnife && "cursor-pointer hover:text-blue-500")} title={!variant.isKnife ? "Click to edit cost" : ""}>{t('inventory.costText', 'Cost')}: ${variant.cost?.toLocaleString()}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-end">
                                                        <span className="inline-flex items-center justify-center font-bold text-gray-700 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded shadow-sm tabular-nums">
                                                            {variant.totalStock?.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-end font-bold tabular-nums text-orange-600">
                                                        {variant.reservedStock?.toLocaleString()}
                                                    </td>
                                                    <td className={clsx("p-4 text-end font-black tabular-nums border-s border-gray-50", isLowStock ? "text-red-600 bg-red-50/10" : "text-green-600")}>
                                                        {variant.availableStock?.toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-end font-black tabular-nums border-s border-gray-50 text-purple-700 bg-purple-50/30">
                                                        {variant.totalSold != null ? variant.totalSold.toLocaleString() : '0'}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={clsx(
                                                            "px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 uppercase tracking-wider relative overflow-hidden",
                                                            isLowStock ? "bg-red-50 text-red-700 border border-red-200 shadow-sm" : "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
                                                        )}>
                                                            {isLowStock && <span className="absolute top-0 end-0 w-1 h-1 bg-red-500 rounded-full animate-ping me-1 mt-1"></span>}
                                                            {isLowStock && <span className="absolute top-0 end-0 w-1 h-1 bg-red-600 rounded-full me-1 mt-1"></span>}
                                                            {isLowStock ? <AlertTriangle className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                                                            {isLowStock ? t('inventory.lowStockText', "Low Stock") : t('inventory.inStockText', "In Stock")}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-end">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleEditClick({ _id: variant.baseProductId })} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Base Product">
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleDeleteClick(variant.baseProductId)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Archive Entire Product">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )
                                )}

                                {activeTab === 'raw' && (
                                    filteredMaterials.length === 0 ? (
                                        <tr><td colSpan="7" className="p-8 text-center text-gray-500">{t('inventory.noMaterials', 'No workshop materials found.')}</td></tr>
                                    ) : (
                                        filteredMaterials.map((material) => {
                                            const isLowStock = material.stockLevel <= material.minimumStock;
                                            const isCriticalType = ['Steel', 'Leather', 'Pins', 'Belt'].includes(material.category);
                                            const showPulsingRed = isLowStock && isCriticalType;

                                            return (
                                                <tr key={material._id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-bold text-gray-900">{material.name}</div>
                                                        {material.category === 'Steel' && material.dimensions && (
                                                            <div className="text-[11px] font-mono text-gray-500 mt-1">
                                                                {material.steelGrade && <span className="text-gray-700 font-bold me-2">{material.steelGrade}</span>}
                                                                {material.dimensions.thickness}x{material.dimensions.width}x{material.dimensions.length}mm
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-gray-500 font-mono text-xs tracking-wider">{material.sku}</td>
                                                    <td className="p-4">
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold uppercase rounded border border-gray-200/50 flex w-fit items-center gap-1.5">
                                                            {material.category}
                                                            {material.isCritical && <AlertTriangle className="w-3 h-3 text-red-500" />}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-end font-medium text-gray-900">
                                                        ${material.costPerUnit?.toFixed(2)} <span className="text-xs text-gray-400 font-normal">/ {material.unitOfMeasure}</span>
                                                    </td>
                                                    <td className="p-4 text-end">
                                                        <span className={clsx("font-bold text-lg tabular-nums", isLowStock ? "text-red-600" : "text-gray-900")}>
                                                            {material.stockLevel?.toLocaleString()}
                                                        </span>
                                                        <span className="text-xs text-gray-500 ms-1 font-medium">{material.unitOfMeasure}</span>
                                                        {material.category === 'Steel' && material.dimensions?.length > 0 && (
                                                            <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Est. {Math.floor((material.stockLevel * material.dimensions.length) / 250)} knives</div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={clsx(
                                                            "px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 uppercase tracking-wider relative",
                                                            isLowStock ? "bg-red-50 text-red-700 border border-red-200 shadow-sm" : "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
                                                        )}>
                                                            {showPulsingRed && <span className="absolute top-0 end-0 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping -mt-0.5 -me-0.5"></span>}
                                                            {showPulsingRed && <span className="absolute top-0 end-0 w-1.5 h-1.5 bg-red-600 rounded-full -mt-0.5 -me-0.5"></span>}
                                                            {isLowStock ? <AlertTriangle className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                                                            {isLowStock ? t('inventory.lowStockText', "Low Stock") : t('inventory.inStockText', "In Stock")}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-end">
                                                        {/* Actions placeholder, could add edit raw material modal later as needed */}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )
                                )}

                                {activeTab === 'categories' && (
                                    filteredCategories.length === 0 ? (
                                        <tr><td colSpan="7" className="p-8 text-center text-gray-500">{t('inventory.noCategories', 'No active categories found.')}</td></tr>
                                    ) : (
                                        filteredCategories.map((cat) => (
                                            <tr key={cat._id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 font-medium text-gray-900">{cat.name}</td>
                                                <td colSpan="5" className="p-4 text-gray-500">{cat.description || t('inventory.noDescription', 'No description provided.')}</td>
                                                <td className="p-4 text-end">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleEditCategory(cat)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Category">
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteCategory(cat._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Archive Category">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination footer — only for Finished Goods tab */}
                    {activeTab === 'finished' && filteredVariants.length > 0 && (() => {
                        const range = [];
                        const delta = 2;
                        let last = 0;
                        for (let i = 1; i <= totalVariantPages; i++) {
                            if (i === 1 || i === totalVariantPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                                if (last && i - last > 1) range.push('...');
                                range.push(i);
                                last = i;
                            }
                        }
                        return (
                            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/30 flex-wrap gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-gray-400">
                                        Page <strong className="text-gray-700">{currentPage}</strong> of <strong className="text-gray-700">{totalVariantPages}</strong>
                                        <span className="text-gray-300 mx-2">·</span>
                                        <span className="text-gray-500">{filteredVariants.length} variants</span>
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-gray-400">Show</span>
                                        <select
                                            value={perPage}
                                            onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                            className="bg-white border border-gray-200 rounded-lg py-1 px-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-400 cursor-pointer"
                                        >
                                            {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                        <span className="text-xs text-gray-400">per page</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                        ‹ Prev
                                    </button>
                                    {range.map((p, i) =>
                                        p === '...' ? (
                                            <span key={`e-${i}`} className="px-2 py-1.5 text-sm text-gray-400">…</span>
                                        ) : (
                                            <button key={p} onClick={() => setCurrentPage(p)}
                                                className={clsx('min-w-[36px] px-2 py-1.5 text-sm font-bold rounded-lg border transition-all',
                                                    p === currentPage ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                )}>{p}</button>
                                        )
                                    )}
                                    <button onClick={() => setCurrentPage(p => Math.min(totalVariantPages, p + 1))} disabled={currentPage === totalVariantPages}
                                        className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                        Next ›
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Suppliers Panel — sits below the full-width table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900">{t('inventory.activeSuppliers', 'Active Suppliers')}</h3>
                        <button onClick={handleCreateSupplier} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Add Supplier">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 p-6 flex flex-col gap-4 max-h-[600px] overflow-y-auto">
                        {suppliers.length === 0 ? (
                            <div className="text-sm text-gray-500 text-center py-8">{t('inventory.noSuppliers', 'No active suppliers.')}</div>
                        ) : suppliers.map(supplier => (
                            <div key={supplier._id} className="p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors bg-gray-50/30 group">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-gray-900">{supplier.name}</h4>
                                    <div className="flex items-center gap-2">
                                        <div className="hidden group-hover:flex items-center gap-1">
                                            <button onClick={() => handleEditSupplier(supplier)} className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDeleteSupplier(supplier._id)} className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                        <span className={clsx("w-2 h-2 rounded-full", supplier.active ? "bg-green-400" : "bg-gray-300")}></span>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-500 mb-4 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-medium text-gray-400">{t('inventory.reliabilityText', 'Reliability')}</span>
                                        <span className={clsx("font-bold", supplier.reliabilityScore >= 90 ? "text-green-600" : supplier.reliabilityScore >= 70 ? "text-yellow-600" : "text-red-600")}>
                                            {supplier.reliabilityScore || 0}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between mb-2">
                                        <span className="font-medium text-gray-400">{t('inventory.leadTimeText', 'Avg Lead Time')}</span>
                                        <span className="font-bold text-gray-900">{supplier.averageLeadTimeDays || 0} {t('inventory.daysText', 'days')}</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-50">
                                        <p className="flex justify-between text-xs"><span className="text-gray-400">{t('inventory.contactText', 'Contact')}:</span> <span className="text-gray-900 truncate ms-2">{supplier.contactPerson || 'N/A'}</span></p>
                                    </div>
                                </div>
                                <button className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-700 transition-colors">
                                    {t('inventory.viewPOs', 'View Purchase Orders')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <ProductModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleModalSubmit}
                    initialData={editingProduct}
                    suppliers={suppliers}
                    categories={categories}
                />
            )}

            {isSupplierModalOpen && (
                <SupplierModal
                    isOpen={isSupplierModalOpen}
                    onClose={() => setIsSupplierModalOpen(false)}
                    supplierArray={editingSupplier}
                />
            )}

            {isCategoryModalOpen && (
                <CategoryModal
                    isOpen={isCategoryModalOpen}
                    onClose={() => setIsCategoryModalOpen(false)}
                    category={editingCategory}
                />
            )}

            {isLedgerOpen && (
                <StockLedgerModal
                    isOpen={isLedgerOpen}
                    onClose={() => { setIsLedgerOpen(false); setSelectedLedgerProduct(null); }}
                    product={selectedLedgerProduct}
                />
            )}

            {isPOModalOpen && (
                <PurchaseOrdersModal
                    isOpen={isPOModalOpen}
                    onClose={() => setIsPOModalOpen(false)}
                />
            )}
        </div>
    );
}

function InventoryCard({ title, value, icon, color, bg, highlight }) {
    const IconComponent = icon;
    return (
        <div className={clsx(
            "p-6 rounded-3xl border shadow-sm flex items-center gap-5 transition-all duration-300 hover:shadow-md hover:-translate-y-1 relative overflow-hidden group hover:border-gray-300",
            highlight ? "bg-gradient-to-br from-red-50 to-white border-red-100" : "bg-white border-gray-100"
        )}>
            {/* Soft decorative blob on hover */}
            <div className={clsx(
                "absolute -top-10 -end-10 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-500",
                color.replace('text-', 'bg-')
            )}></div>

            <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border border-white/50 relative z-10", bg, color)}>
                <IconComponent className="w-7 h-7 drop-shadow-sm" />
            </div>
            <div className="relative z-10">
                <p className={clsx("text-sm font-bold tracking-wide mb-1 uppercase text-[11px]", highlight ? "text-red-700/80" : "text-gray-500")}>{title}</p>
                <h3 className={clsx("text-3xl font-black tabular-nums tracking-tight drop-shadow-sm", highlight ? "text-red-900" : "text-gray-900")}>{value}</h3>
            </div>
        </div>
    );
}
