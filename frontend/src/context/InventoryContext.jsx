import { createContext, useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../utils/apiFetch';

// eslint-disable-next-line react-refresh/only-export-components
export const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
    const { t } = useTranslation();
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
                apiFetch(`/api/inventory/products`),
                apiFetch(`/api/inventory/metrics`),
                apiFetch(`/api/inventory/suppliers`),
                apiFetch(`/api/inventory/categories`),
                apiFetch(`/api/inventory/pos`),
                apiFetch(`/api/inventory/ledger`)
            ]);

            if (prodRes.ok) { const prodJson = await prodRes.json(); setProducts(prodJson.data ?? (Array.isArray(prodJson) ? prodJson : [])); }
            if (metricsRes.ok) setMetrics(await metricsRes.json());
            if (suppRes.ok) { const suppJson = await suppRes.json(); setSuppliers(suppJson.data ?? (Array.isArray(suppJson) ? suppJson : [])); }
            if (catRes.ok) { const catJson = await catRes.json(); setCategories(catJson.data ?? (Array.isArray(catJson) ? catJson : [])); }
            if (poRes.ok) { const poJson = await poRes.json(); setPurchaseOrders(poJson.data ?? (Array.isArray(poJson) ? poJson : [])); }
            if (ledgerRes.ok) { const ledgerJson = await ledgerRes.json(); setGlobalLedger(ledgerJson.data ?? (Array.isArray(ledgerJson) ? ledgerJson : [])); }
        } catch {
            setFetchError(t('inventory.errorLoadData', 'Failed to load inventory data.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventoryData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // Lightweight refresh — only metrics (not all 6 endpoints)
    const refreshMetrics = async () => {
        try {
            const res = await apiFetch(`/api/inventory/metrics`);
            if (res.ok) setMetrics(await res.json());
        } catch { /* non-fatal */ }
    };

    const createProduct = async (formData) => {
        // formData can be FormData (with images) or plain object (legacy)
        const isFormData = formData instanceof FormData;
        const response = await apiFetch(`/api/inventory/products`, {
            method: 'POST',
            ...(isFormData
                ? { body: formData } // browser sets multipart Content-Type automatically
                : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }
            )
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || t('inventory.errorCreateProduct', 'Failed to create product'));
        }

        const newProduct = await response.json();
        setProducts(prev => [...prev, newProduct]);
        refreshMetrics();
        return newProduct;
    };

    const updateProduct = async (id, updates) => {
        const isFormData = updates instanceof FormData;
        const response = await apiFetch(`/api/inventory/products/${id}`, {
            method: 'PUT',
            ...(isFormData
                ? { body: updates }
                : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }
            )
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || t('inventory.errorUpdateProduct', 'Failed to update product'));
        }

        const updatedProduct = await response.json();
        setProducts(prev => prev.map(p => p._id === id ? updatedProduct : p));
        refreshMetrics();
        return updatedProduct;
    };

    const deleteProduct = async (id) => {
        const response = await apiFetch(`/api/inventory/products/${id}`, { method: 'DELETE' });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || t('inventory.errorDeleteProduct', 'Failed to delete product'));
        }

        setProducts(prev => prev.filter(p => p._id !== id));
        refreshMetrics();
    };

    // --- SUPPLIER CRUD ---
    const createSupplier = async (data) => {
        const res = await apiFetch(`/api/inventory/suppliers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(t('inventory.errorCreateSupplier', 'Failed to create supplier'));
        const newData = await res.json();
        setSuppliers(prev => [...prev, newData]);
        return newData;
    };

    const updateSupplier = async (id, updates) => {
        const res = await apiFetch(`/api/inventory/suppliers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error(t('inventory.errorUpdateSupplier', 'Failed to update supplier'));
        const updated = await res.json();
        setSuppliers(prev => prev.map(s => s._id === id ? updated : s));
        return updated;
    };

    const deleteSupplier = async (id) => {
        const res = await apiFetch(`/api/inventory/suppliers/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(t('inventory.errorDeleteSupplier', 'Failed to delete supplier'));
        setSuppliers(prev => prev.filter(s => s._id !== id));
    };

    // --- CATEGORY CRUD ---
    const createCategory = async (data) => {
        const res = await apiFetch(`/api/inventory/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(t('inventory.errorCreateCategory', 'Failed to create category'));
        const newData = await res.json();
        setCategories(prev => [...prev, newData]);
        return newData;
    };

    const updateCategory = async (id, updates) => {
        const res = await apiFetch(`/api/inventory/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error(t('inventory.errorUpdateCategory', 'Failed to update category'));
        const updated = await res.json();
        setCategories(prev => prev.map(c => c._id === id ? updated : c));
        return updated;
    };

    const deleteCategory = async (id) => {
        const res = await apiFetch(`/api/inventory/categories/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(t('inventory.errorDeleteCategory', 'Failed to delete category'));
        setCategories(prev => prev.filter(c => c._id !== id));
    };

    // --- POS CRUD ---
    const createPurchaseOrder = async (data) => {
        const res = await apiFetch(`/api/inventory/pos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(t('inventory.errorCreatePO', 'Failed to create purchase order'));
        const newData = await res.json();
        setPurchaseOrders(prev => [newData, ...prev]);
        return newData;
    };

    const updatePOStatus = async (id, status) => {
        const res = await apiFetch(`/api/inventory/pos/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error(t('inventory.errorUpdatePO', 'Failed to update PO status'));
        const updated = await res.json();
        setPurchaseOrders(prev => prev.map(po => po._id === id ? updated : po));

        // PO receiving affects stock levels — refresh products, metrics, and ledger
        try {
            const [prodRes, metricsRes, ledgerRes] = await Promise.all([
                apiFetch(`/api/inventory/products`),
                apiFetch(`/api/inventory/metrics`),
                apiFetch(`/api/inventory/ledger`),
            ]);
            if (prodRes.ok) { const j = await prodRes.json(); setProducts(j.data ?? (Array.isArray(j) ? j : [])); }
            if (metricsRes.ok) setMetrics(await metricsRes.json());
            if (ledgerRes.ok) { const j = await ledgerRes.json(); setGlobalLedger(j.data ?? (Array.isArray(j) ? j : [])); }
        } catch { /* non-fatal background refresh */ }

        return updated;
    };

    // --- LEDGER ---
    const fetchVariantLedger = async (variantId) => {
        const res = await apiFetch(`/api/inventory/ledger/${variantId}`);
        if (!res.ok) throw new Error(t('inventory.errorFetchLedger', 'Failed to fetch ledger'));
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
