import { ExpandableInput } from '@/Components/primitives/ExpandableInput';
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent';

/**
 * Right-pane text editor for the provider note's plain-text sections (HPI /
 * Assessment) on desktop — the template builder's RowTextarea field (borderless
 * min-h-[4rem] textarea) minus the label header (the pane header already titles the
 * section), routed through ExpandableInput so it stays text-template aware
 * (abbreviation expansion + template sessions). Binds live to the drawer's lifted section state,
 * so the center summary card reflects edits. PE and Plan are NOT edited here — those
 * stay live-mounted in the center (their exam/plan text must stay synced from a
 * template apply, which only their mounted component can generate).
 */

// Matches ProviderTemplateEditPopover.RowTextarea's textarea class.
const INPUT_CLASS =
  'w-full bg-transparent px-4 py-2 pb-3 text-base md:text-sm text-primary placeholder:text-tertiary ' +
  'focus:outline-none resize-none min-h-[4rem] leading-5';

export function TextSectionEditor({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { expanders } = useMergedNoteContent();
  return (
    <label className="block">
      <ExpandableInput
        value={value}
        onChange={onChange}
        expanders={expanders}
        multiline
        hideClear
        className={INPUT_CLASS}
        placeholder={placeholder}
      />
    </label>
  );
}
