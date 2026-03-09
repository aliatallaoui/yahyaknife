import { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const SalesContext = createContext();

export const SalesProvider = ({ children }) => {
    const [orders, setOrders] = useState([]);
    const [customOrders, setCustomOrders] = useState([]);
    const [performance, setPerformance] = useState(null);
    const [loading, setLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrdersCount, setTotalOrdersCount] = useState(0);

    const { token } = useContext(AuthContext);

    const fetchSalesData = async (page = 1, limit = 10) => {
        if (!token) return;
        setLoading(true);
        try {
            const [ordersRes, perfRes, customRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/sales/orders?page=${page}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/sales/performance`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/custom-orders`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            if (ordersRes.ok && perfRes.ok) {
                const ordersData = await ordersRes.json();
                setOrders(ordersData.orders || []);
                setCurrentPage(ordersData.currentPage || 1);
                setTotalPages(ordersData.totalPages || 1);
                setTotalOrdersCount(ordersData.totalOrders || 0);

                setPerformance(await perfRes.json());
            }

            if (customRes.ok) {
                setCustomOrders(await customRes.json());
            }
        } catch (error) {
            console.error('Failed to fetch sales data:', error);
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
            console.error(error);
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
                // Refresh to page 1 to see the new order
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
                fetchSalesData(currentPage); // Sync state entirely
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

    // --- Custom Orders ---
    const createCustomOrder = async (orderData) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/custom-orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

    const updateCustomOrder = async (id, orderData) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/custom-orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

    const deleteCustomOrder = async (id) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/custom-orders/${id}`, {
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
            orders, performance, loading, fetchSalesData,
            currentPage, totalPages, totalOrdersCount,
            createOrder, updateOrder, deleteOrder,
            customOrders, createCustomOrder, updateCustomOrder, deleteCustomOrder
        }}>
            {children}
        </SalesContext.Provider>
    );
};
