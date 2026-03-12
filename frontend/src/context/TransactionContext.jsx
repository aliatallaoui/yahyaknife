import { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const TransactionContext = createContext();

export const TransactionProvider = ({ children }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const { token } = useContext(AuthContext);

    const fetchTransactions = async () => {
        if (!token) return;
        setLoading(true);
        setFetchError(null);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transactions`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
        } catch (error) {
            setFetchError('Failed to load transactions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchTransactions();
        } else {
            setTransactions([]);
        }
    }, [token]);

    const addTransaction = async (transaction) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(transaction)
            });
            if (res.ok) {
                const newTransaction = await res.json();
                setTransactions(prev => [newTransaction, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
                return true;
            }
            throw new Error('Failed to add transaction');
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const updateTransaction = async (id, transaction) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transactions/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(transaction)
            });
            if (res.ok) {
                const updated = await res.json();
                setTransactions(prev => prev.map(t => t._id === id ? updated : t).sort((a, b) => new Date(b.date) - new Date(a.date)));
                return true;
            }
            throw new Error('Failed to update transaction');
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const deleteTransaction = async (id, type) => {
        try {
            const url = type ? `${import.meta.env.VITE_API_URL || ''}/api/transactions/${id}?type=${type}` : `${import.meta.env.VITE_API_URL || ''}/api/transactions/${id}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (res.ok) {
                setTransactions(prev => prev.filter(t => t._id !== id));
                return true;
            }
            throw new Error('Failed to delete transaction');
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    return (
        <TransactionContext.Provider value={{ transactions, loading, fetchError, fetchTransactions, addTransaction, updateTransaction, deleteTransaction }}>
            {children}
        </TransactionContext.Provider>
    );
};
