import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Store, Globe, Palette, Activity } from 'lucide-react';
import clsx from 'clsx';
import useModalDismiss from '../../hooks/useModalDismiss';

const TABS = ['general', 'domain', 'pixels', 'branding'];

export default function ChannelModal({ channel, onSave, onClose }) {
  const { t } = useTranslation();
  const { backdropProps, panelProps } = useModalDismiss(onClose);
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'active',
    domain: { type: 'subdomain', subdomain: '', customDomain: '' },
    pixels: { metaPixelId: '', tiktokPixelId: '', googleAnalyticsId: '', googleTagManagerId: '' },
    branding: { primaryColor: '#2563eb', accentColor: '#f59e0b', fontFamily: 'Inter' }
  });

  useEffect(() => {
    if (channel) {
      setForm({
        name: channel.name || '',
        description: channel.description || '',
        status: channel.status || 'active',
        domain: { type: channel.domain?.type || 'subdomain', subdomain: channel.domain?.subdomain || '', customDomain: channel.domain?.customDomain || '' },
        pixels: { metaPixelId: channel.pixels?.metaPixelId || '', tiktokPixelId: channel.pixels?.tiktokPixelId || '', googleAnalyticsId: channel.pixels?.googleAnalyticsId || '', googleTagManagerId: channel.pixels?.googleTagManagerId || '' },
        branding: { primaryColor: channel.branding?.primaryColor || '#2563eb', accentColor: channel.branding?.accentColor || '#f59e0b', fontFamily: channel.branding?.fontFamily || 'Inter' }
      });
    }
  }, [channel]);

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

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const tabIcons = { general: Store, domain: Globe, pixels: Activity, branding: Palette };

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
          {TABS.map(t_key => {
            const Icon = tabIcons[t_key];
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('salesChannels.channelName', 'Channel Name')} *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder={t('salesChannels.namePlaceholder', 'e.g., Summer Campaign')}
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
            </>
          )}

          {tab === 'domain' && (
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

          {tab === 'pixels' && (
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

          {tab === 'branding' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('salesChannels.primaryColor', 'Primary Color')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.branding.primaryColor}
                      onChange={e => update('branding.primaryColor', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.branding.primaryColor}
                      onChange={e => update('branding.primaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('salesChannels.accentColor', 'Accent Color')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.branding.accentColor}
                      onChange={e => update('branding.accentColor', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.branding.accentColor}
                      onChange={e => update('branding.accentColor', e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('salesChannels.fontFamily', 'Font Family')}
                </label>
                <select
                  value={form.branding.fontFamily}
                  onChange={e => update('branding.fontFamily', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                >
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
            disabled={saving || !form.name.trim()}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors"
          >
            {saving ? t('common.saving', 'Saving...') : channel ? t('common.save', 'Save') : t('salesChannels.createChannel', 'Create Channel')}
          </button>
        </div>
      </div>
    </div>
  );
}
