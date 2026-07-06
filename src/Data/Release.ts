export interface ReleaseNoteTypes {
    version: string;
    date?: string;
    type: 'bug' | 'added' | 'changed' | 'planned' | 'started'
    text?: string,
    explain?: string
    /** Role gate — who sees this note. Omit (or 'medic') = everyone. 'supervisor' /
     *  'provider' hide the note from users who lack that role, since they can't access
     *  the feature anyway. Mirrors GuideSection.tier so a note and its linked User Guide
     *  section stay aligned. */
    tier?: 'medic' | 'supervisor' | 'provider'
    /** id of a User Guide section/subsection (see UserGuideAnchorsById in
     *  src/Data/UserGuide.ts). When set, the note becomes a tappable "Read more"
     *  row that opens the User Guide drawer and scrolls to that anchor. The link
     *  retires automatically when the note rolls off this list; keep the anchor id
     *  stable as long as any shipped note points at it. */
    sectionId?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.7.0', type: 'added', sectionId: 'property-accountability', text: 'Property accountability: cluster primary hand receipt, shortages, DA 2062 sign-out, DA 3161 turn-in, DD 1750 packing list, and personal property' },
    { version: '2.6.9', type: 'changed', sectionId: 'event-subtasks', text: 'sub-tasks in calendar events. Custom cluster PCC/PCIs so you can apply sub-tasks to an event or a pre-defined packing list' },
    { version: '2.6.9', type: 'changed', sectionId: 'outside-contacts', text: 'Outside contacts: let people outside your cluster reach you without an account. Chat goes to the on-call in the cluster, event requests go to the cluster supervisors to add/decline' },
    { version: '2.6.9', type: 'added', tier: 'supervisor', sectionId: 'on-call', text: 'On-call: supervisors in the group can publish a secure link + passphrase so people outside your cluster can send messages to the group. On-Call roster editable so only those on shift get notifications.' },
    { version: '2.6.8', type: 'added', sectionId: 'map-overlays', text: 'Map and navigation overlays - full MGRS / UMT. offline downloadable, exportable. link your TC3 cards to a drop point, link your overlay to a calendar event (range or duty location), upload a PDF map, export strips and range details.' },
    { version: '2.6.8', type: 'added', tier: 'supervisor', sectionId: 'soldier-loaning', text: 'Supervisor support to loan Soldiers to associated clusters. Assign a primary cluster, transfer soldiers. supports multiple calendars.' },
    { version: '2.6.8', type: 'added', sectionId: 'messaging', text: 'Message outside of the associated clusters by searching by email.' },
    { version: '2.6.7', type: 'added', sectionId: 'troops-to-task', text: 'Calendar Huddle in Troops to Task. Manage custom daily positions for your cluster and match assignments' },
    { version: '2.6.7', type: 'changed', sectionId: 'tc3', text: 'TC3 UX update. Manage VS and Treatment across time to match prolonged field care cards' },
    { version: '2.6.7', type: 'changed', sectionId: 'tc3', text: 'Heat Index with location services. For range coverage requirements' },
    { version: '2.6.6', type: 'added', sectionId: 'medevac-9line', text: '9-line MEDEVAC request builder with export / import' },
]
