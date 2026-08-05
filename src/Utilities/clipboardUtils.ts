import { emitCopied } from '../lib/copyFeedback';

/**
 * Convert plain-text note into HTML that preserves line breaks and
 * renders bullet lines (`  • …`) as proper `<ul><li>` lists.
 */
function textToHtml(text: string): string {
    const lines = text.split('\n');
    const parts: string[] = [];
    let inList = false;

    for (const line of lines) {
        const bullet = line.match(/^\s+• (.+)/);
        if (bullet) {
            if (!inList) { parts.push('<ul>'); inList = true; }
            parts.push(`<li>${bullet[1]}</li>`);
        } else {
            if (inList) { parts.push('</ul>'); inList = false; }
            parts.push(`<div>${line || '<br>'}</div>`);
        }
    }
    if (inList) parts.push('</ul>');

    return parts.join('');
}

/**
 * Copy text to clipboard with both text/plain and text/html MIME types.
 * HTML uses <div> wrappers and <ul><li> lists so rich-text targets
 * (EHR, email, etc.) preserve line breaks and bullets on paste.
 * Falls back to writeText if the ClipboardItem API is unavailable.
 *
 * Raises the shared copied confirmation on success — the single copy-feedback
 * surface for the app, so callers don't hold their own `copied` state.
 */
export function copyWithHtml(text: string, label?: string): void {
    const html = textToHtml(text);
    const confirm = () => emitCopied(label);

    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        navigator.clipboard.write([
            new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
                'text/html': new Blob([html], { type: 'text/html' }),
            }),
        ]).then(confirm, () => {
            navigator.clipboard.writeText(text).then(confirm, () => {});
        });
    } else {
        navigator.clipboard.writeText(text).then(confirm, () => {});
    }
}

/**
 * Copy plain text and raise the shared confirmation. Use this for anything that
 * isn't a note — codes, tokens, coordinates, links, IDs — so every copy in the app
 * confirms the same way. `label` names what was copied ("Code copied"); it defaults
 * to a bare "Copied".
 *
 * Resolves false when the write failed, for the rare caller that must react (a
 * manual-selection fallback). The confirmation is already handled either way; do
 * NOT add a local `copied` flag on top of it.
 */
export async function copyText(text: string, label?: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        // execCommand is the last resort for older iOS Safari and non-secure contexts.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) return false;
    }
    emitCopied(label);
    return true;
}

/**
 * Copy an image blob (QR codes, barcodes, rendered report cards) with the same
 * confirmation. Resolves false when the platform refuses image writes — iOS Safari
 * outside a user gesture, mostly — so the caller can fall back to a download.
 */
export async function copyImage(blob: Blob, label = 'Image copied'): Promise<boolean> {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
    try {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
    } catch {
        return false;
    }
    emitCopied(label);
    return true;
}
