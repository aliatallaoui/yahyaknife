import { useState } from 'react';
import { Phone, Copy, Check, MessageCircle } from 'lucide-react';

/**
 * Displays a phone number with one-click copy-to-clipboard feedback,
 * along with a direct WhatsApp message link.
 * Usage: <PhoneChip phone="0555123456" />
 */
export default function PhoneChip({ phone, className = '' }) {
    const [copied, setCopied] = useState(false);

    if (!phone) return <span className={`text-gray-400 text-xs ${className}`}>—</span>;
    
    // Attempt standard formatting for Algeria, fallback to raw digits
    let waPhone = phone.replace(/\D/g, '');
    if (waPhone.startsWith('0')) waPhone = '213' + waPhone.substring(1);

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(phone).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <div className={`inline-flex items-center gap-1 ${className}`} onClick={e => e.stopPropagation()}>
            <button
                type="button"
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Click to copy phone number'}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-indigo-600 group transition-colors py-0.5"
            >
                {copied
                    ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    : <Phone className="w-3.5 h-3.5 shrink-0 relative top-[0.5px]" />
                }
                <span>{phone}</span>
                {!copied && (
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                )}
            </button>
            <a 
                href={`https://wa.me/${waPhone}`} 
                target="_blank" 
                rel="noopener noreferrer"
                title="Message on WhatsApp"
                className="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors ms-1"
            >
                <MessageCircle className="w-3.5 h-3.5" />
            </a>
        </div>
    );
}
