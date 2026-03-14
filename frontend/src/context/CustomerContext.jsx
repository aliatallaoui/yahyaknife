import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../utils/apiFetch';

const CustomerContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useCustomer = () => useContext(CustomerContext);

export const CustomerProvider = ({ children }) => {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCustomers = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await apiFetch(`/api/customers?limit=500`);
            if (!res.ok) throw new Error(t('crm.errorFetchCustomers', 'Failed to fetch customers'));
            const json = await res.json();
            setCustomers(json.data ?? json);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const createCustomer = async (customerData) => {
        const res = await apiFetch(`/api/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customerData)
        });
        if (!res.ok) throw new Error(t('crm.errorCreateCustomer', 'Failed to create customer'));
        const newCustomer = await res.json();
        setCustomers([newCustomer, ...customers]);
        return newCustomer;
    };

    const updateCustomer = async (id, updateData) => {
        const res = await apiFetch(`/api/customers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        if (!res.ok) throw new Error(t('crm.errorUpdateCustomer', 'Failed to update customer'));
        const updatedCustomer = await res.json();
        setCustomers(customers.map(c => c._id === id ? updatedCustomer : c));
        return updatedCustomer;
    };

    const deleteCustomer = async (id) => {
        const res = await apiFetch(`/api/customers/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(t('crm.errorDeleteCustomer', 'Failed to delete customer'));
        setCustomers(customers.filter(c => c._id !== id));
        return true;
    };

    const refreshCustomers = fetchCustomers;

    return (
        <CustomerContext.Provider value={{
            customers,
            loading,
            error,
            createCustomer,
            updateCustomer,
            deleteCustomer,
            refreshCustomers
        }}>
            {children}
        </CustomerContext.Provider>
    );
};
