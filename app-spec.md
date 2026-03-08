# ADTMC (Advanced Defense and Tactical Medical Care) - Application Specification

**Version:** 2.6.3
**Platform:** React 19 / TypeScript 5.9 / Vite 7 Progressive Web App
**Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions + Storage)
**State Management:** Zustand 5
**Styling:** Tailwind CSS 4
**Review Date:** 2026-03-08

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Architecture & Composition](#2-architecture--composition)
3. [Feature Inventory](#3-feature-inventory)
4. [Security Assessment](#4-security-assessment)
5. [Infrastructure & PWA](#5-infrastructure--pwa)
6. [Performance Assessment](#6-performance-assessment)
7. [Accessibility Assessment](#7-accessibility-assessment)
8. [Test Coverage](#8-test-coverage)
9. [Self-Rating & Issues](#9-self-rating--issues)
10. [Roadmap to 10/10](#10-roadmap-to-1010)

---

## 1. Application Overview

ADTMC is a military medical reference and clinical documentation PWA designed for field medics and combat casualty care providers. It operates offline-first, features end-to-end encrypted messaging via a custom Signal Protocol implementation, and supports tactical workflows including TC3 (Tactical Combat Casualty Care) card documentation, aid bag inventory tracking, and property management with chain-of-custody.

### Key Capabilities

- Symptom-based clinical algorithm navigation with screening tools (GAD-7, PHQ-2, MACE2)
- Multi-step medical note writing with template engine and text expansion
- DD Form 1380 (TC3 Card) digital documentation with injury mapping
- End-to-end encrypted messaging (Signal Protocol: X3DH + Double Ratchet + Sealed Sender)
- WebRTC encrypted voice/video calling
- LoRa mesh networking for comms-denied environments
- Aid bag inventory with expiry/low-stock alerts and photo layouts
- Property management with custody transfer and hand-receipt generation
- Training task tracking with supervisor evaluation workflows
- Offline-first with IndexedDB sync queue and Supabase reconciliation
- Barcode encoding/decoding with AES-256-GCM encryption
- Push notifications, biometric auth, PIN security

---

## 2. Architecture & Composition

### 2.1 Entry Points

| File | Purpose |
|------|---------|
| `src/main.tsx` | React 19 createRoot, Supabase connection check, splash screen, SW cleanup |
| `src/App.tsx` | Root component: context providers, drawer orchestration, navigation, responsive layout |
| `src/sw.ts` | Workbox service worker: precaching, runtime caching, push notifications, background sync |
| `vite.config.ts` | Build config: PWA InjectManifest, Tailwind plugin, version injection, React Compiler |

### 2.2 State Management (5 Zustand Stores)

| Store | Lines | Responsibility |
|-------|-------|---------------|
| `useAuthStore` | ~419 | Auth state, profile hydration (sync localStorage + async secureStorage), session cleanup, device roles, Signal init |
| `useNavigationStore` | ~340 | View state, category/symptom/guideline selection, drawer management, CLOSE_ALL_DRAWERS pattern, search expansion |
| `useTC3Store` | ~538 | DD Form 1380 card state: casualty info, injuries, MARCH treatments, vitals, medications, evacuation. Auto body-region from coordinates |
| `usePropertyStore` | ~60 | Property UI: item selection, location breadcrumb, holder filter |
| `useCallStore` | ~86 | Voice/video call lifecycle: ringing → connecting → connected → ended with auto-reset |

### 2.3 Context Providers

| Provider | Purpose |
|----------|---------|
| `ThemeProvider` | Light/dark theme with system preference detection + localStorage persistence |
| `AvatarProvider` | Avatar selection state |
| `MessagesProvider` | Encrypted messaging context (mounted once to survive drawer toggles) |
| `CallProvider` | WebRTC call orchestration (mounted once at app level) |

### 2.4 Component Architecture (~100 Components)

```
src/Components/
├── AlgorithmPage.tsx          # Clinical decision engine with card stack
├── CategoryList.tsx           # 3-tier symptom hierarchy navigation
├── ColumnA.tsx                # Left column carousel (categories/algorithm/search)
├── WriteNotePage.tsx          # 5-step note wizard (HPI, vitals, PE, plan, export)
├── PhysicalExam.tsx           # Physical exam documentation (~900 lines)
├── QuestionCard.tsx           # Algorithm question renderer (~450 lines)
├── SearchResults.tsx          # Categorized search results display
├── BaseDrawer.tsx             # Animated drawer/modal base component
├── SwipeableCard.tsx          # Gesture-enabled card with spring physics
├── TC3/                       # Tactical Combat Casualty Care
│   ├── TC3MobileWizard.tsx    # 8-step mobile wizard
│   ├── TC3DesktopLayout.tsx   # Multi-panel desktop view
│   ├── CasualtyInfoForm.tsx   # Patient demographics
│   ├── MechanismForm.tsx      # Mechanism of injury
│   ├── InjuryMarker.tsx       # Body diagram injury placement
│   ├── MARCHForm.tsx          # MARCH protocol assessment
│   ├── VitalsForm.tsx         # Vital signs capture
│   ├── MedicationsForm.tsx    # Medication administration
│   ├── FluidsPanel.tsx        # IV fluid tracking
│   └── EvacuationForm.tsx     # Evacuation request
├── AidBag/                    # Aid bag inventory
│   ├── AidBagPanel.tsx        # Main inventory view with stats
│   ├── AidBagItemRow.tsx      # Item row with expiry/stock alerts
│   ├── AidBagItemForm.tsx     # Item CRUD form with barcode scan
│   ├── AidBagCategoryGroup.tsx# Category-grouped items
│   ├── BagLayoutPhoto.tsx     # Photo-based bag layout
│   └── BagLayoutEditor.tsx    # Layout position editor
├── Property/                  # Property management
│   ├── HandReceiptView.tsx    # Generated hand-receipt document
│   ├── CustodyTransferForm.tsx# Chain-of-custody transfer
│   ├── DiscrepancyList.tsx    # Discrepancy tracking
│   └── PropertyCSVImport.tsx  # CSV import with validation
├── Settings/                  # Settings panels (~20 components)
│   ├── MainSettingsPanel.tsx  # Settings navigation hub
│   ├── LoginPanel.tsx         # Auth with Supabase
│   ├── MessagesPanel.tsx      # E2E encrypted messaging UI
│   ├── AdminPanel.tsx         # Admin functions
│   ├── SupervisorPanel.tsx    # Supervisor evaluation hub
│   ├── TemplateBuilder.tsx    # Note template CRUD
│   ├── TextExpanderManager.tsx# Abbreviation management
│   ├── TrainingPanel.tsx      # Training task management
│   ├── LoRaPanel.tsx          # LoRa mesh configuration
│   └── Supervisor/            # Supervisor sub-components
│       ├── PersonnelRoster.tsx# Subordinate management
│       ├── EvaluateFlow.tsx   # Multi-step evaluation wizard
│       ├── SoldierProfile.tsx # Individual profile view
│       └── SoldierCertsEditor.tsx # Certification management
└── [UI primitives]            # LoadingSpinner, TextButton, ConnectorDots, etc.
```

### 2.5 Custom Hooks (25)

| Hook | Purpose |
|------|---------|
| `useSwipeNavigation` | Cross-column swipe-back via @use-gesture/react |
| `useSwipeBack` | Vanilla touch edge-swipe detector |
| `usePageSwipe` | Page carousel gesture navigation |
| `useSearch` | Debounced fuzzy search across medical data (~500 entries) |
| `useTrainingCompletions` | Offline-first training CRUD with realtime sync |
| `useRealtimeTrainingCompletions` | Supabase Realtime subscription for training |
| `useSupabaseSubscription` | Generic Realtime subscription with page-visibility gating |
| `usePushNotifications` | Push subscription state management |
| `useServiceWorker` | PWA update detection with version checking |
| `useTemplateSession` | Template engine state machine with queue-based node advancement |
| `useTextExpander` | Abbreviation expansion with fuzzy matching |
| `useBarcodeScanner` | ZXing camera management with auto-cleanup |
| `useImagePaste` | Clipboard image paste detection |
| `useNoteShare` | Web Share API + clipboard fallback for note export |
| `useProfileAvatar` | Avatar persistence + realtime cross-device sync |
| `useUserProfile` | Auth store wrapper for profile operations |
| `useCertifications` | Certification CRUD with profile sync |
| `useProperty` | Property CRUD with offline-first sync |
| `useInstallPrompt` | PWA install prompt with iOS detection + cooldown |
| `usePageVisibility` | Page Visibility API subscription |
| `useIsMobile` | matchMedia responsive breakpoint detection |
| `useInactivityTimer` | Multi-event inactivity detection with throttling |
| `usePinLockoutTimer` | PIN brute-force lockout countdown |
| `useLoRaStatus` | LoRa mesh connection state + stats polling |
| `useMessageNotifications` | Single-slot message toast with auto-dismiss |

### 2.6 Service Layer

| Service | Purpose |
|---------|---------|
| `lib/supabase.ts` | Client init with PWA vs browser auth persistence |
| `lib/syncService.ts` (~655 lines) | Offline-first sync engine: queue processing, exponential backoff, last-write-wins conflict resolution, reconciliation |
| `lib/syncEngine.ts` | Lightweight immediate sync wrapper |
| `lib/cryptoUtils.ts` | PBKDF2 (100k iterations), constant-time comparison, AES helpers |
| `lib/secureStorage.ts` | AES-256-GCM encrypted IndexedDB with non-extractable CryptoKey |
| `lib/pinService.ts` | PIN hash/verify, lockout management, inactivity timeout |
| `lib/biometricService.ts` | WebAuthn credential management |
| `lib/piiDetector.ts` | SSN/phone/email/DOB/MRN regex detection |
| `lib/trainingService.ts` | Training completion CRUD with IDB + sync queue |
| `lib/certificationService.ts` | Certification CRUD with profile sync |
| `lib/feedbackService.ts` | User feedback submission |
| `lib/soundService.ts` | Web Audio API synthesized tones |
| `lib/notifyDispatcher.ts` | Push notification dispatch via edge function |
| `lib/activityHeartbeat.ts` | 5-minute activity pings with 90-day deactivation |
| `lib/sessionCleanup.ts` | Tab-close detection via sessionStorage pairing |
| `lib/cacheService.ts` | SW cache cleanup on signout |
| `lib/result.ts` | Result<T,E> discriminated union + callRpc wrapper |
| `lib/errorBus.ts` | Observer-pattern error aggregation (100-event buffer) |
| `lib/errorCodes.ts` | PostgreSQL/PostgREST error classification |

### 2.7 Signal Protocol Implementation

| Module | Purpose |
|--------|---------|
| `lib/signal/x3dh.ts` | Extended Triple Diffie-Hellman key agreement |
| `lib/signal/ratchet.ts` | Double Ratchet with AES-256-GCM AEAD |
| `lib/signal/sealedSender.ts` | ECIES sealed sender with certificate binding |
| `lib/signal/session.ts` | Session state management |
| `lib/signal/groupService.ts` | Group messaging with Sender Keys |
| `lib/signal/groupNameCrypto.ts` | Encrypted group name storage |
| `lib/signal/deviceService.ts` | Multi-device key distribution |
| `lib/signal/signalInit.ts` | Protocol initialization orchestrator |
| `lib/signal/swFlush.ts` | SW-compatible outbound queue flush (pure IDB + fetch) |
| `lib/signal/kdf.ts` | HKDF-SHA256 key derivation (RFC 5869) |
| `lib/signal/types.ts` | Protocol type definitions |

### 2.8 Additional Infrastructure

| Module | Purpose |
|--------|---------|
| `lib/lora/bleAdapter.ts` | Web Bluetooth LoRa adapter |
| `lib/lora/wireFormat.ts` | LoRa frame encode/decode |
| `lib/lora/meshRouter.ts` | Hop-limited mesh routing with witness dedup |
| `lib/lora/adapterFactory.ts` | Transport adapter factory |
| `lib/webrtc/signalingCrypto.ts` | Ephemeral ECDH + HKDF + AES-256-GCM for signaling |
| `lib/webrtc/webrtcService.ts` | Peer connection lifecycle with STUN |
| `Utilities/barcodeCodec.ts` | Binary packing → deflate → AES-256-GCM → base64 for Data Matrix |
| `Utilities/peCodec.ts` | Physical exam compact encoding v2/v3 with 2-bit status packing |
| `Utilities/templateEngine.ts` | Template node lookup and branch resolution |
| `Utilities/PropertyCSV.ts` | RFC 4180 CSV import/export with validation |

### 2.9 Data Layer

| File | Content |
|------|---------|
| `Data/Algorithms.ts` | Clinical decision algorithms with branching logic |
| `Data/MedData.ts` | Medication reference database |
| `Data/PhysicalExamData.ts` | PE categories, items, chip options per body system |
| `Data/TrainingData.ts` | Training modules with steps and audio aids |
| `Data/TrainingTaskList.ts` | Training task definitions |
| `Data/TrainingConstants.tsx` | Training UI constants and callout components |
| `Data/CatData.ts` | Category/symptom/guideline hierarchy |
| `Data/TemplateTypes.ts` | Template node type definitions |
| `Data/Release.ts` | Release notes history |
| `Data/ProfileAvatars.tsx` | Avatar selection options |

### 2.10 Dependencies

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| react | 19.2.0 | UI framework | Current |
| typescript | ~5.9.3 | Type system | Current |
| zustand | 5.0.11 | State management | Current |
| @supabase/supabase-js | 2.95.3 | Backend client | Current |
| tailwindcss | 4.1.18 | Styling | Current |
| vite | 7.2.4 | Build tool | Current |
| @react-spring/web | 10.0.3 | Spring animations | Current |
| @use-gesture/react | 10.3.1 | Gesture handling | Current |
| @zxing/library | 0.21.3 | Barcode scanning | Stable |
| bwip-js | 4.8.0 | Barcode generation | Stable |
| pako | 2.1.0 | Deflate compression | Stable |
| pdf-lib | 1.17.1 | PDF generation | Stable |
| idb | 8.0.3 | IndexedDB wrapper | Current |
| lucide-react | 0.562.0 | Icons | Current |
| qr-scanner | 1.4.2 | QR scanning | Stable |
| vite-plugin-pwa | 1.2.0 | PWA generation | Current |
| babel-plugin-react-compiler | 1.0.0 | React Compiler | Current |

---

## 3. Feature Inventory

### 3.1 Medical Reference System — Grade: B+

Symptom-based clinical algorithm navigation with 6 question types (RF, initial, choice, count, action, screener), disposition routing, integrated screening tools (GAD-7, PHQ-2, MACE2), medication reference, and training material links. Algorithm state managed via card stack with animated transitions.

**Gaps:** No undo/reset on disposition, no offline algorithm updates, keyboard navigation limited.

### 3.2 TC3 Tactical Casualty Care — Grade: B

8-step mobile wizard and multi-panel desktop layout for DD Form 1380 documentation. Captures: casualty demographics, mechanism of injury, injuries with body diagram marking, MARCH protocol assessment, vital signs with GCS/AVPU, medication administration, IV fluid tracking, and evacuation request.

**Gaps:** No validation before step progression, no draft auto-save, no intervention documentation.

### 3.3 Note Writing System — Grade: A-

5-step wizard: HPI (with template engine + text expanders), vital signs, physical exam (structured v2/v3 encoding), treatment plan (with algorithm integration), and export (multiple formats including barcode). PII detection blocks notes containing SSN/phone/email/DOB/MRN.

**Gaps:** No draft auto-save (data lost on navigation), no pre-export validation.

### 3.4 Training & Certification — Grade: C+

Step-by-step training tasks with audio playback aids, completion tracking with offline-first sync, certification management with expiry tracking, and supervisor evaluation workflow.

**Gaps:** No competency assessment, no knowledge quiz, no performance scoring.

### 3.5 AidBag Inventory — Grade: B

Item tracking with expiry alerts (expired/expiring soon), low-stock alerts, category filtering, photo-based bag layouts with position editor, summary statistics, and multi-select batch operations.

**Gaps:** No reorder automation, no checkout tracking, no inventory audit trail.

### 3.6 Property Management — Grade: B+

Asset tracking with location hierarchy, custody transfer with chain-of-custody forms, hand-receipt PDF generation, condition tracking, CSV import/export (RFC 4180), and discrepancy tracking.

**Gaps:** No barcode generation for property items, component needs refactoring (~600 lines).

### 3.7 End-to-End Encrypted Messaging — Grade: B-

Signal Protocol messaging (X3DH + Double Ratchet + Sealed Sender), group messaging with Sender Keys, encrypted group names, contact list, message context menu, notification toasts. Sealed Sender prevents metadata leakage with certificate-bound sender identity.

**Gaps:** File sharing incomplete, message search missing, call integration minimal.

### 3.8 Voice/Video Calling — Grade: C+

WebRTC peer connections with STUN, ephemeral ECDH signaling encryption (HKDF + AES-256-GCM), audio/video mode support.

**Gaps:** No DTLS-SRTP enforcement, no call verification (ZRTP/SAS), no max call duration.

### 3.9 LoRa Mesh Networking — Grade: B+

Web Bluetooth LoRa adapter, binary wire format, hop-limited mesh routing with witness dedup, route caching, payload segmentation, confirmation tracking. Feature-flag gated.

**Gaps:** No reconnection backoff on failure, stats polling could drain battery.

### 3.10 Settings & Configuration — Grade: B+

User profile management, avatar selection with realtime sync, note content configuration, text expander management, template builder, certification tracking, security (password/PIN/biometric), notification preferences, LoRa configuration, release notes, privacy policy, feedback submission.

**Gaps:** No settings search, no import/export settings.

### 3.11 Supervisor Capabilities — Grade: B

Personnel roster, multi-step evaluation wizard with structured feedback, certification issuance with expiry tracking, individual soldier profile view with cert history.

**Gaps:** No competency matrix, no team reporting, no performance trends, no evidence attachment.

### 3.12 Template & Text Expander — Grade: B+

Queue-based template state machine with branching logic, abbreviation expansion with fuzzy matching, real-time inline suggestions with keyboard navigation, user-customizable via settings, database persistence.

**Gaps:** No shared template library, no template versioning, no usage analytics.

### 3.13 Search — Grade: B

Debounced fuzzy search across medical reference data (~500 entries indexed on mount), categorized results with breadcrumb navigation, loading states.

**Gaps:** No filters/facets, no search history, no typo correction.

---

## 4. Security Assessment

### 4.1 Cryptography — Grade: A-

| Primitive | Implementation | Quality |
|-----------|---------------|---------|
| X3DH Key Agreement | ECDH P-256, signed pre-keys, ephemeral keys | Excellent |
| Double Ratchet | DH ratchet + symmetric ratchet, AES-256-GCM AEAD | Excellent |
| Sealed Sender | ECIES ephemeral ECDH, cert-bound with 24h expiry | Excellent |
| Key Derivation | HKDF-SHA256 (RFC 5869) with domain separation | Excellent |
| Password Hashing | PBKDF2-SHA256, 100k iterations, 16-byte salt | Good |
| Secure Storage | AES-256-GCM, random 12-byte IVs, non-extractable CryptoKey | Good |
| Barcode Encryption | AES-256-GCM with binary packing + deflate | Good |
| Signaling Encryption | Ephemeral P-256 ECDH + HKDF + AES-256-GCM | Good |
| Constant-Time Compare | XOR-based comparison for PIN verification | Good |
| Skipped Key TTL | 7-day expiry with MAX_TOTAL_SKIPPED=1024 | Good |

### 4.2 Vulnerabilities

| ID | Severity | Component | Description |
|----|----------|-----------|-------------|
| SEC-01 | **CRITICAL** | pinService.ts | Lockout timer stored in plaintext localStorage; attacker can clear to bypass brute-force protection |
| SEC-02 | **CRITICAL** | signal/keyStore | Signal Protocol private keys stored in plaintext IndexedDB; physical access compromises all conversations |
| SEC-03 | **HIGH** | biometricService.ts | WebAuthn credentials stored in plaintext localStorage; can be swapped without detection |
| SEC-04 | **HIGH** | pinService.ts | No server-side rate limiting on PIN verification; client-side lockout easily bypassed via DevTools |
| SEC-05 | **HIGH** | pinService.ts | PIN hash and salt cached in module-level variables; no memory clearing on session timeout |
| SEC-06 | **MEDIUM** | (app-wide) | No Content Security Policy headers; XSS has no mitigation |
| SEC-07 | **MEDIUM** | piiDetector.ts | PII detection client-only; direct API calls bypass all detection |
| SEC-08 | **MEDIUM** | pinService.ts | Inactivity timeout stored in plaintext localStorage; user can set to 0 (infinite) |
| SEC-09 | **MEDIUM** | webrtcService.ts | No mandatory DTLS-SRTP; media could transmit unencrypted if negotiation fails |
| SEC-10 | **MEDIUM** | signal/x3dh.ts | No pre-key bundle freshness verification; replay of old bundles possible |
| SEC-11 | **MEDIUM** | biometricService.ts | Only checks UV bit; no attestation statement or authenticator signature validation |
| SEC-12 | **LOW** | cryptoUtils.ts | PBKDF2 at 100k iterations; OWASP 2026 recommends 600k+ |
| SEC-13 | **LOW** | sessionCleanup.ts | Access tokens in memory; XSS could exfiltrate |

### 4.3 Authentication Flow

1. **Supabase Auth** — Email/password login with JWT tokens
2. **PIN Lock** — PBKDF2-hashed PIN with 3-strike lockout (15m cooldown → permanent lock)
3. **Biometric** — WebAuthn passkey with UV verification
4. **Inactivity Timeout** — Multi-event detection (mousemove, keydown, touchstart, scroll, pointerdown) with 1/sec throttle
5. **Session Cleanup** — sessionStorage + localStorage pairing detects tab close vs refresh; calls Supabase signOut
6. **Activity Heartbeat** — 5-minute activity pings; 90-day inactivity triggers account deactivation
7. **Device Roles** — Primary vs Linked device distinction; primary controls Signal key distribution

### 4.4 Data Protection Summary

| Data | Storage | Encrypted | Risk |
|------|---------|-----------|------|
| Messages | IDB via Signal Protocol | Yes (E2E) | Low |
| PIN Hash/Salt | secureStorage (AES-256-GCM IDB) | Yes | Low |
| Signal Private Keys | IndexedDB | **No** | **Critical** |
| Biometric Credential | localStorage | **No** | **High** |
| Lockout Timer | localStorage | **No** | **Critical** |
| Inactivity Timeout | localStorage | **No** | **Medium** |
| AES Master Key | IDB (CryptoKey, non-extractable) | N/A | Medium (SW risk) |
| Supabase Token | sessionStorage (browser) / IDB (SW) | Partial | Low |
| Barcode Data | Data Matrix | Yes (AES-256-GCM) | Low |

---

## 5. Infrastructure & PWA

### 5.1 Service Worker — Grade: A-

- Workbox precaching with `cleanupOutdatedCaches()`
- Runtime caching: StaleWhileRevalidate (fonts CSS), CacheFirst (fonts/storage/videos), NetworkFirst (Supabase API, 10s timeout)
- SPA navigation fallback with denylist for auth/API routes
- Push notification handling (conditional: only shows if app not visible)
- Background sync for Signal outbound message queue
- Skip-waiting + QUEUE_UPDATED message handling

**Issues:** Navigation path hardcoded to `/test2/`, no offline fallback page, no cache size management (maxBytes), push payload not validated.

### 5.2 Offline-First Sync — Grade: A-

- All writes go to IndexedDB first, queued for sync
- Whitelist-based table validation (ALLOWED_SYNC_TABLES)
- FIFO batch processing (20 items/batch)
- Exponential backoff with jitter on failure
- Last-write-wins conflict resolution (server timestamp comparison)
- Bi-directional reconciliation (pull + push)
- Periodic connectivity check (30s) with automatic retry on reconnect
- Realtime subscriptions for cross-device updates (page-visibility gated)

**Issues:** Race condition in periodic check (syncInProgress not atomic), no transaction support (partial batch failures not rolled back), silent failures in reconcile hide data loss, no jitter in periodic check (thundering herd risk).

### 5.3 LoRa Mesh — Grade: B+

Binary wire format with hop-limited forwarding, witness dedup to prevent loops, route caching, payload segmentation for large messages, confirmation tracking. Web Bluetooth BLE adapter. Feature-flag gated.

**Issues:** No reconnection backoff, stats polling every 10s could drain battery.

### 5.4 WebRTC — Grade: B

Peer connection lifecycle with Google STUN servers. Ephemeral ECDH signaling encryption. Audio/video mode support with mute/camera-off controls.

**Issues:** No DTLS-SRTP enforcement, no call verification, no connection timeout, ICE candidates expose IP addresses.

### 5.5 Error Handling — Grade: C+

- ErrorBoundary wraps major components with retry button
- Result<T,E> discriminated union for service functions
- ErrorBus observer pattern with 100-event circular buffer
- Logger with environment-aware filtering (prod: warn+error only)
- ErrorHandler centralized logging with context

**Issues:** No error reporting service (Sentry/DataDog), many `.catch(() => {})` chains suppress errors silently, no network error recovery strategy, missing timeouts on async operations, Logger has no timestamps.

---

## 6. Performance Assessment — Grade: C+

### 6.1 Strengths

- React Compiler babel plugin for automatic optimization
- Workbox precaching for instant asset loading
- Page-visibility gating prevents background battery drain
- Some lazy loading (swFlush dynamic import, offlineDb)
- Search index built once via useMemo
- Spring physics for native-feel animations

### 6.2 Issues

| Issue | Impact | Files |
|-------|--------|-------|
| QuestionCard not memoized (~450 lines) | Rerenders on every parent state change | QuestionCard.tsx |
| ExamItemRow not memoized (30+ instances) | 30+ unnecessary rerenders per exam | PhysicalExam.tsx |
| PhysicalExam too large (~900 lines) | Cannot code-split; hard to optimize | PhysicalExam.tsx |
| PropertyPanel too large (~600 lines) | Same concerns | PropertyPanel.tsx |
| No list virtualization | Large lists cause scroll lag | Multiple components |
| Search index built eagerly on mount | Delays initial render | useSearch.ts |
| No code splitting for routes/data | Full bundle loaded upfront | App.tsx |
| ZXing library loaded eagerly | ~200KB+ added to bundle | useBarcodeScanner.ts |
| Fire-and-forget async patterns | No error recovery, no timeout | Multiple services |
| Inconsistent debouncing | Network hammering on rapid input | Multiple hooks |
| Missing network timeouts | App hangs indefinitely on poor connection | All Supabase calls |

---

## 7. Accessibility Assessment — Grade: C+

### 7.1 Strengths

- Semantic HTML usage
- Touch targets 10-12mm (WCAG compliant)
- Responsive design with mobile-first approach
- Keyboard support in most places
- prefers-reduced-motion could be leveraged

### 7.2 Critical Gaps

| Issue | WCAG Criterion | Impact |
|-------|---------------|--------|
| No aria-labels on interactive elements | 4.1.2 Name, Role, Value | Screen readers can't identify buttons |
| No focus trap in modals/drawers | 2.4.3 Focus Order | Users tab outside modal |
| No aria-live regions | 4.1.3 Status Messages | State changes not announced |
| Form validation not ARIA-marked | 3.3.1 Error Identification | Errors not accessible |
| Color-only status indicators (BMI) | 1.4.1 Use of Color | Color-blind users can't distinguish |
| No skip-to-content link | 2.4.1 Bypass Blocks | Keyboard users must tab through everything |
| Swipe-only navigation paths | 2.1.1 Keyboard | Users unable to perform gestures excluded |

---

## 8. Test Coverage

### 8.1 Existing Tests

| Test File | Coverage | Quality |
|-----------|----------|---------|
| `lib/lora/__tests__/wireFormat.test.ts` | Frame encode/decode, compression | A |
| `lib/lora/__tests__/loraTransport.test.ts` | Message transport, originId, fields | A |
| `lib/signal/__tests__/e2e.test.ts` (~703 lines) | Message routing, backup encryption, logout cleanup | A |
| `lib/__tests__/result.test.ts` | Result type helpers | A |
| `Utilities/__tests__/noteCodec.test.ts` | Note encoding round-trip | A |

### 8.2 Critical Test Gaps

- No hook tests (useTrainingCompletions, useProperty, useTemplateSession)
- No component tests (QuestionCard, PhysicalExam, WriteNotePage)
- No integration tests (offline → online sync transitions)
- No race condition tests (concurrent sync, auth state changes)
- No accessibility tests (automated a11y)
- No visual regression tests
- No performance regression tests
- No WebRTC calling flow tests
- No push notification subscription tests
- No gesture detection tests

---

## 9. Self-Rating & Issues

### Overall Rating: 6.5 / 10

### Rating Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Feature Completeness | 8.0 | 20% | 1.60 |
| Architecture & Code Quality | 7.5 | 15% | 1.13 |
| Cryptography & E2E Encryption | 9.0 | 15% | 1.35 |
| Application Security | 4.5 | 15% | 0.68 |
| Performance | 5.5 | 10% | 0.55 |
| Accessibility | 4.0 | 10% | 0.40 |
| Test Coverage | 3.5 | 10% | 0.35 |
| Infrastructure & PWA | 7.5 | 5% | 0.38 |
| **Total** | | **100%** | **6.43** |

### Why 6.5/10

**What elevates it (strong foundations):**
- World-class Signal Protocol implementation (X3DH + Double Ratchet + Sealed Sender) that rivals production messaging apps
- Comprehensive offline-first architecture with IndexedDB sync queue and bi-directional reconciliation
- Feature-rich domain coverage: clinical algorithms, TC3, note writing, aid bag, property, messaging, training
- Modern tech stack (React 19, TypeScript 5.9, Vite 7, Tailwind 4) with React Compiler
- Thoughtful PWA implementation with background sync and smart push notifications
- LoRa mesh networking for comms-denied environments is genuinely innovative
- Clean Zustand store architecture with clear separation of concerns

**What holds it back (production blockers):**
- **Security:** Critical vulnerabilities in PIN lockout (plaintext localStorage), Signal private keys (unencrypted IDB), biometric credentials (plaintext localStorage). These are unacceptable for a medical/DoD application handling sensitive data
- **Accessibility:** No ARIA labels, no focus traps, no aria-live regions means the app fails WCAG 2.1 AA compliance — a legal requirement for government/healthcare applications
- **Test Coverage:** Only 5 test files covering infrastructure; zero component tests, zero hook tests, zero integration tests. Critical paths (sync, auth, medical algorithms) are completely untested
- **Performance:** Missing memoization on high-frequency components (QuestionCard, ExamItemRow), no list virtualization, no code splitting, missing network timeouts that cause hangs on poor connections
- **Error Handling:** Pervasive `.catch(() => {})` pattern suppresses errors silently; no error reporting service; missing timeouts on all async operations

---

## 10. Roadmap to 10/10

### Tier 1: Critical Security Fixes (Rating impact: +1.5)

1. **Encrypt Signal private keys in IndexedDB** — Wrap keyStore operations with secureStorage encryption. Private keys must never exist in plaintext on disk.
2. **Move lockout timer to secureStorage** — Replace `localStorage.setItem(lockoutUntil)` with encrypted IDB storage to prevent brute-force bypass.
3. **Move biometric credentials to secureStorage** — Replace plaintext localStorage with encrypted storage + integrity verification.
4. **Add server-side PIN rate limiting** — Implement Supabase edge function with max 3 attempts/minute per user, independent of client.
5. **Implement Content Security Policy** — Add CSP headers restricting to `'self'`, block inline scripts, provide XSS defense-in-depth.
6. **Add server-side PII detection** — Second line of defense via Supabase edge function to catch direct API bypass.
7. **Clear PIN hash/salt from memory on session timeout** — Null out module-level `_pinHash` and `_pinSalt` in logout flow.
8. **Encrypt inactivity timeout in secureStorage** — Prevent users from disabling timeout via DevTools.

### Tier 2: Accessibility Compliance (Rating impact: +1.0)

9. **Add aria-labels to all interactive elements** — Buttons, links, form controls throughout the app.
10. **Implement focus trap in BaseDrawer** — Use focus-trap library or manual trap to contain keyboard navigation in modals/drawers.
11. **Add aria-live regions** — Status containers for algorithm results, validation messages, sync status, toast notifications.
12. **Mark form validation errors with ARIA** — `aria-invalid`, `aria-describedby` linking errors to fields.
13. **Add skip-to-content link** — First focusable element bypasses navigation.
14. **Provide button alternatives for swipe gestures** — Back buttons, navigation arrows for users who cannot swipe.
15. **Add color-independent status indicators** — Text labels alongside color for BMI, alerts, dispositions.

### Tier 3: Test Coverage (Rating impact: +0.8)

16. **Component tests for QuestionCard, PhysicalExam, WriteNotePage** — Verify rendering, user interaction, state transitions.
17. **Hook tests for useTrainingCompletions** — Cover race conditions, offline/online transitions, auth state changes.
18. **Hook tests for useTemplateSession** — Verify recursive queue advancement, depth limits, branch resolution.
19. **Integration tests for sync flow** — Offline write → come online → sync → verify server state → verify realtime propagation.
20. **Integration tests for auth flow** — Login → profile hydration → PIN setup → inactivity timeout → re-auth.
21. **Accessibility tests** — Automated a11y testing with axe-core or jest-axe on all major components.
22. **Medical algorithm path tests** — Verify all decision branches produce correct dispositions.
23. **PE codec round-trip tests** — Malformed input, v2/v3 compatibility, null handling.

### Tier 4: Performance Optimization (Rating impact: +0.5)

24. **Add React.memo to QuestionCard and ExamItemRow** — Prevent unnecessary rerenders on parent state changes.
25. **Split PhysicalExam into 3 components** — PhysicalExamParser.ts (logic), VitalSignsPanel.tsx (UI), ExamItemRow.tsx (memoized row).
26. **Add Promise.race timeout to all Supabase operations** — 10s timeout prevents indefinite hangs.
27. **Implement list virtualization** — Use react-window or @tanstack/virtual for long lists (training, property, aid bag).
28. **Lazy-load search index** — Build searchIndex after 500ms delay to unblock initial render.
29. **Code-split data files** — Lazy-load Algorithms.ts, MedData.ts, TrainingData.ts per route.
30. **Lazy-load ZXing** — Dynamic import on first barcode scan request.

### Tier 5: Error Handling & Observability (Rating impact: +0.3)

31. **Integrate Sentry for error reporting** — Capture unhandled exceptions, component errors, and network failures in production.
32. **Replace `.catch(() => {})` with proper error handling** — Every catch block should log context and either retry or surface to user.
33. **Add network timeout wrappers** — Utility function wrapping Promise.race for all async operations.
34. **Add structured logging** — Timestamps, request IDs, user context in all log entries.
35. **Add sync metrics** — Track sync queue depth, reconciliation conflicts, failure rates.

### Tier 6: Feature Polish (Rating impact: +0.4)

36. **Draft auto-save for WriteNotePage and TC3** — Save to IndexedDB on every field change; restore on mount.
37. **Pre-export validation for notes** — Require at least HPI + exam before allowing export.
38. **TC3 step validation** — Require minimum fields before wizard progression.
39. **Message search** — Full-text search across decrypted message history.
40. **WebRTC call verification** — Implement SAS (Short Authentication String) display for call participants.
41. **Undo/reset on algorithm disposition** — Allow users to go back and change their mind.
42. **Deep linking** — React Router integration for shareable algorithm/note/training URLs.
43. **Settings search** — Filter settings panels by keyword.

### Tier 7: Architecture Hardening (Rating impact: +0.2)

44. **Signal key rotation on logout/login** — Regenerate device keys to limit compromise window.
45. **Add branded types for IDs** — `type UserId = string & { readonly __brand: "UserId" }` to prevent ID mixing.
46. **Atomic sync operations** — Transaction support for batch sync to prevent partial application.
47. **Add pre-key bundle freshness verification** — Signed timestamps on X3DH bundles to prevent replay.
48. **WebAuthn attestation validation** — Verify authenticator data signature, not just UV bit.
49. **Semver comparison for SW updates** — Replace string comparison with proper semver library.
50. **Derive SW navigation path from vite config** — Remove hardcoded `/test2/` path.

---

### Implementation Priority Matrix

| Fix | Effort | Impact | Priority |
|-----|--------|--------|----------|
| Encrypt Signal private keys | Medium | Critical | **P0** |
| Move lockout timer to secureStorage | Low | Critical | **P0** |
| Add CSP headers | Low | High | **P0** |
| Add aria-labels | Medium | High | **P0** |
| Focus trap in drawers | Low | High | **P0** |
| Network timeouts | Low | High | **P1** |
| React.memo QuestionCard/ExamItemRow | Low | Medium | **P1** |
| Component tests | High | High | **P1** |
| Draft auto-save | Medium | Medium | **P2** |
| Sentry integration | Low | Medium | **P2** |
| List virtualization | Medium | Medium | **P2** |
| Code splitting | Medium | Medium | **P3** |
| Deep linking | High | Medium | **P3** |
| Signal key rotation | Medium | Low | **P3** |

---

*Generated by comprehensive 4-agent parallel codebase review analyzing 100+ source files across architecture, security, features, and infrastructure.*
