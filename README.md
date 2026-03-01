# started as just ADTMC. name in progress - I'm open to suggestions.
I've tried to code this to provides triage algorithms, medication references, note documentation, property management, forward-security comms for medical personnel, and training IAW updated CPGs, MEDCOM PAM 40-7-21. Built mobile-first, offline-first. It's time we consolidated all of the apps and systems.

```
https://cconner2023.github.io/test2
```

## Tech Stack
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4.
- **Backend:** Supabase (PostgreSQL, Auth, RLS), Rust / Tauri for LoRa side-load components.
- **Offline:** Service Worker (vite-plugin-pwa), IndexedDB (idb) for local persistence encrypted with AES-256-GCM for authenticated users. 
- **Sync:** Custom offline-first sync queue with conflict resolution. training, messaging, property changes that occurs offline is saved locally until the server is contacted.

## Key Features

- **Algorithm Navigation:** Step-by-step medical triage verbatim from MEDCOM PAM 40-7-21
  - 30+ algorithms across 6 clinical categories
  - Integrated screening tools (PHQ-2/9, GAD-7, MACE-2) with automatic scoring
  - Inline clinical guidelines, medication references, and linked training tasks
- **Note Customization:** custom text expanders mimicking other auto-text templates. User-defined: you don't have to look at 30-thousand enterprise templates.
- **Knowledge Base:** Per-item training completion with sync to server for authenticated users based off of critical task list and 68W STP.
 - Train anywhere
 - Leaders can evaluate training. Progressed encrypted and cached locally. Sent to server when connectivity is restored.
- **Messaging:** Message users in clinic, chain ratchet + DH ratchet encrypted at rest. Device purge for inactive devices. Message purge after > 4MB network storage.
- 
- **Offline-First:** sync queue pushes training progress and messaging to network on connect. training information, certification, and knowledge base accessible offline. LoRa architecture + DH/chain ratchet in place for offline messaging in low-bandwidth environments.
- **Authentication:** Auth with role-based accesses
- **Dark/Light Theme:** System preference detection with manual toggle

## Usage Notes

- ALWAYS consult your attending physician. Always refer to local SOP if unsure.
- Never prescribe a medication you don't understand. Always double check your documentation.
- No PII/PHI or note documentation is stored, transmitted, or touches the server. Patient safety is top priority — be respectful of HIPAA and the right to privacy.

## Feedback
- We're always looking for feedback on how to make this product better. You can send feedback in the application settings.

## In Progress
- **BAA:** To one day store / send PHI/PII through secured servers using signal protocols or LoRa transmission.
- **Battle Injuries:** TC3 cards and 9-lines.