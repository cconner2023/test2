export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type: 'bug' | 'added' | 'changed' | 'planned' | 'started'
    text?: string,
    explain?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.6.7', type: 'added', text: 'Calendar view settings. Manage weekend visibility, single vs. triple for day view' },
    { version: '2.6.7', type: 'added', text: 'Calendar Huddle in Troops to Task. Manage custom daily positions for your clinic and match assignments' },
    { version: '2.6.7', type: 'changed', text: 'TC3 UX update. Manage VS and Treatment across time to match prolonged field care cards' },
    { version: '2.6.7', type: 'changed', text: 'Heat Index with location services. For range coverage requirements' },
    { version: '2.6.6', type: 'added', text: '9-line MEDEVAC request builder with export / import' },
    { version: '2.6.6', type: 'added', text: 'extend messaging to all users, find by user email or share your id to another user' },
    { version: '2.6.6', type: 'added', text: 'change your visual theme in settings' },
    { version: '2.6.6', type: 'added', text: 'property management — track, locate, and manage equipment across locations with map view' },
    { version: '2.6.5', type: 'added', text: 'TC3 — digital casualty card with MARCH interventions, body diagram markers, and barcode export' },
    { version: '2.6.4', type: 'added', text: 'burn assessment calculator — Rule of Nines TBSA with Parkland formula fluid resuscitation' },
    { version: '2.6.4', type: 'added', text: 'pin Knowledge Base categories for quick access' },
    { version: '2.6.4', type: 'added', text: 'encrypted calendar events with troops to task view' },
    { version: '2.6.4', type: 'added', text: 'training assignment from supervisor panel' },
    { version: '2.6.4', type: 'changed', text: 'provider view. append medic notes' },
]
