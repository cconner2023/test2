# (ADTMC)
Provides triage algorithms, medication references, note documentation with data matrix sharing, and 68W training IAW updated CPGs, MEDCOM PAM 40-7-21. Built mobile-first, offline-first. Always updating as the battlefield changes and based off of feedback.

```
https://cconner2023.github.io/test2
```

## Tech Stack
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4.
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Offline:** Service Worker (vite-plugin-pwa), IndexedDB (idb) for local persistence encrypted with AES-256-GCM for authenticated users
- **Sync:** Custom offline-first sync queue with conflict resolution. training that occurs offline is saved locally until the server is contacted.

## Key Features

- **Algorithm Navigation:** Step-by-step medical triage verbatim from MEDCOM PAM 40-7-21
  - 30+ algorithms across 6 clinical categories
  - Integrated screening tools (PHQ-2/9, GAD-7, MACE-2) with automatic scoring
  - Inline clinical guidelines, medication references, and linked training tasks
- **Note Customization:** custom text expanders mimicking other auto-text templates. User-defined: you don't have to look at 30-thousand enterprise templates.
- **Training Tracking:** Per-item training completion with sync to server for authenticated users
 - Train anywhere
 - Leaders can evaluate training. Progressed encrypted and cached locally. Sent to server when connectivity is restored.
- **Offline-First:** Full functionality without network; sync queue pushes training progress on reconnect
- **Authentication:** Auth with role-based access
- **Dark/Light Theme:** System preference detection with manual toggle

## Usage Notes

- ALWAYS consult your attending physician. Always refer to local SOP if unsure.
- Never prescribe a medication you don't understand. Always double check your documentation.
- No PII/PHI or note documentation is stored, transmitted, or touches the server. Patient safety is top priority — be respectful of HIPAA and the right to privacy.

## Feedback
- We're always looking for feedback on how to make this product better. You can send feedback in the application settings.

## In Progress
- **BAA:** To one day store / send PHI/PII through secured servers using signal protocols.
- **Logistics:** Inventory your aid bag, your CLS, or your Aid bag. Keep track of expiring medications, and when to call up for re-supply.
- **Battle Injuries:** Sick Call is one thing. Battle injury documentation could be handled the same way.
- **Notifications:** Improved notifications for expiring inventory items and messaging system encrypted end-to-end.
- **9-line MEDEVAC:** Craft your 9-line as you work.