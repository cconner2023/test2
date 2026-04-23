// utilities/ThemeContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { logError } from './ErrorHandler';

export type ThemeName = 'default' | 'ironclad' | 'forest' | 'void' | 'slipstream' | 'urban';
export type ThemeMode = 'light' | 'dark';
type ThemeId = `${ThemeName}-${ThemeMode}`;

interface ThemeContextType {
    /** Current mode — 'light' | 'dark'. Backward compat for existing consumers. */
    theme: ThemeMode;
    /** Current named theme palette. */
    themeName: ThemeName;
    /** Toggle light ↔ dark within the current theme. */
    toggleTheme: () => void;
    /** Set mode explicitly. */
    setTheme: (mode: ThemeMode) => void;
    /** Set named theme palette. */
    setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const VALID_NAMES: ThemeName[] = ['default', 'ironclad', 'forest', 'void', 'slipstream', 'urban'];
const VALID_MODES: ThemeMode[] = ['light', 'dark'];

export function parseThemeId(raw: string | null): { name: ThemeName; mode: ThemeMode } | null {
    if (!raw) return null;
    // Migrate legacy format
    if (raw === 'light') return { name: 'default', mode: 'light' };
    if (raw === 'dark') return { name: 'default', mode: 'dark' };
    const dashIdx = raw.lastIndexOf('-');
    if (dashIdx < 0) return null;
    const name = raw.slice(0, dashIdx) as ThemeName;
    const mode = raw.slice(dashIdx + 1) as ThemeMode;
    if (!VALID_NAMES.includes(name) || !VALID_MODES.includes(mode)) return null;
    return { name, mode };
}

const META_COLORS: Record<ThemeId, string> = {
    'default-light':      'rgb(255, 251, 251)',
    'default-dark':       'rgb(15, 25, 35)',
    'ironclad-light':     'rgb(251, 241, 199)',
    'ironclad-dark':      'rgb(29, 32, 33)',
    'forest-light':       'rgb(252, 252, 250)',
    'forest-dark':        'rgb(14, 15, 14)',
    'void-light':         'rgb(245, 246, 248)',
    'void-dark':          'rgb(10, 11, 13)',
    'slipstream-light':   'rgb(248, 246, 240)',
    'slipstream-dark':    'rgb(12, 15, 18)',
    'urban-light':        'rgb(240, 236, 228)',
    'urban-dark':         'rgb(14, 13, 12)',
};

/** Provides multi-theme context (named palette + light/dark mode) with localStorage persistence and system preference detection. */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [themeName, setThemeNameState] = useState<ThemeName | null>(null);
    const [themeMode, setThemeModeState] = useState<ThemeMode | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let saved: string | null = null;
        try { saved = localStorage.getItem('theme'); } catch (e) { logError('ThemeContext.getItem', e); }

        const parsed = parseThemeId(saved);
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const systemMode: ThemeMode = mediaQuery.matches ? 'dark' : 'light';

        if (parsed) {
            setThemeNameState(parsed.name);
            setThemeModeState(parsed.mode);
        } else {
            setThemeNameState('default');
            setThemeModeState(systemMode);
        }

        const handleSystemChange = (e: MediaQueryListEvent) => {
            let currentSaved: string | null = null;
            try { currentSaved = localStorage.getItem('theme'); } catch (e) { logError('ThemeContext.getItemListener', e); }
            // Only follow system preference if user hasn't explicitly chosen a theme
            if (!currentSaved) {
                setThemeModeState(e.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleSystemChange);
        return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }, []);

    // Apply theme to DOM when it changes
    useEffect(() => {
        if (!themeName || !themeMode || typeof window === 'undefined') return;

        const id: ThemeId = `${themeName}-${themeMode}`;
        document.documentElement.setAttribute('data-theme', id);

        try { localStorage.setItem('theme', id); } catch (e) { logError('ThemeContext.setItem', e); }

        const metaColor = META_COLORS[id];
        let metaEl = document.querySelector('meta[name="theme-color"]');
        if (metaEl) {
            metaEl.setAttribute('content', metaColor);
        } else {
            metaEl = document.createElement('meta');
            metaEl.setAttribute('name', 'theme-color');
            metaEl.setAttribute('content', metaColor);
            document.head.appendChild(metaEl);
        }
    }, [themeName, themeMode]);

    const setTheme = (mode: ThemeMode) => setThemeModeState(mode);
    const setThemeName = (name: ThemeName) => setThemeNameState(name);
    const toggleTheme = () => setThemeModeState(prev => prev === 'light' ? 'dark' : 'light');

    // Don't render until theme is determined (prevent flash)
    if (themeName === null || themeMode === null) return null;

    return (
        <ThemeContext.Provider value={{ theme: themeMode, themeName, toggleTheme, setTheme, setThemeName }}>
            {children}
        </ThemeContext.Provider>
    );
}

/** Access the current theme and toggle/set functions. Must be used within a ThemeProvider. */
export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
