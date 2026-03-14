import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Store, Globe, Palette, Activity, Link2, ShoppingBag, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import useModalDismiss from '../../hooks/useModalDismiss';
import { apiFetch } from '../../utils/apiFetch';
import toast from 'react-hot-toast';

const CHANNEL_TYPES = [
  { value: 'landing_page', label: 'Landing Page', icon: '📄' },
  { value: 'woocommerce', label: 'WooCommerce', icon: '🛒' },
  { value: 'shopify', label: 'Shopify (Soon)', icon: '🏪', disabled: true },
  { value: 'manual', label: 'Manual', icon: '✏️' },
  { value: 'tiktok_shop', label: 'TikTok Shop (Soon)', icon: '🎵', disabled: true },
  { value: 'facebook_shop', label: 'Facebook Shop (Soon)', icon: '📘', disabled: true },
  { value: 'custom_api', label: 'Custom API (Soon)', icon: '🔌', disabled: true },
];

const STORE_TYPES = new Set(['woocommerce', 'shopify', 'tiktok_shop', 'facebook_shop', 'custom_api']);

export default function ChannelModal({ channel, onSave, onClose }) {
  const { t } = useTranslation();
  const { backdropProps, panelProps } = useModalDismiss(onClose);
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'active',
    channelType: 'landing_page',
    config: { storeUrl: '', consumerKey: '', consumerSecret: '', webhookSecret: '' },
    domain: { type: 'subdomain', subdomain: '', customDomain: '' },
    pixels: { metaPixelId: '', tiktokPixelId: '', googleAnalyticsId: '', googleTagManagerId: '' },
    branding: { primaryColor: '#2563eb', accentColor: '#f59e0b', fontFamily: 'Inter' }
  });

  useEffect(() => {
    if (channel) {
      const configObj = channel.config instanceof Map
        ? Object.fromEntries(channel.config)
        : (channel.config || {});
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: channel.name || '',
        description: channel.description || '',
        status: channel.status || 'active',
        channelType: channel.channelType || 'landing_page',
        config: {
          storeUrl: configObj.storeUrl || '',
          consumerKey: configObj.consumerKey || '',
          consumerSecret: configObj.consumerSecret ? '••••••••' : '',
          webhookSecret: configObj.webhookSecret ? '••••••••' : '',
        },
        domain: { type: channel.domain?.type || 'subdomain', subdomain: channel.domain?.subdomain || '', customDomain: channel.domain?.customDomain || '' },
        pixels: { metaPixelId: channel.pixels?.metaPixelId || '', tiktokPixelId: channel.pixels?.tiktokPixelId || '', googleAnalyticsId: channel.pixels?.googleAnalyticsId || '', googleTagManagerId: channel.pixels?.googleTagManagerId || '' },
        branding: { primaryColor: channel.branding?.primaryColor || '#2563eb', accentColor: channel.branding?.accentColor || '#f59e0b', fontFamily: channel.branding?.fontFamily || 'Inter' }
      });
    }
  }, [channel]);

  const isStore = STORE_TYPES.has(form.channelType);
  const isLandingPage = form.channelType === 'landing_page';

  // Build tabs based on channel type
  const tabs = ['general'];
  // For new WooCommerce channels, store URL is on general tab (no integration tab needed)
  if (isStore && channel) tabs.push('integration');
  if (isLandingPage) tabs.push('domain', 'pixels', 'branding');

  const update = (path, value) => {
    setForm(prev => {
      const next = { ...prev };
      const parts = path.split('.');
      if (parts.length === 2) {
        next[parts[0]] = { ...next[parts[0]], [parts[1]]: value };
      } else {
        next[path] = value;
      }
      return next;
    });
  };

  // WooCommerce OAuth — initiate flow (new channel)
  const handleWcOAuth = async () => {
    if (!form.name.trim()) return toast.error(t('salesChannels.nameRequired', 'Channel name is required'));
    if (!form.config.storeUrl?.trim()) return toast.error(t('salesChannels.storeUrlRequired', 'Store URL is required'));
    setSaving(true);
    try {
      const res = await apiFetch('/api/sales-channels/wc-auth/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description,
          storeUrl: form.config.storeUrl.trim(),
          returnUrl: `${window.location.origin}/sales-channels`,
        })
      });
      const json = await res.json();
      if (res.ok && json.data?.authUrl) {
        // Redirect to WooCommerce for approval
        window.location.href = json.data.authUrl;
      } else {
        toast.error(json.message || 'Failed to start WooCommerce connection');
        setSaving(false);
      }
    } catch {
      toast.error('Failed to start WooCommerce connection');
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    // For NEW WooCommerce channels, use OAuth flow instead of direct create
    if (!channel && form.channelType === 'woocommerce') {
      return handleWcOAuth();
    }

    setSaving(true);

    // Build submit data — only include relevant config
    const data = { ...form };

    // Strip masked passwords on edit (don't send placeholder back)
    if (channel && isStore) {
      const cleanConfig = { ...data.config };
      for (const key of ['consumerSecret', 'webhookSecret']) {
        if (cleanConfig[key] === '••••••••') delete cleanConfig[key];
      }
      data.config = cleanConfig;
    }

    // Don't send landing page fields for store channels
    if (isStore) {
      delete data.domain;
      delete data.pixels;
      delete data.branding;
    }

    await onSave(data);
    setSaving(false);
  };

  const tabIcons = { general: Store, integration: Link2, domain: Globe, pixels: Activity, branding: Palette };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" {...backdropProps}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col" {...panelProps}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {channel ? t('salesChannels.editChannel', 'Edit Channel') : t('salesChannels.newChannel', 'New Channel')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-6 gap-1">
          {tabs.map(t_key => {
            const Icon = tabIcons[t_key] || Store;
            return (
              <button
                key={t_key}
                onClick={() => setTab(t_key)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors capitalize',
                  tab === t_key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`salesChannels.tab.${t_key}`, t_key)}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab === 'general' && (
            <>
              {/* Channel Type Selector — only on create */}
              {!channel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('salesChannels.channelType', 'Channel Type')} *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CHANNEL_TYPES.map(ct => (
                      <button
                        key={ct.value}
                        type="button"
                        disabled={ct.disabled}
                        onClick={() => {
                          update('channelType', ct.value);
                          setTab('general');
                        }}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors text-start',
                          ct.disabled && 'opacity-40 cursor-not-allowed',
                          form.channelType === ct.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                            : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                        )}
                      >
                        <span className="text-lg">{ct.icon}</span>
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Show channel type badge on edit */}
              {channel && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-600 dark:text-gray-300">
                  <ShoppingBag className="w-4 h-4" />
                  {t('salesChannels.type', 'Type')}: <strong className="capitalize">{form.channelType?.replace(/_/g, ' ')}</strong>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('salesChannels.channelName', 'Channel Name')} *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder={isStore
                    ? t('salesChannels.storeNamePlaceholder', 'e.g., My WooCommerce Store')
                    : t('salesChannels.namePlaceholder', 'e.g., Summer Campaign')}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('salesChannels.description', 'Description')}
                </label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('common.status', 'Status')}
                </label>
                <select
                  value={form.status}
                  onChange={e => update('status', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">{t('common.active', 'Active')}</option>
                  <option value="inactive">{t('common.inactive', 'Inactive')}</option>
                </select>
              </div>

              {/* WooCommerce: Store URL inline on general tab for creation */}
              {!channel && form.channelType === 'woocommerce' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('salesChannels.storeUrl', 'Store URL')} *
                    </label>
                    <input
                      type="url"
                      value={form.config.storeUrl}
                      onChange={e => update('config.storeUrl', e.target.value)}
                      placeholder="https://mystore.com"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="px-3 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 text-sm text-purple-700 dark:text-purple-300 flex items-start gap-2">
                    <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{t('salesChannels.oauthHintInline', 'You\'ll be redirected to your WooCommerce store to authorize access. The channel is created only after approval.')}</span>
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'integration' && isStore && (
            <>
              <div className="px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
                {form.channelType === 'woocommerce'
                  ? t('salesChannels.integrationHintWc', 'Enter your store URL, then use OAuth to connect automatically. Or enter API keys manually.')
                  : t('salesChannels.integrationHint', 'Enter your store API credentials. Secrets are encrypted before storage.')}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('salesChannels.storeUrl', 'Store URL')} *
                </label>
                <input
                  type="url"
                  value={form.config.storeUrl}
                  onChange={e => update('config.storeUrl', e.target.value)}
                  placeholder="https://mystore.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {form.channelType === 'woocommerce' && (
                <>
                  {/* New channel: OAuth info */}
                  {!channel && (
                    <div className="px-3 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 text-sm text-purple-700 dark:text-purple-300 flex items-start gap-2">
                      <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{t('salesChannels.oauthHint', 'Click "Connect with WooCommerce" to authorize. You\'ll be redirected to your store to approve access. The channel will be created automatically after approval.')}</span>
                    </div>
                  )}

                  {/* Edit mode: show manual key fields */}
                  {channel && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('salesChannels.consumerKey', 'Consumer Key')}
                        </label>
                        <input
                          type="text"
                          value={form.config.consumerKey}
                          onChange={e => update('config.consumerKey', e.target.value)}
                          placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('salesChannels.consumerSecret', 'Consumer Secret')}
                        </label>
                        <input
                          type="password"
                          value={form.config.consumerSecret}
                          onChange={e => update('config.consumerSecret', e.target.value)}
                          placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('salesChannels.webhookSecret', 'Webhook Secret')}
                          <span className="text-xs text-gray-400 ms-1">({t('common.optional', 'Optional')})</span>
                        </label>
                        <input
                          type="password"
                          value={form.config.webhookSecret}
                          onChange={e => update('config.webhookSecret', e.target.value)}
                          placeholder={t('salesChannels.webhookSecretPlaceholder', 'For verifying incoming webhooks')}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tab === 'domain' && isLandingPage && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('salesChannels.domainType', 'Domain Type')}
                </label>
                <select
                  value={form.domain.type}
                  onChange={e => update('domain.type', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="subdomain">{t('salesChannels.subdomain', 'Subdomain')}</option>
                  <option value="custom">{t('salesChannels.customDomain', 'Custom Domain')}</option>
                </select>
              </div>
              {form.domain.type === 'subdomain' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('salesChannels.subdomain', 'Subdomain')}
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={form.domain.subdomain}
                      onChange={e => update('domain.subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="my-store"
                      className="flex-1 px-3 py-2.5 rounded-s-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="px-3 py-2.5 bg-gray-100 dark:bg-gray-600 border border-s-0 border-gray-200 dark:border-gray-600 rounded-e-xl text-xs text-gray-500 dark:text-gray-300">
                      .store
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('salesChannels.customDomain', 'Custom Domain')}
                  </label>
                  <input
                    type="text"
                    value={form.domain.customDomain}
                    onChange={e => update('domain.customDomain', e.target.value)}
                    placeholder="shop.mydomain.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </>
          )}

          {tab === 'pixels' && isLandingPage && (
            <>
              {[
                { key: 'metaPixelId', label: 'Meta Pixel ID', placeholder: '123456789012345' },
                { key: 'tiktokPixelId', label: 'TikTok Pixel ID', placeholder: 'ABCDEF1234' },
                { key: 'googleAnalyticsId', label: 'Google Analytics ID', placeholder: 'G-XXXXXXXXXX' },
                { key: 'googleTagManagerId', label: 'Google Tag Manager ID', placeholder: 'GTM-XXXXXXX' }
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                  <input
                    type="text"
                    value={form.pixels[field.key]}
                    onChange={e => update(`pixels.${field.key}`, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </>
          )}

          {tab === 'branding' && isLandingPage && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('salesChannels.primaryColor', 'Primary Color')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.branding.primaryColor} onChange={e => update('branding.primaryColor', e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer" />
                    <input type="text" value={form.branding.primaryColor} onChange={e => update('branding.primaryColor', e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('salesChannels.accentColor', 'Accent Color')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.branding.accentColor} onChange={e => update('branding.accentColor', e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer" />
                    <input type="text" value={form.branding.accentColor} onChange={e => update('branding.accentColor', e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('salesChannels.fontFamily', 'Font Family')}</label>
                <select value={form.branding.fontFamily} onChange={e => update('branding.fontFamily', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500">
                  {['Inter', 'Cairo', 'Tajawal', 'Roboto', 'Poppins', 'Open Sans', 'Montserrat'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name.trim() || (!channel && form.channelType === 'woocommerce' && !form.config.storeUrl?.trim())}
            className={clsx(
              'inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl transition-colors disabled:opacity-50',
              !channel && form.channelType === 'woocommerce'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {saving
              ? t('common.saving', 'Connecting...')
              : !channel && form.channelType === 'woocommerce'
                ? <><ExternalLink className="w-4 h-4" /> {t('salesChannels.connectWooCommerce', 'Connect with WooCommerce')}</>
                : channel
                  ? t('common.save', 'Save')
                  : t('salesChannels.createChannel', 'Create Channel')}
          </button>
        </div>
      </div>
    </div>
  );
}
