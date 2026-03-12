import { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const SalesContext = createContext();

export const SalesProvider = ({ children }) => {
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
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders?page=${page}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/sales/performance`, { headers: { Authorization: `Bearer ${token}` } })
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
            setFetchError('Failed to load orders.');
        } finally {
            setLoading(false);
        }
    };

    // Re-fetch performance metrics whenever orders mutate locally
    const fetchPerformanceOnly = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/sales/performance`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setPerformance(await res.json());
        } catch (error) {
            setFetchError('Failed to refresh performance metrics.');
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
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(orderData)
            });
            if (res.ok) {
                fetchSalesData(1);
                return true;
            }
            throw new Error(await res.text());
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const updateOrder = async (id, orderData) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(orderData)
            });
            if (res.ok) {
                fetchSalesData(currentPage);
                return true;
            }
            throw new Error(await res.text());
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const deleteOrder = async (id) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                fetchSalesData(currentPage);
                return true;
            }
            throw new Error(await res.text());
        } catch (error) {
            console.error(error);
            throw error;
        }
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
