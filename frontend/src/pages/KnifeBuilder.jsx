import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Layers, Zap, Hammer, ChevronRight, CheckCircle2, User, Loader2, ArrowRight, ArrowLeft, Ruler, Save } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useCustomer } from '../context/CustomerContext';
import axios from 'axios';

const STEPS = ['Blade Profile', 'Materials', 'Measurements', 'Client Summary'];

const KNIFE_TYPES = ['Hunter', 'Chef', 'Tactical', 'Damascus', 'Cleaver', 'Utility', 'Custom'];
const STEEL_TYPES = ['D2', '1095', 'O1', 'AEB-L', 'Damascus', 'S30V', 'VG-10', 'Other'];
const HANDLE_MATERIALS = ['Walnut', 'Rosewood', 'Olive Wood', 'G10', 'Micarta', 'Carbon Fiber', 'Bone', 'Stabilized Wood', 'Other'];

export default function KnifeBuilder() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { customers, refreshCustomers } = useCustomer();

    const [currentStep, setCurrentStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Form State
    const [form, setForm] = useState({
        requestedType: 'Hunter',
        requestedSteel: 'D2',
        requestedHandle: 'Walnut',
        bladeLength: '',
        totalLength: '',
        sheathRequired: false,
        notes: '',
        customerId: '',
        finalPrice: 8000,
        depositPaid: 0
    });

    useEffect(() => {
        refreshCustomers();
    }, []);

    // Price Estimator Logic
    useEffect(() => {
        let base = 5000;
        if (form.requestedType === 'Damascus' || form.requestedSteel === 'Damascus') base += 10000;
        else if (form.requestedType === 'Chef') base += 3000;

        if (form.sheathRequired) base += 2500;
        if (form.requestedHandle === 'Carbon Fiber' || form.requestedHandle === 'Stabilized Wood') base += 3000;

        const extraLength = Math.max(0, (Number(form.bladeLength) || 10) - 15);
        if (extraLength > 0) base += (extraLength * 500);

        setForm(f => ({ ...f, finalPrice: base }));
    }, [form.requestedType, form.requestedSteel, form.requestedHandle, form.sheathRequired, form.bladeLength]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 0));

    const handleSubmit = async () => {
        if (!form.customerId) {
            setError(t('knivesBuilder.errSelectClient', 'Please select a client.'));
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/custom-orders`, {
                customer: form.customerId,
                requestedType: form.requestedType,
                requestedSteel: form.requestedSteel,
                requestedHandle: form.requestedHandle,
                measurements: {
                    bladeLength: Number(form.bladeLength) || null,
                    totalLength: Number(form.totalLength) || null
                },
                sheathRequired: form.sheathRequired,
                finalPrice: form.finalPrice,
                depositPaid: form.depositPaid,
                notes: form.notes,
                status: 'Pending'
            }, { headers: { Authorization: `Bearer ${token}` } });

            navigate('/sales'); // Redirect to sales table to see the new order
        } catch (err) {
            setError(err.response?.data?.error || err.message);
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            <PageHeader
                title={t('knivesBuilder.title', 'Custom Knife Builder')}
                subtitle={t('knivesBuilder.subtitle', 'Design bespoke blades and instantly generate production orders.')}
                variant="production"
            />

            {/* Stepper Wizard */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">

                {/* Progress Bar */}
                <div className="flex items-center justify-between mb-8 relative">
                    <div className="absolute left-0 right-0 top-1/2 h-1 bg-gray-100 -z-10 -translate-y-1/2 rounded-full" />
                    <div className="absolute left-0 top-1/2 h-1 bg-indigo-600 -z-10 -translate-y-1/2 rounded-full transition-all duration-300"
                        style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }} />

                    {STEPS.map((step, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${idx <= currentStep ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-400 border-2 border-gray-200'}`}>
                                {idx < currentStep ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                            </div>
                            <span className={`text-xs font-bold uppercase tracking-wider ${idx <= currentStep ? 'text-indigo-900' : 'text-gray-400'}`}>
                                {t(`knivesBuilder.steps.${['profile', 'materials', 'measurements', 'summary'][idx]}`, step)}
                            </span>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-100 flex items-center gap-3">
                        <Zap className="w-5 h-5" />
                        <span className="text-sm font-semibold">{error}</span>
                    </div>
                )}

                {/* Step Content */}
                <div className="py-6 min-h-[300px]">

                    {currentStep === 0 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                                    <Layers className="text-blue-500 w-5 h-5" /> {t('knivesBuilder.baseProfile', 'Base Profile')}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {KNIFE_TYPES.map(type => (
                                        <button key={t(`knivesBuilder.types.${type}`, type)}
                                            onClick={() => set('requestedType', type)}
                                            className={`p-4 rounded-2xl flex items-center justify-center text-sm font-bold border-2 transition-all ${form.requestedType === type
                                                ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md'
                                                : 'border-gray-100 bg-white text-gray-600 hover:border-blue-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {t(`knivesBuilder.types.${type}`, type)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                                    <Zap className="text-indigo-500 w-5 h-5" /> {t('knivesBuilder.steelSelection', 'Steel Selection')}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {STEEL_TYPES.map(steel => (
                                        <button key={t(`knivesBuilder.steels.${steel}`, steel)}
                                            onClick={() => set('requestedSteel', steel)}
                                            className={`p-4 rounded-2xl flex items-center justify-center text-sm font-bold border-2 transition-all ${form.requestedSteel === steel
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md'
                                                : 'border-gray-100 bg-white text-gray-600 hover:border-indigo-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {t(`knivesBuilder.steels.${steel}`, steel)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                                    <Hammer className="text-amber-500 w-5 h-5" /> {t('knivesBuilder.handleMaterial', 'Handle Material')}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {HANDLE_MATERIALS.map(handle => (
                                        <button key={t(`knivesBuilder.handles.${handle}`, handle)}
                                            onClick={() => set('requestedHandle', handle)}
                                            className={`p-4 rounded-2xl flex items-center justify-center text-sm font-bold border-2 transition-all ${form.requestedHandle === handle
                                                ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md'
                                                : 'border-gray-100 bg-white text-gray-600 hover:border-amber-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {t(`knivesBuilder.handles.${handle}`, handle)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 max-w-xl mx-auto">
                            <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                                <Ruler className="text-emerald-500 w-5 h-5" /> {t('knivesBuilder.specifications', 'Specifications')}
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">{t('knivesBuilder.bladeLength', 'Blade Length (cm)')}</label>
                                    <input type="number" value={form.bladeLength} onChange={e => set('bladeLength', e.target.value)}
                                        className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500" placeholder="e.g. 15" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">{t('knivesBuilder.totalLength', 'Total Length (cm)')}</label>
                                    <input type="number" value={form.totalLength} onChange={e => set('totalLength', e.target.value)}
                                        className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500" placeholder="e.g. 28" />
                                </div>
                            </div>

                            <label className="flex items-center gap-3 p-4 border-2 border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                <input type="checkbox" checked={form.sheathRequired} onChange={e => set('sheathRequired', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-gray-300" />
                                <div>
                                    <span className="block text-sm font-bold text-gray-900">{t('knivesBuilder.sheath', 'Custom Leather Sheath')}</span>
                                    <span className="text-xs font-medium text-gray-500">{t('knivesBuilder.sheathEstimate', '+2500 DZD Estimated')}</span>
                                </div>
                            </label>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">{t('knivesBuilder.specialNotes', 'Special Notes for the Forge')}</label>
                                <textarea rows="3" value={form.notes} onChange={e => set('notes', e.target.value)}
                                    className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500" placeholder="e.g. Acid wash finish on the blade, mosaic pins..." />
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 max-w-2xl mx-auto">
                            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                                <div className="absolute -right-10 -top-10 opacity-10">
                                    <Hammer className="w-48 h-48" />
                                </div>
                                <h3 className="text-xl font-black mb-6 text-indigo-200">{t('knivesBuilder.quoteSummary', 'Quote Summary')}</h3>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm font-medium relative z-10">
                                    <div className="flex justify-between border-b border-gray-700 pb-2">
                                        <span className="text-gray-400">{t('knivesBuilder.profile', 'Profile')}</span>
                                        <span className="text-white font-bold">{form.requestedType}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-700 pb-2">
                                        <span className="text-gray-400">{t('knivesBuilder.steel', 'Steel')}</span>
                                        <span className="text-white font-bold">{form.requestedSteel}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-700 pb-2">
                                        <span className="text-gray-400">{t('knivesBuilder.handle', 'Handle')}</span>
                                        <span className="text-white font-bold">{form.requestedHandle}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-700 pb-2">
                                        <span className="text-gray-400">{t('knivesBuilder.sheath', 'Sheath')}</span>
                                        <span className="text-white font-bold">{form.sheathRequired ? t('knivesBuilder.yes', 'Yes') : t('knivesBuilder.no', 'No')}</span>
                                    </div>
                                </div>
                                <div className="mt-8 pt-6 border-t border-gray-700 flex items-end justify-between relative z-10">
                                    <div>
                                        <span className="block text-sm text-gray-400 font-medium mb-1">{t('knivesBuilder.estimatedFinalPrice', 'Estimated Final Price')}</span>
                                        <span className="text-3xl font-black text-emerald-400">{form.finalPrice.toLocaleString()} <span className="text-lg text-emerald-600">DZD</span></span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-xs text-gray-400 font-medium mb-1">{t('knivesBuilder.depositRequired', 'Deposit Required')}</span>
                                        <input type="number" value={form.depositPaid} onChange={e => set('depositPaid', e.target.value)}
                                            className="w-32 bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-right text-white focus:outline-none focus:border-indigo-500 font-bold" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                                    <User className="text-blue-500 w-5 h-5" /> {t('knivesBuilder.linkClient', 'Link Client')}
                                </h3>
                                <select
                                    className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 font-semibold"
                                    value={form.customerId}
                                    onChange={e => set('customerId', e.target.value)}
                                >
                                    <option value="" disabled>{t('knivesBuilder.selectClient', 'Select an existing client...')}</option>
                                    {customers.map(c => (
                                        <option key={c._id} value={c._id}>{c.name} ({c.phone})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div className="border-t border-gray-100 pt-6 mt-6 flex items-center justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={currentStep === 0 || submitting}
                        className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-0 transition-all flex items-center gap-2"
                    >
                        <ArrowLeft className="w-5 h-5" /> {t('knivesBuilder.btnBack', 'Back')}
                    </button>

                    {currentStep < STEPS.length - 1 ? (
                        <button
                            onClick={handleNext}
                            className="px-8 py-3 rounded-xl font-bold bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2"
                        >
                            {t('knivesBuilder.btnNext', 'Next Step')} <ArrowRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-8 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2 disabled:opacity-70 disabled:hover:transform-none"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {t('knivesBuilder.btnPlaceOrder', 'Place Custom Order')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
