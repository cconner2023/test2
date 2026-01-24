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
            const saved = localStorage.getItem('theme') as Theme;

            if (saved === 'light' || saved === 'dark') {
                setThemeState(saved);
            } else {
                // Use system preference only if no saved preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                setThemeState(prefersDark ? 'dark' : 'light');
            }
        }
    }, []);

    // Apply theme to DOM when it changes
    useEffect(() => {
        if (theme && typeof window !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
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