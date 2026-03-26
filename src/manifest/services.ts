/**
 * Service Manifest — Every lib/ service, the tables/IDB it touches,
 * and its public API surface.
 *
 * Organized by domain: core, property, calendar, signal, lora, webrtc, crypto, util.
 */

export const services = {
  // ─── Core ──────────────────────────────────────────────────────
  authService: {
    path: 'lib/authService.ts',
    tables: { reads: ['profiles', 'clinics'], writes: ['profiles'] },
    idb: [],
    exports: ['registerUser', 'signIn', 'signOut', 'recoveryPassword', 'resetPassword',
              'changePassword', 'storePasswordHash', 'verifyPasswordOffline'],
  },
  adminService: {
    path: 'lib/adminService.ts',
    tables: { reads: ['profiles', 'account_requests', 'clinics', 'user_devices'],
              writes: ['profiles', 'account_requests', 'clinics'] },
    idb: [],
    exports: ['approveAccountRequest', 'rejectAccountRequest', 'promoteToAdmin',
              'demoteFromAdmin', 'getAccountRequests', 'getAllProfiles',
              'createClinic', 'updateClinic', 'deleteClinic',
              'associateClinic', 'disassociateClinic', 'getAssociatedClinics'],
  },
  accountRequestService: {
    path: 'lib/accountRequestService.ts',
    tables: { reads: ['account_requests', 'profiles'], writes: ['account_requests'] },
    idb: [],
    exports: ['submitAccountRequest', 'checkRequestStatus', 'fetchPendingRequests',
              'approveRequest', 'rejectRequest', 'resendStatusToken',
              'submitProfileChangeRequest'],
  },
  certificationService: {
    path: 'lib/certificationService.ts',
    tables: { reads: ['certifications'], writes: ['certifications', 'profiles'] },
    idb: [],
    exports: ['fetchCertifications', 'syncPrimaryToProfile', 'createCertification',
              'updateCertification', 'deleteCertification'],
  },
  feedbackService: {
    path: 'lib/feedbackService.ts',
    tables: { reads: ['feedback', 'profiles'], writes: ['feedback'] },
    idb: [],
    exports: ['submitFeedback', 'getFeedbackList'],
  },
  supervisorService: {
    path: 'lib/supervisorService.ts',
    tables: { reads: ['clinics', 'profiles'], writes: [] },
    idb: [],
    exports: ['getSupervisorClinics', 'getClinicMembers', 'recordCompetencyTest', 'getCompetencyMatrix'],
  },
  clinicAssociationService: {
    path: 'lib/clinicAssociationService.ts',
    tables: { reads: ['clinic_invites'], writes: ['clinic_invites'] },
    idb: [],
    exports: ['generateInvite', 'redeemInvite', 'acceptInvite', 'rejectInvite',
              'revokeInvite', 'emergencyAssociate'],
  },

  // ─── Training ──────────────────────────────────────────────────
  trainingService: {
    path: 'lib/trainingService.ts',
    tables: { reads: ['training_completions'], writes: ['training_completions'] },
    idb: ['packagebackend-offline:trainingCompletions'],
    exports: ['createTrainingCompletion', 'updateTrainingCompletion',
              'fetchTrainingCompletions', 'deleteTrainingCompletion'],
  },

  // ─── Property ──────────────────────────────────────────────────
  propertyService: {
    path: 'lib/propertyService.ts',
    tables: { reads: ['property_items', 'property_locations', 'location_tags', 'custody_ledger'],
              writes: ['property_items', 'property_locations', 'location_tags', 'custody_ledger'] },
    idb: ['packagebackend-offline:propertyItems', 'packagebackend-offline:propertyLocations',
          'packagebackend-offline:propertyDiscrepancies', 'packagebackend-offline:locationTags'],
    exports: ['fetchPropertyItems', 'createPropertyItem', 'updatePropertyItem',
              'deletePropertyItem', 'fetchPropertyLocations', 'createPropertyLocation',
              'transferItem', 'recordCustodyLedger', 'fetchAllLocationTags',
              'fetchLocationTags', 'upsertLocationTags'],
  },
  tagIndex: {
    path: 'lib/tagIndex.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['buildTagIndex', 'findLCA', 'traceCompositeOutline'],
  },

  // ─── Calendar ──────────────────────────────────────────────────
  calendarEventStore: {
    path: 'lib/calendarEventStore.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-calendar-events'],
    exports: ['getDb', 'saveCalendarEvent', 'deleteCalendarEvent',
              'getAllCalendarEvents', 'saveTombstone', 'getAllTombstones', 'clear'],
  },
  calendarRouting: {
    path: 'lib/calendarRouting.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-calendar-events', 'adtmc-message-store'],
    exports: ['isCalendarEvent', 'routeCalendarEvent', 'initCalendarTombstones'],
  },
  calendarExport: {
    path: 'lib/calendarExport.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['exportCalendarToICS', 'exportCalendarToJSON'],
  },

  // ─── Map ───────────────────────────────────────────────────────
  mapOverlayService: {
    path: 'lib/mapOverlayService.ts',
    tables: { reads: [], writes: [] },
    idb: ['packagebackend-offline:mapOverlays'],
    exports: ['getOverlays', 'getOverlay', 'createOverlay', 'updateOverlay',
              'deleteOverlay', 'getLocalMapOverlays'],
  },

  // ─── Offline Sync ──────────────────────────────────────────────
  offlineDb: {
    path: 'lib/offlineDb.ts',
    tables: { reads: [], writes: [] },
    idb: ['packagebackend-offline'],
    exports: ['getDb', 'saveLocalTrainingCompletion', 'getLocalTrainingCompletions',
              'addToSyncQueue', 'getPendingSyncItems', 'saveLocalPropertyItem',
              'clearAllUserData'],
    note: 'Central IDB v6 database: syncQueue, trainingCompletions, propertyItems, propertyLocations, propertyDiscrepancies, locationTags, mapOverlays, notes (legacy)',
  },
  syncEngine: {
    path: 'lib/syncEngine.ts',
    tables: { reads: [], writes: [] },
    idb: ['packagebackend-offline'],
    exports: ['immediateSync', 'startSyncEngine', 'stopSyncEngine'],
  },
  syncService: {
    path: 'lib/syncService.ts',
    tables: { reads: [], writes: ['training_completions', 'property_items', 'property_locations',
              'location_tags', 'custody_ledger', 'discrepancies'] },
    idb: ['packagebackend-offline'],
    exports: ['processSyncQueue', 'isOnline', 'resetFailedItems', 'cleanupSyncedItems', 'retryFailedItems'],
  },

  // ─── Session / Activity ────────────────────────────────────────
  activityHeartbeat: {
    path: 'lib/activityHeartbeat.ts',
    tables: { reads: [], writes: ['profiles', 'user_devices'] },
    idb: [],
    exports: ['isActivityTrackingEnabled', 'startActivityHeartbeat', 'stopActivityHeartbeat'],
  },
  sessionCleanup: {
    path: 'lib/sessionCleanup.ts',
    tables: { reads: [], writes: ['user_devices', 'profiles'] },
    idb: [],
    exports: ['startSessionCleanupTimer', 'stopSessionCleanupTimer', 'performSessionCleanup'],
  },
  pinService: {
    path: 'lib/pinService.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['setPIN', 'verifyPIN', 'verifyPINOffline', 'clearPIN'],
  },
  biometricService: {
    path: 'lib/biometricService.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['isBiometricAvailable', 'registerBiometric', 'authenticateWithBiometric', 'enrollBiometric'],
  },
  pushNotificationService: {
    path: 'lib/pushNotificationService.ts',
    tables: { reads: [], writes: ['push_subscriptions'] },
    idb: [],
    exports: ['isPushSupported', 'subscribeToPush', 'unsubscribeFromPush'],
  },

  // ─── Crypto ────────────────────────────────────────────────────
  cryptoService: {
    path: 'lib/cryptoService.ts',
    tables: { reads: ['clinics', 'app_keys'], writes: [] },
    idb: ['packagebackend-keystore'],
    exports: ['encryptNote', 'decryptNote', 'generateClinicKeyBase64',
              'encryptWithRawKey', 'decryptWithRawKey', 'encryptClinicField',
              'decryptClinicField', 'getOrFetchClinicKey', 'prefetchClinicKeys',
              'rotateClinicKey', 'clearKeyCache'],
  },

  // ─── Signal Protocol ──────────────────────────────────────────
  'signal/signalService': {
    path: 'lib/signal/signalService.ts',
    tables: { reads: ['signal_key_bundles'], writes: ['user_devices', 'signal_key_bundles'] },
    idb: ['adtmc-signal-store', 'adtmc-message-store'],
    exports: ['registerDevice', 'uploadKeyBundle', 'fetchPeerBundles',
              'sendMessage', 'sendMessageBatch', 'deleteMessage', 'transportManager'],
  },
  'signal/vaultDevice': {
    path: 'lib/signal/vaultDevice.ts',
    tables: { reads: ['signal_messages'], writes: ['vault_device_keys', 'signal_key_bundles', 'user_devices'] },
    idb: ['adtmc-signal-store', 'adtmc-message-store'],
    exports: ['generateVaultIdentity', 'uploadVaultDevice', 'deriveAndCacheVaultKey',
              'processVaultMessages', 'ensureVaultExists', 'setVaultKeyReady', 'deleteVaultIdentity'],
  },
  'signal/clinicVaultDevice': {
    path: 'lib/signal/clinicVaultDevice.ts',
    tables: { reads: ['signal_messages'], writes: ['vault_device_keys', 'signal_key_bundles'] },
    idb: ['adtmc-clinic-signal-store', 'adtmc-message-store'],
    exports: ['generateClinicVaultIdentity', 'uploadClinicVaultDevice',
              'processClinicVaultMessages', 'ensureClinicVaultExists',
              'rotateClinicSignedPreKey', 'replenishClinicPreKeys'],
  },
  'signal/backupService': {
    path: 'lib/signal/backupService.ts',
    tables: { reads: ['signal_backups'], writes: ['signal_backups'] },
    idb: ['adtmc-backup-key', 'adtmc-message-store'],
    exports: ['deriveAndStoreBackupKey', 'createBackup', 'restoreBackup',
              'schedulePeriodicBackup', 'markHydrationComplete'],
  },
  'signal/keyStore': {
    path: 'lib/signal/keyStore.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-signal-store'],
    exports: ['loadLocalIdentity', 'storeLocalIdentity', 'generateAndStorePreKeys',
              'saveSession', 'loadSession', 'deleteSession',
              'saveSenderKey', 'loadSenderKey'],
  },
  'signal/clinicKeyStore': {
    path: 'lib/signal/clinicKeyStore.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-clinic-signal-store'],
    exports: ['loadLocalIdentity', 'storeLocalIdentity', 'generateAndStorePreKeys'],
  },
  'signal/messageStore': {
    path: 'lib/signal/messageStore.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-message-store'],
    exports: ['saveMessage', 'getMessage', 'loadAllConversations',
              'deleteMessagesByOriginId', 'saveTombstone', 'getAllTombstones', 'getTombstone'],
  },
  'signal/supabaseTransport': {
    path: 'lib/signal/supabaseTransport.ts',
    tables: { reads: ['signal_messages'], writes: ['signal_messages'] },
    idb: [],
    exports: ['SupabaseTransport'],
  },
  'signal/outboundQueue': {
    path: 'lib/signal/outboundQueue.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-outbound-queue'],
    exports: ['enqueue', 'dequeueAll', 'markSent', 'markFailed', 'getQueueLength'],
  },
  'signal/x3dh': {
    path: 'lib/signal/x3dh.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['x3dhInitiate', 'x3dhRespond', 'deriveMasterSecret'],
    note: 'Pure crypto — X3DH key agreement',
  },
  'signal/ratchet': {
    path: 'lib/signal/ratchet.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['initReceiver', 'ratchetEncrypt', 'ratchetDecrypt'],
    note: 'Pure crypto — Double Ratchet',
  },
  'signal/sealedSender': {
    path: 'lib/signal/sealedSender.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['seal', 'unseal'],
    note: 'Pure crypto — metadata protection',
  },
  'signal/deviceService': {
    path: 'lib/signal/deviceService.ts',
    tables: { reads: ['user_devices'], writes: [] },
    idb: [],
    exports: ['fetchOwnDevicesWithRole'],
  },

  // ─── LoRa Mesh ────────────────────────────────────────────────
  'lora/loraDb': {
    path: 'lib/lora/loraDb.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-lora-mesh'],
    exports: ['getDb', 'saveWitness', 'getWitness', 'deleteWitness',
              'saveRoute', 'getRoute', 'deleteRoute', 'pruneExpiredRoutes'],
  },
  'lora/loraTransport': {
    path: 'lib/lora/loraTransport.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-lora-mesh'],
    exports: ['LoRaTransport'],
  },
  'lora/meshRouter': {
    path: 'lib/lora/meshRouter.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-lora-mesh'],
    exports: ['findRoute', 'recordWitness', 'updateRouteTTL'],
  },
  'lora/bleAdapter': {
    path: 'lib/lora/bleAdapter.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['scanForDevices', 'connectToDevice', 'sendMessage', 'receiveMessage'],
  },

  // ─── WebRTC ────────────────────────────────────────────────────
  'webrtc/callSignaling': {
    path: 'lib/webrtc/callSignaling.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['initiateCall', 'answerCall', 'declineCall', 'hangupCall',
              'sendIceCandidate', 'buildChannelName'],
    note: 'Uses Supabase Realtime Broadcast, not tables',
  },
  'webrtc/webrtcService': {
    path: 'lib/webrtc/webrtcService.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['createPeerConnection', 'addLocalStream', 'addRemoteStream',
              'setMute', 'setVideoEnabled'],
  },
  'webrtc/signalingCrypto': {
    path: 'lib/webrtc/signalingCrypto.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['createSignalingCrypto', 'encryptSignaling', 'decryptSignaling'],
  },

  // ─── Caching ───────────────────────────────────────────────────
  clinicInviteCache: {
    path: 'lib/clinicInviteCache.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-clinic-invites'],
    exports: ['getDb', 'loadInviteCache', 'saveInviteToCache', 'deleteFromCache', 'clearCache'],
  },
  clinicUsersCache: {
    path: 'lib/clinicUsersCache.ts',
    tables: { reads: [], writes: [] },
    idb: ['adtmc-clinic-users'],
    exports: ['getDb', 'loadClinicUsersCache', 'saveUserToCache', 'getUsersByClinic', 'clearCache'],
  },
  cacheService: {
    path: 'lib/cacheService.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['clearServiceWorkerCaches', 'clearAllCaches'],
  },

  // ─── Utilities ─────────────────────────────────────────────────
  supabase: {
    path: 'lib/supabase.ts',
    tables: { reads: ['profiles'], writes: [] },
    idb: [],
    exports: ['supabase'],
    note: 'Singleton Supabase client instance',
  },
  'result': {
    path: 'lib/result.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['ok', 'err', 'fromSupabase', 'succeed', 'fail', 'callRpc'],
    note: 'Result<T,E> pattern for service returns',
  },
  featureFlags: {
    path: 'lib/featureFlags.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['LORA_MESH_ENABLED', 'GUIDED_TOURS_ENABLED', 'BURN_CALCULATOR_ENABLED', 'BLOOD_PRODUCTS_ENABLED'],
  },
  soundService: {
    path: 'lib/soundService.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['playNotificationSound', 'playCriticalSound', 'setSoundEnabled',
              'isMessageSoundsEnabled', 'setMessageSoundsEnabled'],
  },
  piiDetector: {
    path: 'lib/piiDetector.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['detectPII', 'sanitizePII'],
  },
  secureStorage: {
    path: 'lib/secureStorage.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['secureSet', 'secureGet', 'secureRemove', 'encryptString', 'decryptString'],
  },
  errorBus: {
    path: 'lib/errorBus.ts',
    tables: { reads: [], writes: [] },
    idb: [],
    exports: ['errorBus'],
  },
} as const;

export type ServiceId = keyof typeof services;
