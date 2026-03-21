import type { LucideIcon } from 'lucide-react';
import { ToggleSwitch } from './ToggleSwitch';

interface SettingsToggleRowProps {
    icon: LucideIcon;
    label: string;
    subtitle: string;
    checked: boolean;
    onChange: () => void;
    activeColor?: string;
    activeBg?: string;
}

export const SettingsToggleRow = ({
    icon: Icon,
    label,
    subtitle,
    checked,
    onChange,
    activeColor = 'text-themeblue2',
    activeBg = 'bg-themeblue2/15',
}: SettingsToggleRowProps) => (
    <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-themewhite2 cursor-pointer"
        onClick={onChange}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(); } }}
    >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${checked ? activeBg : 'bg-tertiary/10'}`}>
            <Icon size={18} className={checked ? activeColor : 'text-tertiary/50'} />
        </div>
        <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${checked ? 'text-primary' : 'text-tertiary'}`}>{label}</p>
            <p className="text-[11px] text-tertiary/70 mt-0.5">{subtitle}</p>
        </div>
        <ToggleSwitch checked={checked} />
    </div>
);
