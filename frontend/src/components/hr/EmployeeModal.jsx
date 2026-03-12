import { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { XCircle, Banknote, AlertTriangle } from 'lucide-react';
import moment from 'moment';

const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function EmployeeModal({ employee, onClose, onSave }) {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);

    const [formData, setFormData] = useState({
        name: employee?.name || '',
        email: employee?.email || '',
        joinDate: employee?.joinDate ? moment(employee.joinDate).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD'),
        department: employee?.department || 'Manufacturing',
        role: employee?.role || '',
        workshopRole: employee?.workshopRole || 'None',
        status: employee?.status || 'Active',
        salary: employee?.salary || employee?.contractSettings?.monthlySalary || 0,
        dailyRequiredMinutes: employee?.contractSettings?.dailyRequiredMinutes || 480,
        morningStart: employee?.contractSettings?.schedule?.morningStart || '08:00',
        morningEnd: employee?.contractSettings?.schedule?.morningEnd || '12:00',
        eveningStart: employee?.contractSettings?.schedule?.eveningStart || '13:00',
        eveningEnd: employee?.contractSettings?.schedule?.eveningEnd || '17:00',
        workDays: employee?.contractSettings?.workDays?.map(d => daysMap.indexOf(d)).filter(i => i !== -1).join(',') || '0,1,2,3,4'
    });

    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const set = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const payload = {
            name: formData.name,
            email: formData.email,
            joinDate: formData.joinDate,
            department: formData.department,
            role: formData.role,
            workshopRole: formData.workshopRole,
            status: formData.status,
            salary: Number(formData.salary),
            contractSettings: {
                monthlySalary: Number(formData.salary),
                dailyRequiredMinutes: Number(formData.dailyRequiredMinutes),
                schedule: {
                    morningStart: formData.morningStart,
                    morningEnd: formData.morningEnd,
                    eveningStart: formData.eveningStart,
                    eveningEnd: formData.eveningEnd
                },
                workDays: formData.workDays.split(',').map(n => daysMap[Number(n)]).filter(Boolean)
            }
        };

        setSaveError(null);
        try {
            const base = import.meta.env.VITE_API_URL || '';
            const url = employee ? `${base}/api/hr/employees/${employee._id}` : `${base}/api/hr/employees`;
            const method = employee ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                onSave();
            } else {
                const data = await res.json().catch(() => ({}));
                setSaveError(data.message || t('hr.saveEmployeeError', 'Failed to save employee. Please try again.'));
            }
        } catch (err) {
            console.error(err);
            setSaveError(t('hr.saveEmployeeError', 'Failed to save employee. Please try again.'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex justify-center items-center overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-2xl my-8 p-6 shadow-2xl relative">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-gray-900">
                        {employee ? t('hr.editEmployeeTitle') : t('hr.addEmployeeTitle')}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblFullName')}</label>
                            <input required type="text" value={formData.name} onChange={e => set('name', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder={t('hr.namePlaceholder')} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblEmail')}</label>
                            <input required type="email" value={formData.email} onChange={e => set('email', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder={t('hr.emailPlaceholder')} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblStartDate', 'تاريخ البداية العمل')}</label>
                            <input required type="date" value={formData.joinDate} onChange={e => set('joinDate', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                        </div>
                    </div>

                    {/* Role & Status */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblDepartment')}</label>
                            <select value={formData.department} onChange={e => set('department', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none">
                                <option value="Manufacturing">{t('hr.deptManufacturing')}</option>
                                <option value="Warehouse">{t('hr.deptWarehouse')}</option>
                                <option value="Dispatch">{t('hr.deptDispatch')}</option>
                                <option value="Customer Support">{t('hr.deptCustomerSupport')}</option>
                                <option value="Engineering">{t('hr.deptEngineering')}</option>
                                <option value="Finance">{t('hr.deptFinance')}</option>
                                <option value="Sales">{t('hr.deptSales')}</option>
                                <option value="Marketing">{t('hr.deptMarketing')}</option>
                                <option value="HR">{t('hr.deptHR')}</option>
                                <option value="Design">{t('hr.deptDesign')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblRole')}</label>
                            <input required type="text" value={formData.role} onChange={e => set('role', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder={t('hr.rolePlaceholder')} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Workshop Role</label>
                            <select value={formData.workshopRole} onChange={e => set('workshopRole', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none">
                                <option value="None">None (Standard HR)</option>
                                <option value="Master Bladesmith">Master Bladesmith</option>
                                <option value="Grinder">Grinder</option>
                                <option value="Handle Maker">Handle Maker</option>
                                <option value="Finisher">Finisher</option>
                                <option value="Apprentice">Apprentice</option>
                                <option value="Packager">Packager</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('hr.lblStatus')}</label>
                            <select value={formData.status} onChange={e => set('status', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none">
                                <option value="Active">{t('hr.statusActive')}</option>
                                <option value="On Leave">{t('hr.statusOnLeave')}</option>
                                <option value="Terminated">{t('hr.statusTerminated')}</option>
                            </select>
                        </div>
                    </div>

                    {/* Contract & Schedule */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <h3 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                            <Banknote className="w-4 h-4" /> {t('hr.contractSchedule')}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-blue-800 mb-1">{t('hr.lblMonthlySalary')}</label>
                                <input required type="number" value={formData.salary} onChange={e => set('salary', e.target.value)} className="w-full bg-white border border-blue-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-blue-800 mb-1">{t('hr.lblRequiredMinutes')}</label>
                                <input required type="number" value={formData.dailyRequiredMinutes} onChange={e => set('dailyRequiredMinutes', e.target.value)} className="w-full bg-white border border-blue-200 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            {[
                                { label: t('hr.lblMorningIn'), key: 'morningStart' },
                                { label: t('hr.lblMorningOut'), key: 'morningEnd' },
                                { label: t('hr.lblEveningIn'), key: 'eveningStart' },
                                { label: t('hr.lblEveningOut'), key: 'eveningEnd' },
                            ].map(({ label, key }) => (
                                <div key={key}>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">{label}</label>
                                    <input type="time" value={formData[key]} onChange={e => set(key, e.target.value)} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-sm outline-none" />
                                </div>
                            ))}
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">{t('hr.lblActiveWorkDays')}</label>
                            <input type="text" value={formData.workDays} onChange={e => set('workDays', e.target.value)} className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none" placeholder="0,1,2,3,4" />
                            <p className="text-[10px] text-gray-400 mt-1">{t('hr.activeWorkDaysDesc')}</p>
                        </div>
                    </div>

                    {saveError && (
                        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{saveError}</span>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                            {t('hr.btnCancel')}
                        </button>
                        <button type="submit" disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md disabled:bg-blue-300">
                            {isSaving ? t('hr.savingText') : t('hr.btnSaveEmployee')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
