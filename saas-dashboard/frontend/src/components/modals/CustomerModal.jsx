import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const CHANNELS = ['Organic Search', 'Direct Traffic', 'Social Media', 'Referral', 'Paid Ads', 'Other'];
const STATUSES = ['Active', 'Inactive', 'Churned'];

export default function CustomerModal({ isOpen, onClose, onSubmit, initialData }) {
    const isEdit = !!initialData;

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [acquisitionChannel, setAcquisitionChannel] = useState('Organic Search');
    const [status, setStatus] = useState('Active');

    useEffect(() => {
        if (isOpen) {
            if (isEdit && initialData) {
                setName(initialData.name);
                setEmail(initialData.email);
                setAcquisitionChannel(initialData.acquisitionChannel || 'Organic Search');
                setStatus(initialData.status || 'Active');
            } else {
                setName('');
                setEmail('');
                setAcquisitionChannel('Organic Search');
                setStatus('Active');
            }
        }
    }, [isOpen, isEdit, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ name, email, acquisitionChannel, status });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEdit ? 'Edit Customer' : 'Add New Customer'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <form id="customerForm" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                            <input
                                required
                                type="email"
                                className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                disabled={isEdit} // Often don't want to change email easily or use it as ID
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Acquisition Channel</label>
                            <select
                                className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none"
                                value={acquisitionChannel}
                                onChange={e => setAcquisitionChannel(e.target.value)}
                            >
                                {CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                            <select
                                className="w-full bg-gray-50 border border-gray-200 outline-none rounded-lg px-4 py-2 text-sm focus:border-blue-500 transition-colors appearance-none"
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                            >
                                {STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="customerForm" className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/20 transition-all">
                        {isEdit ? 'Save Changes' : 'Create Customer'}
                    </button>
                </div>
            </div>
        </div>
    );
}
