// utilities/ThemeContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Initialize with null, then detect on mount
    const [theme, setThemeState] = useState<Theme | null>(null);

    useEffect(() => {
        // Only run on client side
        if (typeof window !== 'undefined') {
            let saved: string | null = null;
            try {
                saved = localStorage.getItem('theme') as Theme;
            } catch {
                // localStorage unavailable — fall through to system preference
            }
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

            if (saved === 'light' || saved === 'dark') {
                setThemeState(saved);
            } else {
                // Use system preference only if no saved preference
                setThemeState(mediaQuery.matches ? 'dark' : 'light');
            }

            // Listen for system theme preference changes
            const handleSystemThemeChange = (e: MediaQueryListEvent) => {
                let currentSaved: string | null = null;
                try {
                    currentSaved = localStorage.getItem('theme') as Theme;
                } catch {
                    // localStorage unavailable
                }
                // Only update if user hasn't set a manual preference
                if (currentSaved !== 'light' && currentSaved !== 'dark') {
                    setThemeState(e.matches ? 'dark' : 'light');
                }
            };

            mediaQuery.addEventListener('change', handleSystemThemeChange);
            return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
        }
    }, []);

    // Apply theme to DOM when it changes
    useEffect(() => {
        if (theme && typeof window !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);
            try {
                localStorage.setItem('theme', theme);
            } catch {
                // localStorage full or unavailable — theme still works in-memory for this session
            }

            // Update iOS/Safari theme-color meta tag to match current theme
            const themeColor = theme === 'dark' ? 'rgb(15, 25, 35)' : 'rgb(255, 251, 251)';
            let metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
                metaThemeColor.setAttribute('content', themeColor);
            } else {
                metaThemeColor = document.createElement('meta');
                metaThemeColor.setAttribute('name', 'theme-color');
                metaThemeColor.setAttribute('content', themeColor);
                document.head.appendChild(metaThemeColor);
            }
        }
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    const toggleTheme = () => {
        setThemeState(prev => prev === 'light' ? 'dark' : 'light');
    };

    // Don't render until theme is determined (prevent flash)
    if (theme === null) {
        return null; // or a loading spinner
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}