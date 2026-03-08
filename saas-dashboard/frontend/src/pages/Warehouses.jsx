import { useState, useEffect, useContext } from 'react';
import { Box, MapPin, Search, Plus, List, ArrowRightLeft, ShieldCheck, ArrowDown, ArrowUp } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';

export default function Warehouses() {
    const { token } = useContext(AuthContext);
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('warehouses'); // 'warehouses', 'ledger', 'suppliers'

    // Data State
    const [warehouses, setWarehouses] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
    const [warehouseForm, setWarehouseForm] = useState({ name: '', code: '', location: '', capacity: 1000, type: 'Main' });

    const fetchData = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [wRes, lRes, sRes] = await Promise.all([
                fetch('/api/inventory/warehouses', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/inventory/ledger', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/inventory/suppliers', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            setWarehouses(await wRes.json());
            setLedger(await lRes.json());
            setSuppliers(await sRes.json());
        } catch (error) {
            console.error("Error fetching warehouse data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line
    }, [token]);

    const handleCreateWarehouse = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/inventory/warehouses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(warehouseForm)
            });
            if (res.ok) {
                fetchData();
                setIsWarehouseModalOpen(false);
                setWarehouseForm({ name: '', code: '', location: '', capacity: 1000, type: 'Main' });
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1400px]">
            {/* Header & Stats */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Box className="w-6 h-6 text-indigo-600" /> {t('warehouses.title', 'Enterprise Logistics')}
                    </h1>
                    <p className="text-gray-500 mt-1 font-medium">{t('warehouses.subtitle', 'Manage Multi-Warehouse operations, Movement ledgers, and Supplier SLAs.')}</p>
                </div>
                <div className="flex gap-3 bg-gray-100 p-1.5 rounded-xl border border-gray-200">
                    <button onClick={() => setActiveTab('warehouses')} className={clsx("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'warehouses' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50')}>
                        {t('warehouses.tabWarehouses', 'Warehouses')}
                    </button>
                    <button onClick={() => setActiveTab('ledger')} className={clsx("flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'ledger' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50')}>
                        <ArrowRightLeft className="w-4 h-4 rtl:rotate-180" /> {t('warehouses.tabLedger', 'Movement Ledger')}
                    </button>
                    <button onClick={() => setActiveTab('suppliers')} className={clsx("flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'suppliers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50')}>
                        <ShieldCheck className="w-4 h-4" /> {t('warehouses.tabSuppliers', 'Supplier Metrics')}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div></div>
            ) : (
                <>
                    {/* WAREHOUSES TAB */}
                    {activeTab === 'warehouses' && (
                        <div className="flex flex-col gap-6">
                            <div className="flex justify-end">
                                <button onClick={() => setIsWarehouseModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-all">
                                    <Plus className="w-4 h-4" /> {t('warehouses.addWarehouseBtn', 'Add Warehouse')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {warehouses.length > 0 ? warehouses.map(w => (
                                    <div key={w._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col hover:border-indigo-200 hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold">
                                                    {w.code}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900">{w.name}</h3>
                                                    <p className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md inline-block mt-1">{w.type}</p>
                                                </div>
                                            </div>
                                            <span className={clsx("px-2 py-1 rounded-md text-xs font-bold", w.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                                {w.status === 'Active' ? t('warehouses.statusActive', 'Active') : t('warehouses.statusInactive', 'Inactive')}
                                            </span>
                                        </div>
                                        <div className="mt-2 space-y-2 mb-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                                                <MapPin className="w-4 h-4 text-gray-400" /> {w.location || t('warehouses.noLocation', 'No Location Set')}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                                                <List className="w-4 h-4 text-gray-400" /> {t('warehouses.capText', 'Capacity')}: {w.capacity.toLocaleString()} {t('warehouses.unitsText', 'Units')}
                                            </div>
                                        </div>
                                        <div className="mt-auto border-t border-gray-100 pt-4 flex justify-between items-center text-sm font-semibold text-gray-500">
                                            <span>{t('warehouses.managerText', 'Manager')}: {w.managerDetails?.name || t('warehouses.unassigned', 'Unassigned')}</span>
                                        </div>
                                    </div>
                                )) : <div className="col-span-3 text-center text-gray-500 p-8 border border-dashed rounded-xl">{t('warehouses.noWarehouses', 'No warehouses defined. Add one to enable multi-location tracking.')}</div>}
                            </div>
                        </div>
                    )}

                    {/* LEDGER TAB */}
                    {activeTab === 'ledger' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-gray-900">{t('warehouses.ledgerTitle', 'Immutable Stock Ledger')}</h2>
                                <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">{t('warehouses.recentText', 'Recent')} {ledger.length} {t('warehouses.entriesText', 'entries')}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-start border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                            <th className="p-4 font-semibold">{t('warehouses.colDate', 'Date')}</th>
                                            <th className="p-4 font-semibold">{t('warehouses.colRef', 'Reference')}</th>
                                            <th className="p-4 font-semibold">{t('warehouses.colType', 'Type')}</th>
                                            <th className="p-4 font-semibold">{t('warehouses.colVariant', 'Variant (SKU)')}</th>
                                            <th className="p-4 font-semibold text-end">{t('warehouses.colQty', 'Qty')}</th>
                                            <th className="p-4 font-semibold">{t('warehouses.colLocation', 'Location')}</th>
                                            <th className="p-4 font-semibold">{t('warehouses.colNotes', 'Notes')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {ledger.map(entry => (
                                            <tr key={entry._id} className="hover:bg-gray-50/50">
                                                <td className="p-4 text-gray-500 font-medium">{moment(entry.createdAt).format('DD MMM, HH:mm')}</td>
                                                <td className="p-4 font-mono text-xs font-bold text-indigo-600">{entry.referenceId}</td>
                                                <td className="p-4">
                                                    <span className={clsx("px-2 py-1 text-xs font-bold rounded-md",
                                                        entry.type === 'RESTOCK' ? 'bg-green-100 text-green-700' :
                                                            entry.type === 'DEDUCTION' ? 'bg-red-100 text-red-700' :
                                                                entry.type === 'RESERVATION' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                    )}>{entry.type}</span>
                                                </td>
                                                <td className="p-4 font-semibold text-gray-900">{entry.variantId?.sku || t('warehouses.delVariant', 'Deleted Variant')}</td>
                                                <td className="p-4 text-end">
                                                    <span className={clsx("font-bold flex items-center justify-end gap-1", entry.quantity >= 0 ? 'text-green-600' : 'text-red-600')}>
                                                        {entry.quantity >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                        {Math.abs(entry.quantity)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-600 font-medium">{entry.warehouseId?.name || t('warehouses.virtLoc', 'Virtual / Unassigned')}</td>
                                                <td className="p-4 text-gray-500 text-xs">{entry.notes || t('warehouses.noNotes', '-')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {ledger.length === 0 && <div className="p-8 text-center text-gray-500">{t('warehouses.noLedger', 'No movement data found.')}</div>}
                            </div>
                        </div>
                    )}

                    {/* SUPPLIERS TAB */}
                    {activeTab === 'suppliers' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {suppliers.map(s => (
                                <div key={s._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col hover:border-gray-300">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">{s.name}</h3>
                                            <p className="text-sm font-medium text-gray-500 border-b border-gray-100 pb-2 inline-block">{t('warehouses.codeText', 'Code')}: {s.code}</p>
                                        </div>
                                        <span className={clsx("px-2 py-1 rounded-md text-xs font-bold", s.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                            {s.active ? t('warehouses.statusActive', 'Active') : t('warehouses.statusInactive', 'Inactive')}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div className="text-xs text-gray-500 font-bold mb-1">{t('warehouses.leadTimeText', 'Lead Time')}</div>
                                            <div className="text-xl font-bold text-gray-900">{s.averageLeadTimeDays} <span className="text-xs text-gray-500">{t('warehouses.daysText', 'Days')}</span></div>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div className="text-xs text-gray-500 font-bold mb-1">{t('warehouses.reliabilityText', 'Reliability')}</div>
                                            <div className="text-xl font-bold text-blue-600">{s.reliabilityScore}%</div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600 font-medium flex gap-2 items-center">
                                        <AlertTriangle className="w-4 h-4 text-orange-400" /> {t('warehouses.defectRate', 'Defect Rate')}: {s.defectRatePercentage}%
                                    </div>
                                </div>
                            ))}
                            {suppliers.length === 0 && <div className="col-span-3 p-8 text-center text-gray-500 border border-dashed rounded-xl">{t('warehouses.noTrackableSuppliers', 'No suppliers trackable. Use the main Inventory tab to add Vendors.')}</div>}
                        </div>
                    )}
                </>
            )}

            {/* Modal: Add Warehouse */}
            {isWarehouseModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between">
                            <h2 className="text-lg font-bold">{t('warehouses.regTitle', 'Register Warehouse')}</h2>
                        </div>
                        <form onSubmit={handleCreateWarehouse} className="p-6 flex flex-col gap-4">
                            <div><label className="block text-sm font-semibold text-gray-700 mb-1">{t('warehouses.nameLabel', 'Warehouse Name')}</label><input type="text" required value={warehouseForm.name} onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-100 outline-none" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">{t('warehouses.codeLabel', 'Code')}</label><input type="text" required value={warehouseForm.code} onChange={e => setWarehouseForm({ ...warehouseForm, code: e.target.value })} className="w-full border rounded-lg p-2 uppercase focus:ring-2 focus:ring-indigo-100 outline-none" /></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">{t('warehouses.capLabel', 'Capacity')}</label><input type="number" required value={warehouseForm.capacity} onChange={e => setWarehouseForm({ ...warehouseForm, capacity: Number(e.target.value) })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-100 outline-none" /></div>
                            </div>
                            <div><label className="block text-sm font-semibold text-gray-700 mb-1">{t('warehouses.locLabel', 'Location / Address')}</label><input type="text" value={warehouseForm.location} onChange={e => setWarehouseForm({ ...warehouseForm, location: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-100 outline-none" /></div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setIsWarehouseModalOpen(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg">{t('warehouses.btnCancel', 'Cancel')}</button>
                                <button type="submit" className="px-5 py-2 font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{t('warehouses.btnSave', 'Save Warehouse')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
