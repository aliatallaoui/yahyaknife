import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Camera, Mail, Phone, Building, Briefcase } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../utils/apiFetch';
import toast from 'react-hot-toast';

export default function SettingsProfile() {
    const { user, refetchUser } = useContext(AuthContext);
    const { t, i18n } = useTranslation('translation', { keyPrefix: 'settingsProfile' });
    const isAr = i18n.language === 'ar';

    const [name, setName] = useState(user?.name || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [jobTitle, setJobTitle] = useState(user?.jobTitle || '');
    const [saving, setSaving] = useState(false);

    const handleDiscard = () => {
        setName(user?.name || '');
        setPhone(user?.phone || '');
        setJobTitle(user?.jobTitle || '');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await apiFetch('/api/users/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, jobTitle })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed');
            toast.success(t('saveSuccess', 'Profile saved'));
            await refetchUser();
        } catch (err) {
            toast.error(err.message || t('saveError', 'Failed to save profile'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{t('title')}</h3>

            <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300 text-3xl border-4 border-white dark:border-gray-700 shadow-md">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                    <button className={clsx("absolute bottom-0 p-1.5 bg-white dark:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600 shadow-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors", isAr ? "left-0" : "right-0")}>
                        <Camera className="w-4 h-4" />
                    </button>
                </div>
                <div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{user?.name || t('user')}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user?.role || t('standardUser')}</p>
                    <button className="mt-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">{t('changePhoto')}</button>
                </div>
            </div>

            <form className="space-y-6 max-w-2xl" onSubmit={e => e.preventDefault()}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="prof-name" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('lblFullName')}</label>
                        <input id="prof-name" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500" />
                    </div>
                    <div>
                        <label htmlFor="prof-display" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('lblDisplayName')}</label>
                        <input id="prof-display" type="text" placeholder={t('phDisplayName')} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div>
                        <label htmlFor="prof-email" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {t('lblEmail')}</label>
                        <input id="prof-email" type="email" autoComplete="email" dir="ltr" disabled defaultValue={user?.email} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed" />
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{t('emailDesc')}</p>
                    </div>
                    <div>
                        <label htmlFor="prof-phone" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {t('lblPhone')}</label>
                        <input id="prof-phone" type="tel" autoComplete="tel" dir="ltr" placeholder={t('phPhone')} value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div>
                        <label htmlFor="prof-dept" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Building className="w-3.5 h-3.5" /> {t('lblDepartment')}</label>
                        <input id="prof-dept" type="text" disabled defaultValue={user?.department || t('deptOps')} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed" />
                    </div>
                    <div>
                        <label htmlFor="prof-job" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {t('lblJobTitle')}</label>
                        <input id="prof-job" type="text" placeholder={t('phJobTitle')} value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-gray-50/50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500" />
                    </div>
                </div>

                <div className={clsx("pt-6 flex gap-3", isAr ? "justify-start" : "justify-end")}>
                    <button type="button" onClick={handleDiscard} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-sm hover:bg-gray-200 dark:hover:bg-gray-600">{t('btnDiscard')}</button>
                    <button type="button" onClick={handleSave} disabled={saving} className={clsx("px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md hover:bg-indigo-700", saving && "opacity-50 cursor-not-allowed")}>
                        {saving ? t('btnSaving', 'Saving...') : t('btnSave')}
                    </button>
                </div>
            </form>
        </div>
    );
}
