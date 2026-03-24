import { ShieldAlert } from 'lucide-react';

/**
 * Inline warning banner shown when PII/PHI patterns are detected in free-text input.
 * BLOCKING — saving is disabled until flagged content is removed.
 */
export function PIIWarningBanner({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-themeredred/10 border border-themeredred/40 mt-1">
      <ShieldAlert size={16} className="text-themeredred shrink-0 mt-0.5" />
      <div className="text-xs text-themeredred">
        <span className="font-semibold">PII/PHI detected: </span>
        <span>
          {warnings.join(', ')}. Remove before saving.
        </span>
      </div>
    </div>
  );
}
