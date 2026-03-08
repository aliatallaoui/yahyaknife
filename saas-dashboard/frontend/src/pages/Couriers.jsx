import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, Search, Plus, CheckCircle, Activity, MapPin, PackageOpen, Layers } from 'lucide-react';
import moment from 'moment';

export default function Couriers() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('couriers'); // 'couriers' or 'dispatch'

    // Courier Data
    const [couriers, setCouriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [onboardModalOpen, setOnboardModalOpen] = useState(false);
    const [settleModalOpen, setSettleModalOpen] = useState(false);
    const [selectedCourier, setSelectedCourier] = useState(null);
    const [settleAmount, setSettleAmount] = useState('');

    // Dispatch Hub Data
    const [pendingOrders, setPendingOrders] = useState([]);
    const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
    const [dispatchToCourierId, setDispatchToCourierId] = useState('');

    // Active Shipments Data
    const [activeShipments, setActiveShipments] = useState([]);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        vehicleType: 'Motorcycle',
        coverageZones: '',
        pricingRule: 'Flat',
        slaHours: 48
    });

    const fetchCouriers = async () => {
        try {
            const res = await fetch('/api/couriers');
            const data = await res.json();
            setCouriers(data);
        } catch (error) {
            console.error("Error fetching couriers:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOrdersData = async () => {
        try {
            const res = await fetch('/api/sales/orders?limit=1000'); // temporary simple fetch all for dispatch
            const data = await res.json();
            const ordersList = data.orders || data || [];

            const dispatchable = ordersList.filter(o => ['New', 'Confirmed', 'Preparing'].includes(o.status));
            setPendingOrders(dispatchable);

            const active = ordersList.filter(o => ['Ready for Pickup', 'Shipped', 'Out for Delivery'].includes(o.status));
            setActiveShipments(active);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchCouriers();
        fetchOrdersData();
    }, []);

    const handleUpdateShipmentStatus = async (orderId, newStatus) => {
        try {
            const res = await fetch(`/api/sales/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                fetchOrdersData();
                fetchCouriers(); // Refresh courier KPIs and cash collected
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleOnboardSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                phone: formData.phone,
                vehicleType: formData.vehicleType,
                coverageZones: formData.coverageZones.split(',').map(z => z.trim()),
                pricingRules: formData.pricingRule,
                serviceLevelAgreements: { expectedDeliveryWindowHours: Number(formData.slaHours) }
            };
            const res = await fetch('/api/couriers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                fetchCouriers();
                setOnboardModalOpen(false);
                setFormData({ name: '', phone: '', vehicleType: 'Motorcycle', coverageZones: '', pricingRule: 'Flat', slaHours: 48 });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleSettle = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/couriers/${selectedCourier._id}/settle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amountToSettle: Number(settleAmount) })
            });
            if (res.ok) {
                fetchCouriers();
                setSettleModalOpen(false);
                setSettleAmount('');
                setSelectedCourier(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleBatchDispatch = async () => {
        if (selectedOrderIds.size === 0 || !dispatchToCourierId) return alert(t('logistics.alertSelectOrders'));
        try {
            const res = await fetch(`/api/couriers/${dispatchToCourierId}/dispatch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: Array.from(selectedOrderIds) })
            });
            if (res.ok) {
                setSelectedOrderIds(new Set());
                setDispatchToCourierId('');
                fetchOrdersData();
                alert(t('logistics.alertDispatchSuccess'));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const toggleOrderSelect = (id) => {
        const newSet = new Set(selectedOrderIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedOrderIds(newSet);
    };

    const filteredCouriers = couriers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1400px]">
            {/* Header & Stats */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Truck className="w-6 h-6 text-blue-600" /> {t('logistics.title')}
                    </h1>
                    <p className="text-gray-500 mt-1 font-medium">{t('logistics.subtitle')}</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setActiveTab('couriers')} className={`px-4 py-2 font-bold rounded-lg transition-all ${activeTab === 'couriers' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t('logistics.tabCouriers')}</button>
                    <button onClick={() => setActiveTab('dispatch')} className={`px-4 py-2 font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'dispatch' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                        <PackageOpen className="w-4 h-4" /> {t('logistics.tabDispatch')}
                    </button>
                    <button onClick={() => setActiveTab('active')} className={`px-4 py-2 font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'active' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>
                        <MapPin className="w-4 h-4" /> {t('logistics.tabActive')}
                    </button>
                </div>
            </div>

            {/* TAB: COURIERS */}
            {activeTab === 'couriers' && (
                <>
                    <div className="flex justify-between items-center">
                        <div className="relative w-full max-w-sm">
                            <Search className="w-5 h-5 absolute ltr:left-3 rtl:right-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t('logistics.searchPlaceholder')}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="ltr:pl-10 rtl:pr-10 ltr:pr-4 rtl:pl-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 w-full"
                            />
                        </div>
                        <button onClick={() => setOnboardModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-sm">
                            <Plus className="w-4 h-4" /> {t('logistics.addOnboardCourier')}
                        </button>
                    </div>

                    {/* Courier Grid */}
                    {loading ? (
                        <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div></div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-6 gap-4">
                            {filteredCouriers.map(courier => (
                                <div key={courier._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col hover:border-blue-200 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold text-lg">
                                                {courier.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-gray-900 cursor-pointer">{courier.name}</h3>
                                                <p className="text-sm text-gray-500">{courier.vehicleType} • {courier.phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${courier.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {courier.status === 'Active' ? t('logistics.courierStatusActive') : courier.status}
                                            </span>
                                            <div className="flex items-center gap-1 text-xs font-bold text-gray-500">
                                                <MapPin className="w-3 h-3 text-red-400" /> {courier.coverageZones?.join(', ') || t('logistics.courierStatusGlobal')}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                                        <div>
                                            <span className="text-xs text-gray-500 font-medium tracking-wide border-b border-gray-200 pb-1 mb-1 block">{t('logistics.cashInHand')}</span>
                                            <span className="text-lg font-bold text-orange-600">{courier.pendingRemittance.toLocaleString()} <span className="text-xs text-orange-400">{t('logistics.dzdCurrency')}</span></span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500 font-medium tracking-wide border-b border-gray-200 pb-1 mb-1 block">{t('logistics.cashSettled')}</span>
                                            <span className="text-lg font-bold text-green-600">{courier.cashSettled.toLocaleString()} <span className="text-xs text-green-400">{t('logistics.dzdCurrency')}</span></span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500 font-medium tracking-wide border-b border-gray-200 pb-1 mb-1 block">{t('logistics.scoreSla')}</span>
                                            <span className="text-lg font-bold text-gray-900">{courier.reliabilityScore} / {courier.serviceLevelAgreements?.expectedDeliveryWindowHours || 24}h</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-auto">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-blue-500" />
                                            <span className="text-sm font-bold text-gray-700">{t('logistics.successRate')} {courier.successRate.toFixed(1)}%</span>
                                        </div>
                                        <button onClick={() => { setSelectedCourier(courier); setSettleModalOpen(true); }} className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md transition-colors">
                                            <CheckCircle className="w-4 h-4" /> {t('logistics.settleCashBtn')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* TAB: DISPATCH HUB */}
            {activeTab === 'dispatch' && (
                <div className="flex gap-6 h-[75vh]">
                    {/* Orders Queue */}
                    <div className="flex-1 bg-white border border-gray-200 p-6 rounded-2xl flex flex-col h-full shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-gray-400" /> {t('logistics.actionableQueue')} <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
                            </h2>
                        </div>
                        <div className="overflow-y-auto flex-1 ltr:pr-2 rtl:pl-2 space-y-3">
                            {pendingOrders.map(order => (
                                <div key={order._id} onClick={() => toggleOrderSelect(order._id)} className={`p-4 border rounded-xl cursor-pointer transition-all ${selectedOrderIds.has(order._id) ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-500' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="font-bold text-gray-900">{order.orderId}</div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${order.status === 'Preparing' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>{order.status}</span>
                                    </div>
                                    <div className="text-sm text-gray-600 font-medium">
                                        {order.products.reduce((acc, p) => acc + p.quantity, 0)} {t('logistics.itemsText')} • <span className="text-gray-900 font-bold">{order.totalAmount} {t('logistics.dzdCurrency')}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-2 flex justify-between items-center">
                                        <span>{order.customer?.name || t('logistics.customerText')}</span>
                                        <span>{order.customer?.address || t('logistics.noAddress')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dispatch Control */}
                    <div className="w-[380px] bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col shadow-inner">
                        <h2 className="text-lg font-bold text-slate-800 mb-6">{t('logistics.bulkDispatchTitle')}</h2>
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-6">
                            <div className="text-sm font-semibold text-slate-500 mb-1">{t('logistics.selectedOrders')}</div>
                            <div className="text-5xl font-black text-blue-600">{selectedOrderIds.size}</div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('logistics.assignToCourier')}</label>
                            <select
                                className="w-full border border-slate-300 rounded-lg p-3 font-semibold text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                value={dispatchToCourierId}
                                onChange={e => setDispatchToCourierId(e.target.value)}
                            >
                                <option value="">{t('logistics.selectCourierOpt')}</option>
                                {couriers.map(c => (
                                    <option key={c._id} value={c._id}>{c.name} ({c.coverageZones?.join(', ') || t('logistics.courierStatusGlobal')}) - SLA: {c.reliabilityScore}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={handleBatchDispatch}
                            disabled={selectedOrderIds.size === 0 || !dispatchToCourierId}
                            className="mt-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex justify-center items-center gap-2"
                        >
                            <Truck className="w-5 h-5" /> {t('logistics.dispatchNowBtn')}
                        </button>
                    </div>
                </div>
            )}

            {/* TAB: ACTIVE SHIPMENTS */}
            {activeTab === 'active' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <h2 className="text-lg font-bold text-gray-900">{t('logistics.liveShipmentsTitle')}</h2>
                    </div>
                    {activeShipments.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 font-medium">{t('logistics.noActiveShipments')}</div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 text-start">
                            <thead className="bg-white">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('logistics.colOrderAmount')}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('logistics.colCourier')}</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('logistics.colStatus')}</th>
                                    <th className="px-6 py-4 text-end text-xs font-bold text-gray-500 uppercase tracking-wider">{t('logistics.colActions')}</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {activeShipments.map(shipment => {
                                    const courierName = couriers.find(c => c._id === shipment.courier)?.name || 'Unknown';
                                    return (
                                        <tr key={shipment._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-gray-900">{shipment.orderId}</div>
                                                <div className="text-sm font-bold text-orange-600">{shipment.totalAmount.toLocaleString()} DZ</div>
                                                <div className="text-xs text-gray-500 mt-1">{shipment.customer?.name} • {shipment.customer?.address || 'No Address'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                                                        {courierName.charAt(0)}
                                                    </div>
                                                    <span className="font-bold text-sm text-gray-700">{courierName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${shipment.status === 'Out for Delivery' ? 'bg-amber-100 text-amber-800' :
                                                    shipment.status === 'Shipped' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {shipment.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-end text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    {shipment.status === 'Shipped' || shipment.status === 'Ready for Pickup' ? (
                                                        <button
                                                            onClick={() => handleUpdateShipmentStatus(shipment._id, 'Out for Delivery')}
                                                            className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold rounded-md transition-colors"
                                                        >
                                                            {t('logistics.btnMarkOut')}
                                                        </button>
                                                    ) : shipment.status === 'Out for Delivery' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleUpdateShipmentStatus(shipment._id, 'Delivered')}
                                                                className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold rounded-md transition-colors"
                                                            >
                                                                {t('logistics.btnMarkDelivered')}
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateShipmentStatus(shipment._id, 'Refused')}
                                                                className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-md transition-colors"
                                                            >
                                                                {t('logistics.btnMarkRefused')}
                                                            </button>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Modals */}
            {onboardModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between">
                            <h2 className="text-lg font-bold">{t('logistics.modalOnboardTitle')}</h2>
                        </div>
                        <form onSubmit={handleOnboardSubmit} className="p-6 flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">{t('logistics.lblName')}</label><input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border rounded-lg p-2" /></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">{t('logistics.lblPhone')}</label><input type="text" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full border rounded-lg p-2" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">{t('logistics.lblVehicle')}</label><select value={formData.vehicleType} onChange={e => setFormData({ ...formData, vehicleType: e.target.value })} className="w-full border rounded-lg p-2"><option>{t('logistics.optMotorcycle')}</option><option>{t('logistics.optVan')}</option><option>{t('logistics.optTruck')}</option></select></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">{t('logistics.lblSla')}</label><input type="number" required value={formData.slaHours} onChange={e => setFormData({ ...formData, slaHours: e.target.value })} className="w-full border rounded-lg p-2" /></div>
                            </div>
                            <div><label className="block text-sm font-semibold text-gray-700 mb-1">{t('logistics.lblCoverage')}</label><input type="text" placeholder={t('logistics.coveragePlaceholder')} required value={formData.coverageZones} onChange={e => setFormData({ ...formData, coverageZones: e.target.value })} className="w-full border rounded-lg p-2" /></div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setOnboardModalOpen(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg">{t('logistics.btnCancel')}</button>
                                <button type="submit" className="px-5 py-2 font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('logistics.btnAddCourier')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Settle Modal Mini */}
            {settleModalOpen && selectedCourier && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between">
                            <h2 className="text-lg font-bold">{t('logistics.modalSettleTitle')} {selectedCourier.name}</h2>
                        </div>
                        <form onSubmit={handleSettle} className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">{t('logistics.lblAmountSettle')}</label>
                                <input type="number" required max={selectedCourier.pendingRemittance} value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} className="w-full border rounded-lg p-2 font-medium text-lg" />
                                <p className="text-xs text-gray-500 mt-1">{t('logistics.lblPendingAmount')} {selectedCourier.pendingRemittance} {t('logistics.dzdCurrency')}</p>
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setSettleModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg">{t('logistics.btnCancel')}</button>
                                <button type="submit" className="px-5 py-2 text-sm font-bold bg-green-600 text-white rounded-lg">{t('logistics.btnConfirmTransfer')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
