import { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, FileCode2, PlayCircle, Plus, Search, Building } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';
import { ManufacturingContext } from '../context/ManufacturingContext';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import RawMaterialModal from '../components/RawMaterialModal';
import BOMModal from '../components/BOMModal';
import ProductionOrderModal from '../components/ProductionOrderModal';

export default function ProductionFloor() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('materials'); // 'materials', 'boms', 'orders'
    const { loading } = useContext(ManufacturingContext);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-yellow-600 animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <PageHeader
                title={t('manufacturing.title', 'Production Floor')}
                subtitle={t('manufacturing.subtitle', 'Live manufacturing line control, Bill of Materials, and resource planning.')}
                variant="production"
            />

            {/* Analytics Dashboard */}
            <ProductionAnalytics />

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 pb-px overflow-x-auto styled-scrollbar">
                <TabButton
                    active={activeTab === 'materials'}
                    onClick={() => setActiveTab('materials')}
                    icon={Package}
                    label={t('manufacturing.tabMaterials')}
                />
                <TabButton
                    active={activeTab === 'boms'}
                    onClick={() => setActiveTab('boms')}
                    icon={FileCode2}
                    label={t('manufacturing.tabBOMs')}
                />
                <TabButton
                    active={activeTab === 'orders'}
                    onClick={() => setActiveTab('orders')}
                    icon={PlayCircle}
                    label={t('manufacturing.tabOrders')}
                />
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
                {activeTab === 'materials' && <MaterialsPanel />}
                {activeTab === 'boms' && <BOPanel />}
                {activeTab === 'orders' && <OrdersPanel />}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap",
                active
                    ? "border-yellow-600 text-yellow-700 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-white"
            )}
        >
            <Icon className="w-4 h-4" /> {label}
        </button>
    );
}

// --- SUB-PANELS ---

function ProductionAnalytics() {
    const { t } = useTranslation();
    const { analytics } = useContext(ManufacturingContext);

    if (!analytics) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-bold">{t('manufacturing.totalUnitsProduced')}</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1">{analytics.totalUnitsProduced?.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-bold">{t('manufacturing.inProgressBatches')}</p>
                <h3 className="text-2xl font-black text-blue-600 mt-1">{analytics.inProgressOrders}</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-bold">{t('manufacturing.avgCostPerUnit')}</p>
                <h3 className="text-2xl font-black text-yellow-600 mt-1">{analytics.costPerUnit?.toFixed(2)} DZ</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-bold">{t('manufacturing.completedBatches')}</p>
                <h3 className="text-2xl font-black text-green-600 mt-1">{analytics.completedOrders}/{analytics.totalOrders}</h3>
            </div>
        </div>
    );
}

