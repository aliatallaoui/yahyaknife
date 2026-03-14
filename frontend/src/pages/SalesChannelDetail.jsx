import { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Plus, FileText, BarChart3, Eye, EyeOff, Trash2, Edit3,
  ExternalLink, MoreVertical, Globe, ShoppingCart, TrendingUp, Copy,
  Rocket, Pause, Search, Sparkles, CopyPlus
} from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import toast from 'react-hot-toast';
import PageModal from '../components/sales-channels/PageModal';
import AIGeneratorWizard from '../components/sales-channels/AIGeneratorWizard';
import ConfirmDialog from '../components/ConfirmDialog';

export default function SalesChannelDetail() {
  const { t } = useTranslation();
  const { id: channelId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useContext(AuthContext);

  const [channel, setChannel] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [aiWizardOpen, setAiWizardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const [chRes, pgRes] = await Promise.all([
        apiFetch(`/api/sales-channels/${channelId}`),
        apiFetch(`/api/sales-channels/${channelId}/pages`)
      ]);
      if (chRes.ok) { const j = await chRes.json(); setChannel(j.data ?? j); }
      if (pgRes.ok) { const j = await pgRes.json(); setPages(j.data ?? j); }
    } catch {
      toast.error('Failed to load channel');
    } finally { setLoading(false); }
  }, [channelId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreatePage = async (data) => {
    try {
      const res = await apiFetch(`/api/sales-channels/${channelId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const json = await res.json();
        const page = json.data ?? json;
        toast.success(t('salesChannels.pageCreated', 'Page created'));
        setPageModalOpen(false);
        navigate(`/sales-channels/${channelId}/pages/${page._id}/builder`);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Error');
      }
    } catch { toast.error('Error'); }
  };

  const handlePublish = async (pageId) => {
    const res = await apiFetch(`/api/sales-channels/${channelId}/pages/${pageId}/publish`, { method: 'POST' });
    if (res.ok) { toast.success(t('salesChannels.pagePublished', 'Page published')); fetchData(); }
    setMenuOpen(null);
  };

  const handleUnpublish = async (pageId) => {
    const res = await apiFetch(`/api/sales-channels/${channelId}/pages/${pageId}/unpublish`, { method: 'POST' });
    if (res.ok) { toast.success(t('salesChannels.pageUnpublished', 'Page unpublished')); fetchData(); }
    setMenuOpen(null);
  };

  const handleClone = async (pageId) => {
    try {
      const res = await apiFetch(`/api/sales-channels/${channelId}/pages/${pageId}/clone`, { method: 'POST' });
      if (res.ok) {
        toast.success(t('salesChannels.pageCloned', 'Page duplicated'));
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Clone failed');
      }
    } catch { toast.error('Clone failed'); }
    setMenuOpen(null);
  };

  const handleDeletePage = async () => {
    if (!deleteTarget) return;
    const res = await apiFetch(`/api/sales-channels/${channelId}/pages/${deleteTarget._id}`, { method: 'DELETE' });
    if (res.ok) { toast.success(t('salesChannels.pageDeleted', 'Page deleted')); fetchData(); }
    setDeleteTarget(null);
  };

  const handleAIPageComplete = (page) => {
    setAiWizardOpen(false);
    const pageId = page._id || page.page?._id;
    if (pageId) {
      window.open(`/sales-channels/${channelId}/pages/${pageId}/preview`, '_blank');
    }
    fetchData();
  };

  const getPageUrl = (page) => {
    const slug = channel?.domain?.subdomain || channel?.slug;
    return `${window.location.origin}/s/${slug}/${page.slug}`;
  };

  const copyPageUrl = (page) => {
    navigator.clipboard.writeText(getPageUrl(page));
    toast.success(t('common.copied', 'Copied to clipboard'));
    setMenuOpen(null);
  };

  // Filter pages
  const statusCounts = {
    all: pages.length,
    published: pages.filter(p => p.status === 'published').length,
    draft: pages.filter(p => p.status === 'draft').length,
  };

  const filtered = pages.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Conversion rate helper
  const convRate = (page) => {
    const r = page.stats?.conversionRate || 0;
    return r;
  };
  const convColor = (rate) => {
    if (rate >= 5) return 'text-emerald-600 dark:text-emerald-400';
    if (rate >= 2) return 'text-amber-600 dark:text-amber-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!channel) {
    return <div className="text-center py-20 text-gray-500">Channel not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales-channels')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: channel.branding?.primaryColor || '#2563eb' }}>
                {channel.name.charAt(0).toUpperCase()}
              </div>
              {channel.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Globe className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{channel.domain?.subdomain || channel.slug}.store</span>
              <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                channel.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 text-gray-600'
              )}>{channel.status}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('saleschannels.analytics') && (
            <button
              onClick={() => navigate(`/sales-channels/${channelId}/analytics`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <BarChart3 className="w-4 h-4" /> {t('salesChannels.analytics', 'Analytics')}
            </button>
          )}
          {hasPermission('saleschannels.create') && (
            <>
              <button
                onClick={() => setAiWizardOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm"
              >
                <Sparkles className="w-4 h-4" /> {t('salesChannels.ai.button', 'AI Generate')}
              </button>
              <button
                onClick={() => setPageModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> {t('salesChannels.newPage', 'New Page')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('salesChannels.pages', 'Pages'), value: pages.length, icon: FileText, color: 'text-blue-500' },
          { label: t('salesChannels.published', 'Published'), value: statusCounts.published, icon: Globe, color: 'text-emerald-500' },
          { label: t('salesChannels.kpi.orders', 'Orders'), value: channel.stats?.totalOrders || 0, icon: ShoppingCart, color: 'text-violet-500' },
          { label: t('salesChannels.kpi.revenue', 'Revenue'), value: `${(channel.stats?.totalRevenue || 0).toLocaleString()} DA`, icon: TrendingUp, color: 'text-amber-500' }
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-3">
            <s.icon className={clsx("w-5 h-5", s.color)} />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Status Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('salesChannels.searchPages', 'Search pages...')}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {[
            { key: 'all', label: t('common.all', 'All') },
            { key: 'published', label: t('salesChannels.published', 'Published') },
            { key: 'draft', label: t('salesChannels.draft', 'Draft') },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                statusFilter === tab.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {tab.label} <span className="text-[10px] opacity-60">({statusCounts[tab.key]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pages List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('salesChannels.noPagesTitle', 'No landing pages yet')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('salesChannels.noPagesDesc', 'Create your first landing page to start selling')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(page => {
            const rate = convRate(page);
            return (
              <div
                key={page._id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all p-4 flex items-center justify-between cursor-pointer group"
                onClick={() => navigate(`/sales-channels/${channelId}/pages/${page._id}/builder`)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Product image */}
                  <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0">
                    {page.product?.images?.[0] ? (
                      <img src={page.product.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><FileText className="w-6 h-6" /></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{page.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {page.product?.name} &bull; /{page.slug}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {page.stats?.views || 0}</span>
                      <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> {page.stats?.orders || 0}</span>
                      <span className={clsx("flex items-center gap-1 font-semibold", convColor(rate))}>
                        <TrendingUp className="w-3 h-3" /> {rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Quick actions — always visible */}
                  {page.status === 'published' && (
                    <button
                      onClick={e => { e.stopPropagation(); window.open(getPageUrl(page), '_blank'); }}
                      className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title={t('salesChannels.openStorefront', 'Open storefront')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); copyPageUrl(page); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={t('salesChannels.copyUrl', 'Copy URL')}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {hasPermission('saleschannels.publish') && (
                    page.status === 'draft' ? (
                      <button
                        onClick={e => { e.stopPropagation(); handlePublish(page._id); }}
                        className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        title={t('salesChannels.publish', 'Publish')}
                      >
                        <Rocket className="w-4 h-4" />
                      </button>
                    ) : page.status === 'published' ? (
                      <button
                        onClick={e => { e.stopPropagation(); handleUnpublish(page._id); }}
                        className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        title={t('salesChannels.unpublish', 'Unpublish')}
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : null
                  )}

                  {/* Status badge */}
                  <span className={clsx(
                    'px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide',
                    page.status === 'published' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                    page.status === 'draft' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                    'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  )}>
                    {page.status}
                  </span>

                  {/* More menu */}
                  <div className="relative">
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === page._id ? null : page._id); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen === page._id && (
                      <div className="absolute end-0 top-full mt-1 w-48 bg-white dark:bg-gray-700 rounded-xl shadow-xl border border-gray-100 dark:border-gray-600 z-20 py-1">
                        <button onClick={e => { e.stopPropagation(); navigate(`/sales-channels/${channelId}/pages/${page._id}/builder`); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                          <Edit3 className="w-3.5 h-3.5" /> {t('salesChannels.editPage', 'Edit Page')}
                        </button>
                        <button onClick={e => { e.stopPropagation(); window.open(`/sales-channels/${channelId}/pages/${page._id}/preview`, '_blank'); setMenuOpen(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                          <Eye className="w-3.5 h-3.5" /> {t('salesChannels.preview', 'Preview')}
                        </button>
                        {hasPermission('saleschannels.create') && (
                          <button onClick={e => { e.stopPropagation(); handleClone(page._id); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                            <CopyPlus className="w-3.5 h-3.5" /> {t('salesChannels.clonePage', 'Duplicate Page')}
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); setDeleteTarget(page); setMenuOpen(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="w-3.5 h-3.5" /> {t('common.delete', 'Delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {pageModalOpen && <PageModal onSave={handleCreatePage} onClose={() => setPageModalOpen(false)} />}
      {aiWizardOpen && <AIGeneratorWizard channelId={channelId} onComplete={handleAIPageComplete} onClose={() => setAiWizardOpen(false)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('salesChannels.deletePageTitle', 'Delete Page')}
        body={t('salesChannels.deletePageMessage', 'This will permanently delete this landing page.')}
        confirmLabel={t('common.delete', 'Delete')}
        onConfirm={handleDeletePage}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
