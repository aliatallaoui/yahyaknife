import toast from 'react-hot-toast';

/**
 * Thin wrapper around react-hot-toast providing a consistent API.
 * Usage:
 *   import { useToast } from '../components/Toast';
 *   const toast = useToast();
 *   toast.success('Order created!');
 *   toast.error('Failed to save.');
 *   toast.info('Processing...');
 */
export function useToast() {
    return {
        success: (msg, opts) => toast.success(msg, { duration: 5000, ...opts }),
        error: (msg, opts) => toast.error(msg, { duration: 8000, ...opts }),
        info: (msg, opts) => toast(msg, { duration: 5000, icon: 'ℹ️', ...opts }),
        dismiss: toast.dismiss,
    };
}
