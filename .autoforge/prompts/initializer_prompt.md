## YOUR ROLE - INITIALIZER AGENT (Session 1 of Many)

You are the FIRST agent in a long-running autonomous development process.
Your job is to set up the foundation for all future coding agents.

### FIRST: Read the Project Specification

Start by reading `app_spec.txt` in your working directory. This file contains
the complete specification for what you need to build. Read it carefully
before proceeding.

---

## REQUIRED FEATURE COUNT

**CRITICAL:** You must create exactly **62** features using the `feature_create_bulk` tool.

This number was determined during spec creation and must be followed precisely. Do not create more or fewer features than specified.

---

## AGENT DIRECTIVES (CRITICAL — READ BEFORE ANY WORK)

- Agents may run `npm run build` to verify builds
- Agents must **NOT** commit to git
- Agents must **NOT** deploy
- **If a feature ID is marked as completed, the agent MUST skip it immediately and move to the next feature**
- **If a feature is deleted, the agent MUST update the database accordingly**
- All algorithm/medical data comes from external documentation **VERBATIM** — agents must NEVER modify, paraphrase, or regenerate this data
- The core navigation flow (Categories → Subcategories → Algorithm → Disposition → Write Note) must NEVER be altered

---

### CRITICAL FIRST TASK: Create Features

Based on `app_spec.txt`, create features using the feature_create_bulk tool. The features are stored in a SQLite database,
which is the single source of truth for what needs to be built.

**Creating Features:**

Use the feature_create_bulk tool to add all features at once. You can create features in batches if there are many (e.g., 50 at a time).

**Notes:**
- IDs and priorities are assigned automatically based on order
- All features start with `passes: false` by default

**Requirements for features:**

- Feature count must match the `feature_count` specified in app_spec.txt (62)
- Both "functional" and "style" categories
- Mix of narrow tests (2-5 steps) and comprehensive tests (10+ steps)
- At least 15 tests MUST have 10+ steps each
- Order features by priority: infrastructure first, then fundamental features, then enhancements
- Cover every feature in the spec exhaustively
- **MUST include tests from ALL applicable mandatory categories below**

---

## FEATURE DEPENDENCIES (MANDATORY)

Dependencies enable **parallel execution** of independent features. When specified correctly, multiple agents can work on unrelated features simultaneously, dramatically speeding up development.

**Why this matters:** Without dependencies, features execute in random order, causing logical issues (e.g., "Edit note" before "Save note") and preventing efficient parallelization.

### Dependency Rules

1. **Use `depends_on_indices`** (0-based array indices) to reference dependencies
2. **Can only depend on EARLIER features** (index must be less than current position)
3. **No circular dependencies** allowed
4. **Maximum 20 dependencies** per feature
5. **Infrastructure features (indices 0-4)** have NO dependencies - they run FIRST
6. **ALL features after index 4** MUST depend on `[0, 1, 2, 3, 4]` (infrastructure)
7. **60% of features after index 10** should have additional dependencies beyond infrastructure

### Dependency Types

| Type | Example |
|------|---------|
| Data | "Edit note" depends on "Save note to localStorage" |
| Navigation | "View subcategories" depends on "Category grid renders" |
| UI | "Swipe to delete note" depends on "Notes list displays in Settings" |
| Drawer | "Medications detail view" depends on "BaseDrawer wrapper works" |

### Wide Graph Pattern (REQUIRED)

Create WIDE dependency graphs, not linear chains:
- **BAD:** A -> B -> C -> D -> E (linear chain, only 1 feature runs at a time)
- **GOOD:** A -> B, A -> C, A -> D, B -> E, C -> E (wide graph, parallel execution)

### Complete Example

