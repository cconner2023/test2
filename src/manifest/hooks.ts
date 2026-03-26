/**
 * Hook Manifest — Every custom hook, what it consumes, and its purpose.
 *
 * Grouped by domain for quick scanning.
 */

export const hooks = {
  // ─── Auth & Session ────────────────────────────────────────────
  useAuth:                { path: 'Hooks/useAuth.ts',                stores: ['useAuthStore'], services: [], purpose: 'Thin auth store wrapper with shallow equality' },
  useInactivityTimer:     { path: 'Hooks/useInactivityTimer.ts',     stores: [], services: ['pinService'], purpose: 'Fire timeout after inactivity period' },
  usePinLockoutTimer:     { path: 'Hooks/usePinLockoutTimer.ts',     stores: [], services: ['pinService'], purpose: 'PIN lockout countdown timer (1s tick)' },
  useUserProfile:         { path: 'Hooks/useUserProfile.ts',         stores: ['useAuthStore'], services: ['supabase'], purpose: 'Profile get/set with fire-and-forget Supabase sync' },
  useProfileAvatar:       { path: 'Hooks/useProfileAvatar.ts',       stores: [], services: ['supabase'], purpose: 'Avatar selection, upload, cross-device sync' },

  // ─── Navigation & UI ──────────────────────────────────────────
  useNavigation:          { path: 'Hooks/useNavigation.ts',          stores: ['useNavigationStore'], services: [], purpose: 'Navigation store wrapper with back/menu helpers' },
  useNavItems:            { path: 'Hooks/useNavItems.ts',            stores: ['useNavPreferencesStore'], services: [], purpose: 'Menu customization (visibility, starring, reorder)' },
  useMenuSlide:           { path: 'Hooks/useMenuSlide.ts',           stores: ['useNavigationStore'], services: [], purpose: 'CSS-transition menu slide with drag/swipe' },
  useMessagesSlide:       { path: 'Hooks/useMessagesSlide.ts',       stores: ['useNavigationStore'], services: [], purpose: 'Messages panel slide with right-edge drag-to-open' },
  useOverlay:             { path: 'Hooks/useOverlay.ts',             stores: [], services: [], purpose: 'Mount/unmount animation + mobile drag-to-dismiss' },
  useIsMobile:            { path: 'Hooks/useIsMobile.ts',            stores: [], services: [], purpose: 'Media query: viewport ≤ 767px' },
  useIOSKeyboard:         { path: 'Hooks/useIOSKeyboard.ts',         stores: [], services: [], purpose: 'Detect iOS keyboard height via visualViewport' },
  useOnboardingReady:     { path: 'Hooks/useOnboardingReady.ts',     stores: [], services: [], purpose: 'Aggregate blocking UI signals into readiness boolean' },
  useSearch:              { path: 'Hooks/useSearch.ts',              stores: [], services: [], purpose: 'Debounced search across categories, symptoms, meds, training' },
  useColumnCarousel:      { path: 'Hooks/useColumnCarousel.ts',      stores: [], services: [], purpose: 'CSS-transition horizontal panel carousel with swipe' },

  // ─── Gestures ──────────────────────────────────────────────────
  useCanvasGesture:       { path: 'Hooks/useCanvasGesture.ts',       stores: [], services: [], purpose: 'Pan/zoom for property canvas with spring animations' },
  useLongPress:           { path: 'Hooks/useLongPress.ts',           stores: [], services: [], purpose: 'Touch long-press detector (500ms, 10px threshold)' },
  useLongPressDrag:       { path: 'Hooks/useLongPressDrag.ts',       stores: [], services: [], purpose: 'Long-press → drag for calendar events' },
  useSwipeBack:           { path: 'Hooks/useSwipeBack.ts',           stores: [], services: [], purpose: 'Left-edge swipe-back detector' },
  useSwipeGesture:        { path: 'Hooks/useSwipeGesture.ts',        stores: [], services: [], purpose: 'Row-level swipe with long-press for action rows' },
  useSwipeNavigation:     { path: 'Hooks/useSwipeNavigation.ts',     stores: [], services: [], purpose: 'Cross-column swipe-right back + right-edge messages drag' },
  usePageSwipe:           { path: 'Hooks/usePageSwipe.ts',           stores: [], services: [], purpose: 'Horizontal page-swipe for mobile wizard/carousel' },

  // ─── Signal Protocol Messaging ─────────────────────────────────
  useMessages:            { path: 'Hooks/useMessages.ts',            stores: ['useMessagingStore', 'useAuthStore'], services: ['signal/signalService', 'signal/session', 'signal/groupService', 'signal/keyManager'], purpose: 'Send/delete orchestration, device fan-out, group ops' },
  useSignalMessages:      { path: 'Hooks/useSignalMessages.ts',      stores: ['useMessagingStore'], services: ['signal/signalService', 'signal/session', 'signal/clinicSession', 'signal/backupService'], purpose: 'Realtime Signal subscription, offline catch-up, decryption' },
  useMessageNotifications: { path: 'Hooks/useMessageNotifications.ts', stores: [], services: ['soundService'], purpose: 'Single-slot notification for incoming messages' },
  useChatInteractions:    { path: 'Hooks/useChatInteractions.ts',    stores: [], services: [], purpose: 'Shared chat state (context menu, edit, forward, reply, delete)' },
  usePeerAvailability:    { path: 'Hooks/usePeerAvailability.ts',    stores: [], services: ['supabase'], purpose: 'Check peer messageable status (devices + keys)' },
  usePushNotifications:   { path: 'Hooks/usePushNotifications.ts',   stores: ['useNavigationStore'], services: ['pushNotificationService'], purpose: 'FCM push subscription + foreground toast' },

  // ─── Calendar ──────────────────────────────────────────────────
  useCalendarSync:        { path: 'Hooks/useCalendarSync.ts',        stores: ['useCalendarStore'], services: ['calendarEventStore', 'calendarRouting'], purpose: 'Hydrate calendar events from IDB with tombstone cleanup' },
  useCalendarVault:       { path: 'Hooks/useCalendarVault.ts',       stores: ['useAuthStore', 'useMessagingStore'], services: ['signal/signalService', 'signal/clinicSession'], purpose: 'Send/delete calendar events via Signal fan-out' },

  // ─── Training ──────────────────────────────────────────────────
  useTrainingCompletions: { path: 'Hooks/useTrainingCompletions.ts', stores: ['useAuthStore'], services: ['trainingService', 'offlineDb', 'syncService'], purpose: 'Training CRUD, offline-first IDB, Supabase sync' },
  useRealtimeTrainingCompletions: { path: 'Hooks/useRealtimeTrainingCompletions.ts', stores: [], services: ['trainingService'], purpose: 'Realtime subscription for training INSERT/UPDATE/DELETE' },

  // ─── Certifications ────────────────────────────────────────────
  useCertifications:      { path: 'Hooks/useCertifications.ts',      stores: ['useAuthStore'], services: ['certificationService'], purpose: 'Certification CRUD, primary cert sync' },

  // ─── Clinic ────────────────────────────────────────────────────
  useClinicMedics:        { path: 'Hooks/useClinicMedics.ts',        stores: ['useAuthStore'], services: ['supabase', 'clinicUsersCache'], purpose: 'Fetch medics from same + associated clinics' },
  useClinicGroupedMedics: { path: 'Hooks/useClinicGroupedMedics.ts', stores: ['useAuthStore'], services: [], purpose: 'Group medics into own-clinic and nearby buckets' },
  useClinicInvites:       { path: 'Hooks/useClinicInvites.ts',       stores: [], services: ['clinicAssociationService', 'clinicInviteCache'], purpose: 'Clinic invites with auto-generation and expiry' },
  useClinicNameResolver:  { path: 'Hooks/useClinicNameResolver.ts',  stores: [], services: ['supabase'], purpose: 'Resolve clinic name from ID with module-level cache' },

  // ─── Calls ─────────────────────────────────────────────────────
  useCall:                { path: 'Hooks/useCall.ts',                stores: ['useCallStore', 'useAuthStore'], services: ['webrtc/webrtcService', 'webrtc/callSignaling'], purpose: 'WebRTC call orchestration (audio & video)' },

  // ─── LoRa ──────────────────────────────────────────────────────
  useLoRaStatus:          { path: 'Hooks/useLoRaStatus.ts',          stores: [], services: ['signal/signalService', 'lora/types'], purpose: 'Reactive LoRa mesh connection state and stats polling' },

  // ─── Notes & Export ────────────────────────────────────────────
  useAlgorithm:           { path: 'Hooks/useAlgorithm.ts',           stores: [], services: [], purpose: 'Medical decision tree state machine (card, selections, undo)' },
  useNoteCapture:         { path: 'Hooks/useNoteCapture.ts',         stores: [], services: ['Utilities/NoteFormatter'], purpose: 'Generate structured notes from algorithm state' },
  useNoteEditor:          { path: 'Hooks/useNoteEditor.ts',          stores: ['useAuthStore'], services: [], purpose: 'Note editing: pages, swipe, PII warnings, export' },
  useNoteImport:          { path: 'Hooks/useNoteImport.ts',          stores: [], services: ['Utilities/NoteCodec', 'Utilities/TC3Formatter'], purpose: 'Decode barcodes, reconstruct algorithm state + notes' },
  useNoteShare:           { path: 'Hooks/useNoteShare.ts',           stores: [], services: ['Utilities/NoteCodec'], purpose: 'Generate Data Matrix barcode, Web Share API / clipboard' },
  useBarcodeScanner:      { path: 'Hooks/useBarcodeScanner.ts',      stores: [], services: [], purpose: 'Camera barcode scanning via ZXing' },
  usePdfExport:           { path: 'Hooks/usePdfExport.ts',           stores: [], services: [], purpose: 'Generic PDF export hook factory with status tracking' },
  useDA2062Export:        { path: 'Hooks/useDA2062Export.ts',        stores: [], services: ['Utilities/DA2062Export'], purpose: 'DA Form 2062 PDF generation' },
  useDD689Export:         { path: 'Hooks/useDD689Export.ts',         stores: [], services: ['Utilities/DD689Export'], purpose: 'DD Form 689 PDF generation' },
  useSF600Export:         { path: 'Hooks/useSF600Export.ts',         stores: [], services: ['Utilities/SF600Export'], purpose: 'SF600 PDF generation' },

  // ─── Templates ─────────────────────────────────────────────────
  useTemplateSession:     { path: 'Hooks/useTemplateSession.ts',     stores: [], services: [], purpose: 'Template session state (step/choice progression, branching)' },
  useTextExpander:        { path: 'Hooks/useTextExpander.ts',        stores: [], services: [], purpose: 'Fuzzy abbreviation matching for text expansion' },

  // ─── Tour ──────────────────────────────────────────────────────
  useTour:                { path: 'Hooks/useTour.ts',                stores: ['useAuthStore'], services: [], purpose: 'Guided onboarding tour orchestration with role gating' },

  // ─── PWA / Platform ────────────────────────────────────────────
  useServiceWorker:       { path: 'Hooks/useServiceWorker.ts',       stores: [], services: [], purpose: 'SW registration, periodic updates, skip-waiting' },
  useInstallPrompt:       { path: 'Hooks/useInstallPrompt.ts',       stores: [], services: [], purpose: 'PWA install prompt with iOS detection' },
  usePageVisibility:      { path: 'Hooks/usePageVisibility.ts',      stores: [], services: [], purpose: 'Track page visibility via document.visibilityState' },
  useGeolocation:         { path: 'Hooks/useGeolocation.ts',         stores: [], services: [], purpose: 'Browser geolocation with MGRS grid conversion' },
  useImagePaste:          { path: 'Hooks/useImagePaste.ts',          stores: [], services: [], purpose: 'Clipboard paste listener for image files' },
  useVoiceRecorder:       { path: 'Hooks/useVoiceRecorder.ts',       stores: [], services: ['Utilities/voiceUtils'], purpose: 'Audio recording with amplitude tracking (max 120s)' },

  // ─── Realtime / Subscriptions ──────────────────────────────────
  useSupabaseSubscription: { path: 'Hooks/useSupabaseSubscription.ts', stores: [], services: ['supabase'], purpose: 'Shared Realtime channel lifecycle with visibility pause' },

  // ─── Misc ──────────────────────────────────────────────────────
  useMinLoadTime:         { path: 'Hooks/useMinLoadTime.ts',         stores: [], services: [], purpose: 'Keep loading state for min 500ms to prevent flash' },
} as const;

export type HookId = keyof typeof hooks;
