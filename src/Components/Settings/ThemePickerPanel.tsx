import { useTheme, type ThemeName, type ThemeMode } from '../../Utilities/ThemeContext';

const THEME_DEFS: {
    name: ThemeName;
    label: string;
    tagline: string;
    dark: { bg: string; surface: string; accent: string; text: string };
    light: { bg: string; surface: string; accent: string; text: string };
}[] = [
    {
        name: 'default',
        label: 'Default',
        tagline: 'Baseline Medical Network',
        dark:  { bg: '#0f1923', surface: '#19232d', accent: '#158eac', text: '#cbd1d6' },
        light: { bg: '#fffbfb', surface: '#f0f2f5', accent: '#00425c', text: '#1e1e23' },
    },
    {
        name: 'ironclad',
        label: 'Ironclad',
        tagline: 'Desert Command',
        dark:  { bg: '#1d2021', surface: '#282828', accent: '#fe8019', text: '#ebdbb2' },
        light: { bg: '#fcf9f2', surface: '#f6f0e4', accent: '#af3a03', text: '#3c3836' },
    },
    {
        name: 'forest',
        label: 'Forest',
        tagline: 'Extended Jungle Operations',
        dark:  { bg: '#0e0f0e', surface: '#161816', accent: '#34a27c', text: '#d2dad4' },
        light: { bg: '#fcfcfa', surface: '#f2f3f0', accent: '#166e52', text: '#121412' },
    },
    {
        name: 'void',
        label: 'Void',
        tagline: 'Tactical Neural Network',
        dark:  { bg: '#0a0b0d', surface: '#101216', accent: '#00d4e8', text: '#d8e0e8' },
        light: { bg: '#f5f6f8', surface: '#e8eaee', accent: '#006e94', text: '#0c0e12' },
    },
        {
            name: 'slipstream',
            label: 'Slipstream',
            tagline: 'Lightweight Operations',
            dark: { bg: '#0c0f12', surface: '#141a20', accent: '#54887c', text: '#c8d6d4' },
            light: { bg: '#f8f6f0', surface: '#ece8de', accent: '#306458', text: '#12120e' },
        },
        {
            name: 'urban',
            label: 'Urban',
            tagline: 'Familiar Terrain Command',
            dark: { bg: '#0e0d0c', surface: '#161412', accent: '#84644e', text: '#dcd4c8' },
            light: { bg: '#f0ece4', surface: '#e0dace', accent: '#5a4230', text: '#12100c' },
        },
];

export function ThemePickerPanel() {
    const { theme: themeMode, themeName, setTheme, setThemeName } = useTheme();

    return (
        <div data-tour="theme-picker-grid" className="px-5 py-4 space-y-3">
            {THEME_DEFS.map((def) => {
                const isSelected = themeName === def.name;
                const pal = themeMode === 'dark' ? def.dark : def.light;

                return (
                    <button
                        key={def.name}
                        onClick={() => setThemeName(def.name)}
                        className={`w-full rounded-2xl border transition-all active:scale-[0.98] overflow-hidden text-left ${
                            isSelected
                                ? 'border-themeblue2/60 shadow-sm'
                                : 'border-themeblue3/10 hover:border-themeblue3/20'
                        }`}
                    >
                        {/* Mini preview */}
                        <div
                            className="w-full h-16 relative overflow-hidden"
                            style={{ backgroundColor: pal.bg }}
                        >
                            <div
                                className="absolute top-3 left-3 right-3 h-8 rounded-lg"
                                style={{ backgroundColor: pal.surface }}
                            />
                            <div
                                className="absolute top-5 left-5 h-3 w-12 rounded-full"
                                style={{ backgroundColor: pal.accent, opacity: 0.9 }}
                            />
                            <div className="absolute top-5 left-20 space-y-1.5">
                                <div className="h-2 w-16 rounded-full" style={{ backgroundColor: pal.text, opacity: 0.8 }} />
                                <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: pal.text, opacity: 0.4 }} />
                            </div>
                        </div>

                        {/* Info row */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-themewhite2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-primary">{def.label}</p>
                                <p className="text-[9pt] text-tertiary mt-0.5">{def.tagline}</p>
                            </div>
                            {/* light / dark mode toggle */}
                            <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-lg border border-tertiary/15">
                                {(['light', 'dark'] as ThemeMode[]).map((mode) => {
                                    const isActiveMode = isSelected && themeMode === mode;
                                    return (
                                        <button
                                            key={mode}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setThemeName(def.name);
                                                setTheme(mode);
                                            }}
                                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                                isActiveMode
                                                    ? 'bg-themeblue2 text-white'
                                                : 'bg-themeblue2/8 text-primary'
                                            }`}
                                        >
                                            {mode === 'light' ? (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="4" />
                                                    <line x1="12" y1="2" x2="12" y2="4" />
                                                    <line x1="12" y1="20" x2="12" y2="22" />
                                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                                    <line x1="2" y1="12" x2="4" y2="12" />
                                                    <line x1="20" y1="12" x2="22" y2="12" />
                                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                                </svg>
                                            ) : (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                                </svg>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            {isSelected ? (
                                <div className="w-5 h-5 rounded-full bg-themeblue2 flex items-center justify-center shrink-0">
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            ) : (
                                <div className="w-5 h-5 shrink-0" />
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
