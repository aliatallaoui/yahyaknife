import { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const ManufacturingContext = createContext();

export const ManufacturingProvider = ({ children }) => {
    const { token } = useContext(AuthContext);

    const [materials, setMaterials] = useState([]);
    const [boms, setBoms] = useState([]);
    const [productionOrders, setProductionOrders] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchManufacturingData = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [matRes, bomRes, poRes, statRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/raw-materials`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/boms`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/production-orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/analytics`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (matRes.ok) { const md = await matRes.json(); setMaterials(md.data ?? (Array.isArray(md) ? md : [])); }
            if (bomRes.ok) { const bd = await bomRes.json(); setBoms(bd.data ?? (Array.isArray(bd) ? bd : [])); }
            if (poRes.ok) { const pd = await poRes.json(); setProductionOrders(pd.data ?? (Array.isArray(pd) ? pd : [])); }
            if (statRes.ok) { const sd = await statRes.json(); setAnalytics(sd.data ?? sd); }
        } catch (error) {
            console.error("Error fetching manufacturing data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchManufacturingData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // --- RAW MATERIALS ---
    const createMaterial = async (data) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/raw-materials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const newMat = json.data ?? json;
        setMaterials(prev => [...prev, newMat]);
        return newMat;
    };

    const updateMaterial = async (id, data) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/raw-materials/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const updated = json.data ?? json;
        setMaterials(prev => prev.map(m => m._id === id ? updated : m));
        return updated;
    };

    const deleteMaterial = async (id) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/raw-materials/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());
        setMaterials(prev => prev.filter(m => m._id !== id));
    };

    // --- BILL OF MATERIALS (BOM) ---
    const createBOM = async (data) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/boms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const newBom = json.data ?? json;
        setBoms(prev => [...prev, newBom]);
        return newBom;
    };

    const updateBOM = async (id, data) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/boms/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const updated = json.data ?? json;
        setBoms(prev => prev.map(b => b._id === id ? updated : b));
        return updated;
    };

    const deleteBOM = async (id) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/boms/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());
        setBoms(prev => prev.filter(b => b._id !== id));
    };

    // --- PRODUCTION ORDERS ---
    const createProductionOrder = async (data) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/production-orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const newPo = json.data ?? json;
        setProductionOrders(prev => [newPo, ...prev]);
        return newPo;
    };

    const updateProductionStatus = async (id, statusData) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/production-orders/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(statusData)
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const updated = json.data ?? json;
        setProductionOrders(prev => prev.map(po => po._id === id ? updated : po));

        // If it was completed, we need to refresh materials because inventory was deducted
        if (statusData.status === 'Completed') {
            fetchManufacturingData();
        }
        return updated;
    };

    const deleteProductionOrder = async (id) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/production/production-orders/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());
        setProductionOrders(prev => prev.filter(po => po._id !== id));
    };

    return (
        <ManufacturingContext.Provider value={{
            materials,
            boms,
            productionOrders,
            analytics,
            loading,
            createMaterial, updateMaterial, deleteMaterial,
            createBOM, updateBOM, deleteBOM,
            createProductionOrder, updateProductionStatus, deleteProductionOrder,
            refreshManufacturing: fetchManufacturingData
        }}>
            {children}
        </ManufacturingContext.Provider>
    );
};
