# PackageBackEnd

A Progressive Web Application for medical triage documentation and training validation based on **ADTMC MEDCOM PAM 40-7-21**.

## Overview

This app enables medics to:
- Navigate triage algorithms step-by-step
- Document decisions and generate triage notes
- Share notes via PDF417 barcodes and encoded strings
- Import notes from barcodes or encoded strings
- Track training completion
- Work fully offline with automatic sync when connectivity returns

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React + TypeScript |
| Bundler | Vite |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Offline | Service Worker + IndexedDB |
| PWA | Vite PWA Plugin |

## Quick Start

### Prerequisites

- **Node.js 18+** ([download](https://nodejs.org/))
- **Supabase project** ([create one](https://app.supabase.com/))

### Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   ```

2. **Configure environment variables**
   ```bash
   cp my-project/.env.example my-project/.env
   ```
   Edit `my-project/.env` with your Supabase credentials:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

3. **Run the setup script**
   ```bash
   chmod +x init.sh
   ./init.sh
   ```

   This will:
   - Verify prerequisites (Node.js 18+)
   - Check environment configuration
   - Install npm dependencies
   - Start the Vite development server on http://localhost:5173

### Manual Setup (Alternative)

```bash
npm --prefix my-project install
npm --prefix my-project run dev
```

## Project Structure

```
V2/
├── init.sh                      # Development environment setup script
├── README.md                    # This file
├── CLAUDE.md                    # AI agent instructions
├── .autoforge/                  # AutoForge framework (feature tracking)
│   ├── features.db              # Feature database (SQLite)
│   └── prompts/                 # Agent prompt files
│       ├── app_spec.txt         # Project specification
│       ├── initializer_prompt.md
│       ├── coding_prompt.md
│       └── testing_prompt.md
└── my-project/                  # React PWA application
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── .env.example             # Environment variable template
    └── src/
        ├── App.tsx              # Main application component
        ├── main.tsx             # React entry point
        ├── Components/          # React components
        │   ├── AlgorithmPage.tsx
        │   ├── CategoryList.tsx
        │   ├── MedicationPage.tsx
        │   ├── NavTop.tsx
        │   ├── Settings/        # Settings components
        │   └── ...
        ├── Data/                # Static bundled data (PAM 40-7-21)
        │   ├── Algorithms.ts
        │   ├── CatData.ts
        │   ├── MedData.ts
        │   └── TrainingData.ts
        ├── Hooks/               # Custom React hooks
        │   ├── useAlgorithm.ts
        │   ├── useNotesStorage.ts
        │   ├── useServiceWorker.ts
        │   └── ...
        ├── Types/               # TypeScript type definitions
        └── Utilities/           # Utility functions
```

## Database Schema (Supabase)

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data (display name, rank, UIC, role) |
| `clinics` | Clinic information (name, UIC) |
| `notes` | Triage notes (soft delete with deleted_at) |
| `training_completions` | Training item completion tracking |
| `sync_queue` | Offline mutation queue for sync-on-reconnect |

All tables are protected by **Row Level Security (RLS)** policies.

## Security

- **API Keys**: Stored in `.env` (never committed to source control)
- **Row Level Security**: Enabled on all Supabase tables
- **Client-side**: Only the anon key is exposed (safe with RLS)
- **No PII/PHI**: Notes contain operational data only (timestamp, user info, algorithm reference, HPI)

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Offline Support

The app is designed to work fully offline:
- **Service Worker** caches all static assets and data
- **IndexedDB** stores notes locally for offline access
- **Sync Queue** queues mutations and processes them on reconnect
- **Conflict Resolution** uses most-recent-timestamp strategy

## License

Proprietary - ADTMC MEDCOM
