import React, { useState } from 'react';
import { Shield, Smartphone, Key, MonitorSmartphone, X, Laptop } from 'lucide-react';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';

export default function SettingsSecurity() {
    const { t, i18n } = useTranslation('translation', { keyPrefix: 'settingsSecurity' });
    const isAr = i18n.language === 'ar';
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

    return (
        <div className="p-8 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6">{t('title')}</h3>

            <div className="space-y-10 max-w-3xl">

                {/* Password Section */}
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2"><Key className="w-4 h-4 text-gray-400" /> {t('changePwd')}</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="sec-current" className="block text-xs font-bold text-gray-700 mb-1">{t('currentPwd')}</label>
                                <input id="sec-current" type="password" autoComplete="current-password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-gray-50/50" />
                            </div>
                            <div>
                                <label htmlFor="sec-new" className="block text-xs font-bold text-gray-700 mb-1">{t('newPwd')}</label>
                                <input id="sec-new" type="password" autoComplete="new-password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-gray-50/50" />
                            </div>
                            <div>
                                <label htmlFor="sec-confirm" className="block text-xs font-bold text-gray-700 mb-1">{t('confirmPwd')}</label>
                                <input id="sec-confirm" type="password" autoComplete="new-password" placeholder="••••••••" className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-gray-50/50" />
                            </div>
                            <button className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-sm shadow-md hover:bg-indigo-700 transition">{t('updatePwd')}</button>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 h-fit">
                            <h5 className="text-xs font-bold text-gray-900 mb-2">{t('pwdReqTitle')}</h5>
                            <ul className={clsx("text-[11px] text-gray-600 space-y-2 list-disc", isAr ? "pr-4" : "pl-4")}>
                                <li>{t('pwdReq1')}</li>
                                <li>{t('pwdReq2')}</li>
                                <li>{t('pwdReq3')}</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Two-Factor Authentication */}
                <div className="space-y-4 pt-2">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-gray-400" /> {t('mfaTitle')}</div>
                        {twoFactorEnabled ?
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">{t('mfaEnabled')}</span> :
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">{t('mfaOff')}</span>
                        }
                    </h4>

                    <div className="flex flex-col md:flex-row items-center justify-between bg-white border border-gray-200 p-5 rounded-xl shadow-sm gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-gray-900">{t('authApp')}</h5>
                                <p className="text-xs text-gray-500 mt-1">{t('authAppDesc')}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                            className={clsx("px-4 py-2 font-bold rounded-lg text-sm border shadow-sm transition whitespace-nowrap", twoFactorEnabled ? "text-rose-600 bg-white border-rose-200 hover:bg-rose-50" : "text-gray-700 bg-white border-gray-200 hover:bg-gray-50")}
                        >
                            {twoFactorEnabled ? t('mfaDisable') : t('mfaSetup')}
                        </button>
                    </div>
                </div>

                {/* Active Sessions */}
                <div className="space-y-4 pt-2">
                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2"><MonitorSmartphone className="w-4 h-4 text-gray-400" /> {t('sessionsTitle')}</h4>

                    <p className="text-xs text-gray-500 mb-4">{t('sessionsDesc')}</p>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                            <div className="flex items-start gap-3">
                                <Laptop className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{t('session1Title')}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{t('session1Desc')}</p>
                                    <span className="text-[10px] font-bold text-emerald-600 mt-1 inline-block">{t('sessionCurrent')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white border border-gray-100 shadow-sm rounded-xl">
                            <div className="flex items-start gap-3">
                                <Smartphone className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{t('session2Title')}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{t('session2Desc')}</p>
                                    <span className="text-[10px] text-gray-400 mt-1 inline-block">{t('session2Time')}</span>
                                </div>
                            </div>
                            <button className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title={t('revokeSession')}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
