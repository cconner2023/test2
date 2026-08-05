/**
 * Copy-confirmation bus. One event, no payload beyond the label — the UI lives in
 * `CopiedModal`, which is the only subscriber and is mounted once at the app root.
 *
 * A bus rather than a direct import so `clipboardUtils` (a utility) never depends on
 * a component, and so any future copy path gets the confirmation by calling the same
 * function instead of hand-rolling its own `copied` state.
 */

type CopiedListener = (label: string) => void

const listeners = new Set<CopiedListener>()

export function onCopied(listener: CopiedListener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

/** Fire the copied confirmation. No-op until the modal is mounted. */
export function emitCopied(label = 'Copied'): void {
    for (const l of listeners) l(label)
}
