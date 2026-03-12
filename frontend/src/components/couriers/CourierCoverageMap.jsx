import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, Trash2, Home, Building2, HelpCircle, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

export default function CourierCoverageMap({ courierId }) {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    const [coverage, setCoverage] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(null); // coverageId
    const [confirmSync, setConfirmSync] = useState(false);

    const [formData, setFormData] = useState({
        wilayaCode: '',
        commune: '',
        homeSupported: true,
        officeSupported: false
    });

    useEffect(() => {
        if (courierId && courierId !== 'new') {
            fetchCoverage();
        } else {
            setLoading(false);
        }
    }, [courierId]);

    const fetchCoverage = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${courierId}/coverage`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCoverage(res.data);
        } catch (error) {
            console.error('Error fetching coverage:', error);
            setErrorMsg(error.response?.data?.message || t('couriers.loadCoverageFailed', 'Failed to load coverage regions.'));
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${courierId}/coverage`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Reset form partly
            setFormData({
                ...formData,
                commune: '' // Keep wilaya the same to allow rapid entry
            });
            fetchCoverage();
        } catch (error) {
            console.error('Error adding coverage:', error);
            setErrorMsg(error.response?.data?.message || t('couriers.addCoverageFailed', 'Error adding coverage region'));
        }
    };

    const handleDelete = (coverageId) => setConfirmDelete(coverageId);

    const confirmDeleteCoverage = async () => {
        const coverageId = confirmDelete;
        setConfirmDelete(null);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${courierId}/coverage/${coverageId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCoverage();
        } catch (error) {
            console.error('Error deleting coverage:', error);
            setErrorMsg(t('couriers.deleteCoverageFailed', 'Failed to delete coverage region.'));
        }
    };

    const handleSync = () => setConfirmSync(true);

    const confirmSyncCoverage = async () => {
        setConfirmSync(false);
        setSyncing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${courierId}/coverage/sync`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuccessMsg(res.data.message || 'Sync successful');
            fetchCoverage();
        } catch (error) {
            console.error('Error syncing coverage:', error);
            setErrorMsg(error.response?.data?.message || error.response?.data?.error || t('couriers.syncCoverageFailed', 'Error syncing coverage. Check API credentials.'));
        } finally {
            setSyncing(false);
        }
    };

    // Filter and Pagination Logic
    const filteredCoverage = coverage.filter(c => 
        (c.commune || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.wilayaCode || '').toString().includes(searchTerm)
    );

    const totalPages = Math.ceil(filteredCoverage.length / itemsPerPage);
    const currentCoverage = filteredCoverage.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">{t('common.loading', 'Loading...')}</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Error / Success banners */}
            {errorMsg && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{errorMsg}</span>
                    <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600">✕</button>
                </div>
            )}
            {successMsg && (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{successMsg}</span>
                    <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600">✕</button>
                </div>
            )}
            {/* Delete coverage confirm */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="font-bold text-gray-900">{t('couriers.deleteCoverageConfirm', 'Delete this coverage region?')}</h3>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">{t('common.cancel', 'Cancel')}</button>
                            <button onClick={confirmDeleteCoverage} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors">{t('common.delete', 'Delete')}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Sync confirm */}
            {confirmSync && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                <RefreshCw className="w-5 h-5 text-indigo-600" />
                            </div>
                            <h3 className="font-bold text-gray-900">{t('couriers.btnSyncCoverage', 'Sync API Coverage')}</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-5 ms-[52px]">{t('couriers.confirmSync', 'This will fetch all supported wilayas and communes from the Courier API and overwrite/add to your current coverage map. It may take a few seconds.')}</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmSync(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">{t('common.cancel', 'Cancel')}</button>
                            <button onClick={confirmSyncCoverage} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors">{t('common.continue', 'Continue')}</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 text-start">
                <HelpCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-emerald-900">{t('couriers.coverage_info', 'Dynamic Area Validation')}</h4>
                    <p className="text-xs text-emerald-700 mt-1">
                        {t('couriers.coverage_desc', 'During Order Creation, the user will only see the Communes configured here if they select this courier. Furthermore, if they select "Stop Desk/Office", only communes with Office delivery checked will be displayed.')}
                    </p>
                </div>
            </div>

            <div className="bg-white border text-start border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-indigo-500" />
                        {t('couriers.add_region', 'Add Coverage Region')}
                    </h3>
                    
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-lg transition-colors border border-indigo-100 text-sm disabled:opacity-50"
                    >
                        <RefreshCw className={clsx("w-4 h-4", syncing && "animate-spin")} />
                        {syncing ? t('couriers.btnSyncing', 'Syncing API...') : t('couriers.btnSyncCoverage', 'Sync API Coverage')}
                    </button>
                </div>
                
                <form onSubmit={handleAdd} className="flex flex-col md:flex-row items-end gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="w-full md:w-32">
                        <label className="block text-xs font-bold text-gray-600 mb-1">{t('couriers.wilayaCode', 'Wilaya Code')}</label>
                        <input
                            type="text"
                            required
                            value={formData.wilayaCode}
                            onChange={e => setFormData({ ...formData, wilayaCode: e.target.value })}
                            className="w-full text-sm rounded-lg border-gray-300 shadow-sm p-2 border"
                            placeholder="16"
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-gray-600 mb-1">{t('couriers.commune', 'Commune')}</label>
                        <input
                            type="text"
                            required
                            value={formData.commune}
                            onChange={e => setFormData({ ...formData, commune: e.target.value })}
                            className="w-full text-sm rounded-lg border-gray-300 shadow-sm p-2 border"
                            placeholder="Alger Centre"
                        />
                    </div>
                    
                    <div className="flex gap-4 mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.homeSupported}
                                onChange={e => setFormData({ ...formData, homeSupported: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5"><Home className="w-4 h-4 text-gray-400" /> {t('couriers.homeDelivery', 'Home')}</span>
                        </label>
                        
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.officeSupported}
                                onChange={e => setFormData({ ...formData, officeSupported: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-gray-400" /> {t('couriers.officeDelivery', 'Office (Stop Desk)')}</span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </form>

                {/* Filter section */}
                {coverage.length > 0 && (
                    <div className="mt-8 mb-4 flex justify-between items-center">
                        <div className="w-full md:w-1/3">
                            <input
                                type="text"
                                placeholder={t('couriers.searchPlaceholder', 'Search by Commune or Wilaya Code...')}
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1); // Reset to first page on search
                                }}
                                className="w-full text-sm rounded-lg border-gray-300 shadow-sm p-2.5 bg-gray-50 border focus:bg-white transition-colors"
                            />
                        </div>
                        <div className="text-sm text-gray-500 font-bold">
                            {filteredCoverage.length} {t('couriers.regionsFound', 'Regions')}
                        </div>
                    </div>
                )}

                <div className={clsx("border border-gray-200 rounded-lg overflow-hidden", coverage.length === 0 ? "mt-8" : "mt-2")}>
                    <table className="w-full text-start rtl:text-right whitespace-nowrap text-sm">
                        <thead className="bg-gray-50/80 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 font-bold w-20">Wilaya</th>
                                <th className="px-4 py-3 font-bold">Commune</th>
                                <th className="px-4 py-3 font-bold text-center">Home Delv.</th>
                                <th className="px-4 py-3 font-bold text-center">Stop Desk</th>
                                <th className="px-4 py-3 font-bold text-center w-16">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentCoverage.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                                        {coverage.length === 0 
                                            ? "No specific coverage configured. Default assumptions will apply depending on Courier integration level."
                                            : "No coverage matches your search."}
                                    </td>
                                </tr>
                            ) : (
                                currentCoverage.map(c => (
                                    <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-black text-gray-900 bg-gray-50/50 text-center">{c.wilayaCode}</td>
                                        <td className="px-4 py-3 font-bold text-gray-700">{c.commune}</td>
                                        <td className="px-4 py-3 text-center">
                                            {c.homeSupported ? <span className="text-green-600 font-bold">Yes</span> : <span className="text-gray-300">No</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {c.officeSupported ? <span className="text-indigo-600 font-bold">Yes</span> : <span className="text-gray-300">No</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleDelete(c._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <span className="text-sm text-gray-600 ml-2">
                            {t('couriers.page_x_of_y', { x: currentPage, y: totalPages, defaultValue: `Page ${currentPage} of ${totalPages}` })}
                        </span>
                        
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 text-sm font-bold border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('common.prev', 'Previous')}
                            </button>
                            
                            <div className="flex items-center gap-1 mx-2">
                                {/* Only show a few page numbers to keep it clean */}
                                {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                                    // Complex logic just to show the immediate surrounding pages. Simple way:
                                    let pageNum = currentPage;
                                    if (currentPage <= 3) pageNum = idx + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + idx;
                                    else pageNum = currentPage - 2 + idx;
                                    
                                    if (pageNum < 1 || pageNum > totalPages) return null;

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => handlePageChange(pageNum)}
                                            className={clsx(
                                                "w-8 h-8 flex items-center justify-center text-sm font-bold rounded",
                                                currentPage === pageNum 
                                                    ? "bg-indigo-600 text-white" 
                                                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                                            )}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 text-sm font-bold border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('common.next', 'Next')}
                            </button>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
}
