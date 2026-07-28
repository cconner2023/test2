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
    { version: '2.7.5', type: 'started', sectionId: 'writing-notes', text: 'Seeded Notes via algorithm choices (i.e. HPI, PE, plan optionally auto-generate what you already answered in the algorithm). So you don\'t have to type it twice' },
    { version: '2.7.5', type: 'started', sectionId: 'knowledge-base', text: 'Prolonged Field Care and CPG database.' },
    { version: '2.7.5', type: 'added', sectionId: 'knowledge-base', text: 'updated ICTLs: in progress. Mapping to Algorithms and testable data so supervisors have visibility.' },
    { version: '2.7.5', type: 'added', sectionId: 'map-overlays', text: 'Personnel location in map. OFF by default. Users can elect to place themselves on the map so others can see their position. Users can update themselves or remove themselves at any time. Location is sent to your group as an encrypted message - not GPS data' },
    { version: '2.7.5', type: 'added', sectionId: 'outside-contacts', text: 'Create an encrypted message to someone outside the app by email (they open a channel through a link). Expires and is purged after 24 hours. Alternative to inbound messaging via the QR + passcode' },
    { version: '2.7.5', type: 'added', sectionId: 'desktop-shortcuts', text: 'Desktop keyboard shortcuts: hold Ctrl+Alt and press a letter to jump straight to a tool. Desktop only at current; see the user guide for a complete list.' },
    { version: '2.7.4', type: 'added', sectionId: 'clinic-management', text: 'Relocate your cluster (i.e. deployment, rotation) to see new units in that area. Will require those cluster keys kept by supervisors.' },
    { version: '2.7.1', type: 'added', sectionId: 'property-book', text: 'CVIII order 3161 matching turn-in. For use with DCAMS' },
    { version: '2.7.1', type: 'added', tier: 'supervisor', sectionId: 'soldier-loaning', text: 'Supervisors at BDE and higher can now view child cluster training metrics via the supervisor panel. Supervisors can also create new accounts or unlink accounts for child clusters. Only applicable at same level and down (i.e. DIV can manage down, BDE can manage down)' },
    { version: '2.7.1', type: 'added', sectionId: 'property-accountability', text: 'Property accountability: cluster primary hand receipt, shortages, DA 2062 sign-out, DA 3161 turn-in, DD 1750 packing list, and personal property' },
    { version: '2.7.0', type: 'changed', sectionId: 'event-subtasks', text: 'sub-tasks in calendar events — break an event into a shared checklist of items the cluster ticks off' },
    { version: '2.7.0', type: 'changed', sectionId: 'outside-contacts', text: 'Outside contacts: let people outside your cluster reach you without an account. Chat goes to the on-call in the cluster, event requests go to the cluster supervisors to add/decline' },
    { version: '2.7.0', type: 'added', tier: 'supervisor', sectionId: 'on-call', text: 'On-call: supervisors in the group can publish a secure link + passphrase so people outside your cluster can send messages to the group. On-Call roster editable so only those on shift get notifications.' },
]