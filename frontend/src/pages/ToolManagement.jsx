import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Wrench, Settings, AlertCircle, Plus, CheckCircle2, Clock, Calendar, Hash, User, FileText } from 'lucide-react';
import moment from 'moment';

export default function ToolManagement() {
    const { t } = useTranslation();
    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
    const [selectedTool, setSelectedTool] = useState(null);

    // Form stuff
    const [newTool, setNewTool] = useState({ name: '', category: 'Hand Tool', serialNumber: '', status: 'Operational', assignedTo: '' });
    const [maintenanceRecord, setMaintenanceRecord] = useState({ note: '', status: '' });
    const [employees, setEmployees] = useState([]);

    const fetchTools = async () => {
        try {
            setLoading(true);
            const [toolsRes, empRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL || ''}/api/tools`),
                axios.get(`${import.meta.env.VITE_API_URL || ''}/api/hr/employees`)
            ]);
            setTools(toolsRes.data);
            setEmployees(empRes.data);
        } catch (error) {
            console.error('Error fetching tools:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTools();
    }, []);

    const handleSaveTool = async () => {
        try {
            const payload = { ...newTool };
            if (payload.assignedTo === '') payload.assignedTo = null;

            if (selectedTool) {
                await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/tools/${selectedTool._id}`, payload);
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/tools`, payload);
            }
            fetchTools();
            setModalOpen(false);
        } catch (error) {
            alert('Failed to save tool: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleSaveMaintenance = async () => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/tools/${selectedTool._id}/maintenance`, {
                note: maintenanceRecord.note,
                status: maintenanceRecord.status || selectedTool.status
            });
            fetchTools();
            setMaintenanceModalOpen(false);
        } catch (error) {
            alert('Failed to log maintenance');
        }
    };

    const openToolModal = (tool = null) => {
        if (tool) {
            setSelectedTool(tool);
            setNewTool({
                name: tool.name,
                category: tool.category,
                serialNumber: tool.serialNumber || '',
                status: tool.status,
                assignedTo: tool.assignedTo?._id || ''
            });
        } else {
            setSelectedTool(null);
            setNewTool({ name: '', category: 'Hand Tool', serialNumber: '', status: 'Operational', assignedTo: '' });
        }
        setModalOpen(true);
    };

    const openMaintenanceModal = (tool) => {
        setSelectedTool(tool);
        setMaintenanceRecord({ note: '', status: tool.status });
        setMaintenanceModalOpen(true);
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Operational': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'Needs Maintenance': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Under Repair': return 'bg-rose-100 text-rose-800 border-rose-200';
            case 'Decommissioned': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="p-8 pb-32">
            {/* Header & Action */}
            <div className="flex justify-between items-start mb-8 border-b border-gray-200 pb-5">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Wrench className="w-8 h-8 text-slate-600" />
                        {t('tools.title', 'Tool Management & Machinery')}
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">Track operational status, assignments, and repair history</p>
                </div>
                <button
                    onClick={() => openToolModal()}
                    className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-900 transition-all shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    {t('tools.addNew', 'Register Tool')}
                </button>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl"><Wrench className="w-6 h-6 text-slate-600" /></div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Total Registered</p>
                        <p className="text-2xl font-black text-gray-900">{tools.length}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Operational</p>
                        <p className="text-2xl font-black text-gray-900">{tools.filter(t => t.status === 'Operational').length}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-xl"><AlertCircle className="w-6 h-6 text-amber-600" /></div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Needs Maintenance</p>
                        <p className="text-2xl font-black text-gray-900">{tools.filter(t => t.status === 'Needs Maintenance').length}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-rose-50 rounded-xl"><Settings className="w-6 h-6 text-rose-600" /></div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Under Repair</p>
                        <p className="text-2xl font-black text-gray-900">{tools.filter(t => t.status === 'Under Repair').length}</p>
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-start text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-gray-200">
                        <tr>
                            <th className="p-4 text-left">Equipment Name</th>
                            <th className="p-4 text-left">Category & S/N</th>
                            <th className="p-4 text-left">Status</th>
                            <th className="p-4 text-left">Assigned To</th>
                            <th className="p-4 text-left">Last Maintenance</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading tools...</td></tr>}
                        {!loading && tools.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-500">No machinery registered.</td></tr>}
                        {tools.map(tool => (
                            <tr key={tool._id} className="border-b border-gray-100 hover:bg-slate-50/50 transition-colors">
                                <td className="p-4">
                                    <div className="font-bold text-gray-900">{tool.name}</div>
                                </td>
                                <td className="p-4">
                                    <div className="text-gray-900 font-medium">{tool.category}</div>
                                    <div className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                        <Hash className="w-3 h-3" /> {tool.serialNumber || 'N/A'}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2.5 py-1 text-[11px] font-black tracking-wide rounded-full border ${getStatusStyle(tool.status)}`}>
                                        {tool.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {tool.assignedTo ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                {tool.assignedTo.name.charAt(0)}
                                            </div>
                                            <span className="font-medium text-gray-900">{tool.assignedTo.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-sm">Unassigned</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1.5 text-gray-600">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <span>{tool.lastMaintenanceDate ? moment(tool.lastMaintenanceDate).format('MMM Do YYYY') : 'Never'}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => openMaintenanceModal(tool)} className="p-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200" title="Log Maintenance">
                                            <Settings className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => openToolModal(tool)} className="p-2 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200" title="Edit Tool">
                                            <FileText className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Tool Registration Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-black text-gray-900">{selectedTool ? 'Edit Tool' : 'Register New Tool'}</h2>
                            <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tool/Machinery Name</label>
                                <input type="text" value={newTool.name} onChange={e => setNewTool({ ...newTool, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-slate-500 focus:ring-0 outline-none" placeholder="e.g. Belt Grinder 2x72" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                                    <select value={newTool.category} onChange={e => setNewTool({ ...newTool, category: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200">
                                        <option>Grinder</option><option>Forge</option><option>Press</option><option>Hand Tool</option><option>Testing Equipment</option><option>Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Serial Number</label>
                                    <input type="text" value={newTool.serialNumber} onChange={e => setNewTool({ ...newTool, serialNumber: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                                    <select value={newTool.status} onChange={e => setNewTool({ ...newTool, status: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200">
                                        <option>Operational</option><option>Needs Maintenance</option><option>Under Repair</option><option>Decommissioned</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Assigned To</label>
                                    <select value={newTool.assignedTo} onChange={e => setNewTool({ ...newTool, assignedTo: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200">
                                        <option value="">-- Unassigned --</option>
                                        {employees.map(emp => (
                                            <option key={emp._id} value={emp._id}>{emp.name} ({emp.workshopRole || emp.role})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleSaveTool} className="px-5 py-2.5 font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow transition-colors">Save Equipment</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Maintenance Modal */}
            {maintenanceModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-amber-50">
                            <h2 className="text-xl font-black text-amber-900 flex items-center gap-2"><Settings className="w-5 h-5" /> Log Maintenance</h2>
                            <button onClick={() => setMaintenanceModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Target Equipment</span>
                                <span className="font-bold text-gray-900">{selectedTool?.name}</span>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Update Status</label>
                                <select value={maintenanceRecord.status} onChange={e => setMaintenanceRecord({ ...maintenanceRecord, status: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200">
                                    <option>Operational</option><option>Needs Maintenance</option><option>Under Repair</option><option>Decommissioned</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Service Notes</label>
                                <textarea value={maintenanceRecord.note} onChange={e => setMaintenanceRecord({ ...maintenanceRecord, note: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 resize-none h-24" placeholder="e.g. Replaced the main drive belt and re-calibrated tracking."></textarea>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setMaintenanceModalOpen(false)} className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleSaveMaintenance} className="px-5 py-2.5 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow transition-colors">Log Maintenance</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
