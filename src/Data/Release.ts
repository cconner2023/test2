export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type: 'bug' | 'added' | 'changed' | 'planned' | 'started'
    text?: string,
    explain?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.6.3', type: 'added', text: 'User credentials managed and updated by supervisors' },
    { version: '2.6.3', type: 'added', text: 'Messaging system for units - ratcheting using signal open-source. Message persist x 24 hours currently' },
    { version: '2.6.3', type: 'changed', text: 'text expander for HPI and physical exams. Make your own templates' },
    { version: '2.6.3', type: 'changed', text: 'DD FORM 689 export' },
    { version: '2.6.2', type: 'added', text: 'Note Content can be toggled on in settings' },
    { version: '2.6.2', type: 'started', text: 'Training list and evaluation through the supervisor role' },
    { version: '2.6.1', type: 'added', text: 'biometric/pin for timeout (optional)' },
    { version: '2.6.1', type: 'added', text: 'User login and UIC assignment for training validation' },
]
