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
 */
export function copyWithHtml(text: string): void {
    const html = textToHtml(text);

    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        navigator.clipboard.write([
            new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
                'text/html': new Blob([html], { type: 'text/html' }),
            }),
        ]).catch(() => {
            navigator.clipboard.writeText(text);
        });
    } else {
        navigator.clipboard.writeText(text);
    }
}
