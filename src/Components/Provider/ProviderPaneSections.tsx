import { ExpandableInput } from '../ExpandableInput';
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent';

/**
 * Right-pane text editor for the provider note's plain-text sections (HPI /
 * Assessment) on desktop. Binds live to the drawer's lifted section state, so the
 * center summary card reflects edits. PE and Plan are NOT edited here — those stay
 * live-mounted in the center (their exam/plan text must stay synced from a template
 * apply, which only their mounted component can generate).
 */

const TEXTAREA_CLASS =
  'w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary ' +
  'focus:outline-none resize-none overflow-hidden min-h-[260px]';

export function TextSectionEditor({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { expanders } = useMergedNoteContent();
  return (
    <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
      <ExpandableInput
        value={value}
        onChange={onChange}
        expanders={expanders}
        multiline
        hideClear
        className={TEXTAREA_CLASS}
        placeholder={placeholder}
      />
    </div>
  );
}
