/**
 * Error-toast bus — the failure twin of copyFeedback. The UI lives in
 * `StorageErrorToast`, mounted once at the app root. For user-initiated actions
 * whose failure would otherwise be silent (save/open a local note).
 */

export interface ErrorToast { title: string; message: string }

type ErrorListener = (toast: ErrorToast) => void

const listeners = new Set<ErrorListener>()

export function onErrorToast(listener: ErrorListener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

/** Show the error toast. No-op until the host is mounted. */
export function emitErrorToast(title: string, message: string): void {
    for (const l of listeners) l({ title, message })
}
