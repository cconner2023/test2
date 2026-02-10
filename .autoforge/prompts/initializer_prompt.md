# Initializer Prompt — Project Refine

You are the **Initializer Agent** for Project Refine, a medical triage decision support PWA. Your job is to create the feature set that the autonomous coding agent will work through to complete the project.

---

## PROJECT CONTEXT

Project Refine is a **98% complete** React 19 + TypeScript PWA. The remaining work is:
- Fixing broken back navigation (swipe and button)
- Consolidating gesture handling into a unified pattern (react-spring + @use-gesture/react)
- Consolidating animation libraries (remove motion and auto-animate, standardize on react-spring)
- Deduplicating hooks and utilities (shared utilities for repeated logic)
- Cleaning up code for team readability and maintainability

**CRITICAL CONSTRAINTS:**
- Do NOT change any existing UI, visual design, or user-facing behavior
- Do NOT modify data structures, database schema, or data flow
- Do NOT change application features or functionality
- Do NOT add new dependencies — consolidate to fewer libraries
- All gestures, animations, and navigation must behave identically after refactoring
- Favor computation over memoization
- Eliminate all duplicated logic
- Minimize prop drilling

---

## REQUIRED FEATURE COUNT

**CRITICAL:** You must create exactly **33** features using the `feature_create_bulk` tool.

These 33 features are organized into 7 categories. Each feature must be a discrete, testable unit of work.

---

## FEATURE CATEGORIES

### Category 1: Back Navigation Fixes (6 features)
Features 1-6 fix the broken back navigation system:
1. Fix handleBackClick missing return statement after Priority 2 (guideline clearing) in useNavigation.ts
2. Fix swipe-back viewDepth condition so gesture handler fires on Column A panels (not just Column B)
3. Unify cross-column swipe (App.tsx) and carousel swipe (ColumnA.tsx) so they communicate properly
4. Fix onSwipeBack timing in useColumnCarousel — decouple from spring onRest to prevent state/visual desync
5. Verify NavTop back button renders and fires correctly on all applicable views (mobile + desktop, drawers open/closed)
6. End-to-end test: all back navigation paths work — category→main, symptom→category, guideline→symptom, ColumnB→ColumnA, carousel panel→panel

### Category 2: Gesture Consolidation (7 features)
Features 7-13 unify all gesture handling:
7. Define and implement unified useDrag pattern across all 4 implementations (useSwipeNavigation, useColumnCarousel, BaseDrawer, Settings)
8. Consolidate all gesture config values through GestureUtils.ts constants — remove all inline thresholds
9. Refactor BaseDrawer mobile drag-to-close from manual requestAnimationFrame to react-spring useSpring
10. Refactor Settings.tsx SwipeableNoteItem swipe to unified pattern with GestureUtils constants
11. Refactor useSwipeNavigation to align with unified gesture pattern
12. Refactor useColumnCarousel drag handler to align with unified gesture pattern
13. Verify all gesture behaviors are functionally and visually identical after consolidation

### Category 3: Animation Consolidation (5 features)
Features 14-18 standardize on react-spring:
14. Remove unused motion package from package.json and verify no imports reference it
15. Replace @formkit/auto-animate in CategoryList.tsx with react-spring useTrail for list item animations
16. Replace @formkit/auto-animate in App.tsx with react-spring animation approach for content transitions
17. Remove AnimationConfig.ts utility and @formkit/auto-animate from package.json
18. Verify all animations are visually identical after migration

### Category 4: useNavigation Cleanup (4 features)
Features 19-22 clean up the navigation hook:
19. Deduplicate similar state-toggling callbacks (closeMenu, setShowNoteImport, setShowSettings, etc.) into a generic pattern
20. Move CLOSE_ALL_DRAWERS and other constants to module scope (outside the hook)
21. Clean up stateRef usage — ensure consistent and minimal use only where truly needed
22. Verify all navigation flows work identically after cleanup

### Category 5: Note Hook Deduplication (4 features)
Features 23-26 eliminate duplicated logic across note hooks:
23. Extract bitmaskToIndices to shared utility (currently duplicated in useNoteImport.ts and useNoteRestore.ts)
24. Consolidate barcode parsing (parseBarcode / parseEncodedText) into single shared utility
25. Consolidate algorithm and decision-making content formatters into shared utilities (useNoteCapture + useNoteImport have near-identical formatters)
26. Verify note capture, import, restore, and share all function identically after deduplication

### Category 6: General Hook Cleanup (4 features)
Features 27-30 apply best practices across all hooks:
27. Extract useNoteShare canvas helpers (roundRect, generateShareCanvas, canvasToBlob) to module-level or separate utility
28. Clean up useSearch.ts — move typePriority to module-level constant
29. Review and clean up useCallback/useMemo across all hooks — remove unnecessary memoization, favor computation
30. Verify no regressions across all hook functionality

### Category 7: Final Verification (3 features)
Features 31-33 confirm nothing was broken:
31. Visual verification — all screens, components, and animations look exactly the same
32. Functional verification — all features work identically (triage, algorithms, notes, search, settings, PWA)
33. Responsive verification — mobile and desktop layouts, breakpoint switching, touch/pointer interactions all preserved

---

## FEATURE DEPENDENCIES

- **Category 1 (Back Nav)** has no dependencies — start here
- **Category 2 (Gestures)** depends on Category 1 being complete (back nav fixes inform gesture unification)
- **Category 3 (Animations)** can run in parallel with Category 2
- **Category 4 (useNavigation)** depends on Categories 1 and 2 (navigation and gesture fixes must be stable first)
- **Category 5 (Note Hooks)** has no dependencies on other categories — can run in parallel
- **Category 6 (General Cleanup)** depends on Categories 2-5 being complete
- **Category 7 (Verification)** depends on ALL other categories being complete

---

## KEY FILES REFERENCE

**Navigation:**
- src/App.tsx (687 lines) — root component, grid layout, swipe handler wiring
- src/Hooks/useNavigation.ts (486 lines) — navigation state, handleBackClick, layout computation
- src/Components/NavTop.tsx (407 lines) — top bar, back button, menu morphing
- src/Components/ColumnA.tsx (121 lines) — multi-panel navigation carousel

**Gestures:**
- src/Hooks/useSwipeNavigation.ts (62 lines) — cross-column swipe-back
- src/Hooks/useColumnCarousel.ts (169 lines) — carousel panel dragging
- src/Components/BaseDrawer.tsx (287 lines) — drawer drag-to-close (rAF-based)
- src/Components/Settings.tsx (1107 lines) — SwipeableNoteItem gesture
- src/Utilities/GestureUtils.ts (111 lines) — centralized constants and helpers

**Animations:**
- src/Utilities/AnimationConfig.ts (38 lines) — auto-animate wrapper (TO REMOVE)
- src/App.css — 19 CSS keyframe animations (KEEP)

**Note Hooks (duplicated logic):**
- src/Hooks/useNoteCapture.ts (249 lines)
- src/Hooks/useNoteImport.ts (353 lines)
- src/Hooks/useNoteRestore.ts (252 lines)
- src/Hooks/useNoteShare.ts (294 lines)

**Other Hooks:**
- src/Hooks/useAlgorithm.ts (379 lines)
- src/Hooks/useSearch.ts (163 lines)
- src/Hooks/useBarcodeScanner.ts (134 lines)
- src/Hooks/useNotesStorage.ts (119 lines)
- src/Hooks/useInstallPrompt.ts (84 lines)
