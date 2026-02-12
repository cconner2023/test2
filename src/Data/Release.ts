export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type: 'bug' | 'added' | 'changed'
    text?: string,
    explain?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.6.10', type: 'changed', text: 'thought about a server, panicked. that\'s way too much learning for one night.' },
    { version: '2.6.10', type: 'changed', text: 'write note wizard simplified' },
    { version: '2.6.1', type: 'added', text: 'delete, edit, re-save, your notes' },
    { version: '2.6.1', type: 'bug', text: 'Responsive desktop / mobile' },
    { version: '2.6.1', type: 'changed', text: 'Import note from other devices' },
    { version: '2.6.1', type: 'changed', text: 'dark | light mode toggle' },
    { version: '2.6.0', type: 'added', text: 'export note as barcode, encoded text string, or shared image' },
    { version: '2.6.0', type: 'added', text: 'share, copy, and save your notes locally after creating them' },
    { version: '2.6.0', type: 'added', text: 'expanded decision making with easy access to medication information' },
]