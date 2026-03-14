import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import useModalDismiss from '../hooks/useModalDismiss';

/**
 * Shared confirm dialog — replaces per-page inline implementations.
 *
 * Usage with hook:
 *   const { dialog, confirm } = useConfirmDialog();
 *   confirm({ title, body, danger, onConfirm, confirmLabel, cancelLabel });
 *   return <>{dialog}{...rest}</>
 *
 * Or standalone:
 *   <ConfirmDialog open={!!state} {...state} onClose={() => setState(null)} />
 */
export default function ConfirmDialog({ open, title, body, danger = false, onConfirm, onClose, confirmLabel, cancelLabel }) {
    const { t } = useTranslation();
    const { backdropProps, panelProps } = useModalDismiss(onClose);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
            {...backdropProps}
        >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150" {...panelProps}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                    <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
                </div>
                <h3 className="text-base font-black text-gray-900 dark:text-white mb-2">{title}</h3>
                {body && <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">{body}</p>}
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                        {cancelLabel || t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        onClick={() => { onClose(); onConfirm(); }}
                        className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
                    >
                        {confirmLabel || t('common.confirm', 'Confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirmDialog() {
    const [state, setState] = useState(null);

    const confirm = useCallback(({ title, body, danger, onConfirm, confirmLabel, cancelLabel }) => {
        setState({ title, body, danger, onConfirm, confirmLabel, cancelLabel });
    }, []);

    const close = useCallback(() => setState(null), []);

    const dialog = state ? (
        <ConfirmDialog
            open
            title={state.title}
            body={state.body}
            danger={state.danger}
            onConfirm={state.onConfirm}
            onClose={close}
            confirmLabel={state.confirmLabel}
            cancelLabel={state.cancelLabel}
        />
    ) : null;

    return { dialog, confirm, close };
}
