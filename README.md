# (ADTMC)
Algorithm Directed Troop Medical Care — MEDCOM PAM 40-7-21 documentation and training validation PWA. Provides triage algorithms, medication references, note documentation with data matrix sharing, and 68W training. Built mobile-first, offline-first with Supabase backend for data sync.

## Tech Stack
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Offline:** Service Worker (vite-plugin-pwa), IndexedDB (idb) for local persistence
- **Sync:** Custom offline-first sync queue with conflict resolution. Notes or training that occur offline are saved locally until the server is contacted.

## Key Features

- **Algorithm Navigation:** Step-by-step medical triage verbatim from from MEDCOM PAM 40-7-21
- **Note Documentation:** Create, edit, share notes via clipboard, encoded text, or data matrix
- **Note Customization:** custom text expanders mimicking other auto-text templates. User-defined: you don't have to look at 30-thousand of your closest friends' templates.
- **Note Import:** Import notes via camera barcode scan or encoded string
- **Training Tracking:** Per-item training completion with sync to Supabase
- **Offline-First:** Full functionality without network; sync queue pushes changes on reconnect
- **Authentication:** Supabase Auth (email/password) with role-based access
- **Dark/Light Theme:** System preference detection with manual toggle

## Usage Notes

- ALWAYS consult your attending physician. Always refer to local SOP if unsure.
- Never prescribe a medication you don't understand. Always double check your documentation.
- This was built without PII/PHI and was not meant to transmit identifiable information at its current iteration. Maybe someday soon.
- Patient safety is top priority — be respectful of HIPAA and the right to privacy.

