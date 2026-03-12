import { useEffect, useCallback } from 'react';

/**
 * Register a keyboard shortcut.
 *
 * @param {string|string[]} keys  - Key combo(s) to match, e.g. '/', 'ctrl+k', 'escape'
 * @param {function} handler      - Callback called with the KeyboardEvent
 * @param {object}  [options]
 * @param {boolean} [options.skipInputs=true]  - Ignore when user is typing in an input/textarea/select
 * @param {boolean} [options.preventDefault=false] - Call e.preventDefault() before handler
 */
export function useHotkey(keys, handler, { skipInputs = true, preventDefault = false } = {}) {
    const combos = (Array.isArray(keys) ? keys : [keys]).map(k => k.toLowerCase());

    const listener = useCallback((e) => {
        if (skipInputs) {
            const tag = e.target?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
                return;
            }
        }

        const parts = combos.find(combo => {
            const segments = combo.split('+');
            const key = segments[segments.length - 1];
            const needsCtrl  = segments.includes('ctrl');
            const needsMeta  = segments.includes('meta');
            const needsAlt   = segments.includes('alt');
            const needsShift = segments.includes('shift');

            return (
                e.key.toLowerCase() === key &&
                e.ctrlKey  === needsCtrl &&
                e.metaKey  === needsMeta &&
                e.altKey   === needsAlt &&
                e.shiftKey === needsShift
            );
        });

        if (parts !== undefined) {
            if (preventDefault) e.preventDefault();
            handler(e);
        }
    }, [handler, combos.join('|'), skipInputs, preventDefault]);

    useEffect(() => {
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, [listener]);
}
