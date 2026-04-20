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
        tagline: 'Steel & navy',
        dark:  { bg: '#0f1923', surface: '#19232d', accent: '#158eac', text: '#cbd1d6' },
        light: { bg: '#fffbfb', surface: '#f0f2f5', accent: '#00425c', text: '#1e1e23' },
    },
    {
        name: 'ironclad',
        label: 'Ironclad',
        tagline: 'Desert command',
        dark:  { bg: '#1d2021', surface: '#282828', accent: '#fe8019', text: '#ebdbb2' },
        light: { bg: '#fcf9f2', surface: '#f6f0e4', accent: '#af3a03', text: '#3c3836' },
    },
    {
        name: 'forest',
        label: 'Forest',
        tagline: 'Ancient stone & teal water',
        dark:  { bg: '#0e0f0e', surface: '#161816', accent: '#34a27c', text: '#d2dad4' },
        light: { bg: '#fcfcfa', surface: '#f2f3f0', accent: '#166e52', text: '#121412' },
    },
    {
        name: 'void',
        label: 'Void',
        tagline: 'Tactical operations center',
        dark:  { bg: '#0a0b0d', surface: '#101216', accent: '#00d4e8', text: '#d8e0e8' },
        light: { bg: '#f5f6f8', surface: '#e8eaee', accent: '#006e94', text: '#0c0e12' },
    },
];

export function ThemePickerPanel() {
    const { theme: themeMode, themeName, setTheme, setThemeName } = useTheme();

    return (
        <div className="px-5 py-4 space-y-3">
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
                                <p className="text-[11px] text-tertiary/70 mt-0.5">{def.tagline}</p>
                            </div>
                            {/* L / D mode toggle */}
                            <div className="flex rounded-full border border-themeblue3/15 overflow-hidden">
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
                                            className={`px-2.5 py-1 text-xs font-semibold transition-all ${
                                                isActiveMode
                                                    ? 'bg-themeblue2 text-white'
                                                    : 'text-tertiary/70 hover:text-primary'
                                            }`}
                                        >
                                            {mode === 'light' ? 'L' : 'D'}
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
