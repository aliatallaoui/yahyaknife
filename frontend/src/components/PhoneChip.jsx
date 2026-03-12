import { useState } from 'react';
import { Phone, Copy, Check } from 'lucide-react';

/**
 * Displays a phone number with one-click copy-to-clipboard feedback.
 * Usage: <PhoneChip phone="0555123456" />
 */
export default function PhoneChip({ phone, className = '' }) {
    const [copied, setCopied] = useState(false);

    if (!phone) return <span className={`text-gray-400 text-xs ${className}`}>—</span>;

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(phone).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Click to copy phone number'}
            className={`inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-indigo-600 group transition-colors ${className}`}
        >
            {copied
                ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                : <Phone className="w-3.5 h-3.5 shrink-0" />
            }
            <span>{phone}</span>
            {!copied && (
                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
            )}
        </button>
    );
}
