/**
 * Database Manifest — Supabase tables and IndexedDB databases.
 *
 * For each table: which services read/write it, and what feature owns it.
 * For each IDB database: stores inside it, services that access it.
 */

export const supabaseTables = {
  profiles:              { owner: 'auth',      readers: ['authService', 'certificationService', 'supervisorService', 'feedbackService', 'activityHeartbeat', 'adminService'], writers: ['authService', 'certificationService', 'activityHeartbeat'] },
  clinics:               { owner: 'admin',     readers: ['authService', 'cryptoService', 'supervisorService', 'adminService'], writers: ['adminService'] },
  certifications:        { owner: 'settings',  readers: ['certificationService'], writers: ['certificationService'] },
  account_requests:      { owner: 'admin',     readers: ['adminService', 'accountRequestService'], writers: ['accountRequestService', 'adminService'] },
  training_completions:  { owner: 'training',  readers: ['trainingService', 'syncService'], writers: ['trainingService', 'syncService'] },
  property_items:        { owner: 'property',  readers: ['propertyService', 'syncService'], writers: ['propertyService', 'syncService'] },
  property_locations:    { owner: 'property',  readers: ['propertyService', 'syncService'], writers: ['propertyService', 'syncService'] },
  location_tags:         { owner: 'property',  readers: ['propertyService', 'syncService'], writers: ['propertyService', 'syncService'] },
  custody_ledger:        { owner: 'property',  readers: ['propertyService', 'syncService'], writers: ['propertyService', 'syncService'] },
  discrepancies:         { owner: 'property',  readers: ['propertyService', 'syncService'], writers: ['propertyService', 'syncService'] },
  signal_key_bundles:    { owner: 'messaging', readers: ['signal/signalService'], writers: ['signal/signalService', 'signal/vaultDevice', 'signal/clinicVaultDevice'] },
  signal_messages:       { owner: 'messaging', readers: ['signal/vaultDevice', 'signal/clinicVaultDevice', 'signal/supabaseTransport'], writers: ['signal/supabaseTransport'] },
  signal_backups:        { owner: 'messaging', readers: ['signal/backupService'], writers: ['signal/backupService'] },
  vault_device_keys:     { owner: 'messaging', readers: ['signal/vaultDevice', 'signal/clinicVaultDevice'], writers: ['signal/vaultDevice', 'signal/clinicVaultDevice'] },
  user_devices:          { owner: 'auth',      readers: ['signal/signalService', 'signal/deviceService', 'activityHeartbeat'], writers: ['signal/signalService', 'activityHeartbeat', 'signal/vaultDevice'] },
  message_groups:        { owner: 'messaging', readers: [], writers: [] },
  message_group_members: { owner: 'messaging', readers: [], writers: [] },
  feedback:              { owner: 'settings',  readers: ['feedbackService'], writers: ['feedbackService'] },
  push_subscriptions:    { owner: 'auth',      readers: [], writers: ['pushNotificationService'] },
  app_keys:              { owner: 'crypto',    readers: ['cryptoService'], writers: [] },
  clinic_invites:        { owner: 'admin',     readers: ['clinicAssociationService'], writers: ['clinicAssociationService'] },
  clinic_association_log: { owner: 'admin',    readers: [], writers: [] },
  sync_queue:            { owner: 'sync',      readers: [], writers: [] },
  message_rate_limits:   { owner: 'messaging', readers: [], writers: [] },
  notes:                 { owner: 'notes',     readers: [], writers: [], note: 'Legacy — encrypted clinical notes' },
} as const;

export const indexedDBDatabases = {
  'packagebackend-offline': {
    version: 6,
    objectStores: ['syncQueue', 'trainingCompletions', 'propertyItems', 'propertyLocations',
                   'propertyDiscrepancies', 'locationTags', 'mapOverlays', 'notes'],
    services: ['offlineDb', 'trainingService', 'propertyService', 'mapOverlayService',
               'syncEngine', 'syncService'],
    purpose: 'Offline-first sync queue and data cache',
  },
  'adtmc-signal-store': {
    version: 1,
    objectStores: ['localIdentity', 'preKeys', 'signedPreKeys', 'peerIdentities',
                   'sessions', 'senderKeys', 'groupSecrets'],
    services: ['signal/keyStore', 'signal/signalService', 'signal/vaultDevice',
               'signal/senderKeyStore'],
    purpose: 'Personal device Signal Protocol key material',
  },
  'adtmc-clinic-signal-store': {
    version: 1,
    objectStores: ['localIdentity', 'preKeys', 'signedPreKeys', 'peerIdentities', 'sessions'],
    services: ['signal/clinicKeyStore', 'signal/clinicVaultDevice'],
    purpose: 'Clinic device Signal Protocol key material',
  },
  'adtmc-message-store': {
    version: 1,
    objectStores: ['messages', 'conversationTombstones'],
    services: ['signal/messageStore', 'signal/supabaseTransport', 'signal/backupService',
               'signal/vaultDevice', 'calendarRouting'],
    purpose: 'Decrypted Signal messages and conversation tombstones',
  },
  'adtmc-calendar-events': {
    version: 1,
    objectStores: ['events', 'tombstones'],
    services: ['calendarEventStore', 'calendarRouting'],
    purpose: 'Calendar event cache (projection of Signal messages)',
  },
  'adtmc-lora-mesh': {
    version: 1,
    objectStores: ['witnesses', 'routes'],
    services: ['lora/loraDb', 'lora/meshRouter', 'lora/loraTransport'],
    purpose: 'LoRa mesh routing table and relay witness records',
  },
  'adtmc-backup-key': {
    version: 1,
    objectStores: ['keys'],
    services: ['signal/backupService'],
    purpose: 'Non-extractable master backup encryption key',
  },
  'packagebackend-keystore': {
    version: 1,
    objectStores: ['keys'],
    services: ['cryptoService'],
    purpose: 'Clinic AES-256-GCM encryption keys (non-extractable CryptoKeys)',
  },
  'adtmc-clinic-invites': {
    version: 1,
    objectStores: ['invites'],
    services: ['clinicInviteCache'],
    purpose: 'Cached clinic invite data',
  },
  'adtmc-clinic-users': {
    version: 1,
    objectStores: ['users'],
    services: ['clinicUsersCache'],
    purpose: 'Cached clinic member roster',
  },
  'adtmc-outbound-queue': {
    version: 1,
    objectStores: ['messages'],
    services: ['signal/outboundQueue'],
    purpose: 'Failed Signal messages awaiting retry',
  },
} as const;

export type TableName = keyof typeof supabaseTables;
export type IdbName = keyof typeof indexedDBDatabases;
