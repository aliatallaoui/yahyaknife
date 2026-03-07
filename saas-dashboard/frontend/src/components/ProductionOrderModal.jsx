import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function ProductionOrderModal({ isOpen, onClose, onSubmit, initialData, variants = [], boms = [] }) {
    const isEdit = !!initialData;

    const [orderNumber, setOrderNumber] = useState('');
    const [variantId, setVariantId] = useState('');
    const [bomId, setBomId] = useState('');
    const [quantityPlanned, setQuantityPlanned] = useState('');
    const [startDate, setStartDate] = useState('');
    const [completionDate, setCompletionDate] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (isEdit && initialData) {
                setOrderNumber(initialData.orderNumber);
                setVariantId(initialData.variantId?._id || initialData.variantId || '');
                setBomId(initialData.bom?._id || initialData.bom || '');
                setQuantityPlanned(initialData.quantityPlanned || '');
                setStartDate(initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '');
                setCompletionDate(initialData.completionDate ? new Date(initialData.completionDate).toISOString().split('T')[0] : '');
                setNotes(initialData.notes || '');
            } else {
                setOrderNumber(`MFG-${Math.floor(Math.random() * 100000)}`);
                setVariantId('');
                setBomId('');
                setQuantityPlanned('');
                setStartDate(new Date().toISOString().split('T')[0]);
                setCompletionDate('');
                setNotes('');
            }
        }
    }, [isOpen, isEdit, initialData]);

    // Filter available BOMs based on selected variant
    const availableBoms = boms.filter(b => {
        const bId = b.variantId?._id || b.variantId;
        return bId === variantId;
    });

    // Auto-select BOM if there's only one for the chosen variant
    useEffect(() => {
        if (variantId && availableBoms.length === 1 && !bomId) {
            setBomId(availableBoms[0]._id);
        }
    }, [variantId, availableBoms, bomId]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        const payload = {
            orderNumber,
            variantId,
            bom: bomId,
            quantityPlanned: Number(quantityPlanned),
            startDate,
            completionDate,
            notes
        };

        onSubmit(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEdit ? 'Edit Production Order' : 'New Production Order'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <form id="poForm" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Order Number (Auto-Generated)</label>
                            <input required disabled type="text" className="w-full bg-gray-100 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm text-gray-500 font-mono" value={orderNumber} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Target Product Variant</label>
                                <select required className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={variantId} onChange={e => { setVariantId(e.target.value); setBomId(''); }}>
                                    <option value="" disabled>Select Variant...</option>
                                    {variants.map(v => (
                                        <option key={v.variantId || v._id} value={v.variantId || v._id}>
                                            {v.sku} - {v.displayName || v.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Target BOM Recipe</label>
                                <select required disabled={!variantId} className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors disabled:opacity-50" value={bomId} onChange={e => setBomId(e.target.value)}>
                                    <option value="" disabled>Select BOM version...</option>
                                    {availableBoms.map(b => (
                                        <option key={b._id} value={b._id}>
                                            v{b.version} ({b.components?.length || 0} mat.)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity Planned (Units)</label>
                            <input required type="number" min="1" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={quantityPlanned} onChange={e => setQuantityPlanned(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Expected Start Date</label>
                                <input required type="date" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Target Deadline</label>
                                <input type="date" className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors" value={completionDate} onChange={e => setCompletionDate(e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Production Notes</label>
                            <textarea rows="3" placeholder="Optional instructions or notes for the manufacturing team..." className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-yellow-500 transition-colors resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="poForm" className="px-5 py-2.5 text-sm font-semibold text-white bg-yellow-600 hover:bg-yellow-700 rounded-xl shadow-sm shadow-yellow-600/20 transition-all">
                        {isEdit ? 'Save Changes' : 'Start Production'}
                    </button>
                </div>
            </div>
        </div>
    );
}
