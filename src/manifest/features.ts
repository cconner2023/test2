/**
 * Feature Manifest — Machine-readable map of every feature in the app.
 *
 * Each entry describes one user-facing feature: what store it owns,
 * which services and tables it touches, where the components live,
 * and how it's activated (drawer, route, overlay, etc.).
 *
 * Intended audience: AI assistants, onboarding docs, dependency audits.
 */

export const features = {
  admin: {
    label: 'Admin Panel',
    store: 'useInvalidationStore',
    services: ['adminService', 'certificationService', 'accountRequestService'],
    tables: ['profiles', 'account_requests', 'clinics', 'user_devices', 'certifications'],
    idb: [],
    components: 'Components/Admin/',
    drawer: { id: 'showAdminDrawer', wrapper: 'AdminDrawer.tsx' },
  },

  burnDiagram: {
    label: 'Burn TBSA Calculator',
    store: null,
    services: [],
    tables: [],
    idb: [],
    components: 'Components/BurnDiagram/',
    drawer: null, // embedded component, toggled by feature flag BURN_CALCULATOR_ENABLED
    featureFlag: 'BURN_CALCULATOR_ENABLED',
  },

  calendar: {
    label: 'Calendar / Scheduling',
    store: 'useCalendarStore',
    services: ['calendarEventStore', 'calendarRouting', 'calendarExport'],
    tables: [], // calendar events are Signal messages, not a dedicated table
    idb: ['adtmc-calendar-events'],
    components: 'Components/Calendar/',
    drawer: { id: 'showCalendarDrawer', wrapper: 'CalendarDrawer.tsx' },
    hooks: ['useCalendarSync', 'useCalendarVault'],
  },

  mapOverlay: {
    label: 'Tactical Map Overlay',
    store: null,
    services: ['mapOverlayService', 'supervisorService'],
    tables: [], // map_overlays synced via offline queue
    idb: ['packagebackend-offline:mapOverlays'],
    components: 'Components/MapOverlay/',
    drawer: { id: 'showMapOverlayDrawer', wrapper: 'MapOverlayPanel.tsx' },
  },

  property: {
    label: 'Equipment Inventory',
    store: 'usePropertyStore',
    services: ['propertyService', 'tagIndex', 'syncService'],
    tables: ['property_items', 'property_locations', 'location_tags', 'custody_ledger', 'discrepancies'],
    idb: ['packagebackend-offline:propertyItems', 'packagebackend-offline:propertyLocations',
          'packagebackend-offline:propertyDiscrepancies', 'packagebackend-offline:locationTags'],
    components: 'Components/Property/',
    drawer: { id: 'showPropertyDrawer', wrapper: 'PropertyDrawer.tsx' },
  },

  provider: {
    label: 'Provider Notes',
    store: null,
    services: ['piiDetector'],
    tables: [],
    idb: [],
    components: 'Components/Provider/',
    drawer: { id: 'showProviderDrawer', wrapper: 'ProviderDrawer.tsx' },
  },

  settings: {
    label: 'Settings & Profile',
    store: null, // touches many stores but owns none
    services: [
      'supabase', 'authService', 'accountRequestService', 'certificationService',
      'trainingService', 'feedbackService', 'soundService', 'pinService',
      'offlineDb', 'cacheService', 'featureFlags',
      'signal/signalService', 'signal/deviceService', 'signal/keyManager',
      'signal/backupService', 'signal/groupTypes', 'signal/transportTypes',
    ],
    tables: ['profiles', 'certifications', 'training_completions', 'feedback',
             'signal_key_bundles', 'user_devices'],
    idb: [],
    components: 'Components/Settings/',
    drawer: { id: 'showSettings', wrapper: 'Settings.tsx' },
  },

  supervisor: {
    label: 'Supervisor Dashboard',
    store: null,
    services: ['supervisorService', 'trainingService'],
    tables: ['profiles', 'clinics', 'training_completions'],
    idb: [],
    components: 'Components/Settings/Supervisor/',
    drawer: { id: 'showSupervisorDrawer', wrapper: 'SupervisorDrawer.tsx' },
  },

  tc3: {
    label: 'Trauma Casualty Card (DD1380)',
    store: 'useTC3Store',
    services: [], // pure form state; export handled by writeNote
    tables: [],
    idb: [],
    components: 'Components/TC3/',
    drawer: null, // dedicated layout modes: TC3DesktopLayout, TC3MobileWizard
    activation: 'layout', // not a drawer — has own desktop + mobile layout
  },

  tour: {
    label: 'Guided Onboarding',
    store: null,
    services: ['featureFlags'],
    tables: [],
    idb: [],
    components: 'Components/Tour/',
    drawer: null, // overlay system
    featureFlag: 'GUIDED_TOURS_ENABLED',
  },

  messaging: {
    label: 'E2EE Messaging (Signal Protocol)',
    store: 'useMessagingStore',
    services: [
      'signal/signalService', 'signal/session', 'signal/clinicSession',
      'signal/groupService', 'signal/keyManager', 'signal/messageStore',
      'signal/backupService', 'signal/vaultDevice', 'signal/clinicVaultDevice',
      'signal/senderKeyStore', 'signal/supabaseTransport', 'signal/outboundQueue',
    ],
    tables: ['signal_key_bundles', 'signal_messages', 'signal_backups',
             'vault_device_keys', 'user_devices', 'message_groups',
             'message_group_members'],
    idb: ['adtmc-signal-store', 'adtmc-clinic-signal-store', 'adtmc-message-store',
          'adtmc-backup-key', 'adtmc-outbound-queue'],
    components: 'Components/Settings/MessagesPanel.tsx', // + MessagesDrawer.tsx (loose)
    drawer: { id: 'showMessagesDrawer', wrapper: 'MessagesDrawer.tsx' },
    hooks: ['useMessages', 'useSignalMessages', 'useMessageNotifications'],
  },

  knowledgeBase: {
    label: 'Knowledge Base & Reference',
    store: 'useNavPreferencesStore',
    services: ['featureFlags'],
    tables: [],
    idb: [],
    components: 'Components/KnowledgeBaseDrawer.tsx',
    drawer: { id: 'showKnowledgeBase', wrapper: 'KnowledgeBaseDrawer.tsx' },
  },

  training: {
    label: 'Training & Completions',
    store: null,
    services: ['trainingService', 'offlineDb', 'syncService'],
    tables: ['training_completions'],
    idb: ['packagebackend-offline:trainingCompletions'],
    components: 'Components/TrainingDrawer.tsx',
    drawer: { id: 'showTrainingDrawer', wrapper: 'TrainingDrawer.tsx' },
    hooks: ['useTrainingCompletions', 'useRealtimeTrainingCompletions'],
  },

  noteImport: {
    label: 'Barcode Note Import',
    store: null,
    services: ['Utilities/NoteCodec'],
    tables: [],
    idb: [],
    components: 'Components/ImportResultPopover.tsx',
    drawer: null,
  },

  writeNote: {
    label: 'Note Writer & Export',
    store: null,
    services: ['Utilities/NoteFormatter', 'Utilities/NoteCodec'],
    tables: [],
    idb: [],
    components: 'Components/WriteNotePage.tsx',
    drawer: null, // toggled via isWriteNoteVisible in navigation store
    activation: 'navStore:isWriteNoteVisible',
  },

  symptomInfo: {
    label: 'Symptom Guidelines',
    store: null,
    services: [],
    tables: [],
    idb: [],
    components: 'Components/SymptomInfoDrawer.tsx',
    drawer: { id: 'showSymptomInfo', wrapper: 'SymptomInfoDrawer.tsx' },
  },

  calls: {
    label: 'Voice & Video Calls (WebRTC)',
    store: 'useCallStore',
    services: ['webrtc/webrtcService', 'webrtc/callSignaling', 'webrtc/signalingCrypto'],
    tables: [], // signaling via Supabase Realtime Broadcast, no tables
    idb: [],
    components: 'Components/Settings/CallOverlay.tsx',
    drawer: null, // overlay
    hooks: ['useCall'],
  },

  loraMesh: {
    label: 'LoRa Mesh Networking',
    store: null,
    services: ['lora/loraTransport', 'lora/meshRouter', 'lora/loraDb',
               'lora/bleAdapter', 'lora/wireFormat'],
    tables: [],
    idb: ['adtmc-lora-mesh'],
    components: 'Components/Settings/LoRaPanel.tsx',
    drawer: { id: 'showLoRaDrawer', wrapper: 'LoRaPanel.tsx' },
    featureFlag: 'LORA_MESH_ENABLED',
    hooks: ['useLoRaStatus'],
  },

  auth: {
    label: 'Authentication & Session',
    store: 'useAuthStore',
    services: [
      'authService', 'pinService', 'biometricService', 'secureStorage',
      'activityHeartbeat', 'sessionCleanup', 'pushNotificationService',
    ],
    tables: ['profiles', 'clinics', 'user_devices'],
    idb: [],
    components: null, // state-only, UI in Settings
    drawer: null,
    hooks: ['useAuth', 'useInactivityTimer'],
  },

  offlineSync: {
    label: 'Offline-First Sync Engine',
    store: null,
    services: ['offlineDb', 'syncEngine', 'syncService'],
    tables: ['training_completions', 'property_items', 'property_locations',
             'location_tags', 'custody_ledger', 'discrepancies',
             'feature_votes', 'feature_vote_suggestions'],
    idb: ['packagebackend-offline:syncQueue'],
    components: null, // background service
    drawer: null,
  },

  featureVoting: {
    label: 'Feature Voting',
    store: 'useFeatureVotesStore',
    services: ['featureVotingService', 'offlineDb', 'syncService'],
    tables: ['feature_vote_cycles', 'feature_vote_candidates', 'feature_votes', 'feature_vote_suggestions'],
    idb: ['packagebackend-offline:featureVoteCycles',
          'packagebackend-offline:featureVoteCandidates',
          'packagebackend-offline:featureVotes',
          'packagebackend-offline:featureVoteSuggestions'],
    components: 'Components/FeatureVoting/, Components/Settings/FeatureVotesPanel.tsx, Components/Admin/AdminFeatureVotesSection.tsx',
    drawer: null, // embedded in Settings + Admin + login toast
  },
} as const;

export type FeatureId = keyof typeof features;
