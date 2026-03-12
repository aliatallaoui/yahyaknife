import { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
    const { token } = useContext(AuthContext);

    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [globalLedger, setGlobalLedger] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const fetchInventoryData = async () => {
        if (!token) return;
        setLoading(true);
        setFetchError(null);
        try {
            const [prodRes, metricsRes, suppRes, catRes, poRes, ledgerRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/products`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/metrics`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/suppliers`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/categories`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/pos`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/ledger`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (prodRes.ok) { const prodJson = await prodRes.json(); setProducts(prodJson.data ?? (Array.isArray(prodJson) ? prodJson : [])); }
            if (metricsRes.ok) setMetrics(await metricsRes.json());
            if (suppRes.ok) { const suppJson = await suppRes.json(); setSuppliers(suppJson.data ?? (Array.isArray(suppJson) ? suppJson : [])); }
            if (catRes.ok) { const catJson = await catRes.json(); setCategories(catJson.data ?? (Array.isArray(catJson) ? catJson : [])); }
            if (poRes.ok) { const poJson = await poRes.json(); setPurchaseOrders(poJson.data ?? (Array.isArray(poJson) ? poJson : [])); }
            if (ledgerRes.ok) { const ledgerJson = await ledgerRes.json(); setGlobalLedger(ledgerJson.data ?? (Array.isArray(ledgerJson) ? ledgerJson : [])); }
        } catch (error) {
            setFetchError('Failed to load inventory data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventoryData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const createProduct = async (productData) => {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create product');
        }

        const newProduct = await response.json();
        setProducts(prev => [...prev, newProduct]);

        // Recalculate metrics locally or re-fetch loosely
        fetchInventoryData();
        return newProduct;
    };

    const updateProduct = async (id, updates) => {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/products/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update product');
        }

        const updatedProduct = await response.json();
        setProducts(prev => prev.map(p => p._id === id ? updatedProduct : p));
        fetchInventoryData(); // Refresh metrics
        return updatedProduct;
    };

    const deleteProduct = async (id) => {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/products/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete product');
        }

        setProducts(prev => prev.filter(p => p._id !== id));
        fetchInventoryData(); // Refresh metrics
    };

    // --- SUPPLIER CRUD ---
    const createSupplier = async (data) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/suppliers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create supplier');
        const newData = await res.json();
        setSuppliers(prev => [...prev, newData]);
        return newData;
    };

    const updateSupplier = async (id, updates) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/suppliers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update supplier');
        const updated = await res.json();
        setSuppliers(prev => prev.map(s => s._id === id ? updated : s));
        return updated;
    };

    const deleteSupplier = async (id) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/suppliers/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete supplier');
        setSuppliers(prev => prev.filter(s => s._id !== id));
    };

    // --- CATEGORY CRUD ---
    const createCategory = async (data) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create category');
        const newData = await res.json();
        setCategories(prev => [...prev, newData]);
        return newData;
    };

    const updateCategory = async (id, updates) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update category');
        const updated = await res.json();
        setCategories(prev => prev.map(c => c._id === id ? updated : c));
        return updated;
    };

    const deleteCategory = async (id) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/categories/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete category');
        setCategories(prev => prev.filter(c => c._id !== id));
    };

    // --- POS CRUD ---
    const createPurchaseOrder = async (data) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/pos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create purchase order');
        const newData = await res.json();
        setPurchaseOrders(prev => [newData, ...prev]);
        return newData;
    };

    const updatePOStatus = async (id, status) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/pos/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Failed to update PO status');
        const updated = await res.json();

        // Refresh entire inventory state to see stock movement
        fetchInventoryData();
        return updated;
    };

    // --- LEDGER ---
    const fetchVariantLedger = async (variantId) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inventory/ledger/${variantId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch ledger');
        return await res.json();
    };

    return (
        <InventoryContext.Provider value={{
            products,
            suppliers,
            categories,
            metrics,
            purchaseOrders,
            globalLedger,
            loading,
            fetchError,
            createProduct,
            updateProduct,
            deleteProduct,
            createSupplier,
            updateSupplier,
            deleteSupplier,
            createCategory,
            updateCategory,
            deleteCategory,
            createPurchaseOrder,
            updatePOStatus,
            fetchVariantLedger,
            refreshInventory: fetchInventoryData
        }}>
            {children}
        </InventoryContext.Provider>
    );
};
