import type { LucideIcon } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { useRowDensity, ROW_META } from '@/Components/primitives/rowDensity';
import { ToggleSwitch } from './ToggleSwitch';

/**
 * The settings list row: leading icon, label over subtitle, a control at the right
 * edge. Drop it inside a <SectionCard> to build a group.
 *
 * WHY THIS EXISTS: this row was hand-copied into a dozen panels, each carrying its
 * own `role="button" tabIndex onKeyDown` triplet, and every copy was authored for a
 * phone. Settings gained a desktop three-pane layout, so those copies then rendered
 * at desktop width — a 36px icon medallion at one end of the row and its toggle at
 * the other, with the whole width of a pane between them (USR: "very cartoony").
 *
 * TWO DENSITIES, ONE ROW. Mobile is the surface these were drawn for and is
 * unchanged: 36px medallion, `py-3.5`, `active:scale-95` press. Desktop drops the
 * ornament that only reads as a touch affordance — the medallion becomes a bare
 * 16px icon, the row tightens to `py-2.5`, the press-scale goes away (there is no
 * finger to acknowledge), and the label takes the 10pt floor. The icon stays: the
 * icon-row IS the settings pattern here, and a stack of bare text toggles is the
 * thing it was chosen over.
 *
 * Mobile labels stay `text-sm` rather than moving to the `text-[10pt]` floor —
 * that migration is repo-wide and is tagged for its own pass, not smuggled in here.
 *
 * The two densities now live in primitives/rowDensity so the card rows that are not
 * SettingsRows (readiness bars, competency categories, timeline events, certs) read
 * the same numbers instead of each carrying a phone-only copy.
 */

/** Icon + label treatment. `on` still drives the default tone's emphasis; the
 *  others are fixed, because a Sign Out row is not "off" when you are not on it. */
export type SettingsRowTone = 'default' | 'neutral' | 'danger' | 'danger-quiet';

interface SettingsRowProps {
    icon: LucideIcon;
    label: ReactNode;
    subtitle?: ReactNode;
    /** Emphasis for icon + label under the default tone. Toggle rows pass `checked`;
     *  a nav row leaves it on. Ignored by the danger tones. */
    on?: boolean;
    tone?: SettingsRowTone;
    onClick?: () => void;
    /** Right edge — a ToggleSwitch, a ChevronRight, a value. */
    trailing?: ReactNode;
    disabled?: boolean;
    /** Nested one level under the row above (Change PIN under PIN). */
    indent?: boolean;
    /** Hairline above. Set on every row after the first in a group. */
    divided?: boolean;
    /** Override the default tone's "on" colours (e.g. themeblue3 surfaces). */
    onColor?: string;
    onBg?: string;
    className?: string;
    /** Lands on the row's <button>, for call sites that anchor a popover to it
     *  (ProfilePage's account rows). A row with no `onClick` renders a <div> and has
     *  nothing to anchor, so the ref stays null there. Plain prop, not forwardRef —
     *  React 19 passes ref through function components directly. */
    ref?: Ref<HTMLButtonElement>;
}

export function SettingsRow({
    icon: Icon,
    label,
    subtitle,
    on = true,
    tone = 'default',
    onClick,
    trailing,
    disabled = false,
    indent = false,
    divided = false,
    onColor = 'text-themeblue2',
    onBg = 'bg-themeblue2/15',
    className = '',
    ref,
}: SettingsRowProps) {
    const d = useRowDensity();
    const danger = tone === 'danger' || tone === 'danger-quiet';

    const iconTone =
        tone === 'danger' ? 'text-themeredred'
            : tone === 'danger-quiet' ? 'text-themeredred/60'
                : tone === 'neutral' ? 'text-tertiary'
                    : on ? onColor : 'text-tertiary';
    const iconBg =
        tone === 'danger' ? 'bg-themeredred/10'
            : tone === 'danger-quiet' ? 'bg-themeredred/5'
                : tone === 'neutral' ? 'bg-tertiary/10'
                    : on ? onBg : 'bg-tertiary/10';
    const labelTone =
        tone === 'danger' ? 'text-themeredred'
            : tone === 'danger-quiet' ? 'text-themeredred/60'
                : on ? 'text-primary' : 'text-tertiary';

    const border = divided ? 'border-t border-tertiary/10' : '';
    const interactive = onClick && !disabled
        ? `cursor-pointer ${danger ? 'hover:bg-themeredred/5' : 'hover:bg-themeblue2/5'} ${d.press}`
        : '';
    const pad = indent ? `${d.indentPad} bg-tertiary/5` : d.pad;

    const body = (
        <>
            {d.isMobile ? (
                <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                    <Icon size={d.iconSize} className={iconTone} />
                </span>
            ) : (
                <span className="w-5 shrink-0 flex items-center justify-center">
                    <Icon size={d.iconSize} className={iconTone} />
                </span>
            )}
            <span className="flex-1 min-w-0 text-left">
                <span className={`block truncate font-medium ${d.label} ${labelTone}`}>
                    {label}
                </span>
                {subtitle != null && (
                    <span className={`block ${ROW_META} mt-0.5`}>{subtitle}</span>
                )}
            </span>
            {trailing}
        </>
    );

    const classes = `flex items-center gap-3 w-full transition-all ${pad} ${border} ${interactive} ${disabled ? 'opacity-50' : ''} ${className}`;

    // A real button when it acts like one — that is where the keyboard handling
    // the hand-rolled copies each re-implemented actually comes from.
    return onClick && !disabled
        ? <button ref={ref} type="button" onClick={onClick} className={classes}>{body}</button>
        : <div className={classes}>{body}</div>;
}

interface SettingsToggleRowProps {
    icon: LucideIcon;
    label: ReactNode;
    subtitle?: ReactNode;
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    divided?: boolean;
    /** Standalone card rather than a member of a <SectionCard> group. */
    card?: boolean;
    activeColor?: string;
    activeBg?: string;
}

/** A SettingsRow whose trailing control is the toggle. */
export const SettingsToggleRow = ({
    icon,
    label,
    subtitle,
    checked,
    onChange,
    disabled = false,
    divided = false,
    card = false,
    activeColor,
    activeBg,
}: SettingsToggleRowProps) => (
    <SettingsRow
        icon={icon}
        label={label}
        subtitle={subtitle}
        on={checked}
        onClick={onChange}
        disabled={disabled}
        divided={divided}
        onColor={activeColor}
        onBg={activeBg}
        className={card ? 'rounded-xl bg-themewhite2' : ''}
        trailing={<ToggleSwitch checked={checked} />}
    />
);
