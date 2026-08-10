/**
 * Per-step outcome for the admin multi-step writes (approve a request, save a
 * user edit). The rendering component is gone — both flows show the HUD loader
 * and collapse failures into one inline error — but the shape survives because
 * RequestDetail still uses it to skip already-succeeded steps on retry.
 */
export interface StepResult {
  key: string
  label: string
  ok: boolean
  error?: string
  /** True while the step is in flight. */
  pending?: boolean
}
