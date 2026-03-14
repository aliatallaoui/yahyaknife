import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus, Store, Globe, BarChart3, ExternalLink, Trash2, Edit3,
  Eye, EyeOff, MoreVertical, FileText, TrendingUp, ShoppingCart, Search, Megaphone,
  Wifi, WifiOff, ShoppingBag, Laptop
} from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import toast from 'react-hot-toast';
import ChannelModal from '../components/sales-channels/ChannelModal';
import ConfirmDialog from '../components/ConfirmDialog';

const CHANNEL_TYPE_META = {
  landing_page: { label: 'Landing Page', icon: FileText, color: 'blue' },
  woocommerce: { label: 'WooCommerce', icon: ShoppingCart, color: 'purple' },
  shopify: { label: 'Shopify', icon: ShoppingBag, color: 'green' },
  manual: { label: 'Manual', icon: FileText, color: 'gray' },
  tiktok_shop: { label: 'TikTok Shop', icon: Store, color: 'pink' },
  facebook_shop: { label: 'Facebook Shop', icon: Store, color: 'blue' },
  custom_api: { label: 'Custom API', icon: Laptop, color: 'indigo' },
};

export default function SalesChannels() {
  const { t } = useTranslation();
  const { hasPermission } = useContext(AuthContext);
  const navigate = useNavigate();

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await apiFetch('/api/sales-channels');
      if (res.ok) {
        const json = await res.json();
        setChannels(json.data ?? json);
      }
    } catch {
      toast.error(t('salesChannels.errorFetch', 'Failed to load sales channels'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const handleCreate = () => {
    setEditingChannel(null);
    setModalOpen(true);
  };

  const handleEdit = (channel) => {
    setEditingChannel(channel);
    setModalOpen(true);
    setMenuOpen(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(`/api/sales-channels/${deleteTarget._id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('salesChannels.deleted', 'Channel deleted'));
        fetchChannels();
      }
    } catch {
      toast.error(t('salesChannels.errorDelete', 'Failed to delete channel'));
    }
    setDeleteTarget(null);
  };

  const handleSave = async (data) => {
    try {
      const isEdit = !!editingChannel;
      const url = isEdit ? `/api/sales-channels/${editingChannel._id}` : '/api/sales-channels';
      const res = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        toast.success(isEdit ? t('salesChannels.updated', 'Channel updated') : t('salesChannels.created', 'Channel created'));
        setModalOpen(false);
        fetchChannels();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Error');
      }
    } catch {
      toast.error('Error saving channel');
    }
  };

  const filtered = channels.filter(c => {
    if (typeFilter !== 'all' && c.channelType !== typeFilter) return false;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });

  // Summary stats
  const totalPages = channels.reduce((s, c) => s + (c.stats?.totalPages || 0), 0);
  const totalOrders = channels.reduce((s, c) => s + (c.stats?.totalOrders || 0), 0);
  const totalRevenue = channels.reduce((s, c) => s + (c.stats?.totalRevenue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Megaphone className="w-7 h-7 text-blue-600" />
            {t('salesChannels.title', 'Sales Channels')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('salesChannels.subtitle', 'Manage your sales channels — landing pages, stores, and integrations')}
          </p>
        </div>
        {hasPermission('saleschannels.create') && (
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('salesChannels.createChannel', 'New Channel')}
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t('salesChannels.kpi.pages', 'Landing Pages'), value: totalPages, icon: FileText, color: 'blue' },
          { label: t('salesChannels.kpi.orders', 'Total Orders'), value: totalOrders, icon: ShoppingCart, color: 'green' },
          { label: t('salesChannels.kpi.revenue', 'Total Revenue'), value: `${totalRevenue.toLocaleString()} DA`, icon: TrendingUp, color: 'purple' }
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4">
            <div className={clsx(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              kpi.color === 'blue' && 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
              kpi.color === 'green' && 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
              kpi.color === 'purple' && 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
            )}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('salesChannels.searchPlaceholder', 'Search channels...')}
          className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
        />
      </div>

      {/* Channel Type Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all', label: t('common.all', 'All') },
          { key: 'landing_page', label: t('salesChannels.types.landingPage', 'Landing Pages') },
          { key: 'woocommerce', label: 'WooCommerce' },
          { key: 'shopify', label: 'Shopify' },
          { key: 'manual', label: t('salesChannels.types.manual', 'Manual') },
        ].map(pill => (
          <button
            key={pill.key}
            onClick={() => setTypeFilter(pill.key)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
              typeFilter === pill.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Channel Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <Store className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            {channels.length === 0
              ? t('salesChannels.emptyTitle', 'No sales channels yet')
              : t('salesChannels.noResults', 'No channels match your search')
            }
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('salesChannels.emptyDescription', 'Create your first channel to start building landing pages')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(channel => (
            <div
              key={channel._id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-200 overflow-hidden group cursor-pointer"
              onClick={() => navigate(`/sales-channels/${channel._id}`)}
            >
              {/* Channel Header */}
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: channel.branding?.primaryColor || '#2563eb' }}>
                      {channel.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{channel.name}</h3>
                        {channel.channelType !== 'landing_page' && (
                          <span className={clsx(
                            'w-2 h-2 rounded-full shrink-0',
                            channel.integration?.status === 'connected' ? 'bg-emerald-500' :
                            channel.integration?.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                          )} title={channel.integration?.status || 'pending_setup'} />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {channel.channelType === 'landing_page' ? (
                          <>
                            <Globe className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {channel.domain?.subdomain || channel.slug}.store
                            </span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                              {channel.config?.storeUrl || channel.name}
                            </span>
                          </>
                        )}
                      </div>
                      <span className={clsx(
                        'inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                        CHANNEL_TYPE_META[channel.channelType]?.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                        CHANNEL_TYPE_META[channel.channelType]?.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
                        CHANNEL_TYPE_META[channel.channelType]?.color === 'green' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
                        CHANNEL_TYPE_META[channel.channelType]?.color === 'gray' && 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300',
                        CHANNEL_TYPE_META[channel.channelType]?.color === 'pink' && 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
                        CHANNEL_TYPE_META[channel.channelType]?.color === 'indigo' && 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                      )}>
                        {CHANNEL_TYPE_META[channel.channelType]?.label || channel.channelType}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === channel._id ? null : channel._id); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen === channel._id && (
                      <div className="absolute end-0 top-full mt-1 w-44 bg-white dark:bg-gray-700 rounded-xl shadow-xl border border-gray-100 dark:border-gray-600 z-20 py-1">
                        <button onClick={e => { e.stopPropagation(); handleEdit(channel); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                          <Edit3 className="w-3.5 h-3.5" /> {t('common.edit', 'Edit')}
                        </button>
                        <button onClick={e => { e.stopPropagation(); setDeleteTarget(channel); setMenuOpen(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="w-3.5 h-3.5" /> {t('common.delete', 'Delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {channel.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{channel.description}</p>
                )}
              </div>

              {/* Stats Footer */}
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-750 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {channel.channelType === 'landing_page' ? (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> {channel.stats?.totalPages || 0}
                    </span>
                  ) : (
                    <span className={clsx('flex items-center gap-1 text-[10px] font-bold uppercase',
                      channel.integration?.status === 'connected' ? 'text-emerald-600 dark:text-emerald-400' :
                      channel.integration?.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
                    )}>
                      {channel.integration?.status === 'connected' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                      {channel.integration?.status || 'pending'}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5" /> {channel.stats?.totalOrders || 0}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="w-3.5 h-3.5" /> {(channel.stats?.totalRevenue || 0).toLocaleString()} DA
                  </span>
                </div>
                <span className={clsx(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
                  channel.status === 'active'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                )}>
                  {channel.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modalOpen && (
        <ChannelModal
          channel={editingChannel}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('salesChannels.deleteTitle', 'Delete Channel')}
        body={t('salesChannels.deleteMessage', 'This will delete the channel and all its landing pages. This action cannot be undone.')}
        confirmLabel={t('common.delete', 'Delete')}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
