import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface SettingsListItemProps {
    label: string;
    badge?: string;
    expanded: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onDelete: () => void;
    editing?: boolean;
    children?: ReactNode;
}

export const SettingsListItem = ({
    label,
    badge,
    expanded,
    onToggleExpand,
    onEdit,
    onDelete,
    editing = true,
    children,
}: SettingsListItemProps) => (
    <div className="rounded-lg border border-tertiary/15 bg-themewhite overflow-hidden">
        <div
            className={`flex items-center gap-2 px-3 py-2 ${editing ? 'cursor-pointer active:scale-[0.98]' : ''} transition-transform`}
            onClick={editing ? onToggleExpand : undefined}
        >
            {editing
                ? expanded
                    ? <ChevronDown size={13} className="text-tertiary shrink-0" />
                    : <ChevronRight size={13} className="text-tertiary shrink-0" />
                : null
            }
            <span className="text-xs font-medium text-primary truncate flex-1 min-w-0">
                {label}
            </span>
            {badge && (
                <span className="text-[9pt] text-tertiary shrink-0">{badge}</span>
            )}
            <div className={`flex items-center gap-0 overflow-hidden transition-all duration-200 ease-out ${editing ? 'max-w-20 opacity-100' : 'max-w-0 opacity-0'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="shrink-0 p-1 rounded hover:bg-tertiary/10 transition-colors active:scale-95"
                    aria-label={`Edit ${label}`}
                >
                    <Pencil size={13} className="text-tertiary" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="shrink-0 p-1 rounded hover:bg-themeredred/10 transition-colors active:scale-95"
                    aria-label={`Delete ${label}`}
                >
                    <Trash2 size={13} className="text-themeredred/50" />
                </button>
            </div>
        </div>
        {expanded && children && (
            <div className="px-3 pb-2 space-y-1">
                {children}
            </div>
        )}
    </div>
);
