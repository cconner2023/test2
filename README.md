# ADTMC (ProjectOne)

A Progressive Web App for expediting medical triage workflows. Team members navigate through algorithm categories, subcategories, and branching decision trees to reach dispositions, then document outcomes via structured notes.

## Technology Stack

- **Framework:** React 19 + TypeScript 5
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS 4
- **Animations:** Motion (framer-motion successor) + @formkit/auto-animate
- **Icons:** Lucide React
- **Barcode:** pdf417-generator, qrcode.react, qr-scanner, @zxing/library
- **PWA:** vite-plugin-pwa (Workbox) - standalone display, cache-first assets

## Quick Start

```bash
# Option 1: Use init script
bash init.sh

# Option 2: Manual setup
npm install
npm run dev
```

The development server starts at: **http://localhost:5173/ADTMC/**

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
  App.tsx              # Main application component
  main.tsx             # React DOM entry point
  Components/          # 19 React components
    AlgorithmPage.tsx   # Decision tree display
    BaseDrawer.tsx      # Unified drawer wrapper
    CategoryList.tsx    # Category grid navigation
    WriteNotePage.tsx   # 4-page note wizard
    MyNotes.tsx         # Saved notes management
    NavTop.tsx          # Top navigation bar
    Settings.tsx        # App settings
    MedicationsDrawer.tsx # Medication reference
    NoteImport.tsx      # Barcode import
    ...
  Data/                # Static medical data (verbatim, do not modify)
    Algorithms.ts       # Decision tree definitions
    CatData.ts          # Categories and symptoms
    MedData.ts          # Medication database
    Release.ts          # Version history
  Hooks/               # Custom React hooks
    useNavigation.ts    # Central navigation state
    useAlgorithm.ts     # Algorithm/decision tree logic
    useNotesStorage.ts  # localStorage CRUD for notes
    useSearch.ts        # Search with debouncing
    useNoteCapture.ts   # Note text generation
    useNoteImport.ts    # Barcode decode/import
    useBarcodeScanner.ts # Camera barcode scanning
    useServiceWorker.ts # PWA update handling
  Types/               # TypeScript interfaces
  Utilities/           # Theme context, animations, colors
public/                # PWA icons and assets
```

## Core Flow

**Categories** -> **Subcategories/Symptoms** -> **Algorithm Decision Tree** -> **Disposition (CAT I-IV)** -> **Write Note (4-page wizard)**

## Data Storage

- **localStorage** key `adtmc_saved_notes`: Array of SavedNote objects
- **localStorage** key `theme`: User theme preference (`light` | `dark` | `system`)
- No backend required - fully client-side PWA

## Important Notes

- All algorithm/medical data in `src/Data/` comes from external documentation **verbatim** and must not be modified
- The core navigation flow must never be altered
- No mock data or in-memory substitutes - all persistence uses real localStorage
