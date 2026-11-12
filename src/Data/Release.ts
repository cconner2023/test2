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
     *  stable as long as any shipped note points at it. Every new note sets one:
     *  add or extend the guide section in the same change, with the same `tier`,
     *  so a visible note never links to a hidden section. An unknown id silently
     *  degrades to a plain row. */
    sectionId?: string
}

export const ReleaseNotes: ReleaseNoteTypes[] = [
    { version: '2.8.0', type: 'changed', sectionId: 'tracking-board', text: 'BRN input primitive changed' },
    { version: '2.8.0', type: 'changed', sectionId: 'tracking-board', text: 'Tracking board added to the mission overview widgets' },
    { version: '2.8.0', type: 'added', sectionId: 'tracking-board', text: 'Tracking Board: follow casualties by BRN from check-in through your chosen map pins (from POI through disposition). Boards stay inside your cluster unless supervisors turn on sharing.' },
    { version: '2.8.0', type: 'added', sectionId: 'writing-notes', text: 'local save on note drafts. Not pushed to server or across devices. Stored encrypted at rest.' },
    { version: '2.8.0', type: 'changed', sectionId: 'messaging', text: 'Messaging rebuilt for reliability: each message is delivered once to your secure inbox and every one of your devices reads it, so conversations stay in sync across devices with less data use.' },
    { version: '2.7.5', type: 'started', sectionId: 'writing-notes', text: 'Seeded Notes via algorithm choices (i.e. HPI, PE, plan optionally auto-generate what you already answered in the algorithm). So you don\'t have to type it twice. Can be toggled on in the settings' },
    { version: '2.7.5', type: 'started', sectionId: 'knowledge-base', text: 'Prolonged Field Care and CPG database.' },
    { version: '2.7.5', type: 'started', sectionId: 'knowledge-base', text: 'updated ICTLs: in progress. Mapping to Algorithms and testable data so supervisors have visibility.' },
    { version: '2.7.5', type: 'added', sectionId: 'map-overlays', text: 'Personnel location in map. OFF by default. Users can elect to place themselves on the map so others can see their position. Users can update themselves or remove themselves at any time. Location is sent to your group as an encrypted message - not GPS data' },
    { version: '2.7.5', type: 'added', sectionId: 'outside-contacts', text: 'Create an encrypted message to someone outside the app by email (they open a channel through a link). Expires and is purged after 24 hours. Alternative to inbound messaging via the QR + passcode' },
    { version: '2.7.5', type: 'added', sectionId: 'desktop-shortcuts', text: 'Desktop keyboard shortcuts: hold Ctrl+Alt and press a letter to jump straight to a tool. Desktop only at current; see the user guide for a complete list.' },
    { version: '2.7.4', type: 'added', sectionId: 'clinic-management', text: 'Relocate your cluster (i.e. deployment, rotation) to see new units in that area. Will require those cluster keys kept by supervisors.' },
]