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
 *  - `summary` is no longer rendered in the body (headers stand on their own) but
 *    is retained: guide search still matches against it. Keep it short + accurate.
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

import type { GuideIconName } from '../Components/UserGuide/guideIcons';

/**
 * Decorative replica of a button the user will actually tap. Rendered icon-only
 * (matching the real ActionButton variant colors) so readers recognize the
 * control on screen — it is NOT interactive. `label` feeds the tooltip / screen
 * reader; set it when the icon alone is ambiguous.
 */
export interface GuideButton {
    icon: GuideIconName;
    variant?: 'default' | 'danger' | 'success';
    label?: string;
}

/** Shorthand: a bare icon key (`'plus'`) or a full GuideButton for variant/label. */
export type GuideButtonRef = GuideIconName | GuideButton;

/**
 * Inline text that MAY carry button replicas. A plain string is the common case
 * (and keeps every existing block valid); an array interleaves text spans with
 * `{ btn }` segments: `['Tap ', { btn: 'plus' }, ' to add a patient.']`.
 */
export type GuideInline = string | Array<string | { btn: GuideButtonRef }>;

export type GuideBlock =
    /** Body paragraph. */
    | { kind: 'p'; text: GuideInline }
    /** Bold inline header inside a section/subsection. */
    | { kind: 'sub'; text: string }
    /** Bulleted list. */
    | { kind: 'list'; items: GuideInline[] }
    /** Numbered, do-this-then-that steps. */
    | { kind: 'steps'; items: GuideInline[] }
    /** Highlighted callout / tip / caveat. */
    | { kind: 'note'; text: GuideInline }
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
    /** One-line summary — retained for search only; not rendered. */
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

