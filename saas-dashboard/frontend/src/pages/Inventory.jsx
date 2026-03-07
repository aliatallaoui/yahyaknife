import { useState, useContext } from 'react';
import { Package, AlertTriangle, DollarSign, Search, Shield, ArrowRight, Plus, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { InventoryContext } from '../context/InventoryContext';
import ProductModal from '../components/ProductModal';
import SupplierModal from '../components/SupplierModal';
import CategoryModal from '../components/CategoryModal';
import StockLedgerModal from '../components/StockLedgerModal';
import PurchaseOrdersModal from '../components/PurchaseOrdersModal';

export default function Inventory() {
    const {
        products, rawMaterials, suppliers, categories, metrics, loading,
        createProduct, updateProduct, deleteProduct,
        deleteSupplier, deleteCategory
    } = useContext(InventoryContext);

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('finished'); // 'finished' or 'raw'

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
        if (window.confirm("Are you sure you want to completely archive this product? This will remove it from active stock.")) {
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
        if (window.confirm("Archive this supplier?")) await deleteSupplier(id);
    };

    const handleCreateCategory = () => { setEditingCategory(null); setIsCategoryModalOpen(true); };
    const handleEditCategory = (category) => { setEditingCategory(category); setIsCategoryModalOpen(true); };
    const handleDeleteCategory = async (id) => {
        if (window.confirm("Archive this category?")) await deleteCategory(id);
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

    const filteredVariants = flattenedVariants.filter(v =>
        v.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof v.category === 'object' ? v.category?.name : v.category)?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredMaterials = rawMaterials.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6">

            {/* Top Header */}
            <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-gray-100/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-blue-50/20 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">Inventory Tracking</h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Manage product catalog, track stock levels, and monitor supplier flow.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsPOModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 hover:shadow-sm hover:-translate-y-0.5 font-bold rounded-xl text-sm transition-all duration-200">
                        <Package className="w-4 h-4" /> Receive PO
                    </button>
                    <button onClick={handleCreateCategory} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm shadow-sm hover:shadow hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200">
                        <Plus className="w-4 h-4" /> Add Category
                    </button>
                    <button onClick={handleCreateClick} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-b from-gray-800 to-gray-900 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg hover:from-gray-700 hover:to-gray-800 hover:-translate-y-0.5 transition-all duration-200 ring-1 ring-gray-900/50 ring-offset-1">
                        <Plus className="w-4 h-4" /> Add New Product
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InventoryCard
                    title="Total Products"
                    value={metrics?.totalProducts || 0}
                    icon={Package}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <InventoryCard
                    title="Total Stock Valuation"
                    value={`${(metrics?.totalInventoryValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    icon={DollarSign}
                    color="text-green-600"
                    bg="bg-green-50"
                />
                <InventoryCard
                    title="Low Stock Alerts"
                    value={metrics?.lowStockCount || 0}
                    icon={AlertTriangle}
                    color="text-red-600"
                    bg="bg-red-50"
                    highlight={(metrics?.lowStockCount || 0) > 0}
                />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Product Catalog Table */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-6 border-b border-gray-100 pb-4 gap-4">
                        <div className="flex gap-2 bg-gray-50/80 p-1.5 rounded-xl border border-gray-100 shadow-inner w-fit">
                            <button
                                onClick={() => setActiveTab('finished')}
                                className={clsx("px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200", activeTab === 'finished' ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50")}
                            >
                                Finished Goods
                            </button>
                            <button
                                onClick={() => setActiveTab('raw')}
                                className={clsx("px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200", activeTab === 'raw' ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50")}
                            >
                                Raw Materials
                            </button>
                            <button
                                onClick={() => setActiveTab('categories')}
                                className={clsx("px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200", activeTab === 'categories' ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50")}
                            >
                                Categories
                            </button>
                        </div>
                        <div className="relative group">
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search SKU or Name..."
                                className="bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none rounded-xl py-2.5 pl-10 pr-4 text-sm w-full sm:w-72 transition-all duration-200 font-medium placeholder:text-gray-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="p-4 font-semibold">Item</th>
                                    <th className="p-4 font-semibold">SKU</th>
                                    <th className="p-4 font-semibold">Category</th>
                                    <th className="p-4 font-semibold text-right">{activeTab === 'finished' ? 'Price/Cost' : 'Unit Cost'}</th>
                                    {activeTab === 'finished' ? (
                                        <>
                                            <th className="p-4 font-semibold text-right">Total</th>
                                            <th className="p-4 font-semibold text-right text-orange-600">Reserved</th>
                                            <th className="p-4 font-semibold text-right text-green-600">Available</th>
                                            <th className="p-4 font-semibold text-right text-purple-600">Sold</th>
                                        </>
                                    ) : (
                                        <th className="p-4 font-semibold text-right">Stock</th>
                                    )}
                                    <th className="p-4 font-semibold text-center">Status</th>
                                    <th className="p-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {activeTab === 'finished' && (
                                    filteredVariants.length === 0 ? (
                                        <tr><td colSpan="7" className="p-8 text-center text-gray-500">No active products found matching criteria.</td></tr>
                                    ) : (
                                        filteredVariants.map((variant) => {
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
                                                            <span className="text-xs text-indigo-600 font-semibold mt-0.5">{attrString || 'Base'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-gray-500 font-mono text-xs tracking-wider font-semibold">{variant.sku}</td>
                                                    <td className="p-4">
                                                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold uppercase tracking-wider rounded-md border border-gray-200/60 shadow-sm whitespace-nowrap">
                                                            {typeof variant.category === 'object' ? variant.category?.name : variant.category}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="font-bold text-gray-900">${variant.price?.toFixed(2)}</div>
                                                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">Cost: ${variant.cost?.toFixed(2)}</div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <span className="inline-flex items-center justify-center font-bold text-gray-700 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded shadow-sm tabular-nums">
                                                            {variant.totalStock?.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-bold tabular-nums text-orange-600">
                                                        {variant.reservedStock?.toLocaleString()}
                                                    </td>
                                                    <td className={clsx("p-4 text-right font-black tabular-nums border-l border-gray-50", isLowStock ? "text-red-600 bg-red-50/10" : "text-green-600")}>
                                                        {variant.availableStock?.toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right font-black tabular-nums border-l border-gray-50 text-purple-700 bg-purple-50/30">
                                                        {variant.totalSold != null ? variant.totalSold.toLocaleString() : '0'}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={clsx(
                                                            "px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 uppercase tracking-wider relative overflow-hidden",
                                                            isLowStock ? "bg-red-50 text-red-700 border border-red-200 shadow-sm" : "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
                                                        )}>
                                                            {isLowStock && <span className="absolute top-0 right-0 w-1 h-1 bg-red-500 rounded-full animate-ping mr-1 mt-1"></span>}
                                                            {isLowStock && <span className="absolute top-0 right-0 w-1 h-1 bg-red-600 rounded-full mr-1 mt-1"></span>}
                                                            {isLowStock ? <AlertTriangle className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                                                            {isLowStock ? "Low Stock" : "In Stock"}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
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
                                        <tr><td colSpan="7" className="p-8 text-center text-gray-500">No raw materials found.</td></tr>
                                    ) : (
                                        filteredMaterials.map((material) => {
                                            const isLowStock = material.stockLevel <= material.minimumStock;
                                            return (
                                                <tr key={material._id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-4 font-medium text-gray-900">{material.name}</td>
                                                    <td className="p-4 text-gray-500 font-mono text-xs tracking-wider">{material.sku}</td>
                                                    <td className="p-4 text-gray-500">{material.category}</td>
                                                    <td className="p-4 text-right font-medium text-gray-900">
                                                        ${material.costPerUnit?.toFixed(2)} <span className="text-xs text-gray-400 font-normal">/ {material.unitOfMeasure}</span>
                                                    </td>
                                                    <td className="p-4 text-right font-medium tabular-nums text-gray-900">
                                                        {material.stockLevel?.toLocaleString()} <span className="text-xs text-gray-400 font-normal">{material.unitOfMeasure}</span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={clsx(
                                                            "px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 uppercase tracking-wider",
                                                            isLowStock ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                                                        )}>
                                                            {isLowStock ? <AlertTriangle className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                                                            {isLowStock ? "Low Stock" : "In Stock"}
                                                        </span>
                                                    </td>
                                                    <td className="p-4"></td>
                                                </tr>
                                            );
                                        })
                                    )
                                )}

                                {activeTab === 'categories' && (
                                    filteredCategories.length === 0 ? (
                                        <tr><td colSpan="7" className="p-8 text-center text-gray-500">No active categories found.</td></tr>
                                    ) : (
                                        filteredCategories.map((cat) => (
                                            <tr key={cat._id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 font-medium text-gray-900">{cat.name}</td>
                                                <td colSpan="5" className="p-4 text-gray-500">{cat.description || 'No description provided.'}</td>
                                                <td className="p-4 text-right">
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
                </div>

                {/* Suppliers Panel */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-fit sticky top-6">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900">Active Suppliers</h3>
                        <button onClick={handleCreateSupplier} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Add Supplier">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 p-6 flex flex-col gap-4 max-h-[600px] overflow-y-auto">
                        {suppliers.length === 0 ? (
                            <div className="text-sm text-gray-500 text-center py-8">No active suppliers.</div>
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
                                        <span className="font-medium text-gray-400">Reliability</span>
                                        <span className={clsx("font-bold", supplier.reliabilityScore >= 90 ? "text-green-600" : supplier.reliabilityScore >= 70 ? "text-yellow-600" : "text-red-600")}>
                                            {supplier.reliabilityScore || 0}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between mb-2">
                                        <span className="font-medium text-gray-400">Avg Lead Time</span>
                                        <span className="font-bold text-gray-900">{supplier.averageLeadTimeDays || 0} days</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-50">
                                        <p className="flex justify-between text-xs"><span className="text-gray-400">Contact:</span> <span className="text-gray-900 truncate ml-2">{supplier.contactPerson || 'N/A'}</span></p>
                                    </div>
                                </div>
                                <button className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-700 transition-colors">
                                    View Purchase Orders <ArrowRight className="w-3 h-3" />
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

function InventoryCard({ title, value, icon: Icon, color, bg, highlight }) {
    return (
        <div className={clsx(
            "p-6 rounded-3xl border shadow-sm flex items-center gap-5 transition-all duration-300 hover:shadow-md hover:-translate-y-1 relative overflow-hidden group hover:border-gray-300",
            highlight ? "bg-gradient-to-br from-red-50 to-white border-red-100" : "bg-white border-gray-100"
        )}>
            {/* Soft decorative blob on hover */}
            <div className={clsx(
                "absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-500",
                color.replace('text-', 'bg-')
            )}></div>

            <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border border-white/50 relative z-10", bg, color)}>
                <Icon className="w-7 h-7 drop-shadow-sm" />
            </div>
            <div className="relative z-10">
                <p className={clsx("text-sm font-bold tracking-wide mb-1 uppercase text-[11px]", highlight ? "text-red-700/80" : "text-gray-500")}>{title}</p>
                <h3 className={clsx("text-3xl font-black tabular-nums tracking-tight drop-shadow-sm", highlight ? "text-red-900" : "text-gray-900")}>{value}</h3>
            </div>
        </div>
    );
}
