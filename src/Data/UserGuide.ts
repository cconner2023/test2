/**
 * USER GUIDE — PDF-like reference doc. Rendered by UserGuideDrawer.tsx
 *
 * Structure is a THREE-LEVEL tree:
 *   Chapter (L1)  →  Section (L2)  →  Subsection (L3, optional)
 * The left pane renders this tree (collapsible); the right pane renders the body
 * Design contract:
 *  - Sections AND subsections have STABLE ids. Release notes deep-link to one via
 *    ReleaseNoteTypes.sectionId → never rename an id once a shipped note points at
 *    it, or you orphan its "Read more" link. See UserGuideAnchorsById.
 *  - tier gates a whole section the same way it gates a release note: omit /
 *    'medic' = everyone; 'supervisor' / 'provider' hide the section from users who
 *    lack the role (they can't reach the feature, so the docs would only confuse).
 *  - Content is OPERATIONAL ONLY — never embed PHI or patient specifics. This doc
 *    ships in the app bundle and is world-readable to any authed user.
 *
 * Block model is tiny so content stays writable without a markdown
 * dependency. Add block kinds here + a branch in the UserGuideBody renderer.
 *
 * IMAGES: an image block's `src` is just a filename living in public/userGuide/
 * (e.g. src: 'tc3-card.png'). Drop the PNG there and it fills in; until then the
 * renderer shows a dashed "Image pending" placeholder in its place. Set
 * `srcMobile` when the mobile screenshot differs from desktop — mobile uses it and
 * falls back to `src` when omitted.
 */

export type GuideBlock =
    /** Body paragraph. */
    | { kind: 'p'; text: string }
    /** Bold inline header inside a section/subsection. */
    | { kind: 'sub'; text: string }
    /** Bulleted list. */
    | { kind: 'list'; items: string[] }
    /** Numbered, do-this-then-that steps. */
    | { kind: 'steps'; items: string[] }
    /** Highlighted callout / tip / caveat. */
    | { kind: 'note'; text: string }
    /**
     * Inline figure. Desktop floats it into the paragraph flow on the given side
     * (default right) using `src`. Mobile can't afford the width, so it renders as
     * an "Image" link that opens the figure full-size in a PreviewOverlay, using
     * `srcMobile` when set (else `src`). Both are bare filenames in public/userGuide/.
     */
    | { kind: 'image'; src: string; srcMobile?: string; alt: string; caption?: string; side?: 'left' | 'right' };

export interface GuideSubsection {
    /** Stable anchor id — deep-linkable. Never rename once shipped. */
    id: string;
    title: string;
    blocks: GuideBlock[];
}

export interface GuideSection {
    /** Stable anchor id — release notes link here. Never rename once shipped. */
    id: string;
    title: string;
    /** One-line summary shown under the title in the tree / body. */
    summary: string;
    /** Role gate — mirrors ReleaseNoteTypes.tier. Omit = everyone. */
    tier?: 'medic' | 'supervisor' | 'provider';
    /** Intro blocks rendered before any subsections. */
    blocks?: GuideBlock[];
    /** Optional third level. A section with no subsections is a tree leaf. */
    subsections?: GuideSubsection[];
}

export interface GuideChapter {
    /** Stable id for tree collapse state. */
    id: string;
    /** Chapter grouping label shown at the top of its tree branch. */
    label: string;
    sections: GuideSection[];
}

export const USER_GUIDE_VERSION = '2.7.0';

