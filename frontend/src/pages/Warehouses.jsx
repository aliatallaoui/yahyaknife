import { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { useHotkey } from '../hooks/useHotkey';
import { Box, MapPin, Search, Plus, List, ArrowRightLeft, ShieldCheck, ArrowDown, ArrowUp, AlertTriangle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import clsx from 'clsx';
import { fmtShortDateTime } from '../utils/dateUtils';
import { useTranslation } from 'react-i18next';

export default function Warehouses() {
    const { token, hasPermission } = useContext(AuthContext);
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('warehouses'); // 'warehouses', 'ledger', 'suppliers'

    // Data State
    const [warehouses, setWarehouses] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    // Modals
    const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
    const [warehouseForm, setWarehouseForm] = useState({ name: '', code: '', location: '', capacity: 1000, type: 'Main' });
    const [warehouseError, setWarehouseError] = useState(null);
    const [fetchError, setFetchError] = useState(null);

    // Escape key to close warehouse modal
    useEffect(() => {
        if (!isWarehouseModalOpen) return;
        const handler = (e) => { if (e.key === 'Escape') setIsWarehouseModalOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isWarehouseModalOpen]);

    const fetchData = async (signal) => {
        if (!token) return;
        setLoading(true);
        setFetchError(null);
        try {
            const opts = signal ? { signal } : {};
            const [wRes, lRes, sRes] = await Promise.all([
                apiFetch(`/api/inventory/warehouses`, opts),
                apiFetch(`/api/inventory/ledger`, opts),
                apiFetch(`/api/inventory/suppliers`, opts)
            ]);
            if (!wRes.ok || !lRes.ok || !sRes.ok) throw new Error('fetch failed');
            setWarehouses(await wRes.json());
            setLedger(await lRes.json());
            setSuppliers(await sRes.json());
        } catch (error) {
            setFetchError(t('warehouses.fetchError', 'Failed to load warehouse data. Check your connection and refresh.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line
    }, [token]);

    const handleCreateWarehouse = async (e) => {
        e.preventDefault();
        setWarehouseError(null);
        try {
            const res = await apiFetch(`/api/inventory/warehouses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(warehouseForm)
            });
            if (res.ok) {
                fetchData();
                setIsWarehouseModalOpen(false);
                setWarehouseForm({ name: '', code: '', location: '', capacity: 1000, type: 'Main' });
            } else {
                const data = await res.json().catch(() => ({}));
                setWarehouseError(data.message || t('warehouses.saveError', 'Failed to save warehouse. Please try again.'));
            }
        } catch (error) {
            setWarehouseError(t('warehouses.saveError', 'Failed to save warehouse. Please try again.'));
        }
    };

    const filteredWarehouses = useMemo(() => {
        if (!searchTerm.trim()) return warehouses;
        const q = searchTerm.toLowerCase();
        return warehouses.filter(w => w.name?.toLowerCase().includes(q) || w.code?.toLowerCase().includes(q) || w.location?.toLowerCase().includes(q));
    }, [warehouses, searchTerm]);
    const filteredLedger = useMemo(() => {
        if (!searchTerm.trim()) return ledger;
        const q = searchTerm.toLowerCase();
        return ledger.filter(e => e.referenceId?.toLowerCase().includes(q) || e.variantId?.sku?.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q));
    }, [ledger, searchTerm]);
    const filteredSuppliers = useMemo(() => {
        if (!searchTerm.trim()) return suppliers;
        const q = searchTerm.toLowerCase();
        return suppliers.filter(s => s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q));
    }, [suppliers, searchTerm]);

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1400px]">
            {/* Header & Stats */}
            {/* Header & Stats */}
            <PageHeader
                title={t('warehouses.title', 'Enterprise Logistics')}
                subtitle={t('warehouses.subtitle', 'Manage Multi-Warehouse operations, Movement ledgers, and Supplier SLAs.')}
                variant="inventory"
                actions={
                    <div className="flex flex-wrap gap-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-1 rounded-xl shadow-sm shadow-indigo-500/5">
                        <button onClick={() => setActiveTab('warehouses')} className={clsx("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'warehouses' ? 'bg-[#5D5DFF] text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700')}>
                            {t('warehouses.tabWarehouses', 'Warehouses')}
                        </button>
                        {hasPermission('inventory.view') && (
                            <button onClick={() => setActiveTab('ledger')} className={clsx("flex items-center gap-3 px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'ledger' ? 'bg-[#8B5CF6] text-white shadow-lg shadow-purple-500/20' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700')}>
                                <ArrowRightLeft className="w-4 h-4 shrink-0" /> {t('warehouses.tabLedger', 'Ledger')}
                            </button>
                        )}
                        {hasPermission('inventory.view') && (
                            <button onClick={() => setActiveTab('suppliers')} className={clsx("flex items-center gap-3 px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'suppliers' ? 'bg-[#10B981] text-white shadow-lg shadow-emerald-500/20' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700')}>
                                <ShieldCheck className="w-4 h-4 shrink-0" /> {t('warehouses.tabSuppliers', 'Suppliers')}
                            </button>
                        )}
                    </div>
                }
            />

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={fetchData} className="text-red-600 underline hover:no-underline text-xs font-bold">{t('common.retry', 'Retry')}</button>
                    <button onClick={() => setFetchError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 rounded-full animate-spin"></div></div>
            ) : (
                <>
                    {/* Search bar — shared across all tabs */}
                    <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={t('warehouses.search', 'Search... (Press /)')}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-700 border border-indigo-100 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium shadow-sm dark:text-gray-100"
                        />
                    </div>

                    {/* WAREHOUSES TAB */}
                    {activeTab === 'warehouses' && (
                        <div className="flex flex-col gap-6">
                            <div className="flex justify-end">
                                {hasPermission('inventory.adjust') && (
                                    <button onClick={() => setIsWarehouseModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-all">
                                        <Plus className="w-4 h-4" /> {t('warehouses.addWarehouseBtn', 'Add Warehouse')}
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                {filteredWarehouses.length > 0 ? filteredWarehouses.map(w => (
                                    <div key={w._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                                    {w.code}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 dark:text-white">{w.name}</h3>
                                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md inline-block mt-1">{w.type}</p>
                                                </div>
                                            </div>
                                            <span className={clsx("px-2 py-1 rounded-md text-xs font-bold", w.status === 'Active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400')}>
                                                {w.status === 'Active' ? t('warehouses.statusActive', 'Active') : t('warehouses.statusInactive', 'Inactive')}
                                            </span>
                                        </div>
                                        <div className="mt-2 space-y-2 mb-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
                                                <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" /> 
                                                {w.location ? (typeof w.location === 'string' ? w.location : [w.location.address, w.location.city, w.location.state, w.location.country].filter(Boolean).join(', ') || t('warehouses.noLocation', 'No Location Set')) : t('warehouses.noLocation', 'No Location Set')}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
                                                <List className="w-4 h-4 text-gray-400 dark:text-gray-500" /> {t('warehouses.capText', 'Capacity')}: {w.capacity.toLocaleString()} {t('warehouses.unitsText', 'Units')}
                                            </div>
                                        </div>
                                        <div className="mt-auto border-t border-gray-100 dark:border-gray-700 pt-4 flex justify-between items-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                                            <span>{t('warehouses.managerText', 'Manager')}: {w.managerDetails?.name || t('warehouses.unassigned', 'Unassigned')}</span>
                                        </div>
                                    </div>
                                )) : <div className="col-span-3 text-center text-gray-500 dark:text-gray-400 p-8 border border-dashed dark:border-gray-600 rounded-xl">{searchTerm.trim() ? t('warehouses.noMatch', 'No warehouses match your search.') : t('warehouses.noWarehouses', 'No warehouses defined. Add one to enable multi-location tracking.')}</div>}
                            </div>
                        </div>
                    )}

                    {/* LEDGER TAB */}
                    {activeTab === 'ledger' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('warehouses.ledgerTitle', 'Immutable Stock Ledger')}</h2>
                                <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-full">{t('warehouses.recentText', 'Recent')} {ledger.length} {t('warehouses.entriesText', 'entries')}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="cf-table">
                                    <thead>
                                        <tr>
                                            <th>{t('warehouses.colDate', 'Date')}</th>
                                            <th>{t('warehouses.colRef', 'Reference')}</th>
                                            <th>{t('warehouses.colType', 'Type')}</th>
                                            <th>{t('warehouses.colVariant', 'Variant (SKU)')}</th>
                                            <th className="text-end">{t('warehouses.colQty', 'Qty')}</th>
                                            <th>{t('warehouses.colLocation', 'Location')}</th>
                                            <th>{t('warehouses.colNotes', 'Notes')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLedger.map(entry => (
                                            <tr key={entry._id}>
                                                <td className="p-4 text-gray-500 dark:text-gray-400 font-medium">{fmtShortDateTime(entry.createdAt)}</td>
                                                <td className="p-4 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{entry.referenceId}</td>
                                                <td className="p-4">
                                                    <span className={clsx("px-2 py-1 text-xs font-bold rounded-md",
                                                        entry.type === 'RESTOCK' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                                            entry.type === 'DEDUCTION' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                                                entry.type === 'RESERVATION' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                    )}>{entry.type}</span>
                                                </td>
                                                <td className="p-4 font-semibold text-gray-900 dark:text-white">{entry.variantId?.sku || t('warehouses.delVariant', 'Deleted Variant')}</td>
                                                <td className="p-4 text-end">
                                                    <span className={clsx("font-bold flex items-center justify-end gap-1", entry.quantity >= 0 ? 'text-green-600' : 'text-red-600')}>
                                                        {entry.quantity >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                        {Math.abs(entry.quantity)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-600 dark:text-gray-400 font-medium">{entry.warehouseId?.name || t('warehouses.virtLoc', 'Virtual / Unassigned')}</td>
                                                <td className="p-4 text-gray-500 dark:text-gray-400 text-xs">{entry.notes || t('warehouses.noNotes', '-')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredLedger.length === 0 && <div className="p-8 text-center text-gray-500 dark:text-gray-400">{searchTerm.trim() ? t('warehouses.noMatch', 'No ledger entries match your search.') : t('warehouses.noLedger', 'No movement data found.')}</div>}
                            </div>
                        </div>
                    )}

                    {/* SUPPLIERS TAB */}
                    {activeTab === 'suppliers' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredSuppliers.map(s => (
                                <div key={s._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col hover:border-gray-300 dark:hover:border-gray-600">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{s.name}</h3>
                                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-2 inline-block">{t('warehouses.codeText', 'Code')}: {s.code}</p>
                                        </div>
                                        <span className={clsx("px-2 py-1 rounded-md text-xs font-bold", s.active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400')}>
                                            {s.active ? t('warehouses.statusActive', 'Active') : t('warehouses.statusInactive', 'Inactive')}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-bold mb-1">{t('warehouses.leadTimeText', 'Lead Time')}</div>
                                            <div className="text-xl font-bold text-gray-900 dark:text-white">{s.averageLeadTimeDays} <span className="text-xs text-gray-500 dark:text-gray-400">{t('warehouses.daysText', 'Days')}</span></div>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-bold mb-1">{t('warehouses.reliabilityText', 'Reliability')}</div>
                                            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{s.reliabilityScore}%</div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 font-medium flex gap-2 items-center">
                                        <AlertTriangle className="w-4 h-4 text-orange-400" /> {t('warehouses.defectRate', 'Defect Rate')}: {s.defectRatePercentage}%
                                    </div>
                                </div>
                            ))}
                            {filteredSuppliers.length === 0 && <div className="col-span-3 p-8 text-center text-gray-500 dark:text-gray-400 border border-dashed dark:border-gray-600 rounded-xl">{searchTerm.trim() ? t('warehouses.noMatch', 'No suppliers match your search.') : t('warehouses.noTrackableSuppliers', 'No suppliers trackable. Use the main Inventory tab to add Vendors.')}</div>}
                        </div>
                    )}
                </>
            )}

            {/* Modal: Add Warehouse */}
            {isWarehouseModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 flex justify-between">
                            <h2 className="text-lg font-bold dark:text-white">{t('warehouses.regTitle', 'Register Warehouse')}</h2>
                        </div>
                        <form onSubmit={handleCreateWarehouse} className="p-6 flex flex-col gap-4">
                            {warehouseError && (
                                <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{warehouseError}</span>
                                </div>
                            )}
                            <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('warehouses.nameLabel', 'Warehouse Name')}</label><input type="text" required value={warehouseForm.name} onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })} className="w-full border dark:border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-100 outline-none dark:bg-gray-700 dark:text-gray-100" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('warehouses.codeLabel', 'Code')}</label><input type="text" required value={warehouseForm.code} onChange={e => setWarehouseForm({ ...warehouseForm, code: e.target.value })} className="w-full border rounded-lg p-2 uppercase focus:ring-2 focus:ring-indigo-100 outline-none" /></div>
                                <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('warehouses.capLabel', 'Capacity')}</label><input type="number" required value={warehouseForm.capacity} onChange={e => setWarehouseForm({ ...warehouseForm, capacity: Number(e.target.value) })} className="w-full border dark:border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-100 outline-none dark:bg-gray-700 dark:text-gray-100" /></div>
                            </div>
                            <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('warehouses.locLabel', 'Location / Address')}</label><input type="text" value={warehouseForm.location} onChange={e => setWarehouseForm({ ...warehouseForm, location: e.target.value })} className="w-full border dark:border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-indigo-100 outline-none dark:bg-gray-700 dark:text-gray-100" /></div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => { setIsWarehouseModalOpen(false); setWarehouseError(null); }} className="px-5 py-2 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">{t('warehouses.btnCancel', 'Cancel')}</button>
                                <button type="submit" className="px-5 py-2 font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{t('warehouses.btnSave', 'Save Warehouse')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