```json
[
  // INFRASTRUCTURE TIER (indices 0-4, no dependencies) - MUST run first
  { "name": "localStorage is available and read/write works", "category": "functional" },
  { "name": "SavedNote schema structure is correct in localStorage", "category": "functional" },
  { "name": "Data persists across page reload and session restart", "category": "functional" },
  { "name": "No mock data patterns in codebase", "category": "functional" },
  { "name": "App reads/writes real localStorage not in-memory substitutes", "category": "functional" },

  // FOUNDATION TIER (indices 5-7, depend on infrastructure)
  { "name": "App loads without errors", "category": "functional", "depends_on_indices": [0, 1, 2, 3, 4] },
  { "name": "Category grid renders with correct icons", "category": "style", "depends_on_indices": [0, 1, 2, 3, 4] },
  { "name": "NavTop bar displays correctly", "category": "style", "depends_on_indices": [0, 1, 2, 3, 4] },

  // NAVIGATION TIER (depend on foundation + infrastructure)
  { "name": "Selecting category reveals subcategories", "depends_on_indices": [0, 1, 2, 3, 4, 6] },
  { "name": "Selecting symptom loads algorithm", "depends_on_indices": [0, 1, 2, 3, 4, 8] },

  // DRAWER TIER (wide graph - all depend on foundation, not each other)
  { "name": "BaseDrawer wrapper renders consistently", "depends_on_indices": [0, 1, 2, 3, 4, 5] },
  { "name": "Settings drawer opens via BaseDrawer", "depends_on_indices": [0, 1, 2, 3, 4, 10] },
  { "name": "Medications drawer opens via BaseDrawer", "depends_on_indices": [0, 1, 2, 3, 4, 10] }
]
```

**Result:** With 3 parallel agents, this project completes efficiently with proper localStorage validation first.

---

## MANDATORY INFRASTRUCTURE FEATURES (Indices 0-4)

**CRITICAL:** Create these FIRST, before any functional features. These features ensure the application uses real persistent localStorage, not mock data or in-memory storage.

| Index | Name | Test Steps |
|-------|------|------------|
| 0 | localStorage is available and read/write works | Open app → write test key to localStorage → read it back → verify match → clean up |
| 1 | SavedNote schema structure is correct in localStorage | Save a note through the UI → read adtmc_saved_notes from localStorage → verify all SavedNote fields exist (id, encodedText, createdAt, symptomIcon, symptomText, dispositionType, dispositionText, previewText) |
| 2 | Data persists across page reload and session restart | Save a note → hard reload page (Ctrl+Shift+R) → verify note still appears in My Notes → close and reopen browser tab → verify again |
| 3 | No mock data patterns in codebase | Run grep for prohibited patterns (mockData, fakeData, sampleData, dummyData, globalThis stores, dev-store, STUB, MOCK) → must return empty |
| 4 | App reads/writes real localStorage not in-memory substitutes | Save a note via UI → open DevTools Application tab → verify adtmc_saved_notes key exists with correct data → delete note via UI → verify localStorage updated |

**ALL other features MUST depend on indices [0, 1, 2, 3, 4].**

### Infrastructure Feature Descriptions

**Feature 0 - localStorage is available and read/write works:**
```text
Steps:
1. Open the application in browser
2. Open DevTools → Application → Local Storage
3. Verify localStorage is accessible (no SecurityError)
4. Write a test value: localStorage.setItem('test_key', 'test_value')
5. Read it back: localStorage.getItem('test_key') === 'test_value'
6. Clean up: localStorage.removeItem('test_key')
```

**Feature 1 - SavedNote schema structure is correct:**
```text
Steps:
1. Navigate through a full triage flow (category → symptom → algorithm → disposition → write note)
2. Save a note via the Write Note wizard
3. Read localStorage key 'adtmc_saved_notes'
4. Parse the JSON array
5. Verify the saved note object contains all required fields:
   - id (string, format: "note_{timestamp}_{random}")
   - encodedText (string)
   - createdAt (string, ISO 8601)
   - symptomIcon (string)
   - symptomText (string)
   - dispositionType (string)
   - dispositionText (string)
   - previewText (string)
6. Clean up test note
```

