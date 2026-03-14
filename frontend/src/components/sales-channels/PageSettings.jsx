import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save, Search, Layers, FormInput, Palette, BarChart3, Tag,
  ChevronRight
} from 'lucide-react';

/**
 * Page-level settings: SEO, variant display, form config, theme, pixels, overrides.
 */

const SECTIONS = [
  { id: 'seo', label: 'SEO', icon: Search, description: 'Search engine optimization', color: 'blue' },
  { id: 'variants', label: 'Variants', icon: Layers, description: 'Variant display options', color: 'indigo' },
  { id: 'form', label: 'Form', icon: FormInput, description: 'Order form settings', color: 'green' },
  { id: 'theme', label: 'Theme', icon: Palette, description: 'Colors & styling', color: 'purple' },
  { id: 'pixels', label: 'Pixels', icon: BarChart3, description: 'Tracking pixels', color: 'orange' },
  { id: 'overrides', label: 'Overrides', icon: Tag, description: 'Product overrides', color: 'amber' },
];

const SECTION_ICON_COLORS = {
  blue: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30',
  indigo: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30',
  green: 'text-green-500 bg-green-50 dark:bg-green-900/30',
  purple: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30',
  orange: 'text-orange-500 bg-orange-50 dark:bg-orange-900/30',
  amber: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30',
};

