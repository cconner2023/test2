export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type: 'bug' | 'added' | 'changed' | 'planned' | 'started'
    text?: string,
    explain?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.6.4', type: 'added', text: 'burn assessment calculator — Rule of Nines TBSA with Parkland formula fluid resuscitation' },
    { version: '2.6.4', type: 'added', text: 'pin Knowledge Base categories for quick access' },
    { version: '2.6.4', type: 'added', text: 'encrypted calendar events with troops to task view' },
    { version: '2.6.4', type: 'added', text: 'training assignment from supervisor panel' },
    { version: '2.6.4', type: 'changed', text: 'provider view. append medic notes' },
    { version: '2.6.4', type: 'changed', text: 'text-expander update' },
    { version: '2.6.4', type: 'bug', text: 'iOS model viewport adjustment' },
    { version: '2.6.3', type: 'changed', text: 'WhisperNet — offline mesh messaging and guardian node relay' },
    { version: '2.6.3', type: 'added', text: 'manage users in your clinic, and associate your clinic with others via QR' },
    { version: '2.6.3', type: 'added', text: 'extend comms to outside units and parent clinics' },
    { version: '2.6.3', type: 'added', text: 'User credentials managed and updated by supervisors' },
    { version: '2.6.3', type: 'added', text: 'Messaging system architecture for units - ratcheting using signal open-source. Messages persist across devices' },
    { version: '2.6.3', type: 'changed', text: 'text expander for HPI and physical exams. Make your own templates' },
    { version: '2.6.3', type: 'changed', text: 'DD FORM 689 export' },
    { version: '2.6.2', type: 'added', text: 'Note Content toggled in settings' },
    { version: '2.6.2', type: 'started', text: 'Training list and evaluation through the supervisor role' },
    { version: '2.6.1', type: 'added', text: 'biometric/pin for timeout (optional)' },
    { version: '2.6.1', type: 'added', text: 'User login and UIC assignment for training validation' },
]
