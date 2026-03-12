import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from './AuthContext';

const CustomerContext = createContext();

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
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/customers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(t('crm.errorFetchCustomers', 'Failed to fetch customers'));
            const data = await res.json();
            setCustomers(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, [token]);

    const createCustomer = async (customerData) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/customers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(customerData)
            });
            if (!res.ok) throw new Error(t('crm.errorCreateCustomer', 'Failed to create customer'));
            const newCustomer = await res.json();
            setCustomers([newCustomer, ...customers]);
            return newCustomer;
        } catch (err) {
            throw err;
        }
    };

    const updateCustomer = async (id, updateData) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/customers/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });
            if (!res.ok) throw new Error(t('crm.errorUpdateCustomer', 'Failed to update customer'));
            const updatedCustomer = await res.json();
            setCustomers(customers.map(c => c._id === id ? updatedCustomer : c));
            return updatedCustomer;
        } catch (err) {
            throw err;
        }
    };

    const deleteCustomer = async (id) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/customers/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(t('crm.errorDeleteCustomer', 'Failed to delete customer'));
            setCustomers(customers.filter(c => c._id !== id));
            return true;
        } catch (err) {
            throw err;
        }
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
