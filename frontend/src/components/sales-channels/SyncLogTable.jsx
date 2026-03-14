import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

const STATUS_STYLES = {
  success: { icon: CheckCircle2, bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  partial: { icon: AlertTriangle, bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  failed: { icon: XCircle, bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

const SYNC_TYPE_LABELS = {
  webhook_received: 'Webhook',
  poll_sync: 'Auto Sync',
  manual_import: 'Manual Import',
  test_connection: 'Test Connection',
};

export default function SyncLogTable({ logs = [] }) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState(null);

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
        <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
          {t('salesChannels.integration.noSyncLogs', 'No sync logs yet')}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {t('salesChannels.integration.noSyncLogsDesc', 'Logs will appear here after the first sync or webhook event')}
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
              <th className="text-start px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{t('salesChannels.integration.syncType', 'Type')}</th>
              <th className="text-start px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{t('common.status', 'Status')}</th>
              <th className="text-start px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{t('salesChannels.integration.imported', 'Imported')}</th>
              <th className="text-start px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{t('salesChannels.integration.skipped', 'Skipped')}</th>
              <th className="text-start px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{t('salesChannels.integration.duration', 'Duration')}</th>
              <th className="text-start px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{t('common.date', 'Date')}</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const style = STATUS_STYLES[log.status] || STATUS_STYLES.failed;
              const StatusIcon = style.icon;
              const hasErrors = log.syncErrors && log.syncErrors.length > 0;
              const isExpanded = expandedId === log._id;

              return (
                <Fragment key={log._id}>
                  <tr className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-750/50">
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {SYNC_TYPE_LABELS[log.syncType] || log.syncType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', style.bg, style.text)}>
                        <StatusIcon className="w-3 h-3" /> {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{log.ordersImported ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{log.ordersSkipped ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {log.duration ? `${(log.duration / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {hasErrors && (
                        <button onClick={() => setExpandedId(isExpanded ? null : log._id)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && hasErrors && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 bg-red-50/50 dark:bg-red-900/10">
                        <div className="space-y-1">
                          {log.syncErrors.map((err, i) => (
                            <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">
                              {typeof err === 'string' ? err : JSON.stringify(err)}
                            </p>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
