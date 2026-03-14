import { createContext, useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../utils/apiFetch';

// eslint-disable-next-line react-refresh/only-export-components
export const TransactionContext = createContext();

export const TransactionProvider = ({ children }) => {
    const { t } = useTranslation();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const { token } = useContext(AuthContext);

    const fetchTransactions = async () => {
        if (!token) return;
        setLoading(true);
        setFetchError(null);
        try {
            const res = await apiFetch(`/api/transactions?limit=500`);
            if (res.ok) {
                const json = await res.json();
                setTransactions(json.data ?? json);
            }
        } catch {
            setFetchError(t('finance.errorLoadTransactions', 'Failed to load transactions.'));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const addTransaction = async (transaction) => {
        const res = await apiFetch(`/api/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });
        if (res.ok) {
            const newTransaction = await res.json();
            setTransactions(prev => [newTransaction, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
            return true;
        }
        throw new Error(t('finance.errorAddTransaction', 'Failed to add transaction'));
    };

    const updateTransaction = async (id, transaction) => {
        const res = await apiFetch(`/api/transactions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });
        if (res.ok) {
            const updated = await res.json();
            setTransactions(prev => prev.map(t => t._id === id ? updated : t).sort((a, b) => new Date(b.date) - new Date(a.date)));
            return true;
        }
        throw new Error(t('finance.errorUpdateTransaction', 'Failed to update transaction'));
    };

    const deleteTransaction = async (id, type) => {
        const url = type ? `/api/transactions/${id}?type=${type}` : `/api/transactions/${id}`;
        const res = await apiFetch(url, { method: 'DELETE' });
        if (res.ok) {
            setTransactions(prev => prev.filter(t => t._id !== id));
            return true;
        }
        throw new Error(t('finance.errorDeleteTransaction', 'Failed to delete transaction'));
    };

    return (
        <TransactionContext.Provider value={{ transactions, loading, fetchError, fetchTransactions, addTransaction, updateTransaction, deleteTransaction }}>
            {children}
        </TransactionContext.Provider>
    );
};
