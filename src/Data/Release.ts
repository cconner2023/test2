export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type: 'bug' | 'added' | 'changed' | 'planned' | 'started'
    text?: string,
    explain?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.6.9', type: 'added', text: 'Outside contacts: let people outside your cluster reach you without an account. Chat goes to the on-call in the cluster, event requests go to the cluster supervisors to add/decline' },
    { version: '2.6.9', type: 'added', text: 'On-call: supervisors in the group can publish a secure link + passphrase so people outside your cluster can send messages to the group. On-Call roster editable so only those on shift get notifications.' },
    { version: '2.6.8', type: 'added', text: 'Map and navigation overlays - full MGRS / UMT. offline downloadable, exportable. link your TC3 cards to a drop point, link your overlay to a calendar event (range or duty location), upload a PDF map, export strips and range details.' },
    { version: '2.6.8', type: 'added', text: 'Supervisor support to loan Soldiers to associated clusters. Assign a primary cluster, transfer soldiers. supports multiple calendars.' },
    { version: '2.6.8', type: 'added', text: 'Message outside of the associated clusters by searching by email.' },
    { version: '2.6.7', type: 'added', text: 'Calendar Huddle in Troops to Task. Manage custom daily positions for your cluster and match assignments' },
    { version: '2.6.7', type: 'changed', text: 'TC3 UX update. Manage VS and Treatment across time to match prolonged field care cards' },
    { version: '2.6.7', type: 'changed', text: 'Heat Index with location services. For range coverage requirements' },
    { version: '2.6.6', type: 'added', text: '9-line MEDEVAC request builder with export / import' },
]
