/**
 * Signal Protocol — barrel export.
 *
 * Consumers import from './signal' for the public API.
 * Internal modules (keyStore, kdf, ratchet, x3dh) are not re-exported.
 */

// ---- Types ----

export type {
  StoredLocalIdentity,
  StoredPreKey,
  StoredSignedPreKey,
  StoredPeerIdentity,
  PublicKeyBundle,
  RatchetKeyPair,
  RatchetState,
  StoredSession,
  MessageHeader,
  EncryptedMessage,
  InitialMessage,
} from './types'

// ---- Transport Types (Phase 3) ----

export type {
  SignalKeyBundleRow,
  PeerBundleRpcResult,
  SignalMessageRow,
  DecryptedSignalMessage,
  PeerDevice,
  FanOutMessageInput,
} from './transportTypes'

// ---- Message Content (structured text / image) ----

export type {
  MessageContent,
  TextContent,
  ImageContent,
  ParsedContent,
} from './messageContent'

export {
  serializeContent,
  parseMessageContent,
} from './messageContent'

// ---- Attachment Service (encrypted image upload/download) ----

export {
  uploadEncryptedAttachment,
  downloadDecryptedAttachment,
} from './attachmentService'

export type { UploadResult } from './attachmentService'

// ---- Key Management (Phase 1) ----

export {
  // Identity
  getLocalIdentity,
  generateLocalIdentity,
  ensureLocalIdentity,
  getLocalDeviceId,

  // Pre-keys
  generatePreKeys,
  consumePreKey,
  getPreKeyCount,

  // Signed pre-keys
  generateSignedPreKey,

  // Bundle
  assemblePublicKeyBundle,

  // Peer trust
  storePeerIdentity,
  getPeerIdentity,
  markPeerVerified,

  // Key import (for incoming bundles)
  importDhPublicKey,
  importSigningPublicKey,

  // Signature verification
  verifySignature,

  // ECDH primitive
  performDh,

  // Cleanup
  clearSignalKeys,
} from './keyManager'

// ---- Session Management (Phase 2) ----

export {
  // Session lifecycle
  createOutboundSession,
  receiveInitialMessage,

  // Messaging
  encryptMessage,
  decryptMessage,

  // Session queries
  hasSession,
  deleteSession,
  clearAllSessions,
} from './session'

// ---- Transport Layer (Phase 3) ----

export {
  // Device management
  registerDevice,
  unregisterDevice,
  fetchPeerDevices,
  getDeviceLabel,

  // Key bundles
  uploadKeyBundle,
  fetchPeerBundle,
  fetchPeerBundleForDevice,

  // Messaging
  sendMessage,
  sendMessageFanOut,
  fetchUnreadMessages,
  markMessagesRead,
  fetchConversation,
} from './signalService'

export { initSignalBundle } from './signalInit'

// ---- Message Persistence (Phase 5) ----

export {
  saveMessage,
  loadConversation,
  loadAllConversations,
  loadUnreadCounts,
  updateReadAt,
  updateMessageText,
  deleteMessages,
  clearMessageStore,
} from './messageStore'
