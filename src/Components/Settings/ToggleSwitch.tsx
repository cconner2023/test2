/** Reusable toggle switch used across Settings panels. */
export const ToggleSwitch = ({ checked }: { checked: boolean }) => (
    <div className={`w-10 h-6 rounded-full relative transition-colors ${checked ? 'bg-themeblue2' : 'bg-tertiary/25'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </div>
);
