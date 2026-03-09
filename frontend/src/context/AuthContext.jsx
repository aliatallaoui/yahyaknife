import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            if (token) {
                try {
                    const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/me`, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
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
                            preferences: userData.preferences || {}
                        });
                    } else {
                        logout();
                    }
                } catch (error) {
                    console.error('Failed to fetch user:', error);
                    logout();
                }
            }
            setLoading(false);
        };

        fetchUser();
    }, [token]);

    const login = async (email, password) => {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
                preferences: data.preferences || {} // capture incoming preferences
            });
            localStorage.setItem('token', data.token);
            return true;
        } else {
            throw new Error(data.message || 'Login failed');
        }
    };

    const register = async (name, email, password) => {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            setToken(data.token);
            setUser({
                _id: data._id,
                name: data.name,
                email: data.email,
                role: data.role,
                permissions: data.permissions || [],
                isActive: data.isActive
            });
            localStorage.setItem('token', data.token);
            return true;
        } else {
            throw new Error(data.message || 'Registration failed');
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
    };

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
    const hasPermission = (action) => {
        if (!user) return false;
        if (user.role === 'Super Admin') return true;
        if (user.roleObject && user.roleObject.name === 'Super Admin') return true;
        return Array.isArray(user.permissions) && user.permissions.includes(action);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateContextPreferences, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};