export const USER_GUIDE_VERSION = '2.7.1';

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
                    { kind: 'p', text: 'This is an offline-first platform for medical operations — triage, training, communications, navigation, and property. Everything you do is encrypted to your device first and syncs when you have a connection, so you can keep working with no signal.' },
                ],
                subsections: [
                    {
                        id: 'working-offline',
                        title: 'Working offline',
                        blocks: [
                            { kind: 'p', text: 'Anything you create, edit, or delete (except encounter documentation) is encrypted, queued locally, and pushed to the server the moment you reconnect. You never lose work by going dark. Check Settings → Local Storage to see cached data and sync status.' },
                            { kind: 'note', text: 'We build frequently and remove bugs as we find them. If your device flashes a second loading screen, that was a silent update.' },
                            { kind: 'note', text: 'When a new version is ready you will see an "Update Available" card — install it to get the latest features.' },
                        ],
                    },
                    {
                        id: 'getting-around',
                        title: 'Getting around',
                        blocks: [
                            { kind: 'list', items: [
                                'The side navigation opens the major areas — calendar, messages, map, property, triage, training, and your clinical tools.',
                                'Settings (the gear) holds your profile, preferences, security, and this User Guide.',
                                'A red indicator on an item means something needs your attention.',
                                'On desktop most tools open a two-pane drawer (a list on the left, detail on the right); on mobile the detail slides up as a sheet. The controls are the same either way.',
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
                    { kind: 'p', text: 'Your account belongs to a cluster — the team you share a schedule, messages, and property book with. Nearby clusters are associated automatically on creation; they surface in your messaging so you can always reach out for help.' },
                    { kind: 'sub', text: 'Roles' },
                    { kind: 'list', items: [
                        'Medic — everyone has this role. It is the base level that unlocks the clinical tools.',
                        'Supervisor — cluster management: personnel, readiness, certifications, appointment templates, and the on-call roster.',
                        'Provider — the note-authoring surface, including importing a medic\'s note to review, edit, and sign.',
                    ] },
                    { kind: 'note', text: 'You don\'t self-register into a cluster. A supervisor adds you (see "Adding people to your cluster"). Guest users can still open the app but only reach TC3, the knowledge base, and ADTMC.' },
                ],
            },
            {
                id: 'app-security',
                title: 'App lock & unlocking',
                summary: 'App Lock, a PIN, and Face / Touch unlock.',
                blocks: [
                    { kind: 'image', src: 'app-security.png', srcMobile: 'app-security-mobile.png', alt: 'Security settings', caption: 'Settings → Security.', side: 'right' },
                    { kind: 'p', text: 'Because this may hold operational data, you can protect it behind a screen lock. Find these under Settings → Security.' },
                    { kind: 'steps', items: [
                        'Open Settings → Security.',
                        'Turn on App Lock — it requires an unlock when you reopen the app or after inactivity.',
                        'Optionally set a PIN to use as your unlock code instead of your password.',
                        'Turn on Face / Touch to unlock with your device biometrics.',
                    ] },
                    { kind: 'note', text: 'Biometric unlock needs App Lock turned on. Face / Touch is independent of the PIN.' },
                ],
            },
            {
                id: 'linked-devices',
                title: 'Linked devices',
                summary: 'Sign in on a second device by scanning a QR code.',
                blocks: [
                    { kind: 'image', src: 'linked-devices.png', srcMobile: 'linked-devices-mobile.png', alt: 'Linked devices QR', caption: 'Scanning to link a device.', side: 'left' },
                    { kind: 'p', text: 'Linked Devices lets you sign in on another device without re-typing your password. You need a device that is already signed in.' },
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
                summary: 'Month, day, and troops views; creating, editing, and deleting events.',
                blocks: [
                    { kind: 'image', src: 'calendar-month.png', srcMobile: 'calendar-month-mobile.png', alt: 'Calendar month view', caption: 'The month view.', side: 'right' },
                    { kind: 'p', text: 'The calendar carries your cluster\'s schedule — coverage, ranges, duty locations, appointments, and training. The bar across the bottom (the "island") switches between Month, Day, and Troops to Task and carries the round + button for creating events.' },
                    { kind: 'sub', text: 'Create an event' },
                    { kind: 'steps', items: [
                        ['Tap the round ', { btn: 'plus' }, ' ("Add event") on the bottom island, then tap New Event. (Or long-press a day to get a quick "Add Event" that pre-fills that date.)'],
                        'Enter an Event title (required) and pick a Category — Training, Duty, Range, Appointment, Mission, MEDEVAC, Huddle, Leave, or Other.',
                        'Set the time: toggle All day, or set Start date / time and End date / time. Pick a color swatch if you want to code it.',
                        'Optionally add a Location (links a map overlay), Description / OPORD notes, Equipment (property items), and Personnel (who is assigned).',
                        'Save with the check pill in the header. The event syncs to everyone in your cluster.',
                    ] },
                    { kind: 'note', text: 'If you belong to more than one cluster, a Cluster picker appears so you can choose which schedule the event lands on. Pick MEDEVAC as the category to attach a 9-line to the event.' },
                    { kind: 'sub', text: 'Edit, move, or delete' },
                    { kind: 'steps', items: [
                        'Tap an event to open its detail view.',
                        ['Tap the ', { btn: 'more-horizontal' }, ' (More) menu for Edit, Move, Share to chat, Add to phone calendar, or Delete.'],
                        'Edit reopens the form (with a Status row — Pending / Active / Done / Cancelled). Change what you need and Save.',
                        'Move puts you in move-mode — tap a day in the month view to relocate the event.',
                        'Delete asks you to confirm ("Delete event?"); it is removed for every cluster member.',
                    ] },
                ],
                subsections: [
                    {
                        id: 'calendar-views',
                        title: 'Views & layout options',
                        blocks: [
                            { kind: 'list', items: [
                                'Month — the big picture, color-coded by category.',
                                'Day — a single day; the layout can switch to a three-day span or a flat Summary read-out.',
                                'Troops to Task — the day\'s positions with personnel matched to them.',
                            ] },
                            { kind: 'p', text: 'The sliders icon on the island opens View options, which change with the active view: Month toggles weekends shown/hidden; Day switches between Single day, Triple day, and Summary; Troops to Task sets the time cells (Hourly / 20-minute / Daily) and rows (All personnel / Huddle only).' },
                        ],
                    },
                    {
                        id: 'calendar-import/export',
                        title: 'Importing / exporting a schedule',
                        blocks: [
                            { kind: 'p', text: 'Bring an existing schedule in from a spreadsheet, or export the calendar for handoff. Both live under the + button in the Data submenu.' },
                            { kind: 'steps', items: [
                                'Tap + → Data → Import CSV. Drop a CSV (or tap to browse); a Download template link gives you the exact columns.',
                                'Review the preview table (Title / Date / Time / Category) and any skipped rows, then tap "Import N events".',
                                'To export, tap + → Data → Export .ics for the whole calendar, or Export Troops-to-Task .csv for the day\'s assignments.',
                            ] },
                        ],
                    },
                ],
            },
            {
                id: 'event-subtasks',
                title: 'Sub-tasks & checklists',
                summary: 'Break an event into sub-tasks or reuse a saved cluster checklist (PCC/PCI).',
                blocks: [
                    { kind: 'image', src: 'event-subtasks.png', srcMobile: 'event-subtasks-mobile.png', alt: 'Event tasks card', caption: 'Tasks on an event.', side: 'left' },
                    { kind: 'p', text: 'The Tasks card on an event is a checklist that rides along with it — the concrete things that have to happen. You can add items one at a time or seed the whole list from a saved cluster Checklist (your PCC/PCI packing list).' },
                    { kind: 'steps', items: [
                        'Open or create an event and find the Tasks card.',
                        'Tap the + (Add task). To reuse a standard list, pick one of your cluster\'s Checklists at the top — every item seeds onto the event.',
                        'For a one-off item, tap Add new and choose Add equipment, Add location, or Add free text.',
                        'Assignees check items off as they\'re completed — status is shared with the cluster.',
                    ] },
                    { kind: 'note', text: 'Build a checklist once and drop it onto any event instead of re-typing the same items. Cluster checklists themselves are created and edited under Settings → App Content → Checklists (New checklist → Add check → Equipment / Location / Free text).' },
                ],
            },
            {
                id: 'troops-to-task',
                title: 'Troops to Task & the Huddle',
                summary: 'Daily positions and matching people to assignments.',
                blocks: [
                    { kind: 'image', src: 'troops-to-task.png', srcMobile: 'troops-to-task-mobile.png', alt: 'Troops to Task view', caption: 'Matching people to the day.', side: 'right' },
                    { kind: 'p', text: 'Troops to Task is where you match your people to the day\'s work. A Huddle band across the top holds the Provider row plus one row per station your cluster defines; personnel lanes and an Unassigned row sit below it.' },
                    { kind: 'steps', items: [
                        'Switch to Troops to Task on the island.',
                        'Tap a person in the left name column to "arm" them — the row highlights.',
                        'Tap a station row (or the Provider row) to assign that person there. If they\'re already placed, you\'re asked to remove the existing assignment first.',
                        'Tap an empty station row to open a new Huddle event pre-set to that station.',
                    ] },
                    { kind: 'note', text: 'The station rows come from your cluster\'s Huddle Tasks, defined by a supervisor in Calendar Settings. Review coverage at a glance so gaps are obvious before they bite you.' },
                ],
            },
            {
                id: 'provider-templates',
                title: 'Appointment templates',
                summary: 'Generate provider appointment slots across a date range.',
                tier: 'supervisor',
                blocks: [
                    { kind: 'image', src: 'appointment-templates.png', srcMobile: 'appointment-templates-mobile.png', alt: 'Appointment template generator', caption: 'Generating appointment slots.', side: 'left' },
                    { kind: 'p', text: 'Supervisors can generate provider appointment slots in bulk — a template that lays down open appointment blocks across the days you choose — and clear them back out when plans change.' },
                    { kind: 'sub', text: 'Define appointment types first' },
                    { kind: 'steps', items: [
                        'Open the calendar\'s Settings (gear) → the Appointment Types section.',
                        'Tap New appointment type, enter a Type name (e.g. "20-min in-person") and a Duration in minutes, then Save.',
                    ] },
                    { kind: 'sub', text: 'Generate the slots' },
                    { kind: 'steps', items: [
                        'Tap + → Templates → Provider Template.',
                        'Pick the Provider and the Appointment type, then set the Start date / time and End date / time.',
                        'Review the preview of generated slots (tap a slot to Remove it), then tap Generate in the header.',
                        'To pull slots back out, use + → Templates → Clear Templates, pick the provider(s) and a date range, and Clear.',
                    ] },
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
                    { kind: 'p', text: 'Messaging is end-to-end encrypted. Your cluster and associated clusters surface automatically, and you can always start a conversation by looking someone up.' },
                    { kind: 'steps', items: [
                        'Open Messages and tap New.',
                        'Search your contacts, or use one of the lookup options: Scan QR Code, Enter User Code, or an email lookup.',
                        'Pick the person to open the conversation.',
                    ] },
                    { kind: 'note', text: 'Users who haven\'t logged in yet won\'t be messagable.' },
                ],
                subsections: [
                    {
                        id: 'messaging-media',
                        title: 'Photos, voice notes & sharing',
                        blocks: [
                            { kind: 'list', items: [
                                'Tap the + in the composer to attach a photo, or share a calendar event or a map overlay straight into the chat.',
                                'Hold the mic button to record a voice note.',
                                'Share a property item, event, or overlay from that object\'s own menu ("Share to chat") — pick recipients and send. The other person taps through to it.',
                                'Long-press a message to Reply, Forward, Copy, Save media, or Delete.',
                            ] },
                            { kind: 'note', text: 'The app doesn\'t keep a file locker. Attachments live in the conversation where you sent them, not a separate documents area.' },
                        ],
                    },
                    {
                        id: 'messaging-self-notes',
                        title: 'Notes to self',
                        blocks: [
                            { kind: 'p', text: 'Your "Notes" conversation is a private thread with yourself — a quick place to stash a reminder or a scratch message that stays on your account. Start a new message and pick your own Notes row.' },
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
                    { kind: 'p', text: 'Groups are shared conversations for a team or a task.' },
                    { kind: 'steps', items: [
                        'Tap New → New Group.',
                        'Enter a Group name, tick the members to include, and tap Create Group.',
                        'Later, open the group and tap Group info to manage it.',
                    ] },
                    { kind: 'list', items: [
                        'Rename the group with the pencil.',
                        'Add members by Email or User Code.',
                        'Make a member primary (the admin badge), or Leave the group yourself.',
                        'A primary member can Purge the group.',
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
                        'A message from an outside contact routes to whoever is on-call in the cluster.',
                        'An event request from an outside contact goes to the cluster supervisors, who can add it to the calendar or decline it.',
                    ] },
                    { kind: 'p', text: 'This keeps the medics reachable. The supervisor can rotate the keys or kill the link at any time; if outside contact isn\'t authorized, the cluster is unreachable from the outside.' },
                ],
            },
            {
                id: 'on-call',
                title: 'On-call & the roster',
                summary: 'Publish a secure inbound link and control who gets notified.',
                tier: 'supervisor',
                blocks: [
                    { kind: 'image', src: 'on-call.png', srcMobile: 'on-call-mobile.png', alt: 'On-call roster', caption: 'The on-call roster.', side: 'left' },
                    { kind: 'p', text: 'Supervisors publish a secure link plus passphrase so people outside the cluster can reach it, and control who gets the notifications. This lives in the Outside contact section of your cluster panel (Settings → Clusters → your cluster).' },
                    { kind: 'sub', text: 'Publish the link' },
                    { kind: 'steps', items: [
                        'In the Outside contact section, tap Mint event intake.',
                        'Type a Passphrase and Confirm it (or tap Random), then tap Mint.',
                        'The card now shows the Unit code, a Submission URL, and a QR — share those with the people who need to reach you.',
                        'Turn on the channels you want: Allow event requests, Allow text messaging, and (where available) Allow calls.',
                    ] },
                    { kind: 'sub', text: 'Manage the roster' },
                    { kind: 'steps', items: [
                        'Once a channel is enabled, each person in the Users list gains an on-call toggle.',
                        'Toggle people on or off as shifts change — off-shift members stop getting these notifications.',
                        'Rotate the passcode or passphrase, or Kill credential, from the section\'s menu when keys need to change.',
                    ] },
                    { kind: 'note', text: 'Rotating the passcode invalidates the current QR — reprint your poster after you rotate.' },
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
                summary: 'MEDCOM PAM 40-7-21 sick-call decision trees.',
                blocks: [
                    { kind: 'image', src: 'adtmc.png', srcMobile: 'adtmc-mobile.png', alt: 'ADTMC algorithm question card', caption: 'Working an algorithm.', side: 'right' },
                    { kind: 'p', text: 'The clinical engine walks you through an encounter using ADTMC sick-call decision trees. Pick the presenting symptom and answer the questions.' },
                    { kind: 'steps', items: [
                        'Open a symptom category and choose the complaint. (The symptom screen also links General Information, Differentials, and MEDCOM / STP training.)',
                        'Work the question cards top to bottom. Choice cards take an option; Action Required cards take Performed (green check) or Deferred / Not Indicated (red X); Screening Tool cards open a scored screener.',
                        'When a disposition card appears, tap the Continue chevron to open the note builder.',
                    ] },
                ],
            },
            {
                id: 'screeners',
                title: 'Screeners',
                summary: 'Standard screening instruments, scored for you.',
                blocks: [
                    { kind: 'image', src: 'screeners.png', srcMobile: 'screeners-mobile.png', alt: 'A screener', caption: 'A scored screener.', side: 'left' },
                    { kind: 'p', text: 'Common screening instruments are built in and scored as you go. When an algorithm reaches a Screening Tool card, the result drops straight into the encounter.' },
                    { kind: 'steps', items: [
                        'On a Screening Tool card, tap Start Screening.',
                        'Answer each question — a running Score and interpretation show at the top. (PHQ-2 extends to PHQ-9 automatically when it needs to.)',
                        'Tap Complete Screening; the card reads Completed with the score and carries into the note.',
                    ] },
                    { kind: 'list', items: [
                        'GAD-7 and PHQ-2 / PHQ-9 for anxiety and depression.',
                        'MACE 2 for concussion screening.',
                        'AUDIT-C for alcohol use.',
                    ] },
                    { kind: 'note', text: 'You can also open any screener from the knowledge base for reference; the score only flows into an encounter when you launch it from an algorithm card.' },
                ],
            },
            {
                id: 'knowledge-base',
                title: 'Knowledge base & medications',
                summary: 'Reference for medications, guidelines, screeners, and calculators.',
                blocks: [
                    { kind: 'image', src: 'knowledge-base.png', srcMobile: 'knowledge-base-mobile.png', alt: 'Knowledge base', caption: 'The reference shelf.', side: 'right' },
                    { kind: 'p', text: 'The knowledge base is your reference shelf — medications, training references (STP 8-68W13), the screening tools, calculators (Conversions, Burn Assessment, Heat Category), and the 9-Line MEDEVAC report.' },
                    { kind: 'steps', items: [
                        'Open Knowledge Base and use the Search field, or tap a category group.',
                        'Tap Medications, then search or tap a drug to open its detail.',
                        'Use Pin in the header to save a medication to your Pinned list for fast recall.',
                    ] },
                ],
            },
            {
                id: 'writing-notes',
                title: 'Writing a note',
                summary: 'Assemble a documentation note from the encounter.',
                blocks: [
                    { kind: 'image', src: 'note-builder.png', srcMobile: 'note-builder-mobile.png', alt: 'Note builder', caption: 'Assembling a note.', side: 'left' },
                    { kind: 'p', text: 'The note builder assembles your documentation from the encounter — the algorithm path seeds the history, exam, and plan, and you fill in the rest. The Full Note tab shows the sections; the Decision Making tab shows how you got there.' },
                    { kind: 'list', items: [
                        'History of Present Illness — tap Add HPI.',
                        'Physical Exam — each body-system block toggles Normal / Abnormal; pick findings and "(specify…)" for detail. A Vital Signs block is included.',
                        'Assessment — a free-text impression, plus a Differential Diagnosis you build from suggestions or custom entries.',
                        'Plan — order-set blocks for Meds, Lab, Radiology, Referral, Instructions, and Follow-up.',
                    ] },
                    { kind: 'steps', items: [
                        'Fill the section cards on the Full Note tab.',
                        'Tap Next; choose Include DM or Exclude DM to control whether decision-making is embedded.',
                        'On the final page, Done offers to Log training against your record.',
                    ] },
                ],
            },
            {
                id: 'sharing-notes',
                title: 'Sharing & importing a note',
                summary: 'Export as SF 600 / DD 689, a data matrix, or encoded text; import by barcode.',
                blocks: [
                    { kind: 'image', src: 'note-export.png', srcMobile: 'note-export-mobile.png', alt: 'Note export options', caption: 'Export options for a note.', side: 'right' },
                    { kind: 'p', text: 'A finished note gives you an encoded string, a data-matrix barcode, and the plain text. We do not store this information on our server, so it moves device-to-device with you.' },
                    { kind: 'steps', items: [
                        'From the Note Preview, Copy note text or Export SF600 PDF.',
                        'From the Encoded Note, Copy encoded text, Share note as image, or Export DD689 PDF.',
                        'On the receiving device, use the import bar — Scan barcode, Upload image, or paste the code — then Decode to keep working on it.',
                        'Or copy the plain text and paste it directly into the EHR.',
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
                        'Open the Provider drawer and tap Import Medic Note, then paste or scan the encoded note and Decode.',
                        'The medic\'s note shows read-only under each section (HPI / Physical Exam / Assessment / Plan); type your additions in each box. Apply a template if you use one.',
                        'Tap Next to reach Note Output — your signature is appended.',
                        'Copy the note text, Export SF600 PDF, or copy the encoded note / barcode to hand off or paste into the EHR.',
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
                    { kind: 'p', text: 'TC3 cards track treatment across time so the record matches prolonged field-care documentation. A card is one scrolling column you fill top to bottom.' },
                    { kind: 'steps', items: [
                        'Open TC3 and tap Add casualty details to fill Casualty Information — EVAC priority, name, battle roster number, sex, blood type, unit, and allergies.',
                        'Add mechanism — pick from the Select All That Apply list (GSW, Blast, Burn, Fall, MVC, IED, and more).',
                        'Tap the body diagram to place injury, treatment, and IV/IO markers.',
                        'Add interventions under MARCH (Hemorrhage / Airway / Breathing / Circulation), including meds, fluids, and blood products with quick-add chips.',
                        'Record vitals as timestamped entries so you see the trend over the length of care.',
                        'Export the card with Export Note & Barcode to transfer it.',
                    ] },
                    { kind: 'note', text: 'Link a card to a map drop point from the map (a waypoint\'s "Link active casualty card"). The Heat Category calculator lives in the knowledge base if you need WBGT/heat guidance alongside a card.' },
                ],
                subsections: [
                    {
                        id: 'tc3-card-detail',
                        title: 'Running multiple casualties',
                        blocks: [
                            { kind: 'p', text: 'The Casualties roster in the TC3 header keeps each card separate so you can move between them during a MASCAL.' },
                            { kind: 'list', items: [
                                'Tap New casualty to start another card; each row reads "Casualty N · Name".',
                                'A row\'s menu offers View note, Reset card, or Discard.',
                                'Export all hands off the whole queue at once.',
                            ] },
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
                    { kind: 'p', text: 'The 9-line builder walks you through a complete request. Open it from the knowledge base ("9-Line MEDEVAC"), from a PZ/LZ map pin ("Build MEDEVAC"), or by choosing MEDEVAC as an event category.' },
                    { kind: 'steps', items: [
                        'Choose the mode — W (Wartime) or P (Peacetime) — top-right.',
                        'Tap each numbered line and fill it: pickup site (with Use current location), radio, patients by precedence and type, special equipment, security or wound info, marking method, nationality, and NBC / terrain.',
                        'Use Next line / Clear line / Accept as you move through.',
                        'Review and export the completed request to hand off, or pre-fill line 1 from a map pin.',
                    ] },
                ],
            },
            {
                id: 'burn-calculator',
                title: 'Burn calculator',
                summary: 'Estimate total body surface area burned and fluids.',
                blocks: [
                    { kind: 'image', src: 'burn-calculator.png', srcMobile: 'burn-calculator-mobile.png', alt: 'Burn calculator body diagram', caption: 'Marking TBSA.', side: 'right' },
                    { kind: 'p', text: 'Open Burn Assessment in the knowledge base. Mark the affected regions on the body diagram and it works out the total body surface area (TBSA) for you.' },
                    { kind: 'steps', items: [
                        'Tap the burned regions on the body diagram — the Measurements panel shows a running TBSA %.',
                        'Enter the patient weight in pounds (it converts to kilograms).',
                        'Read the Rule of Ten (initial rate, titrated to urine output) and the Parkland Formula (24-hour volume split first-8 / next-16 hours).',
                    ] },
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
                    { kind: 'p', text: 'The map holds full MGRS / UTM navigation overlays that download for offline use and export for sharing.' },
                    { kind: 'steps', items: [
                        'Tap the add button → Add to map → New overlay to create one.',
                        'Use Import to bring in GPX/KML, a Geo-PDF, or MBTiles tiles.',
                        'On an overlay\'s row menu you can View / Hide, Rename, Share to chat, Link to event, Add floor, or download / remove offline tiles.',
                        'Link an overlay to a calendar event — a range or a duty location — so it opens straight from the schedule.',
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
                        'Open Map Settings to switch the Coordinate display between MGRS, UTM, and Lat/Lng, and the Bearing reference between True, Grid, and Magnetic (declination is handled for you).',
                        'Open the MGRS Converter to type a grid and Go to map, or copy a converted coordinate.',
                        'Tap any point to see its MGRS / UTM / Lat / Lng and Save as waypoint or Navigate from here.',
                        'Use Measure to get distance and bearing between two points.',
                        'A saved route\'s read view lists per-leg distance and bearing and exports a strip map.',
                    ] },
                ],
            },
            {
                id: 'map-waypoints',
                title: 'Waypoints, routes & areas',
                summary: 'Drop pins and draw routes and zones.',
                blocks: [
                    { kind: 'image', src: 'map-waypoints.png', srcMobile: 'map-waypoints-mobile.png', alt: 'Waypoint glyph picker', caption: 'The pin library.', side: 'left' },
                    { kind: 'p', text: 'Mark up the map with a full library of pins — LZ, PZ, DZ, CCP, rally, objective, casualty, supply, hazard, target, and more — plus routes and areas.' },
                    { kind: 'steps', items: [
                        'Tap the add button → New feature → Drop pin, then tap the map and pick the glyph.',
                        'Choose Route and tap successive points to get per-leg distance and bearing, then Save as route.',
                        'Choose Area and tap points to mark a zone, then Save as area.',
                        'Edit a feature to rename it, recolor it, link a TC3 card or events, or reassign its floor.',
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
                        'Download an overlay\'s map tiles so it works offline, and remove them to reclaim space.',
                        'Import overlays as GPX or KML, or import MBTiles tiles directly.',
                        'Upload a Geo-PDF map to bring your own graphics onto the map.',
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
                    { kind: 'p', text: 'The property book answers "where is everything." Items live in a tree of locations — buildings, rooms, and vehicles — that you build to match your footprint. The Add button (+) opens the "Add to Property Book" sheet with New Item, New Location, and the Data & labels tools.' },
                    { kind: 'sub', text: 'Add a location (building, room, or zone)' },
                    { kind: 'steps', items: [
                        'Tap + → New Location.',
                        'Enter a Location name and, to nest it (a room inside a building), pick the building under Parent location.',
                        'Leave Type on Area for buildings, rooms, and zones. Optionally attach a photo to use as the map tile, then Save.',
                    ] },
                    { kind: 'sub', text: 'Add an item and place it' },
                    { kind: 'steps', items: [
                        'Tap + → New Item (or a location\'s menu → New item).',
                        'Fill Item name, Nomenclature, and Material/NSN and LIN. Set the class — Consumable, Durable, or Sensitive.',
                        'Turn on Track individually (serialized) for serial-numbered gear and add each serial; otherwise set a Quantity and Unit of issue (EA, SET, PR…).',
                        'Pick the Location to place it in, optionally a Holder and a Parent item, then Save.',
                    ] },
                    { kind: 'note', text: 'Search from the top of the book to jump to any item or location.' },
                ],
                subsections: [
                    {
                        id: 'property-vehicles',
                        title: 'Vehicles, PMCS & dispatch',
                        blocks: [
                            { kind: 'p', text: 'A vehicle is just a location with its Type set to Vehicle. Once it exists, it carries its own maintenance and dispatch timeline, and its BII can be signed onto the hand receipt.' },
                            { kind: 'steps', items: [
                                'Tap + → New Location, name it (put the bumper number in the name — there is no separate bumper field), and set Type to Vehicle.',
                                'Optionally pick a Hand-receipt LIN so the vehicle carries its authorized BII, then Save.',
                                'On the vehicle, open its menu for PMCS and Dispatch (both show only for vehicles), plus New item to load its BII.',
                            ] },
                            { kind: 'sub', text: 'Dispatch (DA 5982/5987)' },
                            { kind: 'steps', items: [
                                'Open the vehicle\'s menu → Dispatch.',
                                'Set the Dispatch expires date, Odometer out, Operator, and TC — then tap Dispatch. You can scan the paper dispatch form to attach it.',
                                'When the vehicle comes back, open Dispatch again and fill the Return date and Odometer in, then Return.',
                            ] },
                            { kind: 'sub', text: 'PMCS (5988/5988E)' },
                            { kind: 'steps', items: [
                                'Open the vehicle\'s menu → PMCS.',
                                'Enter Mileage and fuel level, pick the Operator (and Mechanic), and use Report a fault to stage any faults.',
                                'Tap Record PMCS — the readings and faults commit as one event. Tap an open fault\'s X later to mark it corrected.',
                            ] },
                            { kind: 'note', text: 'Recent dispatch and PMCS activity also surface on the Sign-outs tab under their own groups.' },
                        ],
                    },
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
                            { kind: 'p', text: 'The authorized-items list IS your hand receipt — the LINs you are signed for and, under each, the items that make it up. You build it yourself; there is no external catalog to sync. Open it from the Cluster Hand Receipt row.' },
                            { kind: 'steps', items: [
                                'Tap Add authorized item. With no LINs yet, you\'re prompted to add one first — a LIN is a header (a Set name and a LIN number), not a counted item.',
                                'Under a LIN, add its authorized components: a Component role (e.g. Tourniquet), a Product name (e.g. CAT), the Material/NSN, and the Authorized qty.',
                                'On-hand rolls up automatically from the physical stock you\'ve placed in the book that matches that LIN and NSN.',
                            ] },
                            { kind: 'note', text: 'Each authorized line reads as on-hand / authorized in EA units, so a shortage is obvious at a glance. You can also Import from CSV to seed the whole hand receipt.' },
                        ],
                    },
                    {
                        id: 'property-shortages',
                        title: 'Shortages',
                        blocks: [
                            { kind: 'image', src: 'property-shortages.png', srcMobile: 'property-shortages-mobile.png', alt: 'Shortages report', caption: 'Shortages by LIN.', side: 'right' },
                            { kind: 'p', text: 'The Cluster Shortages report is authorized minus on-hand, folded live from the book and grouped under each LIN. Anything you are short shows the exact gap.' },
                            { kind: 'list', items: [
                                'A line is short when on-hand falls below its authorized quantity.',
                                'Staging an item for turn-in counts it as gone immediately, so the shortage surfaces right away.',
                                'Open the report\'s More actions menu → DA 2062 shortage annex to export the shortfall as a printable annex.',
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
                                'Tap + → New DA 2062.',
                                'Under "Sign to", pick a cluster member, or add an outside recipient by name.',
                                'Select the items (each with a quantity capped at on-hand). Toggle "Move to recipient\'s zone" if the item physically leaves its location, and add notes.',
                                'Tap Sign out — the recipient signs on the signature pad, and the app builds the 2062 to print or export.',
                                'Sign items back in from the Sign-outs tab → Signed Out → the receipt\'s menu → Sign in; the item returns to a location you choose.',
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
                                'From an item\'s menu → Logistics → Stage for turn-in as you set items aside. They stay on-hand and accountable, and their lines show short until they leave the book.',
                                'Review the batch on the Sign-outs tab → Turn-In group. Open it to Edit items (un-stage anything you\'re keeping).',
                                'When you go to the depot, Complete turn-in to mint the DA 3161 document.',
                                'Completed items drop off the active book and stay browsable in turn-in history (Open DA 3161).',
                            ] },
                            { kind: 'note', text: 'Staging is fully reversible — Remove turn-in un-stages every item back onto the books before it is turned in.' },
                        ],
                    },
                    {
                        id: 'personal-property',
                        title: 'Personal vs cluster property',
                        blocks: [
                            { kind: 'p', text: 'An item can belong to the cluster or to you personally. Personal property travels with you rather than staying with the cluster.' },
                            { kind: 'steps', items: [
                                'Open an item\'s menu → Logistics → Mark as mine (or Mark as cluster property to hand it back).',
                                'Use the left-rail My property filter → My property only to see just what you own or hold.',
                            ] },
                            { kind: 'note', text: 'Cluster property is the default and stays on the cluster book; personal property is scoped to you and follows your member zone.' },
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
                    { kind: 'steps', items: [
                        'Tap the Camera button and point it at an item\'s printed label to locate it on the map or mark it expended.',
                        'Enroll an item in Visual ID (item menu → Logistics → Enroll Visual ID) so the camera can recognize it later without a barcode.',
                        'Print labels from + → Data & labels → Print labels (or a single item / zone from its menu), choosing Address or File-folder stock.',
                        'Import or export the book as CSV from + → Data & labels. Import is an upsert (merge), never a wipe.',
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
                    { kind: 'p', text: 'Training you complete is tracked against your record. Open a task to see its Conditions, Standards, and Performance Steps; an assigned task shows a Due / Overdue banner.' },
                    { kind: 'steps', items: [
                        'Open an STP task from the knowledge base (STP 8-68W13) or your training list.',
                        'Work through it and tap Mark as Completed (or scroll to the end).',
                        'If the task was scheduled on the calendar, completing it flips that event to done automatically, so the schedule and the record stay in step.',
                    ] },
                ],
            },
            {
                id: 'certifications',
                title: 'Certifications',
                summary: 'Expiration-aware certification tracking.',
                blocks: [
                    { kind: 'image', src: 'certifications.png', srcMobile: 'certifications-mobile.png', alt: 'Certifications list', caption: 'Certs and their status.', side: 'right' },
                    { kind: 'p', text: 'Certifications track what you\'re current on and warn before they lapse. Manage them in Settings → Profile → Certifications.' },
                    { kind: 'steps', items: [
                        'Tap Add certification.',
                        'Fill the Certification title, Cert #, Issued date, and Expires date, and mark it Primary if it\'s your main credential.',
                        'Save. Each cert shows a status pill — Valid, Expiring, or Expired — so nothing quietly goes out of date.',
                    ] },
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
                    { kind: 'p', text: 'The Supervisor drawer is your team-lead lens: readiness, certifications, coverage, and per-soldier training status in one place. Training completions update live, so you see progress as it happens.' },
                    { kind: 'list', items: [
                        'A cluster overview card shows Readiness and Compliance bars (red below 50%).',
                        'Soldier Readiness lists each person worst-first, with badges for loaned in / out and overdue items. Tap a soldier for their certs, tests, assignments, and timeline.',
                        'Coverage Gaps breaks down subject-area coverage; drill in to evaluate tasks (Go / No-Go) or algorithms, or schedule training onto the calendar.',
                    ] },
                ],
            },
            {
                id: 'clinic-management',
                title: 'Managing your cluster',
                summary: 'Add people, manage personnel and roles, and shape cluster surfaces.',
                tier: 'supervisor',
                blocks: [
                    { kind: 'image', src: 'clinic-management.png', srcMobile: 'clinic-management-mobile.png', alt: 'Cluster settings', caption: 'Cluster management.', side: 'right' },
                    { kind: 'p', text: 'Open Settings → Clusters → your cluster ("Manage cluster and personnel") to reach the cluster panel. This is where you add people, set roles, organize sub-units, and authorize outside contact.' },
                ],
                subsections: [
                    {
                        id: 'cluster-add-members',
                        title: 'Adding people to your cluster',
                        blocks: [
                            { kind: 'p', text: 'There is no self-registration — you add people. Adding is by email: if the person already has an account you attach them; if not, you create the account for them. (Your cluster\'s invite code / QR is for associating with other clusters, not for adding individuals.)' },
                            { kind: 'steps', items: [
                                'In the cluster panel\'s Users section, tap Add member.',
                                'Type the person\'s email and tap Add.',
                                'If an account exists, they\'re added immediately.',
                                'If not, the card becomes a New user form — set a Password (12+ chars), First / Last / MI, Credential, Component, Rank, and UIC, and toggle Supervisor or Provider if needed. Tap Create & add.',
                            ] },
                            { kind: 'note', text: 'Everyone gets the Medic role by default. Adding someone who belongs to another cluster reassigns them to yours.' },
                        ],
                    },
                    {
                        id: 'cluster-personnel',
                        title: 'Managing personnel & roles',
                        blocks: [
                            { kind: 'steps', items: [
                                'In the Users list, tap a member to open their card.',
                                'Tap Edit (pencil) to change their email, Component, Rank, Roles (Supervisor / Provider — Medic is always implied), and Section, then Save.',
                                'Use Reset password to set a new password (it takes effect immediately; the user is not notified).',
                                'Use Remove — or swipe the row left — to take them off the cluster ("Remove from cluster?").',
                            ] },
                            { kind: 'note', text: 'Organize platoons and squads under the Sub-units section (Add sub-unit); deleting a sub-unit moves its members to HQ / Unassigned.' },
                        ],
                    },
                    {
                        id: 'cluster-associate',
                        title: 'Associating with other clusters',
                        blocks: [
                            { kind: 'p', text: 'Associating clusters lets you message and loan people between them. Each cluster has a rotating invite code and QR on its main card.' },
                            { kind: 'steps', items: [
                                'Share your invite: use the cluster card\'s menu → Copy invite code or Share QR image.',
                                'To link another cluster, tap Associate a cluster and enter their invite code, or scan / upload their QR, then Associate.',
                                'Remove a link by swiping it or using Disassociate.',
                            ] },
                        ],
                    },
                ],
            },
            {
                id: 'soldier-loaning',
                title: 'Loaning soldiers between clusters',
                summary: 'Assign a primary cluster and transfer people across associated clusters.',
                tier: 'supervisor',
                blocks: [
                    { kind: 'image', src: 'soldier-loaning.png', srcMobile: 'soldier-loaning-mobile.png', alt: 'Loaning a soldier', caption: 'Transferring across clusters.', side: 'left' },
                    { kind: 'p', text: 'Supervisors can loan soldiers to associated clusters while keeping ownership clear. Open a member\'s card to reach the loan and transfer actions.' },
                    { kind: 'steps', items: [
                        'Open the member\'s card and tap Loans (up to 4) to toggle which associated clusters they\'re loaned to — or add one by cluster code.',
                        'Use Transfer to change a soldier\'s home cluster entirely (this ends every active loan).',
                        'A loaned-in soldier\'s remove action reads End loan, which sends them back to their home cluster.',
                    ] },
                    { kind: 'note', text: 'If you\'re loaned to other clusters yourself, use the Switch cluster / "Operating as" control on the cluster card to manage each cluster\'s schedule and personnel in turn.' },
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
