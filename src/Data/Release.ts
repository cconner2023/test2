export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type: 'bug' | 'added' | 'changed' | 'planned' | 'started'
    text?: string,
    explain?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.6.3', type: 'added', text: 'text expander for HPI and physical exams. Make your own templates' },
    { version: '2.6.3', type: 'added', text: 'clinic heirarchy. Parent clinics see child clinic documentation for easier patient tracking' },
    { version: '2.6.3', type: 'added', text: 'DD FORM 689 export' },
    { version: '2.6.2', type: 'added', text: 'physical exam section and HPI can be toggled on in settings' },
    { version: '2.6.2', type: 'changed', text: 'tutorials and how-to. Found in settings' },
    { version: '2.6.2', type: 'started', text: 'training list and evaluation through the supervisor role' },
    { version: '2.6.1', type: 'added', text: 'biometric/pin for timeout (optional)' },
    { version: '2.6.1', type: 'added', text: 'User login and UIC assignment - see all the notes from your clinic wherever you log in' },
]