function MaterialsPanel() {
    const { t } = useTranslation();
    const { materials, createMaterial, updateMaterial } = useContext(ManufacturingContext);
    const { suppliers } = useContext(InventoryContext);
    const { hasPermission } = useContext(AuthContext);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [modalError, setModalError] = useState(null);

    const handleAddClick = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (mat) => {
        setEditingItem(mat);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (payload) => {
        setModalError(null);
        try {
            if (editingItem) await updateMaterial(editingItem._id, payload);
            else await createMaterial(payload);
            setIsModalOpen(false);
        } catch (error) {
            setModalError(t('manufacturing.errSaveMaterial', 'Failed to save raw material.'));
        }
    };

    return (
        <div className="p-4 sm:p-6 flex flex-col h-full relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-lg font-bold text-gray-900">{t('manufacturing.tabMaterials')}</h3>
                {hasPermission('manufacturing.manage_raw_materials') && (
                    <button onClick={handleAddClick} className="flex-1 sm:flex-none justify-center w-full sm:w-auto flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white font-semibold rounded-xl text-sm transition-all hover:bg-yellow-700 shadow-sm">
                        <Plus className="w-4 h-4" /> {t('manufacturing.addMaterial')}
                    </button>
                )}
            </div>

            <div className="overflow-x-auto w-full">
                <table className="w-full text-start border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                            <th className="p-4 font-semibold rounded-ss-lg">{t('manufacturing.colSku')}</th>
                            <th className="p-4 font-semibold">{t('manufacturing.colName')}</th>
                            <th className="p-4 font-semibold">{t('manufacturing.colCategory')}</th>
                            <th className="p-4 font-semibold">{t('manufacturing.colUoM')}</th>
                            {hasPermission('manufacturing.view_costs') && <th className="p-4 font-semibold">{t('manufacturing.colCost')}</th>}
                            <th className="p-4 font-semibold rounded-se-lg">{t('manufacturing.colStock')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {materials.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-500">{t('manufacturing.noMaterials')}</td></tr>
                        ) : materials.map((mat) => (
                            <tr key={mat._id} className={clsx("hover:bg-gray-50/50", hasPermission('manufacturing.manage_raw_materials') && "cursor-pointer")} onClick={() => hasPermission('manufacturing.manage_raw_materials') && handleEditClick(mat)}>
                                <td className="p-4 font-mono text-xs text-blue-600 hover:underline">{mat.sku}</td>
                                <td className="p-4 font-semibold text-gray-900">{mat.name}</td>
                                <td className="p-4 text-gray-500">{mat.category}</td>
                                <td className="p-4 text-gray-500">{mat.unitOfMeasure}</td>
                                {hasPermission('manufacturing.view_costs') && <td className="p-4 text-gray-900">${mat.costPerUnit?.toFixed(2)}</td>}
                                <td className="p-4 font-bold flex flex-col gap-1">
                                    <span className={clsx("px-2 py-0.5 rounded w-fit", mat.stockLevel <= mat.minimumStock ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")} title="Total Available">
                                        {mat.stockLevel - (mat.reservedQuantity || 0)} {t('manufacturing.availableStock')}
                                    </span>
                                    {(mat.reservedQuantity > 0) && (
                                        <span className="px-2 py-0.5 rounded w-fit bg-yellow-50 text-yellow-700 text-xs" title="Reserved for Active Production">
                                            {mat.reservedQuantity} {t('manufacturing.reservedStock')}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modalError && (
                <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 font-semibold">
                    {modalError}
                </div>
            )}

            <RawMaterialModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setModalError(null); }}
                onSubmit={handleModalSubmit}
                initialData={editingItem}
                suppliers={suppliers}
            />
        </div>
    );
}

function BOPanel() {
    const { t } = useTranslation();
    const { boms, createBOM, updateBOM } = useContext(ManufacturingContext);
    const { products } = useContext(InventoryContext);
    const { materials } = useContext(ManufacturingContext);
    const { hasPermission } = useContext(AuthContext);

    // Flatten variants from all products for the dropdown
    const variants = products.flatMap(p => p.variants || []);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [modalError, setModalError] = useState(null);

    const handleAddClick = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (bom) => {
        setEditingItem(bom);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (payload) => {
        setModalError(null);
        try {
            if (editingItem) await updateBOM(editingItem._id, payload);
            else await createBOM(payload);
            setIsModalOpen(false);
        } catch (error) {
            setModalError(t('manufacturing.errSaveBOM', 'Failed to save BOM.'));
        }
    };

    return (
        <div className="p-4 sm:p-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-lg font-bold text-gray-900">{t('manufacturing.bomsSubtitle')}</h3>
                {hasPermission('manufacturing.create_bom') && (
                    <button onClick={handleAddClick} className="flex-1 sm:flex-none justify-center w-full sm:w-auto flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white font-semibold rounded-xl text-sm transition-all hover:bg-yellow-700 shadow-sm">
                        <Plus className="w-4 h-4" /> {t('manufacturing.createBOM')}
                    </button>
                )}
            </div>
            {boms.length === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-xl">
                    {t('manufacturing.noBoms')}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {boms.map(bom => (
                        <div key={bom._id} onClick={() => hasPermission('manufacturing.update_bom') && handleEditClick(bom)} className={clsx("border border-gray-100 p-5 rounded-xl shadow-sm hover:shadow-md hover:border-yellow-200 transition-all bg-white group", hasPermission('manufacturing.update_bom') && "cursor-pointer")}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">v{bom.version}</span>
                                <span className={clsx("w-2 h-2 rounded-full", bom.isActive ? "bg-green-500" : "bg-gray-300")}></span>
                            </div>
                            <h4 className="font-bold text-gray-900 text-lg">{bom.variantId?.sku || t('manufacturing.unknownVariant')}</h4>
                            <p className="text-sm text-gray-500 mb-4">{bom.variantId?.displayName || t('manufacturing.baseProduct')}</p>

                            <div className="flex justify-between items-end pt-4 border-t border-gray-100">
                                <div>
                                    <p className="text-xs text-gray-400 font-semibold mb-0.5">{t('manufacturing.componentsText')}</p>
                                    <p className="text-sm font-bold text-gray-700">{bom.components?.length || 0}</p>
                                </div>
                                {hasPermission('manufacturing.view_costs') && (
                                    <div className="text-end">
                                        <p className="text-xs text-gray-400 font-semibold mb-0.5">{t('manufacturing.estCostText')}</p>
                                        <p className="text-sm font-bold text-yellow-600">${bom.totalEstimatedCost?.toFixed(2)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <BOMModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                initialData={editingItem}
                variants={variants}
                rawMaterials={materials}
            />
            {modalError && (
                <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 font-semibold">
                    {modalError}
                </div>
            )}
        </div>
    );
}

function OrdersPanel() {
    const { t } = useTranslation();
    const { productionOrders, createProductionOrder, updateProductionStatus } = useContext(ManufacturingContext);
    const { products } = useContext(InventoryContext);
    const { boms } = useContext(ManufacturingContext);
    const { hasPermission } = useContext(AuthContext);

    const variants = products.flatMap(p => p.variants || []);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [panelError, setPanelError] = useState(null);

    const handleAddClick = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (po) => {
        setEditingItem(po);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (payload) => {
        setPanelError(null);
        try {
            if (editingItem) {
                await updateProductionStatus(editingItem._id, payload);
            } else {
                await createProductionOrder(payload);
            }
            setIsModalOpen(false);
        } catch (error) {
            setPanelError(t('manufacturing.errSaveOrder', 'Failed to save Production Order.'));
        }
    };

    const handleStatusTransition = async (po, newStatus) => {
        setPanelError(null);
        try {
            const qty = newStatus === 'Completed' ? po.quantityPlanned : po.quantityCompleted;
            await updateProductionStatus(po._id, { status: newStatus, quantityCompleted: qty });
        } catch (error) {
            setPanelError(t('manufacturing.errTransitionStatus', 'Failed to transition status.'));
        }
    };

    return (
        <div className="p-4 sm:p-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-lg font-bold text-gray-900">{t('manufacturing.activeBatches')}</h3>
                {hasPermission('manufacturing.create_production_order') && (
                    <button onClick={handleAddClick} className="flex-1 sm:flex-none justify-center w-full sm:w-auto flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white font-semibold rounded-xl text-sm transition-all hover:bg-yellow-700 shadow-sm">
                        <Plus className="w-4 h-4" /> {t('manufacturing.newOrder')}
                    </button>
                )}
            </div>

            <div className="overflow-x-auto w-full">
                <table className="w-full text-start border-collapse min-w-[900px]">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                            <th className="p-4 font-semibold rounded-ss-lg">{t('manufacturing.colOrderNo')}</th>
                            <th className="p-4 font-semibold">{t('manufacturing.colVariantSku')}</th>
                            <th className="p-4 font-semibold">{t('manufacturing.colPlannedQty')}</th>
                            <th className="p-4 font-semibold">{t('manufacturing.colCompletedQty')}</th>
                            <th className="p-4 font-semibold">{t('manufacturing.colStatus')}</th>
                            <th className="p-4 font-semibold rounded-se-lg text-end">{t('manufacturing.colDeadline')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {productionOrders.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-500">{t('manufacturing.noOrders')}</td></tr>
                        ) : productionOrders.map((po) => (
                            <tr key={po._id} className="hover:bg-gray-50/50">
                                <td className="p-4 font-semibold text-gray-900">{po.orderNumber}</td>
                                <td className="p-4 font-mono text-xs">{po.variantId?.sku}</td>
                                <td className="p-4 text-gray-900">{po.quantityPlanned}</td>
                                <td className="p-4 text-gray-900">{po.quantityCompleted}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <span className={clsx("px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
                                            po.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                po.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                                    po.status === 'Quality Check' ? 'bg-purple-100 text-purple-700' :
                                                        po.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                        )}>
                                            {po.status === 'Planned' ? t('manufacturing.statusPlanned') : po.status === 'In Progress' ? t('manufacturing.statusInProgress') : po.status === 'Quality Check' ? t('manufacturing.statusQualityCheck') : po.status === 'Completed' ? t('manufacturing.statusCompleted') : t('manufacturing.statusCancelled')}
                                        </span>
                                        {po.status === 'Planned' && hasPermission('manufacturing.start_production') && (
                                            <button onClick={(e) => { e.stopPropagation(); handleStatusTransition(po, 'In Progress'); }} className="text-xs text-blue-600 hover:underline font-bold bg-blue-50 px-2 py-1 rounded">{t('manufacturing.btnStart')}</button>
                                        )}
                                        {po.status === 'In Progress' && hasPermission('manufacturing.complete_stage') && (
                                            <button onClick={(e) => { e.stopPropagation(); handleStatusTransition(po, 'Quality Check'); }} className="text-xs text-purple-600 hover:underline font-bold bg-purple-50 px-2 py-1 rounded">{t('manufacturing.btnQcCheck')}</button>
                                        )}
                                        {po.status === 'Quality Check' && hasPermission('manufacturing.complete_production') && (
                                            <button onClick={(e) => { e.stopPropagation(); handleStatusTransition(po, 'Completed'); }} className="text-xs text-green-600 hover:underline font-bold bg-green-50 px-2 py-1 rounded">{t('manufacturing.btnFinishYield')}</button>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-end text-gray-500">
                                    {po.completionDate ? new Date(po.completionDate).toLocaleDateString() : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {panelError && (
                <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 font-semibold">
                    {panelError}
                </div>
            )}

            <ProductionOrderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                initialData={editingItem}
                variants={variants}
                boms={boms}
            />
        </div>
    );
}
