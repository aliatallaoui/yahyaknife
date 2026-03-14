import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useModalDismiss from '../../hooks/useModalDismiss';

const CHANNELS = ['Organic Search', 'Direct Traffic', 'Social Media', 'Referral', 'Paid Ads', 'Other'];
const STATUSES = ['Active', 'Inactive', 'Churned'];

export default function CustomerModal({ isOpen, onClose, onSubmit, initialData }) {
    const { t } = useTranslation();
    const { backdropProps, panelProps } = useModalDismiss(onClose);
    const isEdit = !!initialData;

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [acquisitionChannel, setAcquisitionChannel] = useState('Organic Search');
    const [status, setStatus] = useState('Active');

    useEffect(() => {
        if (isOpen) {
            if (isEdit && initialData) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setName(initialData.name);
                setEmail(initialData.email);
                setPhone(initialData.phone || '');
                setAddress(initialData.address || '');
                setAcquisitionChannel(initialData.acquisitionChannel || 'Organic Search');
                setStatus(initialData.status || 'Active');
            } else {
                setName('');
                setEmail('');
                setPhone('');
                setAddress('');
                setAcquisitionChannel('Organic Search');
                setStatus('Active');
            }
        }
    }, [isOpen, isEdit, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ name, email, phone, address, acquisitionChannel, status });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" {...backdropProps}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md flex flex-col" {...panelProps}>
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {isEdit ? t('modals.custTitleEdit', 'Edit Customer') : t('modals.custTitleAdd', 'Add New Customer')}
                    </h2>
                    <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <form id="customerForm" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="cust-name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('modals.custName', 'Name')}</label>
                            <input
                                id="cust-name"
                                required
                                type="text"
                                autoComplete="name"
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-4 py-2 text-sm dark:text-gray-100 focus:border-blue-500 transition-colors"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="cust-email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('modals.custEmail', 'Email')}</label>
                            <input
                                id="cust-email"
                                required
                                type="email"
                                autoComplete="email"
                                dir="ltr"
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-4 py-2 text-sm dark:text-gray-100 focus:border-blue-500 transition-colors"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                disabled={isEdit}
                            />
                        </div>
                        <div>
                            <label htmlFor="cust-phone" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('modals.custPhone', 'Phone Number (*COD Required)')}</label>
                            <input
                                id="cust-phone"
                                required
                                type="tel"
                                autoComplete="tel"
                                dir="ltr"
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-4 py-2 text-sm dark:text-gray-100 focus:border-blue-500 transition-colors"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder={t('modals.custPhonePlaceholder', '05XX XX XX XX')}
                            />
                        </div>
                        <div>
                            <label htmlFor="cust-address" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('modals.custAddress', 'Delivery Address')}</label>
                            <input
                                id="cust-address"
                                type="text"
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-4 py-2 text-sm dark:text-gray-100 focus:border-blue-500 transition-colors"
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                placeholder={t('modals.custAddressPlaceholder', 'City, Region, exact street...')}
                            />
                        </div>
                        <div>
                            <label htmlFor="cust-channel" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('modals.custAcqChannel', 'Acquisition Channel')}</label>
                            <select
                                id="cust-channel"
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-4 py-2 text-sm dark:text-gray-100 focus:border-blue-500 transition-colors appearance-none"
                                value={acquisitionChannel}
                                onChange={e => setAcquisitionChannel(e.target.value)}
                            >
                                {CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="cust-status" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('modals.custStatus', 'Status')}</label>
                            <select
                                id="cust-status"
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 outline-none rounded-lg px-4 py-2 text-sm dark:text-gray-100 focus:border-blue-500 transition-colors appearance-none"
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                            >
                                {STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl transition-colors">
                        {t('modals.btnCancel', 'Cancel')}
                    </button>
                    <button type="submit" form="customerForm" className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/20 transition-all">
                        {isEdit ? t('modals.btnSave', 'Save Changes') : t('modals.custBtnCreate', 'Create Customer')}
                    </button>
                </div>
            </div>
        </div>
    );
}
