# PackageBackEnd (ADTMC)

Algorithm Directed Troop Medical Care — MEDCOM PAM 40-7-21 documentation and training validation PWA.

Provides triage algorithms, medication references, note documentation with PDF417 barcode sharing, and training completion tracking. Built offline-first with Supabase backend for data sync.

## Tech Stack

- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Offline:** Service Worker (vite-plugin-pwa), IndexedDB (idb) for local persistence
- **Sync:** Custom offline-first sync queue with conflict resolution by timestamp

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>

# 2. Run the setup script
chmod +x init.sh
./init.sh
```

The `init.sh` script will:
- Check Node.js 18+ is installed
- Install all dependencies (including @supabase/supabase-js and idb)
- Create `.env.local` from template if needed
- Start the development server at http://localhost:5173/test2/

## Environment Variables

Copy `.env.example` to `.env.local` at the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Security:** The anon key is safe for client-side use with Row Level Security (RLS) enabled. Never commit the service role key.

**Note:** Database is already configured in Supabase. No local migration needed for front-end deployment.

## Project Structure

```
src/
├── Components/     # React UI components
├── Data/           # Static bundled data (ADTMC algorithms, medications, training)
├── Hooks/          # Custom React hooks
├── Types/          # TypeScript type definitions
├── Utilities/      # Helper functions (theme, codecs, animations)
├── lib/            # Supabase client, auth, offline DB, sync service
├── App.tsx         # Main application component
└── main.tsx        # Entry point
```

## Key Features

- **Algorithm Navigation:** Step-by-step medical triage algorithms from MEDCOM PAM 40-7-21
- **Note Documentation:** Create, edit, share notes via clipboard, encoded text, or PDF417 barcode
- **Note Import:** Import notes via camera barcode scan, file upload, or encoded string
- **Training Tracking:** Per-item training completion with sync to Supabase
- **Offline-First:** Full functionality without network; sync queue pushes changes on reconnect
- **Authentication:** Supabase Auth (email/password) with role-based access (medic/supervisor/dev)
- **Dark/Light Theme:** System preference detection with manual toggle

## Usage Notes

ALWAYS consult your attending physician. Always refer to local SOP if unsure.
Never prescribe a medication you don't understand. Always double check.

This was built without PII/PHI and was not meant to transmit identifiable information.
Patient safety is top priority — be respectful of HIPAA and the right to privacy.

## Development

```bash
npm run dev       # Start dev server
npm run lint      # Run ESLint
npm run preview   # Preview production build (tests PWA/SW)
```

**Do NOT run `npm run build`** — builds are handled by the project owner.
