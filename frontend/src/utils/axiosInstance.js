import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: API });

let refreshPromise = null;

async function tryRefreshToken() {
    const rt = localStorage.getItem('refreshToken');
    if (!rt) return null;

    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const res = await axios.post(`${API}/api/auth/refresh`, { refreshToken: rt });
            const { token, refreshToken } = res.data;
            localStorage.setItem('token', token);
            localStorage.setItem('refreshToken', refreshToken);
            return token;
        } catch {
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

// Request interceptor — inject token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor — retry on 401
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retried) {
            originalRequest._retried = true;
            const newToken = await tryRefreshToken();
            if (newToken) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            }
            // Refresh failed — clear auth and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
        }

        return Promise.reject(error);
    }
);

export default api;
