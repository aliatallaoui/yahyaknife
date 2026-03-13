/**
 * Fetch wrapper with automatic token refresh on 401.
 * Drop-in replacement for fetch() in API calls.
 *
 * Usage:
 *   import { apiFetch } from '../utils/apiFetch';
 *   const res = await apiFetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
 */

const API = import.meta.env.VITE_API_URL || '';

let refreshPromise = null; // Deduplicate concurrent refresh attempts

async function tryRefreshToken() {
    const rt = localStorage.getItem('refreshToken');
    if (!rt) return null;

    // If a refresh is already in-flight, wait for it
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const res = await fetch(`${API}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: rt }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            return data.token;
        } catch {
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

export async function apiFetch(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${API}${url}`;

    // Inject current token if Authorization header is present
    const token = localStorage.getItem('token');
    if (token && !options.headers?.Authorization) {
        options.headers = {
            ...options.headers,
            Authorization: `Bearer ${token}`,
        };
    }

    let response = await fetch(fullUrl, options);

    // On 401, attempt silent refresh and retry once
    if (response.status === 401) {
        const newToken = await tryRefreshToken();
        if (newToken) {
            options.headers = {
                ...options.headers,
                Authorization: `Bearer ${newToken}`,
            };
            response = await fetch(fullUrl, options);
        }
    }

    // On 402, subscription/trial expired — redirect to paywall
    if (response.status === 402) {
        const data = await response.clone().json().catch(() => ({}));
        // Dispatch a custom event so the app can react (e.g. redirect to /subscription-expired)
        window.dispatchEvent(new CustomEvent('subscription-expired', { detail: data }));
    }

    // On 403 with PLAN_LIMIT_* code — dispatch upgrade prompt event
    if (response.status === 403) {
        const data = await response.clone().json().catch(() => ({}));
        if (data.code && data.code.startsWith('PLAN_LIMIT_')) {
            window.dispatchEvent(new CustomEvent('plan-limit-reached', { detail: data }));
        }
    }

    return response;
}
