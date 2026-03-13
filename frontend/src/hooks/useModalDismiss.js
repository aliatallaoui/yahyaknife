import { useEffect, useCallback } from 'react';

/**
 * Hook that handles Escape-key dismissal for modals.
 * Returns a backdrop onClick handler for click-outside dismissal.
 *
 * Usage:
 *   const { backdropProps, panelProps } = useModalDismiss(onClose);
 *   return (
 *     <div className="fixed inset-0 ..." {...backdropProps}>
 *       <div className="..." {...panelProps}>
 *         ...
 *       </div>
 *     </div>
 *   );
 */
export default function useModalDismiss(onClose) {
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    return {
        backdropProps: { onClick: onClose },
        panelProps: { onClick: stopPropagation, role: 'dialog', 'aria-modal': true },
    };
}