**Feature 2 - Data persists across page reload (CRITICAL):**
```text
Steps:
1. Save a note with identifiable content through the full triage flow
2. Verify note appears in My Notes (within Settings)
3. Hard reload the page (Ctrl+Shift+R to bypass cache)
4. Open Settings → My Notes
5. Verify the saved note still appears with correct data
6. Close the browser tab completely
7. Reopen the app in a new tab
8. Verify the note still persists
9. If data is GONE → CRITICAL FAILURE (in-memory storage detected)
10. Clean up test note
```

**Feature 3 - No mock data patterns in codebase:**
```text
Steps:
1. Run: grep -r "globalThis\." --include="*.ts" --include="*.tsx" src/
2. Run: grep -r "dev-store\|devStore\|DevStore\|mock-db\|mockDb" --include="*.ts" --include="*.tsx" src/
3. Run: grep -r "mockData\|testData\|fakeData\|sampleData\|dummyData" --include="*.ts" --include="*.tsx" src/
4. Run: grep -r "TODO.*real\|TODO.*database\|TODO.*API\|STUB\|MOCK" --include="*.ts" --include="*.tsx" src/
5. Run: grep -E "json-server|miragejs|msw" package.json
6. ALL grep commands must return empty (exit code 1)
7. If any returns results → investigate and fix before passing
```

**Feature 4 - App reads/writes real localStorage:**
```text
Steps:
1. Open app with DevTools → Application → Local Storage visible
2. Save a note through the triage flow
3. Verify 'adtmc_saved_notes' key appears in localStorage panel
4. Verify the JSON data matches what's displayed in the UI
5. Delete the note via My Notes UI
6. Verify localStorage is updated (note removed from array)
7. If localStorage never changes → implementation is using in-memory store
```

---

## MANDATORY TEST CATEGORIES

The features **MUST** include tests from all applicable categories below. This is a frontend-only PWA, so categories are adapted accordingly.

### Category Distribution

| Category                         | Count |
| -------------------------------- | ----- |
| **0. Infrastructure (REQUIRED)** | 5     |
| B. Navigation Integrity          | 8     |
| C. Real Data Verification        | 6     |
| D. Workflow Completeness         | 8     |
| E. Error Handling                | 4     |
| G. State & Persistence           | 5     |
| I. Double-Action & Idempotency   | 3     |
| J. Data Cleanup & Cascade        | 3     |
| K. Default & Reset               | 3     |
| L. Search & Filter Edge Cases    | 4     |
| N. Feedback & Notification       | 3     |
| O. Responsive & Layout           | 4     |
| P. Accessibility                 | 3     |
| S. Export/Import (Barcode)       | 3     |
| **TOTAL**                        | **62** |

---

### Category Descriptions (Adapted for Frontend PWA)

**0. Infrastructure (REQUIRED - Priority 0)** - localStorage availability, schema correctness, data persistence across reload, absence of mock patterns. These features MUST pass before any functional features can begin. Exactly 5 infrastructure features (indices 0-4).

**B. Navigation Integrity** - Test category → subcategory → algorithm → disposition → write note flow, back button behavior, drawer open/close, swipe navigation between main views on mobile, desktop 3-column grid transitions.

**C. Real Data Verification** - Test note CRUD with real localStorage, data persistence across refresh, cross-tab sync via storage events, algorithm data renders correctly from static sources.

**D. Workflow Completeness** - Test end-to-end triage flow, all 4 pages of Write Note wizard, note save/edit/delete lifecycle, barcode generation and import, medication reference lookup.

**E. Error Handling** - Test localStorage full/unavailable, invalid barcode decode, camera permission denied for scanner, empty states (no saved notes).

**G. State & Persistence** - Test theme persistence, notes survive page reload, algorithm state during navigation, drawer state management, cross-tab localStorage sync.

**I. Double-Action & Idempotency** - Test double-tap on save note, rapid delete clicks, back-and-resave behavior.

**J. Data Cleanup & Cascade** - Test note deletion removes from localStorage array, UI list updates after delete, no orphaned data.

