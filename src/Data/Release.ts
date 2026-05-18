export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type: 'bug' | 'added' | 'changed' | 'planned' | 'started'
    text?: string,
    explain?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.6.8', type: 'added', text: 'Map and navigation overlays - full MGRS / UMT. offline downloadable, exportable. link your TC3 cards to a drop point, link your overlay to a calendar event (range or duty location), upload a PDF map, export strips and range details.' },
    { version: '2.6.8', type: 'added', text: 'Supervisor support to loan Soldiers to associated clusters. Assign a primary cluster, transfer soldiers. supports multiple calendars.' },
    { version: '2.6.8', type: 'added', text: 'Message outside of the associated clusters by searching by email.' },
    { version: '2.6.7', type: 'added', text: 'Calendar Huddle in Troops to Task. Manage custom daily positions for your cluster and match assignments' },
    { version: '2.6.7', type: 'changed', text: 'TC3 UX update. Manage VS and Treatment across time to match prolonged field care cards' },
    { version: '2.6.7', type: 'changed', text: 'Heat Index with location services. For range coverage requirements' },
    { version: '2.6.6', type: 'added', text: '9-line MEDEVAC request builder with export / import' },
    { version: '2.6.6', type: 'added', text: 'extend messaging to all users, find by user email or share your id to another user' },
    { version: '2.6.6', type: 'added', text: 'change your visual theme in settings' },
    { version: '2.6.6', type: 'added', text: 'property management — track, locate, and manage equipment across your cluster with map view' },
    { version: '2.6.5', type: 'added', text: 'TC3 — digital casualty card with MARCH interventions, body diagram markers, and barcode export' },
]
