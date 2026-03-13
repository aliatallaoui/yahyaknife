import React, { useState, useEffect, useRef, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { PackageX, ScanLine, CheckCircle, RefreshCw, XCircle, FileText, ArrowLeftRight, Lock } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function RTOArrivalScanner() {
    const { t } = useTranslation();
    const { hasPermission } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!hasPermission('inventory.adjust')) navigate('/dashboard');
    }, [hasPermission, navigate]);
    const [scanInput, setScanInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [lastProcessed, setLastProcessed] = useState(null);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    // Auto-focus the hidden/main input field for barcode scanners
    useEffect(() => {
        const timeout = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timeout);
    }, []);

    // Keep focus even if clicking around
    const handleScreenClick = () => {
        if (!loading) inputRef.current?.focus();
    };

    const handleProcessRTO = async (e) => {
        e.preventDefault();
        const code = scanInput.trim();
        if (!code) return;

        setLoading(true);
        setError('');
        setLastProcessed(null);

        try {
            const res = await apiFetch('/api/inventory/process-rto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ searchKey: code })
            });

            const data = await res.json();

            if (res.ok) {
                setLastProcessed(data);
                // Play success beep
                const audio = new Audio('/success-beep.mp3'); // Optional: Add a simple beep file to public/
                audio.play().catch(() => {});
            } else {
                setError(data.message || t('operations.rtoFailed', 'Failed to process RTO'));
                // Play fail beep
                const audio = new Audio('/error-beep.mp3');
                audio.play().catch(() => {});
            }
        } catch (err) {
            setError(t('operations.rtoNetworkError', 'Network error processing RTO.'));
        } finally {
            setScanInput('');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in h-[calc(100vh-100px)] flex flex-col" onClick={handleScreenClick}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-xl shadow-sm">
                            <ArrowLeftRight className="w-6 h-6" />
                        </div>
                        {t('operations.rtoScanner', 'RTO Inbound Scanner')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 max-w-xl">
                        {t('operations.rtoDesc', 'Scan a returned package barcode to instantly restock the items and close the shipment loop.')}
                    </p>
                </div>
            </div>

            {/* Main Scanner Area */}
            <div className="flex-1 flex flex-col gap-6">
                
                {/* Scanner Input Box */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-indigo-100 dark:border-indigo-900/50 p-8 flex flex-col items-center justify-center relative overflow-hidden transition-all focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-50 dark:focus-within:ring-indigo-900/30">
                    <scan className="absolute top-4 left-4 flex items-center gap-2 text-indigo-400 dark:text-indigo-300 font-bold text-xs uppercase tracking-widest">
                        <ScanLine className="w-4 h-4" /> {t('operations.readyToScan', 'Ready to scan')}
                    </scan>
                    
                    <form onSubmit={handleProcessRTO} className="w-full max-w-lg mt-4">
                        <input
                            ref={inputRef}
                            type="text"
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            disabled={loading}
                            placeholder={t('operations.scanPlaceholder', 'Scan Tracking # or Order ID...')}
                            className="w-full text-center text-3xl md:text-5xl font-black text-gray-900 dark:text-white border-none outline-none bg-transparent placeholder:text-gray-200 dark:placeholder:text-gray-600"
                            autoComplete="off"
                            autoFocus
                        />
                        <button type="submit" className="hidden">Submit</button>
                    </form>

                    {loading && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex items-center justify-center z-10">
                            <span className="flex items-center gap-3 font-bold text-indigo-600 text-xl tracking-wide">
                                <RefreshCw className="w-8 h-8 animate-spin" /> {t('operations.processingRestock', 'Processing Restock...')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Status Output Area */}
                <div className="flex-1">
                    {error && (
                        <div className="bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200 h-full">
                            <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-4 inner-shadow-sm">
                                <XCircle className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-black text-rose-900 dark:text-rose-200 mb-2">{t('operations.scanRejected', 'Scan Rejected')}</h2>
                            <p className="text-rose-700 dark:text-rose-300 font-medium text-lg max-w-md">{error}</p>
                        </div>
                    )}

                    {lastProcessed && !error && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200 h-full bg-wave-pattern">
                            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-black text-emerald-900 dark:text-emerald-200 mb-2">{lastProcessed.orderId} {t('operations.restocked', 'Restocked')}</h2>
                            
                            <div className="mt-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl p-4 w-full max-w-sm border border-emerald-100 dark:border-emerald-800/50 shadow-sm text-left">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 border-b border-emerald-100 dark:border-emerald-800/50 pb-2">{t('operations.itemsRestocked', 'Items Restocked')}</p>
                                <ul className="space-y-3">
                                    {lastProcessed.items?.map((item, idx) => (
                                        <li key={idx} className="flex justify-between items-center bg-white dark:bg-gray-700 p-2 rounded-lg border border-gray-100 dark:border-gray-600">
                                            <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2">
                                                <PackageX className="w-4 h-4 text-emerald-500" /> 
                                                <span className="truncate max-w-[180px]">{item.name || 'Unknown item'}</span>
                                            </span>
                                            <span className="font-black text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">+{item.quantity}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {!lastProcessed && !error && (
                        <div className="h-full bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <FileText className="w-16 h-16 mb-4 opacity-50" />
                            <p className="font-semibold text-lg">{t('operations.waitingForScan', 'Waiting for scan...')}</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
