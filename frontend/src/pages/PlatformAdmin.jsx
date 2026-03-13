import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
    Building2, Users, ShoppingCart, TrendingUp, Shield, Search,
    ChevronLeft, ChevronRight, Eye, Pause, Play, ArrowUpDown,
    Crown, UserCog, ExternalLink, BarChart3, Activity, UserPlus,
    Package, FileText, Zap, Database, RefreshCw, X, Download,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import { useConfirmDialog } from '../components/ConfirmDialog';

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-emerald-500 to-emerald-600',
        violet: 'from-violet-500 to-violet-600',
        amber: 'from-amber-500 to-amber-600',
    };
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-3 mb-3">
                <div className={clsx('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white', colors[color])}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}

// ─── Plan Badge ────────────────────────────────────────────────────────────
function PlanBadge({ plan }) {
    const styles = {
        Free: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        Basic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        Pro: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
        Enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    };
    return (
        <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold', styles[plan] || styles.Free)}>
            {plan || 'Free'}
        </span>
    );
}

// ─── Status Dot ────────────────────────────────────────────────────────────
function StatusDot({ active, deleted }) {
    if (deleted) return <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="Deleted" />;
    return <span className={clsx('inline-block w-2 h-2 rounded-full', active ? 'bg-emerald-500' : 'bg-gray-400')} title={active ? 'Active' : 'Suspended'} />;
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────
function MiniBar({ data, dataKey, labelKey = 'period', color = '#8b5cf6', height = 120 }) {
    if (!data?.length) return <p className="text-xs text-gray-400 py-4 text-center">No data</p>;
    const max = Math.max(...data.map(d => d[dataKey] || 0), 1);
    return (
        <div className="flex items-end gap-1 justify-between" style={{ height }}>
            {data.map((d, i) => {
                const val = d[dataKey] || 0;
                const pct = Math.max((val / max) * 100, 2);
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <span className="text-[9px] text-gray-400 truncate">{val.toLocaleString()}</span>
                        <div
                            className="w-full rounded-t-sm transition-all"
                            style={{ height: `${pct}%`, backgroundColor: color, minHeight: 2 }}
                            title={`${d[labelKey]}: ${val.toLocaleString()}`}
                        />
                        <span className="text-[8px] text-gray-400 truncate w-full text-center">{(d[labelKey] || '').slice(-5)}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Relative Time ────────────────────────────────────────────────────────
function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(date).toLocaleDateString();
}

// ─── CSV Export ───────────────────────────────────────────────────────────
function exportTenantsCSV(tenants) {
    const headers = ['Name', 'Owner', 'Plan', 'Status', 'Members', 'Subscription', 'Created'];
    const rows = tenants.map(t => [
        t.name,
        t.owner?.name || '',
        t.planTier || 'Free',
        t.isActive ? 'Active' : (t.deletedAt ? 'Deleted' : 'Suspended'),
        t.memberCount || 0,
        t.subscription?.status || 'none',
        new Date(t.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Detail Panel Tab Button ──────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                active
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50'
            )}
        >
            {children}
        </button>
    );
}

export default function PlatformAdmin() {
    const { user } = useContext(AuthContext);

    const [analytics, setAnalytics] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');
    const [loading, setLoading] = useState(true);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [detailTab, setDetailTab] = useState('overview');
    const [detailLoading, setDetailLoading] = useState(false);
    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [usage, setUsage] = useState(null);
    const [usageLoading, setUsageLoading] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [detailed, setDetailed] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const { dialog, confirm } = useConfirmDialog();

    // ── Debounced search ────────────────────────────────────────────────
    const [searchInput, setSearchInput] = useState('');
    const debounceRef = useRef(null);
    const handleSearchInput = (val) => {
        setSearchInput(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
    };

    // ── Escape to close detail panel ────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && selectedTenant) setSelectedTenant(null); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [selectedTenant]);

    // ── Fetch analytics ───────────────────────────────────────────────────
    const refreshAnalytics = useCallback(() => {
        apiFetch('/api/platform/analytics')
            .then(r => r.ok ? r.json() : Promise.reject('Failed'))
            .then(setAnalytics)
            .catch(() => {});
        apiFetch('/api/platform/analytics/detailed')
            .then(r => r.ok ? r.json() : Promise.reject('Failed'))
            .then(setDetailed)
            .catch(() => {});
    }, []);

    useEffect(() => { refreshAnalytics(); }, [refreshAnalytics]);

    // ── Fetch tenants ─────────────────────────────────────────────────────
    const fetchTenants = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page, limit: 15, sortBy, sortOrder });
            if (search) params.set('search', search);
            if (statusFilter) params.set('status', statusFilter);
            if (planFilter) params.set('planTier', planFilter);

            const res = await apiFetch(`/api/platform/tenants?${params}`);
            if (!res.ok) throw new Error('Failed to load tenants');
            const data = await res.json();
            setTenants(data.data || []);
            setTotal(data.total || 0);
            setPages(data.pages || 1);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter, planFilter, sortBy, sortOrder]);

    useEffect(() => { fetchTenants(); }, [fetchTenants]);

    // ── View tenant detail ────────────────────────────────────────────────
    const viewDetail = async (id) => {
        setDetailLoading(true);
        try {
            const res = await apiFetch(`/api/platform/tenants/${id}`);
            if (!res.ok) throw new Error('Failed');
            setSelectedTenant(await res.json());
        } catch {
            toast.error('Failed to load tenant details');
        } finally {
            setDetailLoading(false);
        }
    };

    // ── Fetch tenant members ──────────────────────────────────────────────
    const fetchMembers = async (id) => {
        setMembersLoading(true);
        try {
            const res = await apiFetch(`/api/platform/tenants/${id}/members`);
            if (!res.ok) throw new Error('Failed');
            setMembers(await res.json());
        } catch {
            setMembers([]);
        } finally {
            setMembersLoading(false);
        }
    };

    // ── Fetch tenant usage ────────────────────────────────────────────────
    const fetchUsage = async (id) => {
        setUsageLoading(true);
        try {
            const res = await apiFetch(`/api/platform/tenants/${id}/usage`);
            if (!res.ok) throw new Error('Failed');
            setUsage(await res.json());
        } catch {
            setUsage(null);
        } finally {
            setUsageLoading(false);
        }
    };

    // ── Fetch tenant audit log ─────────────────────────────────────────────
    const fetchAudit = async (id) => {
        setAuditLoading(true);
        try {
            const res = await apiFetch(`/api/platform/tenants/${id}/audit?limit=30`);
            if (!res.ok) throw new Error('Failed');
            setAuditLogs(await res.json());
        } catch {
            setAuditLogs([]);
        } finally {
            setAuditLoading(false);
        }
    };

    // Load tab data when tab changes
    useEffect(() => {
        if (!selectedTenant) return;
        if (detailTab === 'members' && members.length === 0) fetchMembers(selectedTenant._id);
        if (detailTab === 'usage' && !usage) fetchUsage(selectedTenant._id);
        if (detailTab === 'activity' && auditLogs.length === 0) fetchAudit(selectedTenant._id);
    }, [detailTab, selectedTenant?._id]);

    // Reset tab state when tenant changes
    const viewDetailAndReset = async (id) => {
        setDetailTab('overview');
        setMembers([]);
        setUsage(null);
        setAuditLogs([]);
        await viewDetail(id);
    };

    // ── Suspend / Reactivate ──────────────────────────────────────────────
    const doToggleTenantStatus = async (id, currentlyActive) => {
        const action = currentlyActive ? 'suspend' : 'reactivate';
        setActionLoading(id);
        try {
            const res = await apiFetch(`/api/platform/tenants/${id}/${action}`, { method: 'PATCH' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            toast.success(data.message);
            fetchTenants();
            if (selectedTenant?._id === id) viewDetail(id);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const toggleTenantStatus = (id, currentlyActive, tenantName) => {
        const action = currentlyActive ? 'Suspend' : 'Reactivate';
        confirm({
            title: `${action} Tenant`,
            body: `Are you sure you want to ${action.toLowerCase()} "${tenantName || 'this tenant'}"? ${currentlyActive ? 'All users will be locked out immediately.' : ''}`,
            danger: currentlyActive,
            confirmLabel: action,
            onConfirm: () => doToggleTenantStatus(id, currentlyActive),
        });
    };

    // ── Change plan ───────────────────────────────────────────────────────
    const doChangePlan = async (id, planTier) => {
        setActionLoading(id);
        try {
            const res = await apiFetch(`/api/platform/tenants/${id}/plan`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planTier }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            toast.success(data.message);
            fetchTenants();
            if (selectedTenant?._id === id) viewDetail(id);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const changePlan = (id, planTier, currentPlan) => {
        confirm({
            title: 'Change Plan',
            body: `Change plan from ${currentPlan || 'current'} to ${planTier}? This will update limits and billing immediately.`,
            confirmLabel: `Switch to ${planTier}`,
            onConfirm: () => doChangePlan(id, planTier),
        });
    };

    // ── Impersonate ───────────────────────────────────────────────────────
    const doImpersonate = async (tenantId) => {
        try {
            const res = await apiFetch(`/api/platform/impersonate/${tenantId}`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            // Store original tokens for return
            localStorage.setItem('_pa_original_token', localStorage.getItem('token'));
            localStorage.setItem('_pa_original_refresh', localStorage.getItem('refreshToken') || '');

            // Set impersonation tokens
            localStorage.setItem('token', data.token);
            localStorage.removeItem('refreshToken'); // impersonation tokens don't get refresh

            toast.success(`Impersonating ${data.tenantName}. Reloading...`);
            setTimeout(() => window.location.href = '/', 500);
        } catch (err) {
            toast.error(err.message);
        }
    };

    const impersonate = (tenantId, tenantName) => {
        confirm({
            title: 'Start Impersonation',
            body: `You will be logged in as "${tenantName || 'this tenant'}". All actions will be audited. The session expires in 1 hour.`,
            danger: true,
            confirmLabel: 'Impersonate',
            onConfirm: () => doImpersonate(tenantId),
        });
    };

    // ── Exit impersonation ────────────────────────────────────────────────
    const exitImpersonation = () => {
        const original = localStorage.getItem('_pa_original_token');
        if (original) {
            localStorage.setItem('token', original);
            const refresh = localStorage.getItem('_pa_original_refresh');
            if (refresh) localStorage.setItem('refreshToken', refresh);
            localStorage.removeItem('_pa_original_token');
            localStorage.removeItem('_pa_original_refresh');
            window.location.href = '/platform-admin';
        }
    };

    // ── Sort toggle ────────────────────────────────────────────────────────
    const toggleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
        setPage(1);
    };

    // Check if currently impersonating
    const isImpersonating = !!localStorage.getItem('_pa_original_token');

    if (user?.platformRole !== 'platform_admin') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-500">Platform admin privileges required.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {dialog}
            {/* Impersonation Banner */}
            {isImpersonating && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <UserCog className="w-5 h-5 text-amber-600" />
                        <span className="text-amber-800 dark:text-amber-300 font-medium">
                            You are impersonating a tenant. Actions are logged.
                        </span>
                    </div>
                    <button
                        onClick={exitImpersonation}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                    >
                        Exit Impersonation
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Crown className="w-7 h-7 text-amber-500" />
                        Platform Administration
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage all tenants, subscriptions, and platform health</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => exportTenantsCSV(tenants)}
                        disabled={tenants.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/30 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 text-sm font-medium transition-colors disabled:opacity-40"
                        title="Export current page to CSV"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                    <button
                        onClick={async () => {
                            setRefreshing(true);
                            refreshAnalytics();
                            await fetchTenants();
                            setRefreshing(false);
                        }}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-900/30 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Analytics Cards */}
            {analytics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={Building2} label="Total Tenants" value={analytics.tenants.total} sub={`${analytics.tenants.active} active`} color="violet" />
                    <StatCard icon={Users} label="Total Users" value={analytics.users.total} color="blue" />
                    <StatCard icon={ShoppingCart} label="Orders This Month" value={analytics.orders.thisMonth?.toLocaleString()} sub={analytics.orders.growth ? `${analytics.orders.growth}% vs last month` : null} color="green" />
                    <StatCard icon={TrendingUp} label="GMV This Month" value={`${(analytics.revenueThisMonth || 0).toLocaleString()} DZD`} color="amber" />
                </div>
            )}

            {/* Plan Distribution */}
            {analytics?.planDistribution && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Plan Distribution</h3>
                    <div className="flex gap-6 flex-wrap">
                        {['Free', 'Basic', 'Pro', 'Enterprise'].map(plan => (
                            <div key={plan} className="flex items-center gap-2">
                                <PlanBadge plan={plan} />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {analytics.planDistribution[plan] || 0}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Detailed Analytics */}
            {detailed && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Revenue Trend */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-4 h-4 text-violet-500" />
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Revenue Trend</h3>
                        </div>
                        <MiniBar data={detailed.revenueByMonth} dataKey="revenue" color="#8b5cf6" />
                    </div>

                    {/* Tenant Growth */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <UserPlus className="w-4 h-4 text-emerald-500" />
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tenant Growth</h3>
                        </div>
                        <MiniBar data={detailed.growthByMonth} dataKey="newTenants" color="#10b981" />
                        {detailed.churnedThisMonth > 0 && (
                            <p className="text-xs text-red-500 mt-2">
                                {detailed.churnedThisMonth} churned this month
                            </p>
                        )}
                    </div>

                    {/* Top Tenants + Subscription Status */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Activity className="w-4 h-4 text-amber-500" />
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top Tenants</h3>
                        </div>
                        <div className="space-y-2 mb-4">
                            {(detailed.topTenants || []).slice(0, 5).map((t, i) => (
                                <div key={t.tenantId || i} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-gray-400 w-4">{i + 1}.</span>
                                        <span className="text-gray-900 dark:text-white truncate">{t.name}</span>
                                        <PlanBadge plan={t.planTier} />
                                    </div>
                                    <span className="text-gray-500 shrink-0">{(t.revenue || 0).toLocaleString()} DZD</span>
                                </div>
                            ))}
                        </div>
                        {detailed.subscriptionStatus && (
                            <>
                                <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2 border-t border-gray-100 dark:border-gray-700/50 pt-3">Subscriptions</p>
                                <div className="flex gap-3 flex-wrap">
                                    {Object.entries(detailed.subscriptionStatus).map(([k, v]) => (
                                        <div key={k} className="text-center">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{v}</p>
                                            <p className="text-[9px] text-gray-400 capitalize">{k}</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-wrap gap-3 items-center">
                    {analytics && (
                        <div className="flex items-center gap-3 pe-3 me-1 border-e border-gray-200 dark:border-gray-600">
                            <span className="text-xs text-gray-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />{analytics.tenants.active}</span>
                            <span className="text-xs text-gray-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />{(analytics.tenants.total || 0) - (analytics.tenants.active || 0)}</span>
                        </div>
                    )}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search tenants..."
                            value={searchInput}
                            onChange={e => handleSearchInput(e.target.value)}
                            className="w-full ps-9 pe-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                    >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Suspended</option>
                        <option value="deleted">Deleted</option>
                    </select>
                    <select
                        value={planFilter}
                        onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                    >
                        <option value="">All Plans</option>
                        <option value="Free">Free</option>
                        <option value="Basic">Basic</option>
                        <option value="Pro">Pro</option>
                        <option value="Enterprise">Enterprise</option>
                    </select>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Tenant Table + Detail Panel */}
            <div className="flex gap-4 relative">
                {/* Table */}
                <div className={clsx('bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all', selectedTenant ? 'flex-1' : 'w-full')}>
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-3 text-start">Status</th>
                                            <th className="px-4 py-3 text-start cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('name')}>
                                                <span className="inline-flex items-center gap-1">Tenant {sortBy === 'name' && <ArrowUpDown className="w-3 h-3" />}</span>
                                            </th>
                                            <th className="px-4 py-3 text-start">Owner</th>
                                            <th className="px-4 py-3 text-center cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('planTier')}>
                                                <span className="inline-flex items-center gap-1">Plan {sortBy === 'planTier' && <ArrowUpDown className="w-3 h-3" />}</span>
                                            </th>
                                            <th className="px-4 py-3 text-center">Members</th>
                                            <th className="px-4 py-3 text-start">Subscription</th>
                                            <th className="px-4 py-3 text-start cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('createdAt')}>
                                                <span className="inline-flex items-center gap-1">Created {sortBy === 'createdAt' && <ArrowUpDown className="w-3 h-3" />}</span>
                                            </th>
                                            <th className="px-4 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                        {tenants.map(tenant => (
                                            <tr
                                                key={tenant._id}
                                                className={clsx(
                                                    'hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors',
                                                    selectedTenant?._id === tenant._id && 'bg-violet-50/50 dark:bg-violet-900/10'
                                                )}
                                                onClick={() => viewDetailAndReset(tenant._id)}
                                            >
                                                <td className="px-4 py-3">
                                                    <StatusDot active={tenant.isActive} deleted={!!tenant.deletedAt} />
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{tenant.name}</td>
                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                                    {tenant.owner?.name || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center"><PlanBadge plan={tenant.planTier} /></td>
                                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{tenant.memberCount || 0}</td>
                                                <td className="px-4 py-3">
                                                    <span className={clsx(
                                                        'text-xs font-medium capitalize',
                                                        tenant.subscription?.status === 'active' && 'text-emerald-600',
                                                        tenant.subscription?.status === 'trialing' && 'text-blue-600',
                                                        ['expired', 'canceled', 'past_due'].includes(tenant.subscription?.status) && 'text-red-500',
                                                    )}>
                                                        {tenant.subscription?.status || 'none'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">
                                                    {new Date(tenant.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            title="View Details"
                                                            onClick={() => viewDetailAndReset(tenant._id)}
                                                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600/50"
                                                        >
                                                            <Eye className="w-4 h-4 text-gray-500" />
                                                        </button>
                                                        <button
                                                            title={tenant.isActive ? 'Suspend' : 'Reactivate'}
                                                            onClick={() => toggleTenantStatus(tenant._id, tenant.isActive, tenant.name)}
                                                            disabled={actionLoading === tenant._id}
                                                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600/50"
                                                        >
                                                            {tenant.isActive
                                                                ? <Pause className="w-4 h-4 text-amber-500" />
                                                                : <Play className="w-4 h-4 text-emerald-500" />
                                                            }
                                                        </button>
                                                        <button
                                                            title="Impersonate"
                                                            onClick={() => impersonate(tenant._id, tenant.name)}
                                                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600/50"
                                                        >
                                                            <ExternalLink className="w-4 h-4 text-violet-500" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {tenants.length === 0 && (
                                            <tr><td colSpan={8} className="text-center py-12 text-gray-400">No tenants found</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {pages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700/50">
                                    <span className="text-xs text-gray-500">{total} tenants total</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page <= 1}
                                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-sm text-gray-600 dark:text-gray-300">
                                            {page} / {pages}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => Math.min(pages, p + 1))}
                                            disabled={page >= pages}
                                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Detail Panel - mobile overlay backdrop */}
                {selectedTenant && (
                    <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSelectedTenant(null)} />
                )}
                {selectedTenant && (
                    <div className="w-full lg:w-[400px] shrink-0 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[calc(100vh-180px)] fixed inset-0 z-50 lg:static lg:z-auto lg:inset-auto m-4 lg:m-0">
                        {detailLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="h-6 w-6 animate-spin rounded-full border-3 border-violet-500 border-t-transparent" />
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="p-5 pb-0">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedTenant.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <StatusDot active={selectedTenant.isActive} deleted={!!selectedTenant.deletedAt} />
                                                <span className="text-xs text-gray-500">{selectedTenant.isActive ? 'Active' : 'Suspended'}</span>
                                                <PlanBadge plan={selectedTenant.planTier} />
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedTenant(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Tabs */}
                                    <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700/50 pb-0">
                                        <TabBtn active={detailTab === 'overview'} onClick={() => setDetailTab('overview')}>Overview</TabBtn>
                                        <TabBtn active={detailTab === 'members'} onClick={() => setDetailTab('members')}>Members</TabBtn>
                                        <TabBtn active={detailTab === 'usage'} onClick={() => setDetailTab('usage')}>Usage</TabBtn>
                                        <TabBtn active={detailTab === 'activity'} onClick={() => setDetailTab('activity')}>Activity</TabBtn>
                                    </div>
                                </div>

                                <div className="p-5 space-y-5">
                                    {/* ── Overview Tab ──────────────────────────── */}
                                    {detailTab === 'overview' && (
                                        <>
                                            {/* Owner */}
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Owner</p>
                                                <p className="text-sm text-gray-900 dark:text-white">{selectedTenant.owner?.name || 'N/A'}</p>
                                                <p className="text-xs text-gray-500">{selectedTenant.owner?.email || ''}</p>
                                            </div>

                                            {/* Health Metrics */}
                                            {selectedTenant.health && (
                                                <div>
                                                    <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Health</p>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                                            <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedTenant.health.memberCount}</p>
                                                            <p className="text-[10px] text-gray-400">Members</p>
                                                        </div>
                                                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                                            <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedTenant.health.orderCountMonth}</p>
                                                            <p className="text-[10px] text-gray-400">Orders/Mo</p>
                                                        </div>
                                                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                                            <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedTenant.health.customerCount}</p>
                                                            <p className="text-[10px] text-gray-400">Customers</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Recent Orders */}
                                            {selectedTenant.health?.recentOrders?.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Recent Orders</p>
                                                    <div className="space-y-1.5">
                                                        {selectedTenant.health.recentOrders.map(o => (
                                                            <div key={o._id} className="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={clsx(
                                                                        'w-1.5 h-1.5 rounded-full',
                                                                        o.status === 'Delivered' && 'bg-emerald-500',
                                                                        o.status === 'Cancelled' && 'bg-red-500',
                                                                        o.status === 'Returned' && 'bg-amber-500',
                                                                        !['Delivered', 'Cancelled', 'Returned'].includes(o.status) && 'bg-blue-500'
                                                                    )} />
                                                                    <span className="text-gray-600 dark:text-gray-300">{o.status}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-gray-900 dark:text-white font-medium">{(o.financials?.total || 0).toLocaleString()} DZD</span>
                                                                    <span className="text-gray-400" title={new Date(o.createdAt).toLocaleString()}>{timeAgo(o.createdAt)}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Subscription */}
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Subscription</p>
                                                <div className="space-y-1 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Status</span>
                                                        <span className="font-medium capitalize text-gray-900 dark:text-white">{selectedTenant.subscription?.status || 'none'}</span>
                                                    </div>
                                                    {selectedTenant.subscription?.trialEndsAt && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Trial Ends</span>
                                                            <span className="text-gray-900 dark:text-white">{new Date(selectedTenant.subscription.trialEndsAt).toLocaleDateString()}</span>
                                                        </div>
                                                    )}
                                                    {selectedTenant.subscription?.currentPeriodEnd && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Period End</span>
                                                            <span className="text-gray-900 dark:text-white">{new Date(selectedTenant.subscription.currentPeriodEnd).toLocaleDateString()}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Plan Change */}
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Change Plan</p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {['Free', 'Basic', 'Pro', 'Enterprise'].map(plan => (
                                                        <button
                                                            key={plan}
                                                            onClick={() => changePlan(selectedTenant._id, plan, selectedTenant.planTier)}
                                                            disabled={selectedTenant.planTier === plan || actionLoading === selectedTenant._id}
                                                            className={clsx(
                                                                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                                                                selectedTenant.planTier === plan
                                                                    ? 'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-400 cursor-default'
                                                                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                                                            )}
                                                        >
                                                            {plan}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Limits */}
                                            {selectedTenant.limits && (
                                                <div>
                                                    <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Plan Limits</p>
                                                    <div className="space-y-1 text-xs">
                                                        {Object.entries(selectedTenant.limits).map(([k, v]) => (
                                                            <div key={k} className="flex justify-between">
                                                                <span className="text-gray-500">{k}</span>
                                                                <span className="text-gray-900 dark:text-white font-medium">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Created */}
                                            <div className="text-xs text-gray-400">
                                                Created: {new Date(selectedTenant.createdAt).toLocaleString()}
                                            </div>
                                        </>
                                    )}

                                    {/* ── Members Tab ──────────────────────────── */}
                                    {detailTab === 'members' && (
                                        <>
                                            {membersLoading ? (
                                                <div className="flex items-center justify-center py-10">
                                                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-violet-500 border-t-transparent" />
                                                </div>
                                            ) : members.length === 0 ? (
                                                <p className="text-sm text-gray-400 text-center py-10">No members found</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    <p className="text-xs text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                                                    {members.map(m => {
                                                        const roleName = typeof m.role === 'object' ? m.role?.name : m.role;
                                                        const isActive = m.user?.isActive !== false && m.status !== 'removed';
                                                        return (
                                                            <div key={m._id} className={clsx('flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl', !isActive && 'opacity-50')}>
                                                                <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 text-xs font-bold">
                                                                    {(m.user?.name || m.name || '?')[0].toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.user?.name || m.name || 'Unknown'}</p>
                                                                        {m.user?.platformRole === 'platform_admin' && (
                                                                            <Crown className="w-3 h-3 text-amber-500 shrink-0" title="Platform Admin" />
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-gray-500 truncate">{m.user?.email || m.email || ''}</p>
                                                                </div>
                                                                <span className="text-[10px] px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 font-medium capitalize">
                                                                    {roleName || 'member'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* ── Usage Tab ────────────────────────────── */}
                                    {detailTab === 'usage' && (
                                        <>
                                            {usageLoading ? (
                                                <div className="flex items-center justify-center py-10">
                                                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-violet-500 border-t-transparent" />
                                                </div>
                                            ) : !usage ? (
                                                <p className="text-sm text-gray-400 text-center py-10">No usage data</p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {/* Current Period */}
                                                    {usage.current && (
                                                        <div>
                                                            <p className="text-xs text-gray-400 uppercase font-semibold mb-3">Current Period</p>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {[
                                                                    { icon: Package, label: 'Orders', val: usage.current.orders },
                                                                    { icon: FileText, label: 'Exports', val: usage.current.exports },
                                                                    { icon: Zap, label: 'API Calls', val: usage.current.apiCalls },
                                                                    { icon: Database, label: 'Storage', val: usage.current.storage ? `${(usage.current.storage / 1024 / 1024).toFixed(1)} MB` : '0' },
                                                                ].map(item => (
                                                                    <div key={item.label} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <item.icon className="w-3.5 h-3.5 text-gray-400" />
                                                                            <span className="text-[10px] text-gray-400">{item.label}</span>
                                                                        </div>
                                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{typeof item.val === 'number' ? item.val.toLocaleString() : item.val}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* History */}
                                                    {usage.history?.length > 0 && (
                                                        <div>
                                                            <p className="text-xs text-gray-400 uppercase font-semibold mb-3">History</p>
                                                            <div className="space-y-2">
                                                                {usage.history.map((h, i) => (
                                                                    <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                                                        <span className="text-gray-500 font-medium">{h.period}</span>
                                                                        <div className="flex gap-3 text-gray-600 dark:text-gray-300">
                                                                            <span>{h.orders || 0} orders</span>
                                                                            <span>{h.apiCalls || 0} API</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* ── Activity Tab ──────────────────────────── */}
                                    {detailTab === 'activity' && (
                                        <>
                                            {auditLoading ? (
                                                <div className="flex items-center justify-center py-10">
                                                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-violet-500 border-t-transparent" />
                                                </div>
                                            ) : auditLogs.length === 0 ? (
                                                <p className="text-sm text-gray-400 text-center py-10">No activity recorded</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    <p className="text-xs text-gray-400">{auditLogs.length} recent actions</p>
                                                    {auditLogs.map(log => (
                                                        <div key={log._id} className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-600 pb-2">
                                                            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-violet-500" />
                                                            <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                                {log.action.replace(/_/g, ' ')}
                                                            </p>
                                                            <p className="text-[10px] text-gray-500 mt-0.5">
                                                                {log.actorUserId?.name || 'System'} &middot; {log.module}
                                                            </p>
                                                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                                <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                                                                    {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                                                </p>
                                                            )}
                                                            <p className="text-[9px] text-gray-400 mt-1" title={new Date(log.createdAt).toLocaleString()}>
                                                                {timeAgo(log.createdAt)}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Actions — always visible at bottom */}
                                    <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                        <button
                                            onClick={() => toggleTenantStatus(selectedTenant._id, selectedTenant.isActive, selectedTenant.name)}
                                            disabled={actionLoading === selectedTenant._id}
                                            className={clsx(
                                                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                                                selectedTenant.isActive
                                                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400'
                                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400'
                                            )}
                                        >
                                            {selectedTenant.isActive ? 'Suspend' : 'Reactivate'}
                                        </button>
                                        <button
                                            onClick={() => impersonate(selectedTenant._id, selectedTenant.name)}
                                            className="flex-1 py-2 rounded-lg text-sm font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-400"
                                        >
                                            Impersonate
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
