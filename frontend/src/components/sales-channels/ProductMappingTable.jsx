import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Trash2, ArrowRight, Link2 } from 'lucide-react';
import clsx from 'clsx';
import { apiFetch } from '../../utils/apiFetch';
import toast from 'react-hot-toast';

export default function ProductMappingTable({ channelId, mappings = [], onRefresh }) {
  const { t } = useTranslation();
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (mappingId) => {
    setDeletingId(mappingId);
    try {
      const res = await apiFetch(`/api/sales-channels/${channelId}/product-mappings/${mappingId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('salesChannels.integration.mappingDeleted', 'Mapping removed'));
        onRefresh?.();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.message || 'Failed to delete mapping');
      }
    } catch {
      toast.error('Failed to delete mapping');
    }
    setDeletingId(null);
  };

  if (mappings.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
        <Link2 className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
          {t('salesChannels.integration.noMappings', 'No product mappings')}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {t('salesChannels.integration.noMappingsDesc', 'Mappings are created automatically when orders are imported, or can be set up manually')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
              <th className="text-start px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                {t('salesChannels.integration.externalProduct', 'External Product')}
              </th>
              <th className="w-10"></th>
              <th className="text-start px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                {t('salesChannels.integration.internalProduct', 'Internal Product')}
              </th>
              <th className="text-start px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                {t('salesChannels.integration.lastSynced', 'Last Synced')}
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {mappings.map(m => (
              <tr key={m._id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-750/50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{m.externalProductName || m.externalProductId}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                      ID: {m.externalProductId}{m.externalVariantId ? ` / ${m.externalVariantId}` : ''}
                    </p>
                  </div>
                </td>
                <td className="px-2 py-3">
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      {m.internalProduct?.name || '—'}
                    </p>
                    {m.internalVariant && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {m.internalVariant.name}{m.internalVariant.sku ? ` (${m.internalVariant.sku})` : ''}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                  {m.lastSyncedAt ? new Date(m.lastSyncedAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(m._id)}
                    disabled={deletingId === m._id}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    title={t('common.delete', 'Delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
