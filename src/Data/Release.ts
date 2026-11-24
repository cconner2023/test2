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
    { version: '2.8.0', type: 'added', sectionId: 'writing-notes', text: 'Seeded Note via algorithm choices. Toggle this on in the settings and your note will be pre-filled with your algorithm choices' },
    { version: '2.8.0', type: 'bug', sectionId: 'writing-notes', text: 'Edit in Provider actually works now guys' },
    { version: '2.8.0', type: 'bug', sectionId: 'outside-contacts', text: 'Outside contacts encrypt file send fixed.' },
    { version: '2.8.0', type: 'changed', sectionId: 'getting-around', text: 'The User Guide moved out of Settings into the side navigation, next to Settings. Desktop: Ctrl+Alt+G.' },
    { version: '2.8.0', type: 'added', sectionId: 'messaging-media', text: 'Send files in chat: any type up to 25 MB, encrypted on your device. Photos can be sent at original quality. Attachments expire after 21 days.' },
    { version: '2.8.0', type: 'changed', sectionId: 'tracking-board', text: 'BRN input primitive changed' },
    { version: '2.8.0', type: 'changed', sectionId: 'tracking-board', text: 'Tracking board added to the mission overview widgets' },
    { version: '2.8.0', type: 'added', sectionId: 'tracking-board', text: 'Tracking Board: follow from POI to disposition. Updated to include map sharing across clusters so you can track at echelon. Item exp after 30 days' },
    { version: '2.8.0', type: 'added', sectionId: 'writing-notes', text: 'save draft notes encrypted locally on device' },
    { version: '2.8.0', type: 'changed', sectionId: 'messaging', text: 'Messaging rebuilt for reliability: delivered once to your secure vault for your devices to reduce data consumption and improve reliability' },
    { version: '2.7.5', type: 'started', sectionId: 'writing-notes', text: 'Seeded Note via algorithm choices (i.e. HPI, PE, plan optionally auto-generate what you already answered in the algorithm). So you don\'t have to type it twice. Can be toggled on in the settings' },
    { version: '2.7.5', type: 'started', sectionId: 'knowledge-base', text: 'Prolonged Field Care and CPG database.' },
    { version: '2.7.5', type: 'started', sectionId: 'knowledge-base', text: 'updated ICTLs: in progress. Mapping to Algorithms and testable data so supervisors have visibility.' },
    { version: '2.7.4', type: 'added', sectionId: 'clinic-management', text: 'Relocate your cluster (i.e. deployment, rotation) to see new units in that area. Will require those cluster keys kept by supervisors.' },
]