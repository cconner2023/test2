import { Plus, Minus } from 'lucide-react';

/**
 * Per-note quantity control on a selected medication. Minus is absent at zero
 * rather than dimmed, so the row never carries a dead button. The count is
 * unsized so it matches whatever row it sits in.
 */
export function MedQtyStepper({ value, onChange }: { value: number; onChange: (next: number) => void }) {
    return (
        <span className="flex items-center gap-1 shrink-0">
            {value > 0 && (
                <>
                    <button
                        type="button"
                        onClick={() => onChange(value - 1)}
                        className="p-1 text-tertiary active:text-primary transition-colors"
                        aria-label="Decrease quantity"
                    >
                        <Minus size={12} />
                    </button>
                    <span className="text-primary tabular-nums min-w-[1.5rem] text-center">x {value}</span>
                </>
            )}
            <button
                type="button"
                onClick={() => onChange(value + 1)}
                className="p-1 text-tertiary active:text-primary transition-colors"
                aria-label="Increase quantity"
            >
                <Plus size={12} />
            </button>
        </span>
    );
}
