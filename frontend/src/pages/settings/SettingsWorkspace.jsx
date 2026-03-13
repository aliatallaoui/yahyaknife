import React, { useState, useEffect, useContext } from 'react';
import { Building2, Users, Package, ShoppingCart, Truck, Copy, CheckCircle2, AlertTriangle, UserPlus, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export default function SettingsWorkspace() {
    const { hasPermission } = useContext(AuthContext);
    const { t, i18n } = useTranslation();
    const isAr = i18n.language === 'ar';

    const [tenant, setTenant] = useState(null);
    const [usage, setUsage] = useState(null);
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Settings form
    const [name, setName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [businessPhone, setBusinessPhone] = useState('');
    const [businessAddress, setBusinessAddress] = useState('');
    const [currency, setCurrency] = useState('DZD');
    const [timezone, setTimezone] = useState('Africa/Algiers');
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Invite form
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const [inviting, setInviting] = useState(false);

    const canEdit = hasPermission('tenant.settings');
    const canInvite = hasPermission('tenant.invite');

    useEffect(() => {
        fetchAll();
    }, []);

    async function fetchAll() {
        setLoading(true);
        setError(null);
        try {
            const [tenantRes, usageRes, teamRes] = await Promise.all([
                apiFetch('/api/tenants/me'),
                apiFetch('/api/tenants/me/usage'),
                apiFetch('/api/tenants/me/team'),
            ]);

            if (!tenantRes.ok || !usageRes.ok || !teamRes.ok) {
                throw new Error('Failed to load workspace data');
            }

            const [tenantData, usageData, teamData] = await Promise.all([
                tenantRes.json(),
                usageRes.json(),
                teamRes.json(),
            ]);

            setTenant(tenantData);
            setUsage(usageData);
            setTeam(teamData);

            // Populate form
            setName(tenantData.name || '');
            setCompanyName(tenantData.settings?.companyName || '');
            setBusinessPhone(tenantData.settings?.businessPhone || '');
            setBusinessAddress(tenantData.settings?.businessAddress || '');
            setCurrency(tenantData.settings?.currency || 'DZD');
            setTimezone(tenantData.settings?.timezone || 'Africa/Algiers');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        setSaveSuccess(false);
        try {
            const res = await apiFetch('/api/tenants/me/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    settings: { companyName, businessPhone, businessAddress, currency, timezone },
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.message || 'Save failed');
            }
            setSaveSuccess(true);
            toast.success(t('settingsWorkspace.saved', 'Settings saved'));
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleInvite(e) {
        e.preventDefault();
        if (!inviteEmail) return;
        setInviting(true);
        setInviteLink('');
        try {
            const res = await apiFetch('/api/tenants/me/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Invite failed');
            setInviteLink(data.inviteLink);
            setInviteEmail('');
            toast.success(t('settingsWorkspace.inviteSent', 'Invite created'));
        } catch (err) {
            toast.error(err.message);
        } finally {
            setInviting(false);
        }
    }

    function copyInviteLink() {
        navigator.clipboard.writeText(inviteLink);
        toast.success(t('settingsWorkspace.copied', 'Copied to clipboard'));
    }

    // ── Usage bar helper ────────────────────────────────────────────────────
    function UsageBar({ label, current, limit, icon: Icon }) {
        const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
        const isWarning = pct >= 80;
        const isFull = pct >= 100;
        return (
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                        <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        {label}
                    </span>
                    <span className={clsx('font-semibold text-xs', isFull ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400')}>
                        {current} / {limit >= 999999 ? '∞' : limit}
                    </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={clsx('h-full rounded-full transition-all', isFull ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-500')}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
                <button onClick={fetchAll} className="mt-3 text-sm text-indigo-600 hover:underline">
                    {t('common.retry', 'Retry')}
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8" dir={isAr ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {t('settingsWorkspace.title', 'Workspace Settings')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('settingsWorkspace.subtitle', 'Manage your workspace, team, and plan')}
                    </p>
                </div>
            </div>

            {/* Plan & Usage Section */}
            {usage && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                            {t('settingsWorkspace.planUsage', 'Plan & Usage')}
                        </h4>
                        <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full">
                            {usage.planTier}
                        </span>
                    </div>
                    <div className="grid gap-4">
                        <UsageBar label={t('settingsWorkspace.users', 'Users')} current={usage.usage.users.current} limit={usage.usage.users.limit} icon={Users} />
                        <UsageBar label={t('settingsWorkspace.ordersMonth', 'Orders / month')} current={usage.usage.ordersPerMonth.current} limit={usage.usage.ordersPerMonth.limit} icon={ShoppingCart} />
                        <UsageBar label={t('settingsWorkspace.products', 'Products')} current={usage.usage.products.current} limit={usage.usage.products.limit} icon={Package} />
                        <UsageBar label={t('settingsWorkspace.couriers', 'Couriers')} current={usage.usage.couriers.current} limit={usage.usage.couriers.limit} icon={Truck} />
                    </div>
                </div>
            )}

            {/* Workspace Settings Form */}
            {canEdit && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                        {t('settingsWorkspace.workspaceInfo', 'Workspace Info')}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                                {t('settingsWorkspace.workspaceName', 'Workspace Name')}
                            </label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                                {t('settingsWorkspace.companyName', 'Company Name')}
                            </label>
                            <input
                                value={companyName}
                                onChange={e => setCompanyName(e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                                {t('settingsWorkspace.phone', 'Business Phone')}
                            </label>
                            <input
                                value={businessPhone}
                                onChange={e => setBusinessPhone(e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                                {t('settingsWorkspace.currency', 'Currency')}
                            </label>
                            <select
                                value={currency}
                                onChange={e => setCurrency(e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/30 outline-none transition-colors"
                            >
                                <option value="DZD">DZD - Algerian Dinar</option>
                                <option value="USD">USD - US Dollar</option>
                                <option value="EUR">EUR - Euro</option>
                                <option value="SAR">SAR - Saudi Riyal</option>
                                <option value="AED">AED - UAE Dirham</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                                {t('settingsWorkspace.address', 'Business Address')}
                            </label>
                            <input
                                value={businessAddress}
                                onChange={e => setBusinessAddress(e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                        </button>
                        {saveSuccess && (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                                <CheckCircle2 className="w-4 h-4" />
                                {t('settingsWorkspace.saved', 'Saved')}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Team & Invite Section */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                    {t('settingsWorkspace.team', 'Team')} ({team.length})
                </h4>

                {/* Invite form */}
                {canInvite && (
                    <form onSubmit={handleInvite} className="flex gap-2">
                        <input
                            type="email"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            placeholder={t('settingsWorkspace.inviteEmailPlaceholder', 'colleague@company.com')}
                            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/30 outline-none transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={inviting || !inviteEmail}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                            <UserPlus className="w-4 h-4" />
                            {inviting ? t('settingsWorkspace.inviting', 'Inviting...') : t('settingsWorkspace.invite', 'Invite')}
                        </button>
                    </form>
                )}

                {/* Invite link display */}
                {inviteLink && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                        <input
                            readOnly
                            value={inviteLink}
                            className="flex-1 text-xs bg-transparent text-emerald-800 dark:text-emerald-300 outline-none"
                        />
                        <button onClick={copyInviteLink} className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded transition-colors">
                            <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </button>
                    </div>
                )}

                {/* Team list */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {team.map(member => (
                        <div key={member._id} className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-sm font-bold">
                                    {member.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{member.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                    {member.role?.name || 'No role'}
                                </span>
                                <span className={clsx('w-2 h-2 rounded-full', member.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Subscription Info */}
            {tenant?.subscription && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                        {t('settingsWorkspace.subscription', 'Subscription')}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t('settingsWorkspace.status', 'Status')}</p>
                            <p className={clsx('font-semibold capitalize', {
                                'text-emerald-600 dark:text-emerald-400': tenant.subscription.status === 'active',
                                'text-amber-600 dark:text-amber-400': tenant.subscription.status === 'trialing',
                                'text-red-600 dark:text-red-400': ['expired', 'canceled', 'past_due'].includes(tenant.subscription.status),
                            })}>
                                {tenant.subscription.status}
                            </p>
                        </div>
                        {tenant.subscription.trialEndsAt && (
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('settingsWorkspace.trialEnds', 'Trial Ends')}</p>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                    {new Date(tenant.subscription.trialEndsAt).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                        {tenant.subscription.currentPeriodEnd && (
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('settingsWorkspace.renewsOn', 'Renews On')}</p>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                    {new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
