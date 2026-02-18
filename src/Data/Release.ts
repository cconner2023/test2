export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type: 'bug' | 'added' | 'changed' | 'planned' | 'started'
    text?: string,
    explain?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.6.2', type: 'changed', text: 'training list and testing' },
    { version: '2.6.2', type: 'bug', text: 'server listener on minimize so we don\'t drain all the batteries' },
    { version: '2.6.2', type: 'added', text: 'biometric/pin for timeout (optional)' },
    { version: '2.6.2', type: 'added', text: 'User login and UIC assignment - see all the notes from your clinic wherever you log in' },
    { version: '2.6.1', type: 'started', text: 'training documentation pushed to server.' },
    { version: '2.6.1', type: 'changed', text: 'Import note from other devices via barcode' },
    { version: '2.6.0', type: 'added', text: 'share, copy, save your notes locally after creating them' },
]