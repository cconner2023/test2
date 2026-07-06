# Name in progress - I'm open to suggestions. An application for the medical MOSs.
I started making this with 2017 SPC me in mind - what could he have used, what would've made us more effective as medics. Triage algorithms, medication references, note documentation suggestions, property management, E2EE comms for medical personnel so we could evac faster, and training IAW updated CPGs, STP, MEDCOM PAM 40-7-21. Built mobile-first, offline-first, E2EE and hashed to outpace a post-quantum world. Maybe its a playground, maybe it actually goes somewhere, maybe its the next system of record. Who knows. Feel free to chime in.

```
https://cconner2023.github.io/test2
```

## Tech Stack
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4.
- **Backend:** Supabase (PostgreSQL, Auth, RLS), AES-256-GCM, E2EE with chain/DH ratchet.
- **Offline:** Service Worker (vite-plugin-pwa), IndexedDB (idb) for local persistence encrypted with AES-256-GCM for authenticated users. LoRa architecture with BWE. 
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

## Feedback
- We're always looking for feedback on how to make this product better. You can send feedback in the application settings or in gh.

## In Progress and future thoughts
- **BAA:** one day store / send PHI/PII through secured servers with audit logging. Sick Call logs, real-time provider or NCO notification.
- **App licensing:** use the app stores and an .exe for desktop devices. take advantage of the hardware we already use.
- **Connections:** IPPS-A, MODS, DCAMS, GCCS-A, etc. Hoping for write accesses so we don't have to keep using software from whatever time period those are from.
- **MilitaryMedicine:** it would be really neat to be able to use their doctrine.
- **Physical Exam and Abnormal Findings Dictionary:** would have to be collected from providers and medics across the globe. most current ones are trademarked and not helpful.