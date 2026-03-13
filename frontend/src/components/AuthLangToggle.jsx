import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

const LANGUAGES = [
    { code: 'ar', label: 'ع', full: 'العربية' },
    { code: 'en', label: 'En', full: 'English' },
];

export default function AuthLangToggle() {
    const { i18n } = useTranslation();

    return (
        <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm">
            {LANGUAGES.map(lang => (
                <button
                    key={lang.code}
                    onClick={() => i18n.changeLanguage(lang.code)}
                    className={clsx(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                        lang.code === i18n.language
                            ? "bg-white/[0.12] text-white shadow-sm"
                            : "text-white/40 hover:text-white/70"
                    )}
                    title={lang.full}
                >
                    {lang.label}
                </button>
            ))}
        </div>
    );
}
