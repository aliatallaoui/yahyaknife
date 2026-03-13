import { useState } from 'react';
import {
    MessageSquare, Send, Loader2, CheckCircle, AlertTriangle,
    Phone, MapPin, Truck, Bell, Clock, PenLine
} from 'lucide-react';
import clsx from 'clsx';
import { apiFetch } from '../../utils/apiFetch';

const MESSAGE_PRESETS = [
    {
        key: 'order_confirmed',
        label: 'Order Confirmed',
        labelAr: 'تأكيد الطلب',
        icon: CheckCircle,
        color: 'text-green-600 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20',
    },
    {
        key: 'order_dispatched',
        label: 'Order Dispatched',
        labelAr: 'تم الشحن',
        icon: Truck,
        color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20',
    },
    {
        key: 'order_in_city',
        label: 'In Your City',
        labelAr: 'وصل لولايتك',
        icon: MapPin,
        color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
    },
    {
        key: 'out_for_delivery',
        label: 'Out for Delivery',
        labelAr: 'في الطريق إليك',
        icon: Truck,
        color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
    },
    {
        key: 'answer_delivery_call',
        label: 'Answer Delivery Call',
        labelAr: 'رد على مكالمة المندوب',
        icon: Phone,
        color: 'text-red-600 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
    },
    {
        key: 'failed_delivery_attempt',
        label: 'Failed Delivery',
        labelAr: 'محاولة توصيل فاشلة',
        icon: AlertTriangle,
        color: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20',
    },
    {
        key: 'pickup_reminder',
        label: 'Pickup Reminder',
        labelAr: 'تذكير بالاستلام',
        icon: Bell,
        color: 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20',
    },
];

export default function MessagePanel({ orderId, isOpen, onMessageSent }) {
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [customMessage, setCustomMessage] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [lang, setLang] = useState('ar');

    if (!isOpen) return null;

    const handleSend = async (templateKey) => {
        setSending(true);
        setResult(null);
        try {
            const body = {
                orderId,
                templateKey: isCustom ? 'custom' : templateKey,
                lang,
                channel: 'sms',
            };
            if (isCustom) body.customMessage = customMessage;

            const res = await apiFetch('/api/call-center/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            const data = json.data ?? json;

            setResult({
                success: data.sent,
                text: data.messageText,
                error: data.error,
            });

            if (data.sent && onMessageSent) onMessageSent(templateKey);

            // Auto-clear result after 4s
            setTimeout(() => setResult(null), 4000);
        } catch (err) {
            setResult({ success: false, error: err.message });
        } finally {
            setSending(false);
            setSelectedTemplate(null);
        }
    };

    return (
        <div className="space-y-3">
            {/* Language toggle */}
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Quick Messages
                </h4>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                    <button
                        onClick={() => setLang('ar')}
                        className={clsx(
                            'px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors',
                            lang === 'ar' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                        )}
                    >
                        عربي
                    </button>
                    <button
                        onClick={() => setLang('fr')}
                        className={clsx(
                            'px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors',
                            lang === 'fr' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                        )}
                    >
                        FR
                    </button>
                </div>
            </div>

            {/* Result toast */}
            {result && (
                <div className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
                    result.success
                        ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20'
                        : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                )}>
                    {result.success ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{result.success ? 'Message sent!' : (result.error || 'Failed to send')}</span>
                </div>
            )}

            {/* Preset buttons grid */}
            <div className="grid grid-cols-2 gap-1.5">
                {MESSAGE_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = selectedTemplate === preset.key;

                    return (
                        <button
                            key={preset.key}
                            disabled={sending}
                            onClick={() => {
                                if (isSelected) {
                                    // Second click — send
                                    handleSend(preset.key);
                                } else {
                                    setSelectedTemplate(preset.key);
                                    setIsCustom(false);
                                }
                            }}
                            className={clsx(
                                'flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-all',
                                isSelected
                                    ? 'ring-2 ring-indigo-500 ' + preset.color
                                    : preset.color + ' hover:shadow-sm',
                                sending && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            {sending && isSelected ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                            ) : (
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate">
                                {isSelected ? (lang === 'ar' ? 'إرسال ←' : 'Send →') : (lang === 'ar' ? preset.labelAr : preset.label)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Custom message */}
            <div className="space-y-1.5">
                <button
                    onClick={() => { setIsCustom(!isCustom); setSelectedTemplate(null); }}
                    className={clsx(
                        'w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-all',
                        isCustom
                            ? 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    )}
                >
                    <PenLine className="h-3.5 w-3.5 shrink-0" />
                    {lang === 'ar' ? 'رسالة مخصصة' : 'Custom Message'}
                </button>

                {isCustom && (
                    <div className="space-y-1.5">
                        <textarea
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            placeholder={lang === 'ar' ? 'اكتب رسالتك هنا...' : 'Write your message...'}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 h-20 resize-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-gray-800 dark:text-gray-200 placeholder-gray-400"
                            dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        />
                        <button
                            disabled={sending || !customMessage.trim()}
                            onClick={() => handleSend('custom')}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            {lang === 'ar' ? 'إرسال' : 'Send'}
                        </button>
                    </div>
                )}
            </div>

            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                Click a template once to select, click again to send
            </p>
        </div>
    );
}