export const UserGuide: GuideChapter[] = [
    {
        id: 'getting-started',
        label: 'Getting started',
        sections: [
            {
                id: 'the-basics',
                title: 'The basics',
                summary: 'What the app is, how it works offline, and where things live.',
                blocks: [
                    { kind: 'p', text: 'This is an offline-first platform for medical operations — triage, training, communications, navigation, and property. Encrypted to your device first and syncs when you have connection. You can keep working with no connection.' },
                ],
                subsections: [
                    {
                        id: 'working-offline',
                        title: 'Working offline',
                        blocks: [
                            { kind: 'p', text: 'Anything you can create, edit, or delete (except encounter documentation) is encrypted, queued locally, and pushed to the server the moment you reconnect. You never lose work by going dark. Check Local Storage in Settings to see cached data and sync status.' },
                            { kind: 'note', text: 'We build frequently and remove bugs as we find them. If you notice your device flashes a second loading screen - that was a silent update.' },
                            { kind: 'note', text: 'When a new version is ready, you will be shown an "Update Available" card — install the new version to see latest features.' },
                        ],
                    },
                    {
                        id: 'getting-around',
                        title: 'Getting around',
                        blocks: [
                            { kind: 'list', items: [
                                'The side navigation opens the major areas — calendar, messages, map, and your clinical tools.',
                                'Settings (this menu) holds your profile, preferences, security, and this User Guide.',
                                'A red indicator on an item means something needs your attention.',
                            ] },
                        ],
                    },
                ],
            },
            {
                id: 'accounts-roles',
                title: 'Accounts, clusters & roles',
                summary: 'Clusters group your team; your role decides what you can do.',
                blocks: [
                    { kind: 'p', text: 'Your account belongs to a cluster — the team you share a schedule, messages, and property book with. Nearby clusters are `associated` automatically on creation; they surface in your messaging so you can always reach out for help.' },
                    { kind: 'sub', text: 'Roles' },
                    { kind: 'list', items: [
                        'Medic — everyone has this role. this is the base-level that helps give you access to the clinical tools',
                        'Supervisor — cluster management: personnel, readiness, certifications, appointment templates, and the on-call roster.',
                        'Provider — the note-authoring surface, including importing a medic\'s note to review, edit, and sign.',
                    ] },
                    { kind: 'note', text: 'Guest users can still use the application, but can only access TC3, knowledge base, and ADTMC.' },
                ],
            },
            {
                id: 'app-security',
                title: 'App lock & unlocking',
                summary: 'App Lock, a PIN, and Face / Touch unlock.',
                blocks: [
                    { kind: 'image', src: 'app-security.png', srcMobile: 'app-security-mobile.png', alt: 'Security settings', caption: 'Settings → Security.', side: 'right' },
                    { kind: 'p', text: 'Because this may hold operational data, you can protect it behind a screen lock. Find these under Settings → Security.' },
                    { kind: 'list', items: [
                        'App Lock — requires an unlock when you reopen the app or after inactivity.',
                        'PIN — set a PIN as your unlock code rather than your password',
                        'Face / Touch — unlock with your device biometrics. This is independent of the PIN.',
                    ] },
                    { kind: 'note', text: 'Biometric unlock needs App Lock turned on.' },
                ],
            },
            {
                id: 'linked-devices',
                title: 'Linked devices',
                summary: 'Sign in on a second device by scanning a QR code.',
                blocks: [
                    { kind: 'image', src: 'linked-devices.png', srcMobile: 'linked-devices-mobile.png', alt: 'Linked devices QR', caption: 'Scanning to link a device.', side: 'left' },
                    { kind: 'p', text: 'Linked Devices lets you sign in on another device without re-typing your password. This requires a signed-in device' },
                    { kind: 'steps', items: [
                        'On the new device, open the login screen and choose to link a device — it shows a QR code.',
                        'On your signed-in device, open Settings → Linked Devices and scan that code.',
                        'The new device signs in and your information is recovered.',
                    ] },
                ],
            },
        ],
    },
    {
        id: 'calendar',
        label: 'Calendar & scheduling',
        sections: [
            {
                id: 'calendar-events',
                title: 'Events & the calendar',
                summary: 'Month, day, and troops views; creating and editing events.',
                blocks: [
                    { kind: 'image', src: 'calendar-month.png', srcMobile: 'calendar-month-mobile.png', alt: 'Calendar month view', caption: 'The month view.', side: 'right' },
                    { kind: 'p', text: 'The calendar carries your clinic\'s schedule — coverage, ranges, duty locations, and training. You can switch between month, day, and troops-to-task views from the calendar header, and can further scope your view or filter it.' },
                    { kind: 'steps', items: [
                        'Open the calendar and tap a day (or the add control) to create an event.',
                        'Set the title, time window, category, personnel assigned, location, property, or custom to-do lists.',
                        'Save — the event syncs to everyone in your cluster.',
                    ] },
                    { kind: 'note', text: 'Events are shared through your cluster vault, so teammates see the same schedule once you\'re both online.' },
                ],
                subsections: [
                    {
                        id: 'calendar-views',
                        title: 'Views & the day summary',
                        blocks: [
                            { kind: 'list', items: [
                                'Month — the big picture, color-coded by category.',
                                'Day — a single day (or a three-day span), plus a flat Summary read-out.',
                                'Troops to Task — the day\'s positions with personnel matched to them.',
                            ] },
                            { kind: 'p', text: 'you can see layout option by tapping the layout icon in the center island. tapping it again removes it' },
                        ],
                    },
                    {
                        id: 'calendar-import/export',
                        title: 'Importing/exporting a schedule',
                        blocks: [
                            { kind: 'p', text: 'Bring an existing schedule in from a spreadsheet with CSV import by tapping the add control, or export the calendar back out for handoff.' },
                        ],
                    },
                ],
            },
            {
                id: 'event-subtasks',
                title: 'Sub-tasks & packing lists',
                summary: 'Break an event into sub-tasks or reuse a saved PCC/PCI list.',
                blocks: [
                    { kind: 'image', src: 'event-subtasks.png', srcMobile: 'event-subtasks-mobile.png', alt: 'Event sub-tasks card', caption: 'Sub-tasks on an event.', side: 'left' },
                    { kind: 'p', text: 'Sub-tasks let you break an event into the concrete things that have to happen — a checklist that rides along with the event.' },
                    { kind: 'steps', items: [
                        'Open or create an event.',
                        'In the event\'s tasks card, add sub-tasks one at a time.',
                        'To reuse a standard list, apply a saved custom cluster PCC/PCI as a pre-defined packing list.',
                        'Check tasks off as they\'re completed — status is shared with the cluster.',
                    ] },
                    { kind: 'note', text: 'Build a packing list once as a custom PCC/PCI and drop it onto any event instead of re-typing the same items every time.' },
                ],
            },
            {
                id: 'troops-to-task',
                title: 'Troops to Task & the Huddle',
                summary: 'Daily positions and matching people to assignments.',
                blocks: [
                    { kind: 'image', src: 'troops-to-task.png', srcMobile: 'troops-to-task-mobile.png', alt: 'Troops to Task view', caption: 'Matching people to the day.', side: 'right' },
                    { kind: 'p', text: 'Troops-to-Task is where you match your people to the day\'s work. The Calendar Huddle manages custom daily positions for your cluster and lines up assignments against them.' },
                    { kind: 'list', items: [
                        'Define the daily positions your cluster fills.',
                        'Assign personnel to positions for a given day.',
                        'Review coverage at a glance so gaps are obvious before they bite you.',
                    ] },
                ],
            },
            {
                id: 'provider-templates',
                title: 'Appointment templates',
                summary: 'Generate provider appointment slots across a date range.',
                tier: 'supervisor',
                blocks: [
                    { kind: 'image', src: 'appointment-templates.png', srcMobile: 'appointment-templates-mobile.png', alt: 'Appointment template generator', caption: 'Generating appointment slots.', side: 'left' },
                    { kind: 'p', text: 'Supervisors can generate provider appointment slots in bulk — a template that lays down open appointment blocks across the days you choose — and clear them back out by provider and date range when plans change.' },
                    { kind: 'p', text: 'Define your cluster\'s appointment types once in cluster settings; the generator uses them to build the slots.' },
                ],
            },
        ],
    },
    {
        id: 'communications',
        label: 'Communications',
        sections: [
            {
                id: 'messaging',
                title: 'Messaging',
                summary: 'Secure messages inside and outside your cluster.',
                blocks: [
                    { kind: 'image', src: 'messaging.png', srcMobile: 'messaging-mobile.png', alt: 'Messaging conversation', caption: 'A conversation.', side: 'right' },
                    { kind: 'p', text: 'Messaging is end-to-end encrypted. Your cluster and associated clusters are surfaced automatically, and you can always start conversations by looking a user up by their email, ID, or QR.' },
                    { kind: 'note', text: 'Users who haven\'t logged in won\'t be messagable.' },
                ],
                subsections: [
                    {
                        id: 'messaging-media',
                        title: 'Photos, voice notes & sharing',
                        blocks: [
                            { kind: 'list', items: [
                                'Send photos and voice notes inside a conversation.',
                                'Share a calendar event, a map overlay, or a property item straight into a chat — the other person taps through to it.',
                            ] },
                            { kind: 'note', text: 'The app doesn\'t keep a file locker. Attachments live in the conversation where you sent them, not a separate documents area.' },
                        ],
                    },
                    {
                        id: 'messaging-self-notes',
                        title: 'Notes to self',
                        blocks: [
                            { kind: 'p', text: 'Your "Notes" conversation is a private thread with yourself — a quick place to stash a reminder or a scratch message that stays on your account.' },
                        ],
                    },
                ],
            },
            {
                id: 'message-groups',
                title: 'Group conversations',
                summary: 'Create a group and manage who is in it.',
                blocks: [
                    { kind: 'image', src: 'group-info.png', srcMobile: 'group-info-mobile.png', alt: 'Group info page', caption: 'Managing a group.', side: 'left' },
                    { kind: 'p', text: 'Groups are shared conversations for a team or a task. Open a group\'s info page to manage it.' },
                    { kind: 'list', items: [
                        'Rename the group.',
                        'Add or remove members by email or user code.',
                        'Promote a member to primary, or leave the group yourself.',
                    ] },
                ],
            },
            {
                id: 'outside-contacts',
                title: 'Outside contacts',
                summary: 'Let people without an account reach your cluster.',
                blocks: [
                    { kind: 'image', src: 'outside-contacts.png', srcMobile: 'outside-contacts-mobile.png', alt: 'Outside contact link', caption: 'The outside front door.', side: 'right' },
                    { kind: 'p', text: 'Outside contacts let people who don\'t have an account reach your cluster through a secure link and passphrase your supervisor publishes.' },
                    { kind: 'list', items: [
                        'A chat message from an outside contact routes to whoever is on-call in the cluster.',
                        'An event request from an outside contact goes to the cluster supervisors, who can add it to the calendar or decline it.',
                    ] },
                    { kind: 'p', text: 'This ensures the medics are always (conditionally) reachable. The supervisor can rotate the keys or kill the QR at any time. If outside contact is not authorized by supervisor, then the cluster is unreachable from the outside' },
                ],
            },
            {
                id: 'on-call',
                title: 'On-call & the roster',
                summary: 'Publish a secure inbound link and control who gets notified.',
                tier: 'supervisor',
                blocks: [
                    { kind: 'image', src: 'on-call.png', srcMobile: 'on-call-mobile.png', alt: 'On-call roster', caption: 'The on-call roster.', side: 'left' },
                    { kind: 'p', text: 'Supervisors publish a secure link plus passphrase so people outside the cluster can send messages to the group. The on-call roster controls who actually gets the notifications.' },
                    { kind: 'steps', items: [
                        'Publish the on-call link and passphrase for your group.',
                        'Edit the on-call roster so only the people on shift are notified.',
                        'Update the roster as shifts change — off-shift members stop getting these notifications.',
                    ] },
                ],
            },
        ],
    },
    {
        id: 'triage',
        label: 'Triage & documentation',
        sections: [
            {
                id: 'triage-algorithms',
                title: 'ADTMC',
                summary: 'MEDCOM PAM 40-7-21 - a workflow that let\'s you .',
                blocks: [
                    { kind: 'image', src: 'adtmc.png', srcMobile: 'adtmc-mobile.png', alt: 'ADTMC algorithm question card', caption: 'Working an algorithm.', side: 'right' },
                    { kind: 'p', text: 'The clinical engine walks you through the encounter using ADTMC sick-call decision trees. Pick the presenting symptom and answer the questions.' },
                    { kind: 'steps', items: [
                        'Open a symptom category and choose the complaint.',
                        'Work through the question cards — each answer branches the path.',
                        'Land on a disposition to view decision making or full note-write.',
                    ] },
                ],
            },
            {
                id: 'screeners',
                title: 'Screeners',
                summary: 'Standard screening instruments, scored for you.',
                blocks: [
                    { kind: 'image', src: 'screeners.png', srcMobile: 'screeners-mobile.png', alt: 'A screener', caption: 'A scored screener.', side: 'left' },
                    { kind: 'p', text: 'Common screening instruments are built in and scored as you go, so the result drops straight into the encounter.' },
                    { kind: 'list', items: [
                        'GAD-7 and PHQ-2 / PHQ-9 for anxiety and depression.',
                        'MACE2 for concussion screening.',
                        'AUDIT-C for alcohol use.',
                    ] },
                ],
            },
            {
                id: 'knowledge-base',
                title: 'Knowledge base & medications',
                summary: 'Reference for medications, guidelines, and training tasks.',
                blocks: [
                    { kind: 'image', src: 'knowledge-base.png', srcMobile: 'knowledge-base-mobile.png', alt: 'Knowledge base', caption: 'The reference shelf.', side: 'right' },
                    { kind: 'p', text: 'The knowledge base is your reference shelf — look up a medication, review a guideline, or open a training task without leaving the app. You can jump to it from search or from a symptom guideline.' },
                ],
            },
            {
                id: 'writing-notes',
                title: 'Writing a note',
                summary: 'Assemble a documentation note from the encounter.',
                blocks: [
                    { kind: 'image', src: 'note-builder.png', srcMobile: 'note-builder-mobile.png', alt: 'Note builder', caption: 'Assembling a note.', side: 'left' },
                    { kind: 'p', text: 'The note builder assembles your documentation from the encounter — the algorithm path seeds the history, exam, and plan, and you fill in the rest.' },
                    { kind: 'list', items: [
                        'HPI — the history of the present illness.',
                        'Physical exam — pick exam blocks and mark findings normal or abnormal.',
                        'Assessment — a free-text clinical impression, plus your differential diagnosis.',
                        'Plan — order sets and plan blocks for what happens next.',
                        'Vital signs — captured as their own pinned block.',
                    ] },
                ],
            },
            {
                id: 'sharing-notes',
                title: 'Sharing & importing a note',
                summary: '',
                blocks: [
                    { kind: 'image', src: 'note-export.png', srcMobile: 'note-export-mobile.png', alt: 'Note export options', caption: 'Export options for a note.', side: 'right' },
                    { kind: 'p', text: 'A finished note gives you an encoded string, data matrix, and the plain text with export options. We currently do not store this information on our server.' },
                    { kind: 'steps', items: [
                        'Finish the note and open its export.',
                        'Export an SF 600 / DD Form 689 / data matrix / encoded text',
                        'On the receiving device, scan the barcode or paste the text to decrypt the note and keep working on it.',
                        'Copy the plain text and paste directly into the EHR.',
                    ] },
                ],
            },
            {
                id: 'provider-sign',
                title: 'Reviewing & signing',
                summary: 'Providers import a medic note, edit, and sign.',
                tier: 'provider',
                blocks: [
                    { kind: 'image', src: 'provider-sign.png', srcMobile: 'provider-sign-mobile.png', alt: 'Provider review and sign', caption: 'Reviewing a medic note.', side: 'left' },
                    { kind: 'p', text: 'Providers close the loop on a medic\'s note: decrypt it, add your own assessment and edits, and sign it off.' },
                    { kind: 'steps', items: [
                        'Import the medic\'s note (by barcode).',
                        'Review and edit - your assessment sits alongside theirs.',
                        're-export that finalized note, copy and paste directly to the EHR, or generate an SF 600 / DD Form 689 .',
                    ] },
                ],
            },
        ],
    },
    {
        id: 'field-care',
        label: 'Trauma & field care',
        sections: [
            {
                id: 'tc3',
                title: 'TC3 cards',
                summary: 'Manage vitals and treatment across time for prolonged care.',
                blocks: [
                    { kind: 'image', src: 'tc3-card.png', srcMobile: 'tc3-card-mobile.png', alt: 'TC3 card', caption: 'A TC3 card.', side: 'right' },
                    { kind: 'p', text: 'TC3 cards track treatment across time so the record matches prolonged field care documentation.' },
                    { kind: 'list', items: [
                        'Record vitals and treatments as timestamped entries.',
                        'Review the trend over the length of care, not just a single snapshot.',
                        'Link a card to a map drop point when location matters.',
                    ] },
                    { kind: 'note', text: 'Heat Index uses location services to flag range coverage requirements against the conditions on the ground.' },
                ],
                subsections: [
                    {
                        id: 'tc3-card-detail',
                        title: 'Building the card',
                        blocks: [
                            { kind: 'list', items: [
                                'Casualty info and mechanism of injury.',
                                'MARCH interventions, added as you perform them.',
                                'Injury markers placed on a body diagram.',
                                'Medications, fluids, and blood.',
                            ] },
                            { kind: 'p', text: 'Running more than one casualty? The casualty queue keeps each card separate so you can move between them.' },
                        ],
                    },
                ],
            },
            {
                id: 'medevac-9line',
                title: '9-line MEDEVAC',
                summary: 'Build, export, and import a 9-line request.',
                blocks: [
                    { kind: 'image', src: 'medevac-9line.png', srcMobile: 'medevac-9line-mobile.png', alt: '9-line MEDEVAC builder', caption: 'The 9-line builder.', side: 'left' },
                    { kind: 'p', text: 'The 9-line MEDEVAC builder walks you through a complete request and lets you export or import it so it moves with the mission.' },
                    { kind: 'steps', items: [
                        'Open the 9-line builder.',
                        'Fill each line — location, callsign, patients, equipment, and the rest.',
                        'Export the completed request to hand off, or import one you received.',
                    ] },
                ],
            },
            {
                id: 'burn-calculator',
                title: 'Burn calculator',
                summary: 'Estimate total body surface area burned.',
                blocks: [
                    { kind: 'image', src: 'burn-calculator.png', srcMobile: 'burn-calculator-mobile.png', alt: 'Burn calculator body diagram', caption: 'Marking TBSA.', side: 'right' },
                    { kind: 'p', text: 'The burn calculator estimates total body surface area (TBSA) burned. Mark the affected regions on the body diagram and it works out the percentage for you.' },
                ],
            },
        ],
    },
    {
        id: 'map',
        label: 'Map & navigation',
        sections: [
            {
                id: 'map-overlays',
                title: 'Map & navigation overlays',
                summary: 'MGRS/UTM overlays, offline maps, and linking to events.',
                blocks: [
                    { kind: 'image', src: 'map-overlay.png', srcMobile: 'map-overlay-mobile.png', alt: 'Map overlay', caption: 'A navigation overlay.', side: 'left' },
                    { kind: 'p', text: 'The map supports full MGRS / UTM navigation overlays that download for offline use and export for sharing.' },
                    { kind: 'list', items: [
                        'Download overlays so they\'re available offline.',
                        'Link a TC3 card to a drop point on the map.',
                        'Link an overlay to a calendar event — a range or a duty location.',
                        'Upload a PDF map to bring your own graphics, or import from any MGRS application.',
                        'Export strips and range details for handoff.',
                    ] },
                ],
            },
            {
                id: 'map-coordinates',
                title: 'Coordinates & navigating',
                summary: 'MGRS/UTM/lat-long readout, bearings, and go-to.',
                blocks: [
                    { kind: 'image', src: 'map-coordinates.png', srcMobile: 'map-coordinates-mobile.png', alt: 'Coordinate readout and go-to card', caption: 'Coordinates and go-to.', side: 'right' },
                    { kind: 'p', text: 'The map speaks the coordinate systems you work in and helps you get from where you are to a point.' },
                    { kind: 'list', items: [
                        'Switch the readout between MGRS, UTM, and latitude / longitude.',
                        'Type an MGRS grid and jump straight to it.',
                        'Bearings render in true, magnetic, or grid north — declination is handled for you.',
                        'Pick a waypoint and the go-to card shows range and bearing with a live compass arrow.',
                        'Measure distance and bearing between points.',
                    ] },
                ],
            },
            {
                id: 'map-waypoints',
                title: 'Waypoints, routes & areas',
                summary: 'Drop pins and draw routes and zones.',
                blocks: [
                    { kind: 'image', src: 'map-waypoints.png', srcMobile: 'map-waypoints-mobile.png', alt: 'Waypoint glyph picker', caption: 'The pin library.', side: 'left' },
                    { kind: 'p', text: 'Mark up the map with a full library of pins — LZ, PZ, DZ, rally, objective, CCP, casualty, supply, hazard, and more — plus routes and areas.' },
                    { kind: 'steps', items: [
                        'Add a waypoint and pick its icon from the category picker.',
                        'Draw a route to get per-leg distance and bearing labels.',
                        'Draw an area to mark a zone.',
                    ] },
                ],
            },
            {
                id: 'offline-maps',
                title: 'Offline maps & import / export',
                summary: 'Download tiles for offline use; move overlays in and out.',
                blocks: [
                    { kind: 'image', src: 'offline-maps.png', srcMobile: 'offline-maps-mobile.png', alt: 'Offline tile download', caption: 'Downloading tiles.', side: 'right' },
                    { kind: 'list', items: [
                        'Download an overlay\'s map tiles so it works offline.',
                        'Import and export overlays as GPX or KML.',
                        'Upload a PDF map to bring your own graphics onto the map.',
                    ] },
                ],
            },
        ],
    },
    {
        id: 'property',
        label: 'Property',
        sections: [
            {
                id: 'property-book',
                title: 'The property book',
                summary: 'Organize items by location, room, and vehicle.',
                blocks: [
                    { kind: 'image', src: 'property-book.png', srcMobile: 'property-book-mobile.png', alt: 'Property location tree', caption: 'The location tree.', side: 'left' },
                    { kind: 'p', text: 'The property book answers "where is everything." Items live in a tree of locations — buildings, rooms, and vehicles — that you build to match your footprint.' },
                    { kind: 'steps', items: [
                        'Add locations to lay out your buildings, rooms, and vehicles.',
                        'Add items and place each one in its location, with NSN, serial, and quantity.',
                        'Search from the top to jump to any item or location.',
                    ] },
                ],
            },
            {
                id: 'property-accountability',
                title: 'Hand receipts, shortages & turn-in',
                summary: 'Your primary hand receipt, shortages, DA 2062 sign-out, and DA 3161 turn-in.',
                blocks: [
                    { kind: 'image', src: 'property-hand-receipt.png', srcMobile: 'property-hand-receipt-mobile.png', alt: 'Authorized items hand receipt', caption: 'The primary hand receipt.', side: 'left' },
                    { kind: 'p', text: 'Beyond "where is everything," the property book tracks what you are accountable for — what you are authorized, what you actually hold, and who has signed for it. This is your primary hand receipt (PHR) and the paperwork that rides on top of it.' },
                ],
                subsections: [
                    {
                        id: 'authorized-items',
                        title: 'Your primary hand receipt (authorized items)',
                        blocks: [
                            { kind: 'p', text: 'The authorized-items list IS your hand receipt — the LINs you are signed for and, under each, the items that make it up. You build it yourself; there is no external catalog to sync.' },
                            { kind: 'steps', items: [
                                'Add the LINs you are signed for first — a LIN is a header (its name and LIN number), not a counted item.',
                                'Under a LIN, add its authorized items with a nomenclature, NSN, and the authorized quantity.',
                                'On-hand rolls up automatically from the physical stock you have placed in the book that matches that LIN and NSN.',
                            ] },
                            { kind: 'note', text: 'Each authorized line reads as on-hand / authorized, both in individual (EA) units, so a shortage is obvious at a glance.' },
                        ],
                    },
                    {
                        id: 'property-shortages',
                        title: 'Shortages',
                        blocks: [
                            { kind: 'image', src: 'property-shortages.png', srcMobile: 'property-shortages-mobile.png', alt: 'Shortages report', caption: 'Shortages by LIN.', side: 'right' },
                            { kind: 'p', text: 'The shortages report is authorized minus on-hand, folded live from the book and grouped under each LIN. Anything you are short shows the exact gap.' },
                            { kind: 'list', items: [
                                'A line is short when on-hand falls below its authorized quantity.',
                                'Staging an item for turn-in counts it as gone immediately, so the shortage surfaces right away.',
                                'Export a DA 2062 shortage annex straight from the report to hand-jam or attach.',
                            ] },
                        ],
                    },
                    {
                        id: 'da2062-hand-receipts',
                        title: 'Signing property out (DA 2062)',
                        blocks: [
                            { kind: 'image', src: 'property-da2062.png', srcMobile: 'property-da2062-mobile.png', alt: 'DA 2062 sign-out', caption: 'Signing items out.', side: 'left' },
                            { kind: 'p', text: 'A DA 2062 hand receipt signs one or more items to a person — inside your cluster or outside it — and produces the printable document.' },
                            { kind: 'steps', items: [
                                'Start a new DA 2062 from the property add control.',
                                'Pick the recipient: a cluster member, or an outside recipient by name.',
                                'Select the items and sign them out — the app builds the 2062 to print or export.',
                                'Sign items back in from the hand-receipt list when they are returned; the item goes back to its usual location.',
                            ] },
                            { kind: 'note', text: 'An item signed out still belongs to you on the book — the hand receipt records who is holding it, not a transfer of accountability off your PHR.' },
                        ],
                    },
                    {
                        id: 'da3161-turnin',
                        title: 'Turning property in (DA 3161)',
                        blocks: [
                            { kind: 'p', text: 'Turn-in is a two-step, batched flow built for real depot trips: stage items over time, then verify the whole batch on one DA 3161 when you make the trip.' },
                            { kind: 'steps', items: [
                                'Stage items for turn-in as you set them aside — they stay on-hand and accountable, and their lines show short until they leave the book.',
                                'When you go to the depot, verify the batch to mint the DA 3161 turn-in document.',
                                'Verified items drop off the active book and stay browsable in turn-in history.',
                            ] },
                            { kind: 'note', text: 'Staging is fully reversible — un-stage to pull an item back before it is turned in.' },
                        ],
                    },
                    {
                        id: 'personal-property',
                        title: 'Personal vs cluster property',
                        blocks: [
                            { kind: 'p', text: 'An item can belong to the cluster or to you personally. Personal property travels with you rather than staying with the cluster, so use the owner toggle to mark what is yours.' },
                            { kind: 'list', items: [
                                'Cluster property is the default — it stays on the cluster book.',
                                'Personal property is scoped to you; filter the book to "My property" to see just what you own or hold.',
                            ] },
                        ],
                    },
                ],
            },
            {
                id: 'property-scan',
                title: 'Scanning, labels & data',
                summary: 'Find items by camera; print labels; import / export.',
                blocks: [
                    { kind: 'image', src: 'property-scan.png', srcMobile: 'property-scan-mobile.png', alt: 'Item scanner', caption: 'Scanning to locate an item.', side: 'right' },
                    { kind: 'p', text: 'Scan an item to find it fast, and move data in and out in bulk.' },
                    { kind: 'list', items: [
                        'Scan a barcode to locate an item on the map or confirm what it is.',
                        'Enroll an item in Visual ID so the camera can recognize it later without a barcode.',
                        'Print labels for your items and locations.',
                        'Import and export the book as CSV.',
                    ] },
                ],
            },
        ],
    },
    {
        id: 'training',
        label: 'Training & readiness',
        sections: [
            {
                id: 'training-completions',
                title: 'Training completions',
                summary: 'Track completed training, tied to the calendar.',
                blocks: [
                    { kind: 'image', src: 'training-completions.png', srcMobile: 'training-completions-mobile.png', alt: 'Training completions', caption: 'A training record.', side: 'left' },
                    { kind: 'p', text: 'Training you complete is tracked against your record. When training is scheduled on the calendar, completing it links back to that event, so the schedule and the record stay in step.' },
                ],
            },
            {
                id: 'certifications',
                title: 'Certifications',
                summary: 'Expiration-aware certification tracking.',
                blocks: [
                    { kind: 'image', src: 'certifications.png', srcMobile: 'certifications-mobile.png', alt: 'Certifications list', caption: 'Certs and their status.', side: 'right' },
                    { kind: 'p', text: 'Certifications track what you\'re current on and warn before it lapses. Each cert reads as valid, expiring soon, or expired, so nothing quietly goes out of date.' },
                ],
            },
        ],
    },
    {
        id: 'supervisors',
        label: 'For supervisors',
        sections: [
            {
                id: 'team-readiness',
                title: 'Team readiness',
                summary: 'See your team\'s training, certs, and coverage at a glance.',
                tier: 'supervisor',
                blocks: [
                    { kind: 'image', src: 'team-readiness.png', srcMobile: 'team-readiness-mobile.png', alt: 'Team readiness view', caption: 'The team-lead lens.', side: 'left' },
                    { kind: 'p', text: 'The supervisor view is your team-lead lens: readiness, certifications, coverage, and per-soldier training status in one place. Training completions update live, so you see progress as it happens.' },
                ],
            },
            {
                id: 'clinic-management',
                title: 'Managing your cluster',
                summary: 'Personnel, rooms, huddle tasks, and appointment types.',
                tier: 'supervisor',
                blocks: [
                    { kind: 'image', src: 'clinic-management.png', srcMobile: 'clinic-management-mobile.png', alt: 'Cluster settings', caption: 'Cluster settings.', side: 'right' },
                    { kind: 'p', text: 'Cluster settings are where you shape the surfaces everyone else uses.' },
                    { kind: 'list', items: [
                        'Manage personnel — who is in the cluster and their roles.',
                        'Authorize outside contact, and manage your on-call roster',
                    ] },
                ],
            },
            {
                id: 'soldier-loaning',
                title: 'Loaning soldiers between clusters',
                summary: 'Assign a primary cluster and transfer people across associated clusters.',
                tier: 'supervisor',
                blocks: [
                    { kind: 'image', src: 'soldier-loaning.png', srcMobile: 'soldier-loaning-mobile.png', alt: 'Loaning a soldier', caption: 'Transferring across clusters.', side: 'left' },
                    { kind: 'p', text: 'Supervisors can loan soldiers to associated clusters while keeping ownership clear.' },
                    { kind: 'steps', items: [
                        'Assign each soldier a primary cluster.',
                        'Transfer a soldier to an associated cluster when they\'re loaned out.',
                        'Manage multiple calendars so each cluster sees the right schedule.',
                    ] },
                ],
            },
        ],
    },
];

/**
 * Flat lookup of every DEEP-LINKABLE anchor — sections AND subsections — by id.
 * Used to resolve a release note's sectionId and to validate deep-links. Built
 * once at module load. A collision would mean two anchors share an id (illegal).
 */
export const UserGuideAnchorsById: Record<string, GuideSection | GuideSubsection> =
    UserGuide.reduce((acc, chapter) => {
        for (const section of chapter.sections) {
            acc[section.id] = section;
            for (const sub of section.subsections ?? []) acc[sub.id] = sub;
        }
        return acc;
    }, {} as Record<string, GuideSection | GuideSubsection>);
