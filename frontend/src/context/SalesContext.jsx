import { createContext, useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../utils/apiFetch';

export const SalesContext = createContext();

export const SalesProvider = ({ children }) => {
    const { t } = useTranslation();
    const [orders, setOrders] = useState([]);
    const [performance, setPerformance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrdersCount, setTotalOrdersCount] = useState(0);

    const { token } = useContext(AuthContext);

    const fetchSalesData = async (page = 1, limit = 10) => {
        if (!token) return;
        setLoading(true);
        setFetchError(null);
        try {
            const [ordersRes, perfRes] = await Promise.all([
                apiFetch(`/api/sales/orders?page=${page}&limit=${limit}`),
                apiFetch(`/api/sales/performance`)
            ]);

            if (ordersRes.ok && perfRes.ok) {
                const ordersData = await ordersRes.json();
                setOrders(ordersData.orders || []);
                setCurrentPage(ordersData.currentPage || 1);
                setTotalPages(ordersData.totalPages || 1);
                setTotalOrdersCount(ordersData.totalOrders || 0);

                setPerformance(await perfRes.json());
            }
        } catch (error) {
            setFetchError(t('sales.errorLoadOrders', 'Failed to load orders.'));
        } finally {
            setLoading(false);
        }
    };

    // Re-fetch performance metrics whenever orders mutate locally
    const fetchPerformanceOnly = async () => {
        if (!token) return;
        try {
            const res = await apiFetch(`/api/sales/performance`);
            if (res.ok) {
                setPerformance(await res.json());
                setFetchError(null);
            }
        } catch (error) {
            setFetchError(t('sales.errorRefreshPerf', 'Failed to refresh performance metrics.'));
        }
    }

    useEffect(() => {
        if (token) fetchSalesData();
        else {
            setOrders([]);
            setPerformance(null);
        }
    }, [token]);

    const createOrder = async (orderData) => {
        const res = await apiFetch(`/api/sales/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        if (res.ok) {
            fetchSalesData(1);
            return true;
        }
        throw new Error(await res.text());
    };

    const updateOrder = async (id, orderData) => {
        const res = await apiFetch(`/api/sales/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        if (res.ok) {
            fetchSalesData(currentPage);
            return true;
        }
        throw new Error(await res.text());
    };

    const deleteOrder = async (id) => {
        const res = await apiFetch(`/api/sales/orders/${id}`, {
            method: 'DELETE',
        });
        if (res.ok) {
            fetchSalesData(currentPage);
            return true;
        }
        throw new Error(await res.text());
    };

    return (
        <SalesContext.Provider value={{
            orders, performance, loading, fetchError, fetchSalesData,
            currentPage, totalPages, totalOrdersCount,
            createOrder, updateOrder, deleteOrder
        }}>
            {children}
        </SalesContext.Provider>
    );
};
