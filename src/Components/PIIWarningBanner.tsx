import { ShieldAlert } from 'lucide-react';

/**
 * Inline warning banner shown when PII/PHI patterns are detected in free-text input.
 * BLOCKING — saving is disabled until flagged content is removed.
 */
export function PIIWarningBanner({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/40 mt-1">
      <ShieldAlert size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <div className="text-xs text-red-700 dark:text-red-300">
        <span className="font-semibold">PII/PHI Blocked — </span>
        <span>
          Remove patient-identifiable information before saving. Detected: {warnings.join(', ')}.
        </span>
      </div>
    </div>
  );
}
