import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext();

const API = import.meta.env.VITE_API_URL || '';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [loading, setLoading] = useState(true);
    const refreshTimerRef = useRef(null);
    const scheduleRefreshRef = useRef(null);

    // ─── Refresh token helper ────────────────────────────────────────────────
    const tryRefresh = useCallback(async () => {
        const rt = localStorage.getItem('refreshToken');
        if (!rt) return null;

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
            setToken(data.token);
            return data.token;
        } catch {
            return null;
        }
    }, []);

    const logout = () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
    };

    // Schedule silent refresh 5 minutes before access token expires (1d token → refresh at ~23h 55m)
    const scheduleRefresh = useCallback(() => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        // Refresh after 23 hours (conservative for 1-day tokens)
        const ms = 23 * 60 * 60 * 1000;
        refreshTimerRef.current = setTimeout(async () => {
            const newToken = await tryRefresh();
            if (newToken) scheduleRefreshRef.current?.();
        }, ms);
    }, [tryRefresh]);

    useEffect(() => {
        scheduleRefreshRef.current = scheduleRefresh;
    });

    useEffect(() => {
        let cancelled = false;

        const fetchUser = async () => {
            let currentToken = token;
            if (currentToken) {
                try {
                    let response = await fetch(`${API}/api/auth/me`, {
                        headers: { Authorization: `Bearer ${currentToken}` }
                    });

                    if (cancelled) return;

                    // If 401, try refresh before giving up
                    if (response.status === 401) {
                        const refreshed = await tryRefresh();
                        if (cancelled) return;
                        if (refreshed) {
                            currentToken = refreshed;
                            response = await fetch(`${API}/api/auth/me`, {
                                headers: { Authorization: `Bearer ${currentToken}` }
                            });
                            if (cancelled) return;
                        }
                    }

                    if (response.ok) {
                        const userData = await response.json();
                        if (cancelled) return;
                        setUser({
                            _id: userData._id,
                            name: userData.name,
                            email: userData.email,
                            role: userData.role,
                            roleObject: userData.roleObject,
                            permissions: userData.permissions || [],
                            permissionOverrides: userData.permissionOverrides || [],
                            isActive: userData.isActive,
                            preferences: userData.preferences || {},
                            tenant: userData.tenant,
                            tenantName: userData.tenantName || null,
                            subscription: userData.subscription || null,
                            hasMultipleTenants: userData.hasMultipleTenants || false,
                            platformRole: userData.platformRole || null,
                            onboardingCompleted: userData.onboardingCompleted ?? true,
                        });
                        scheduleRefresh();
                    } else {
                        if (!cancelled) logout();
                    }
                } catch {
                    if (!cancelled) logout();
                }
            }
            if (!cancelled) setLoading(false);
        };

        fetchUser();

        return () => {
            cancelled = true;
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        };
    }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    // Exposed refetch for profile updates etc.
    const refetchUser = useCallback(async () => {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) return;
        try {
            const response = await fetch(`${API}/api/auth/me`, {
                headers: { Authorization: `Bearer ${currentToken}` }
            });
            if (response.ok) {
                const userData = await response.json();
                setUser({
                    _id: userData._id,
                    name: userData.name,
                    email: userData.email,
                    role: userData.role,
                    roleObject: userData.roleObject,
                    permissions: userData.permissions || [],
                    permissionOverrides: userData.permissionOverrides || [],
                    isActive: userData.isActive,
                    preferences: userData.preferences || {},
                    tenant: userData.tenant,
                    tenantName: userData.tenantName || null,
                    subscription: userData.subscription || null,
                    hasMultipleTenants: userData.hasMultipleTenants || false,
                    platformRole: userData.platformRole || null,
                    onboardingCompleted: userData.onboardingCompleted ?? true,
                });
            }
        } catch { /* silent */ }
    }, []);

    const login = async (email, password) => {
        const response = await fetch(`${API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            setToken(data.token);
            setUser({
                _id: data._id,
                name: data.name,
                email: data.email,
                role: data.role,
                roleObject: data.roleObject,
                permissions: data.permissions || [],
                permissionOverrides: data.permissionOverrides || [],
                isActive: data.isActive,
                preferences: data.preferences || {},
                tenant: data.tenant,
                tenantName: data.tenantName || null,
                subscription: data.subscription || null,
                hasMultipleTenants: data.hasMultipleTenants || false,
                platformRole: data.platformRole || null,
                onboardingCompleted: data.onboardingCompleted ?? true,
            });
            localStorage.setItem('token', data.token);
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
            scheduleRefresh();
            return true;
        } else {
            throw new Error(data.message || 'Login failed');
        }
    };

    const register = async (name, email, password, businessName) => {
        const response = await fetch(`${API}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, businessName })
        });

        const data = await response.json();

        if (response.ok) {
            setToken(data.token);
            setUser({
                _id: data._id,
                name: data.name,
                email: data.email,
                role: data.role,
                roleObject: data.roleObject || null,
                permissions: data.permissions || [],
                permissionOverrides: data.permissionOverrides || [],
                isActive: data.isActive,
                preferences: data.preferences || {},
                tenant: data.tenant,
                tenantName: data.tenantName || null,
                subscription: data.subscription || null,
                hasMultipleTenants: false,
                platformRole: data.platformRole || null,
                onboardingCompleted: data.onboardingCompleted ?? false,
            });
            localStorage.setItem('token', data.token);
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
            scheduleRefresh();
            return true;
        } else {
            throw new Error(data.message || 'Registration failed');
        }
    };

    const switchTenant = useCallback(async (tenantId) => {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) throw new Error('Not authenticated');

        const res = await fetch(`${API}/api/auth/switch-tenant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${currentToken}`,
            },
            body: JSON.stringify({ tenantId }),
        });

        const data = await res.json();
        if (!res.ok) {
            toast.error(data.message || 'Failed to switch workspace');
            throw new Error(data.message);
        }

        // Update tokens
        localStorage.setItem('token', data.token);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        setToken(data.token);

        // Update user context with new tenant info
        setUser(prev => ({
            ...prev,
            tenant: data.tenant,
            tenantName: data.tenantName || null,
            role: data.role,
            roleObject: data.roleObject,
            permissions: data.permissions || [],
            subscription: data.subscription || null,
        }));

        scheduleRefresh();
        toast.success(`Switched to ${data.tenantName || 'workspace'}`);

        // Force full page reload to re-fetch all tenant-scoped data
        window.location.reload();
    }, [scheduleRefresh]);

    const updateContextPreferences = (newPreferences) => {
        if (user) {
            setUser({ ...user, preferences: newPreferences });
        }
    };

    /**
     * Checks if the current user has the required permission.
     * Super Admins always return true.
     * @param {string} action - The permission key to check (e.g. 'financial.read')
     * @returns {boolean}
     */
    // Legacy → canonical permission aliases (old DB strings → new PERMS strings)
    const PERM_ALIASES = {
        'financial.read': 'finance.view',
        'inventory.read': 'inventory.view',
        'warehouse.read': 'inventory.view',
        'sales.read': 'orders.view',
        'dispatch.read': 'shipments.view',
        'customer.read': 'customers.view',
        'hr.read': 'hr.employees.view',
        'hr.manage_attendance': 'hr.employees.view',
        'hr.manage_payroll': 'hr.payroll.view',
        'hr.view_reports': 'hr.employees.view',
    };

    const hasPermission = (action) => {
        if (!user) return false;
        if (user.role === 'Super Admin') return true;
        if (user.roleObject && user.roleObject.name === 'Super Admin') return true;
        if (!Array.isArray(user.permissions)) return false;
        // Direct match
        if (user.permissions.includes(action)) return true;
        // Check if any legacy alias in user.permissions maps to the requested action
        for (const perm of user.permissions) {
            if (PERM_ALIASES[perm] === action) return true;
        }
        // Check if the requested action has a legacy form that's in user.permissions
        for (const [legacy, canonical] of Object.entries(PERM_ALIASES)) {
            if (canonical === action && user.permissions.includes(legacy)) return true;
        }
        return false;
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, switchTenant, updateContextPreferences, hasPermission, refetchUser }}>
            {children}
        </AuthContext.Provider>
    );
};
