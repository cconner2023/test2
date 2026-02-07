export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type?: 'bug' | 'added' | 'changed';
    text?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.6.1', type: 'changed', text: 'decision making modal / drawer' },
    { version: '2.6.1', type: 'added', text: 'user login' },
    { version: '2.6.1', type: 'bug', text: 'modal backdrop correction' },
    { version: '2.6.0', type: 'bug', text: 'Responsive desktop / mobile' },
    { version: '2.6.0', type: 'changed', text: 'settings modal / drawer' },
    { version: '2.6.0', type: 'added', text: 'dark | light mode toggle' },
    { version: '2.6.0', type: 'added', text: 'Export note as shared content: QR code, 2D barcode, encoded text string' },
    { version: '2.6.0', type: 'added', text: 'Import note as shared content from export' },
    { version: '2.6.0', type: 'changed', text: 'React framework' },

]