import { create } from 'zustand';

const initialProductLine = { variantId: '', name: '', quantity: 1, unitPrice: 0, availableStock: null, sku: '', isCustom: false };

export const useOrderFormStore = create((set, get) => ({
    // Order Header
    orderId: '',
    channel: 'Website',
    status: 'New',
    priority: 'Normal',
    tags: [],

    // Customer Lookup & Intelligence
    customerPhone: '',
    customerName: '',
    customerId: null,
    customerRisk: 'Low',
    customerWarning: null,
    activeDuplicateOrders: [],
    
    // Address & Delivery
    shippingPhone2: '',
    shippingWilayaCode: '',
    shippingWilayaName: '',
    shippingCommune: '',
    shippingAddress: '',
    shippingWeight: 1,
    shippingFragile: false,
    shippingDeliveryType: 0, // 0=home, 1=stop desk
    courierId: '',
    
    // Products
    products: [{ ...initialProductLine }],
    
    // Pricing
    codAmount: 0,
    courierFee: 0,
    discount: 0,
    manualPricing: false,

    // Notes
    notes: '',
    
    // Actions
    updateField: (field, value) => set({ [field]: value }),
    
    updateProduct: (index, field, value) => {
        const newProducts = [...get().products];
        newProducts[index][field] = value;
        set({ products: newProducts });
    },
    
    updateProductMulti: (index, updates) => {
        const newProducts = [...get().products];
        newProducts[index] = { ...newProducts[index], ...updates };
        set({ products: newProducts });
    },
    
    addProduct: () => {
        set({ products: [...get().products, { ...initialProductLine }] });
    },
    
    removeProduct: (index) => {
        const newProducts = [...get().products];
        if (newProducts.length > 1) {
            newProducts.splice(index, 1);
            set({ products: newProducts });
        }
    },
    
    calculateSubtotal: () => {
        return get().products.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    },
    
    calculateFinalTotal: () => {
        const subtotal = get().calculateSubtotal();
        const fee = Number(get().courierFee) || 0;
        const discount = Number(get().discount) || 0;
        return subtotal + fee - discount;
    },

    resetForm: () => set({
        orderId: `ORD-${Math.floor(Math.random() * 100000)}`,
        channel: 'Website',
        status: 'New',
        priority: 'Normal',
        tags: [],
        customerPhone: '',
        customerName: '',
        customerId: null,
        customerRisk: 'Low',
        customerWarning: null,
        activeDuplicateOrders: [],
        shippingPhone2: '',
        shippingWilayaCode: '',
        shippingWilayaName: '',
        shippingCommune: '',
        shippingAddress: '',
        shippingWeight: 1,
        shippingFragile: false,
        shippingDeliveryType: 0,
        courierId: '',
        products: [{ ...initialProductLine }],
        codAmount: 0,
        courierFee: 0,
        discount: 0,
        manualPricing: false,
        notes: ''
    }),

    setInitialData: (data) => {
        if (!data) return;
        set({
            orderId: data.orderId || '',
            customerId: data.customer?._id || data.customer || null,
            customerName: data.customer?.name || data.shipping?.recipientName || '',
            customerPhone: data.customer?.phone || data.shipping?.phone1 || '',
            channel: data.channel || 'Website',
            status: data.status || 'New',
            priority: data.priority || 'Normal',
            tags: data.tags || [],
            notes: data.notes || '',
            codAmount: data.financials?.codAmount || data.amountToCollect || 0,
            courierFee: data.financials?.courierFee || 0,
            discount: data.financials?.discount || data.discount || 0,

            shippingPhone2: data.shipping?.phone2 || '',
            shippingWilayaCode: data.shipping?.wilayaCode || '',
            shippingWilayaName: data.shipping?.wilayaName || '',
            shippingCommune: data.shipping?.commune || '',
            shippingAddress: data.shipping?.address || '',
            shippingWeight: data.shipping?.weight || 1,
            shippingFragile: data.shipping?.fragile || false,
            shippingDeliveryType: data.shipping?.deliveryType || 0,

            courierId: data.courier?._id || data.courier || '',
            
            products: data.products?.length > 0
                ? data.products.map(p => {
                    const vid = p.variantId?._id || p.variantId || '';
                    return {
                        variantId: vid,
                        name: p.name || 'Unknown Item',
                        sku: p.sku || '',
                        quantity: p.quantity,
                        unitPrice: p.unitPrice,
                        availableStock: null,
                        isCustom: !vid
                    };
                })
                : [{ ...initialProductLine }]
        });
    }
}));
