import { Check, Copy, Share2, FileDown } from 'lucide-react';
import type { getColorClasses } from '../Utilities/ColorUtilities';

export const ActionIconButton = ({
    onClick,
    status,
    variant,
    title,
}: {
    onClick: () => void;
    status: 'idle' | 'busy' | 'done';
    variant: 'copy' | 'share' | 'pdf';
    title: string;
}) => {
    const colorClass = status === 'done' ? 'text-green-600'
        : status === 'busy' ? 'text-purple-600'
            : 'text-tertiary hover:text-primary hover:bg-themewhite3';

    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`p-1.5 transition-colors rounded-full ${colorClass}`}
            title={title}
        >
            {status === 'busy' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            ) : status === 'done' ? (
                <Check className="w-4 h-4" />
            ) : variant === 'copy' ? (
                <Copy className="w-4 h-4" />
            ) : variant === 'share' ? (
                <Share2 className="w-4 h-4" />
            ) : (
                <FileDown className="w-4 h-4" />
            )}
        </button>
    );
};

export const SlideWrapper = ({
    children,
    slideDirection
}: {
    children: React.ReactNode;
    slideDirection: 'left' | 'right' | '';
}) => {
    const slideClasses = {
        '': '',
        'left': 'animate-slide-in-left',
        'right': 'animate-slide-in-right'
    };

    return (
        <div className={`h-full w-full ${slideClasses[slideDirection]}`}>
            {children}
        </div>
    );
};

export const ToggleOption: React.FC<{
    checked: boolean;
    onChange: () => void;
    label: string;
    onDescription: string;
    offDescription: string;
    icon: React.ReactNode;
    colors: ReturnType<typeof getColorClasses>;
}> = ({ checked, onChange, label, onDescription, offDescription, icon, colors }) => (
    <div
        onClick={onChange}
        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer
            ${checked
                ? colors.symptomClass
                : 'border-tertiary/15 bg-themewhite2'
            }`}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(); }
        }}
    >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${checked ? `${colors.sliderClass}/15` : 'bg-tertiary/10'}`}>
            <span className={checked ? colors.symptomCheck : 'text-tertiary/50'}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${checked ? 'text-primary' : 'text-tertiary'}`}>{label}</p>
            <p className="text-[11px] text-tertiary/70 mt-0.5">{checked ? onDescription : offDescription}</p>
        </div>
        <div className={`w-10 h-6 rounded-full relative transition-colors ${checked ? colors.sliderClass : 'bg-tertiary/25'}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
    </div>
);