**K. Default & Reset** - Test theme defaults to system preference, algorithm resets when starting new triage, drawer starts at default height.

**L. Search & Filter Edge Cases** - Test empty search, special characters, zero results, search across all content types (categories, symptoms, medications, DDX).

**N. Feedback & Notification** - Test copy-to-clipboard confirmation, save note success feedback, delete confirmation two-tap pattern, PWA update notification.

**O. Responsive & Layout** - Test mobile stacked overlay at 375px, tablet at 768px, desktop 3-column at 1920px, safe area insets, drawer sizing, touch targets ≥44px.

**P. Accessibility** - Test tab navigation through triage flow, ARIA labels on interactive elements, color contrast for disposition colors, focus management in drawers.

**S. Export/Import (Barcode)** - Test PDF417 barcode generation, QR code generation, barcode scan/decode round-trip integrity.

---

## ABSOLUTE PROHIBITION: NO MOCK DATA

The features must include tests that **actively verify real data** and **detect mock data patterns**.

**Include these specific tests:**

1. Save a note with unique identifiable content
2. Verify that EXACT note appears in My Notes UI
3. Refresh page — note persists
4. Delete note — verify it's gone from UI AND localStorage
5. If data appears that wasn't created during test — FLAG AS MOCK DATA

**The agent implementing features MUST NOT use:**

- Hardcoded arrays of fake data for notes
- `mockData`, `fakeData`, `sampleData`, `dummyData` variables
- `// TODO: replace with real storage`
- `setTimeout` simulating storage delays with static data
- Static returns instead of localStorage queries

**Additional prohibited patterns (in-memory stores):**

- `globalThis.` (in-memory storage pattern)
- `dev-store`, `devStore`, `DevStore` (development stores)
- `json-server`, `mirage`, `msw` (mock backends)
- `Map()` or `Set()` used as primary data store
- Environment checks like `if (process.env.NODE_ENV === 'development')` for data routing

**Why this matters:** In-memory stores will pass simple tests because data persists during a single page session. But data is LOST on page reload, which is unacceptable. The Infrastructure features (0-4) specifically test for this by requiring data to survive a full page reload.

---

**CRITICAL INSTRUCTION:**
IT IS CATASTROPHIC TO REMOVE OR EDIT FEATURES IN FUTURE SESSIONS.
Features can ONLY be marked as passing (via the `feature_mark_passing` tool with the feature_id).
Never remove features, never edit descriptions, never modify testing steps.
This ensures no functionality is missed.

**ADDITIONAL CRITICAL INSTRUCTION:**
If a feature ID is already marked as completed/passing, the agent MUST skip it immediately and move to the next feature. Do NOT re-verify, re-test, or re-implement completed features. If a feature is deleted from the database, update accordingly and proceed.

### SECOND TASK: Create init.sh

Create a script called `init.sh` that future agents can use to quickly
set up and run the development environment. The script should:

1. Run `npm install` to install dependencies
2. Run `npm run dev` to start the Vite development server
3. Print the local URL where the app is accessible
4. **NOT** run git commands or deploy

Base the script on the technology stack specified in `app_spec.txt`.

### THIRD TASK: Initialize Git

Create a git repository and make your first commit with:

- init.sh (environment setup script)
- README.md (project overview and setup instructions)
- Any initial project structure files

Commit message: "Initial setup: init.sh, project structure, and features created via API"

### FOURTH TASK: Create Project Structure

Set up the basic project structure based on what's specified in `app_spec.txt`.
This typically includes directories for the React/TypeScript/Vite application
with Tailwind CSS configuration.

### ENDING THIS SESSION

Once you have completed the four tasks above:

1. Commit all work with a descriptive message
2. Verify features were created using the feature_get_stats tool
3. Leave the environment in a clean, working state
4. Exit cleanly

**IMPORTANT:** Do NOT attempt to implement any features. Your job is setup only.
Feature implementation will be handled by parallel coding agents that spawn after
you complete initialization. Starting implementation here would create a bottleneck
and defeat the purpose of the parallel architecture.
