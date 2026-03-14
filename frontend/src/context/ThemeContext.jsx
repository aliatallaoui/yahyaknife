import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from './AuthContext';

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext();

const STORAGE_KEY = 'theme-preference';

export function ThemeProvider({ children }) {
    const { user, updateContextPreferences } = useContext(AuthContext);

    // Initial theme: user pref > localStorage > 'system'
    const [theme, setThemeState] = useState(() => {
        return user?.preferences?.theme || localStorage.getItem(STORAGE_KEY) || 'system';
    });

    // Sync from user preferences when they load/change
    useEffect(() => {
        if (user?.preferences?.theme) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setThemeState(user.preferences.theme);
        }
    }, [user?.preferences?.theme]);

    // Resolve effective mode (light or dark)
    const getEffectiveMode = useCallback((themeValue) => {
        if (themeValue === 'dark') return 'dark';
        if (themeValue === 'light') return 'light';
        // system: check OS preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }, []);

    const [effectiveMode, setEffectiveMode] = useState(() => getEffectiveMode(theme));

    // Apply dark class to <html> and update effective mode
    useEffect(() => {
        const mode = getEffectiveMode(theme);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEffectiveMode(mode);
        const root = document.documentElement;
        if (mode === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        root.style.colorScheme = mode;
    }, [theme, getEffectiveMode]);

    // Listen for OS preference changes when theme is 'system'
    useEffect(() => {
        if (theme !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => {
            setEffectiveMode(e.matches ? 'dark' : 'light');
            document.documentElement.classList.toggle('dark', e.matches);
            document.documentElement.style.colorScheme = e.matches ? 'dark' : 'light';
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    const setTheme = useCallback((newTheme) => {
        setThemeState(newTheme);
        localStorage.setItem(STORAGE_KEY, newTheme);
        // Optimistically update user context
        if (user && updateContextPreferences) {
            updateContextPreferences({ ...(user.preferences || {}), theme: newTheme });
        }
    }, [user, updateContextPreferences]);

    // Cycle: light → dark → system
    const toggleTheme = useCallback(() => {
        const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
        setTheme(next);
    }, [theme, setTheme]);

    return (
        <ThemeContext.Provider value={{ theme, effectiveMode, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
