export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type: 'bug' | 'added' | 'changed'
    text?: string,
    explain?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.6.1', type: 'added', text: 'save note' },
    { version: '2.6.1', type: 'added', text: 'my notes in settings' },
    { version: '2.6.1', type: 'added', text: 'delete, edit, re-save, share saved notes' },
    { version: '2.6.1', type: 'changed', text: 'SW cache busting' },
    { version: '2.6.0', type: 'bug', text: 'Responsive desktop / mobile' },
    { version: '2.6.0', type: 'changed', text: 'settings modal / drawer' },
    { version: '2.6.0', type: 'added', text: 'dark | light mode toggle' },
    { version: '2.6.0', type: 'added', text: 'Export note as : PDF417 barcode, encoded text string, or shared image' },
    { version: '2.6.0', type: 'added', text: 'Import note as shared content from export' },
    { version: '2.6.0', type: 'changed', text: 'React framework' },

]