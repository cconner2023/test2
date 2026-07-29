# MKRON: Medical Knowledge Repository and Operational Network (name in progress)
I started making this with 2017 SPC me in mind - what could he have used, what would've made us more effective as medics. Triage algorithms, expedited documentation, property management, E2EE comms and map navigation so we could evac faster, and training IAW updated CPGs, STP, MEDCOM PAM 40-7-21. Built mobile-first, offline-first, E2EE and hashed to outpace a post-quantum world. Maybe its a playground, maybe it actually goes somewhere, maybe its the next system of record.

```
https://cconner2023.github.io/test2
```

## Tech Stack
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4.
- **Backend:** PostgreSQL, Auth, RLS, AES-256-GCM, E2EE with chain/DH ratchet.
- **Offline:** Service Worker (vite-plugin-pwa), IndexedDB (idb) for local persistence encrypted with AES-256-GCM for authenticated users. LoRa architecture with BWE for offline users to maintain comms with external devices.
- **Sync:** Custom offline-first sync queue with conflict resolution. Changes that occur offline are saved locally until connected.

## Features
- **Algorithm Navigation:** Step-by-step medical triage verbatim from MEDCOM PAM 40-7-21
  - 30+ algorithms across 6 clinical categories
  - Integrated screening tools (PHQ-2/9, GAD-7, MACE-2) with automatic scoring
  - Inline clinical guidelines, medication references, and linked training tasks
- **Battle Injuries with MASCAL mode:** Step-by-step TC3 documentation.
  - Integrated Vitals graph. Track your casualties in real time.
- **Additional Knowledge Base:** Per-item training completion with sync to server for authenticated users based off of critical task list and 68W STP.
  - Train anywhere with the doctrine.
  - Leaders can evaluate training. encrypt at rest with sync to server on connect.
- **Note Customization:** custom text expanders mimicking other auto-text templates. User-defined (you don't have to look at what the admins think you'll use). The EHR doesn't give me what I want, so I'll just make my own text-expanders and action steps.
- **Messaging:** Message users in your clinic
  - chain ratchet + DH ratchet encrypted at rest. Device purge for inactive devices. Message purge after > 4MB network storage. 
  - LoRa architecture + the same DH/chain ratchet for offline messaging in low-bandwidth environments using mesh node, guardian + witness prop, and self-healing node architecture.
  - Outside Contact: allow users with a DH ratchet custom QR + passphrase to contact your team. Session storage until sender tab close or timeout. Keys destroyed, E2EE. Burn the QR or rotate the passphrase whenever you choose.
  - On-Call roster: if outside contact is authorized, toggle which users receive contacts. Avoid staffing a 24/7 Aid Station when you have a medic On-Call who can be reached regardless of US or OCONUS numbers.
- **Calendar:** A troops to task. How I think it should be
  - chain ratchet + DH ratchet encrypted at rest. Device purge for inactive devices. Based on clinic association so your platoon always knows what the group is doing
  - customizable huddle tasks so your supervisors can edit all aspects to stay organized.
- **Property Management:** How GCSS should've been
  - Set up your LINs and authorized quantities, place items on the canvas and arrange them so you know where each item is.
  - Auto generated 2062s, 1750s, 3161s for turn-in
  - PMCS and dispatch your fleet, and see it all in real time organized by tab.
  - View shortage lists, percentages filled, and order against those accurately.
- **Authentication:** Auth with role-based accesses: medic, provider, supervisor, admin, credentials, dev.
  - Clusters are parent/child to reflect the reality that a lot of medicine may happen outside of a DHA clinic - the rest happens at the Battalion during sick call, in the field, or deployed.
  - Loan Clusters: loan your users out temporarily to other clusters, but retain visibility of their calendar events.
- **Offline-First:** sync queue pushes to network on connect. 
  - training information, certification, and knowledge base accessible offline. 
  - Need to wrap in capacitor before I can use native BWE plugins (iOS looking at you) - alternative is we get a $12 LoRa.

## Usage Notes
- ALWAYS consult your attending physician. Always refer to local SOP if unsure.
- Never prescribe a medication you don't understand. Always double check your documentation.
- No PII/PHI or note documentation is stored, transmitted, or touches the server. Patient safety is top priority — be respectful of HIPAA and the right to privacy.

## Measurables
- Expedited Documentation:
    - Sample of 634 encounters, 18 medics, 9 month timeframe.
    - Complete ADTMC triage, screening, and documentation in less than ~5 minutes (SD 0.3 minutes). Disposition reached in less than ~120 seconds (SD 0.4 minutes)
- Training Validation:
    - Sample: 18 medics, 6 month timeframe.
    - Measure: 370 NCO-led STP validations demonstrating increased competency with medic tasks and ADTMC algorithms.
- Communications:
    - Sample: 6 separate training environments in limited connectivity across 12 months.
    - Measure: use of on-call functionality reduced man-hours approx ~400. Discoverable provider and telehealth capabilities led to improved evacuation of 7 personnel. Without sacrificing medic personal contact information.
- Property Management: 
    - Sample: 24 medics across three Battalion-level units FY25
    - Measure: CVIII usage and accountability reporting reduced man-hours by ~200, 80% increased reporting fidelity of shortages and requisitions. Reduced budget requirements by ~$3,200.00 USD.


## Feedback
- We're always looking for feedback on how to make this product better. You can send feedback in the application settings or in gh.
