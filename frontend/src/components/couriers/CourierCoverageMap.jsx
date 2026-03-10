import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, Trash2, Home, Building2, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

export default function CourierCoverageMap({ courierId }) {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    const [coverage, setCoverage] = useState([]);
    const [loading, setLoading] = useState(true);

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
            alert(error.response?.data?.message || 'Error adding coverage region');
        }
    };

    const handleDelete = async (coverageId) => {
        if (!window.confirm('Delete this coverage region?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${import.meta.env.VITE_API_URL || ''}/api/couriers/${courierId}/coverage/${coverageId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCoverage();
        } catch (error) {
            console.error('Error deleting coverage:', error);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Regions...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-indigo-500" />
                    {t('couriers.add_region', 'Add Coverage Region')}
                </h3>
                
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
                            <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5"><Home className="w-4 h-4 text-gray-400" /> Home</span>
                        </label>
                        
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.officeSupported}
                                onChange={e => setFormData({ ...formData, officeSupported: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-gray-400" /> Office (Stop Desk)</span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </form>

                <div className="mt-8 border border-gray-200 rounded-lg overflow-hidden">
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
                            {coverage.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                                        No specific coverage configured. Default assumptions will apply depending on Courier integration level.
                                    </td>
                                </tr>
                            ) : (
                                coverage.map(c => (
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

            </div>
        </div>
    );
}