export default function PageSettings({ page, onSave }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const [seo, setSeo] = useState(page.seo || {});
  const [variantDisplay, setVariantDisplay] = useState(page.variantDisplay || {});
  const [formConfig, setFormConfig] = useState(page.formConfig || {});
  const [themeSettings, setThemeSettings] = useState(page.theme || {});
  const [pixels, setPixels] = useState(page.pixels || {});
  const [productOverrides, setProductOverrides] = useState(page.productOverrides || {});

  const [section, setSection] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ seo, variantDisplay, formConfig, theme: themeSettings, pixels, productOverrides });
    setSaving(false);
  };

  // Show section list when no section is selected
  if (!section) {
    return (
      <div className="p-3">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-bold mb-3 px-1">
          Page Settings
        </p>
        <div className="space-y-1">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const iconColors = SECTION_ICON_COLORS[s.color];
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group text-start"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColors}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{s.label}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{s.description}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const currentSection = SECTIONS.find(s => s.id === section);

  return (
    <div className="p-3">
      {/* Section header with back button */}
      <button
        onClick={() => setSection(null)}
        className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-3 font-medium"
      >
        <ChevronRight className="w-3 h-3 rotate-180" />
        Back to settings
      </button>

      <div className="flex items-center gap-2 mb-4">
        {(() => {
          const Icon = currentSection.icon;
          const iconColors = SECTION_ICON_COLORS[currentSection.color];
          return (
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColors}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          );
        })()}
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{currentSection.label}</h3>
      </div>

      {/* SEO */}
      {section === 'seo' && (
        <div className="space-y-3">
          <Field label={t('salesChannels.settings.seoTitle', 'SEO Title')} value={seo.title} onChange={v => setSeo(p => ({ ...p, title: v }))} placeholder={t('salesChannels.settings.seoTitlePlaceholder', 'Page title for search engines')} />
          <Field label={t('salesChannels.settings.metaDesc', 'Meta Description')} value={seo.description} onChange={v => setSeo(p => ({ ...p, description: v }))} placeholder={t('salesChannels.settings.metaDescPlaceholder', 'Description for search results')} multiline />
          <Field label={t('salesChannels.settings.ogImage', 'OG Image URL')} value={seo.ogImage} onChange={v => setSeo(p => ({ ...p, ogImage: v }))} placeholder="https://..." />
          {/* SEO preview */}
          <div className="mt-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-bold mb-2">Search Preview</p>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400 truncate">
              {seo.title || page.title || 'Page Title'}
            </p>
            <p className="text-[10px] text-green-700 dark:text-green-400 truncate mt-0.5">
              yourstore.com/s/channel/{page.slug || 'page-slug'}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {seo.description || 'Add a meta description for better search engine visibility...'}
            </p>
          </div>
        </div>
      )}

      {/* Variants */}
      {section === 'variants' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('salesChannels.settings.displayStyle', 'Display Style')}</label>
            <select
              value={variantDisplay.style || 'buttons'}
              onChange={e => setVariantDisplay(p => ({ ...p, style: e.target.value }))}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
            >
              {[
                { value: 'dropdown', label: t('salesChannels.settings.dropdown', 'Dropdown') },
                { value: 'buttons', label: t('salesChannels.settings.buttons', 'Buttons') },
                { value: 'images', label: t('salesChannels.settings.imageCards', 'Image Cards') },
                { value: 'colorSwatches', label: t('salesChannels.settings.colorSwatches', 'Color Swatches') },
                { value: 'cards', label: t('salesChannels.settings.cardBlocks', 'Card Blocks') },
                { value: 'radio', label: t('salesChannels.settings.radioButtons', 'Radio Buttons') },
                { value: 'grid', label: t('salesChannels.settings.grid', 'Grid') }
              ].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Toggle label={t('salesChannels.settings.showPrice', 'Show Price')} checked={variantDisplay.showPrice !== false} onChange={v => setVariantDisplay(p => ({ ...p, showPrice: v }))} />
          <Toggle label={t('salesChannels.settings.showStock', 'Show Stock')} checked={!!variantDisplay.showStock} onChange={v => setVariantDisplay(p => ({ ...p, showStock: v }))} />
          <Toggle label={t('salesChannels.settings.showImages', 'Show Images')} checked={variantDisplay.showImages !== false} onChange={v => setVariantDisplay(p => ({ ...p, showImages: v }))} />
        </div>
      )}

      {/* Form Config */}
      {section === 'form' && (
        <div className="space-y-3">
          <Field label={t('salesChannels.settings.submitBtn', 'Submit Button Text')} value={formConfig.submitButtonText} onChange={v => setFormConfig(p => ({ ...p, submitButtonText: v }))} placeholder={t('salesChannels.settings.submitBtnPlaceholder', 'Order Now')} />
          <Field label={t('salesChannels.settings.successMsg', 'Success Message')} value={formConfig.successMessage} onChange={v => setFormConfig(p => ({ ...p, successMessage: v }))} placeholder={t('salesChannels.settings.successMsgPlaceholder', 'Order placed!')} multiline />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('salesChannels.settings.maxQty', 'Max Quantity')}</label>
            <input
              type="number"
              value={formConfig.maxQuantity || 10}
              onChange={e => setFormConfig(p => ({ ...p, maxQuantity: Number(e.target.value) }))}
              min={1}
              max={50}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
            />
          </div>
          <Toggle label={t('salesChannels.settings.duplicateDetection', 'Duplicate Detection')} checked={formConfig.enableDuplicateDetection !== false} onChange={v => setFormConfig(p => ({ ...p, enableDuplicateDetection: v }))} />
          <Toggle label={t('salesChannels.settings.fraudCheck', 'Fraud Check')} checked={formConfig.enableFraudCheck !== false} onChange={v => setFormConfig(p => ({ ...p, enableFraudCheck: v }))} />
        </div>
      )}

      {/* Theme */}
      {section === 'theme' && (
        <div className="space-y-3">
          {/* Theme preview swatch */}
          <div className="flex gap-2 mb-1">
            {[
              { label: 'Primary', color: themeSettings.primaryColor || '#2563eb' },
              { label: 'Accent', color: themeSettings.accentColor || '#f59e0b' },
              { label: 'BG', color: themeSettings.backgroundColor || '#ffffff' },
              { label: 'Text', color: themeSettings.textColor || '#1f2937' },
            ].map(s => (
              <div key={s.label} className="flex-1 text-center">
                <div className="w-full h-8 rounded-lg border border-gray-200 dark:border-gray-600 mb-1" style={{ backgroundColor: s.color }} />
                <span className="text-[9px] text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>

          <ColorField label={t('salesChannels.settings.primaryColor', 'Primary Color')} value={themeSettings.primaryColor || '#2563eb'} onChange={v => setThemeSettings(p => ({ ...p, primaryColor: v }))} />
          <ColorField label={t('salesChannels.settings.accentColor', 'Accent Color')} value={themeSettings.accentColor || '#f59e0b'} onChange={v => setThemeSettings(p => ({ ...p, accentColor: v }))} />
          <ColorField label={t('salesChannels.settings.background', 'Background')} value={themeSettings.backgroundColor || '#ffffff'} onChange={v => setThemeSettings(p => ({ ...p, backgroundColor: v }))} />
          <ColorField label={t('salesChannels.settings.textColor', 'Text Color')} value={themeSettings.textColor || '#1f2937'} onChange={v => setThemeSettings(p => ({ ...p, textColor: v }))} />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('salesChannels.settings.buttonStyle', 'Button Style')}</label>
            <select
              value={themeSettings.buttonStyle || 'rounded'}
              onChange={e => setThemeSettings(p => ({ ...p, buttonStyle: e.target.value }))}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
            >
              <option value="rounded">{t('salesChannels.settings.rounded', 'Rounded')}</option>
              <option value="square">{t('salesChannels.settings.square', 'Square')}</option>
              <option value="pill">{t('salesChannels.settings.pill', 'Pill')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('salesChannels.settings.layout', 'Layout')}</label>
            <select
              value={themeSettings.layout || 'standard'}
              onChange={e => setThemeSettings(p => ({ ...p, layout: e.target.value }))}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
            >
              <option value="standard">{t('salesChannels.settings.standard', 'Standard')}</option>
              <option value="minimal">{t('salesChannels.settings.minimal', 'Minimal')}</option>
              <option value="bold">{t('salesChannels.settings.bold', 'Bold')}</option>
            </select>
          </div>
        </div>
      )}

      {/* Pixels */}
      {section === 'pixels' && (
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
            {t('salesChannels.settings.pixelHint', 'Page-level overrides. Leave empty to use channel defaults.')}
          </p>
          <Field label={t('salesChannels.settings.metaPixel', 'Meta Pixel ID')} value={pixels.metaPixelId} onChange={v => setPixels(p => ({ ...p, metaPixelId: v }))} placeholder={t('salesChannels.settings.optionalOverride', 'Optional override')} />
          <Field label={t('salesChannels.settings.tiktokPixel', 'TikTok Pixel ID')} value={pixels.tiktokPixelId} onChange={v => setPixels(p => ({ ...p, tiktokPixelId: v }))} />
          <Field label={t('salesChannels.settings.gaId', 'Google Analytics ID')} value={pixels.googleAnalyticsId} onChange={v => setPixels(p => ({ ...p, googleAnalyticsId: v }))} />
          <Field label={t('salesChannels.settings.gtmId', 'GTM ID')} value={pixels.googleTagManagerId} onChange={v => setPixels(p => ({ ...p, googleTagManagerId: v }))} />
        </div>
      )}

      {/* Product Overrides */}
      {section === 'overrides' && (
        <div className="space-y-3">
          <Field label={t('salesChannels.settings.displayName', 'Display Name')} value={productOverrides.displayName} onChange={v => setProductOverrides(p => ({ ...p, displayName: v }))} placeholder={t('salesChannels.settings.overrideName', 'Override product name')} />
          <Field label={t('salesChannels.settings.description', 'Description')} value={productOverrides.description} onChange={v => setProductOverrides(p => ({ ...p, description: v }))} placeholder={t('salesChannels.settings.overrideDesc', 'Override description')} multiline />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('salesChannels.settings.promoPrice', 'Promotional Price')}</label>
            <input
              type="number"
              value={productOverrides.promotionalPrice || ''}
              onChange={e => setProductOverrides(p => ({ ...p, promotionalPrice: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder={t('salesChannels.settings.leaveEmpty', 'Leave empty for default')}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
            />
          </div>
          <Toggle label={t('salesChannels.settings.showStockLevel', 'Show Stock Level')} checked={!!productOverrides.showStockLevel} onChange={v => setProductOverrides(p => ({ ...p, showStockLevel: v }))} />
          <Toggle label={t('salesChannels.settings.showOrigPrice', 'Show Original Price')} checked={productOverrides.showOriginalPrice !== false} onChange={v => setProductOverrides(p => ({ ...p, showOriginalPrice: v }))} />
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full mt-5 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
      >
        <Save className="w-3.5 h-3.5" />
        {saving ? t('common.saving', 'Saving...') : t('salesChannels.settings.saveSettings', 'Save Settings')}
      </button>
    </div>
  );
}

// Reusable field components
function Field({ label, value, onChange, placeholder, multiline }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white resize-none"
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
        />
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white font-mono" />
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      <button
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
