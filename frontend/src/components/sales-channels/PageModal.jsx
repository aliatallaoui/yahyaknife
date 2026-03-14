import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Package } from 'lucide-react';
import useModalDismiss from '../../hooks/useModalDismiss';
import { apiFetch } from '../../utils/apiFetch';

export default function PageModal({ onSave, onClose }) {
  const { t } = useTranslation();
  const { backdropProps, panelProps } = useModalDismiss(onClose);
  const [title, setTitle] = useState('');
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/inventory/products');
        if (res.ok) {
          const json = await res.json();
          setProducts(json.data ?? json);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProduct = products.find(p => p._id === productId);

  const handleSubmit = async () => {
    if (!title.trim() || !productId) return;
    setSaving(true);
    await onSave({ title: title.trim(), productId });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" {...backdropProps}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" {...panelProps}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('salesChannels.newPage', 'New Landing Page')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('salesChannels.pageTitle', 'Page Title')} *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('salesChannels.pageTitlePlaceholder', 'e.g., Premium Wireless Earbuds')}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('salesChannels.selectProduct', 'Select Product')} *
            </label>
            <div className="relative mb-2">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('salesChannels.searchProducts', 'Search products...')}
                className="w-full ps-9 pe-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs dark:text-white"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 dark:border-gray-600 rounded-xl p-1">
              {loading ? (
                <div className="text-center py-6 text-gray-400 text-xs">{t('common.loading', 'Loading...')}</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">{t('salesChannels.noProducts', 'No products found')}</div>
              ) : filtered.map(p => (
                <button
                  key={p._id}
                  onClick={() => { setProductId(p._id); if (!title) setTitle(p.name); }}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-start transition-colors ${
                    productId === p._id
                      ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-600 overflow-hidden shrink-0">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-gray-400" /></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.category?.name || t('inventory.uncategorized', 'Uncategorized')}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedProduct && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 overflow-hidden shrink-0">
                {selectedProduct.images?.[0] ? (
                  <img src={selectedProduct.images[0]} alt="" className="w-full h-full object-cover" />
                ) : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-gray-400" /></div>}
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">{selectedProduct.name}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">{t('common.selected', 'Selected')}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim() || !productId}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl"
          >
            {saving ? t('common.saving', 'Saving...') : t('salesChannels.createAndBuild', 'Create & Open Builder')}
          </button>
        </div>
      </div>
    </div>
  );
}
