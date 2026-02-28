/**
 * Type definitions for Signal Protocol key management.
 *
 * Uses ECDH P-256 for key agreement and ECDSA P-256 for signing,
 * both via the Web Crypto API (zero external dependencies).
 *
 * Key hierarchy:
 * - Identity key pair: long-lived, one per user per device
 *   - Signing key (ECDSA P-256): signs pre-keys, proves identity
 *   - DH key (ECDH P-256): participates in X3DH key agreement
 * - Signed pre-key: medium-lived ECDH key, rotated periodically
 * - One-time pre-keys: ephemeral ECDH keys, consumed on first contact
 */

// ---- Local Key Storage ----

/** Local identity key material (our own keys, stored in IndexedDB). */
export interface StoredLocalIdentity {
  /** Unique identifier for this device. */
  deviceId: string
  /** ECDSA P-256 public key for signing pre-keys. */
  signingPublicKey: CryptoKey
  /** ECDSA P-256 private key for signing pre-keys. */
  signingPrivateKey: CryptoKey
  /** ECDH P-256 public key for X3DH key agreement. */
  dhPublicKey: CryptoKey
  /** ECDH P-256 private key for X3DH key agreement. */
  dhPrivateKey: CryptoKey
  /** Pre-exported signing public key (SPKI base64) for bundle assembly. */
  signingPublicKeyBase64: string
  /** Pre-exported DH public key (raw base64) for bundle assembly. */
  dhPublicKeyBase64: string
  /** Monotonically increasing counter for pre-key ID assignment. */
  nextPreKeyId: number
  createdAt: string
}

/** A one-time pre-key pair stored locally. */
export interface StoredPreKey {
  keyId: number
  publicKey: CryptoKey
  privateKey: CryptoKey
  /** Pre-exported public key (raw base64) for bundle assembly. */
  publicKeyBase64: string
  createdAt: string
}

/** A signed pre-key pair stored locally. */
export interface StoredSignedPreKey {
  keyId: number
  publicKey: CryptoKey
  privateKey: CryptoKey
  /** Pre-exported public key (raw base64) for bundle assembly. */
  publicKeyBase64: string
  /** ECDSA signature of the raw public key bytes, by identity signing key (base64). */
  signatureBase64: string
  createdAt: string
}

/** A peer's identity public keys stored locally for trust verification. */
export interface StoredPeerIdentity {
  userId: string
  /** Peer's device ID. */
  deviceId: string
  /** Compound key: `${userId}:${deviceId}` — used as IndexedDB key. */
  identityKey: string
  /** Peer's signing public key (SPKI base64). */
  signingPublicKeyBase64: string
  /** Peer's DH public key (raw base64). */
  dhPublicKeyBase64: string
  /** When we first saw this peer's keys. */
  firstSeen: string
  /** Whether the user has explicitly verified this peer (e.g., safety number). */
  verified: boolean
}

// ---- Server-Side (Supabase) ----

/** Public key bundle uploaded to Supabase for session initiation.
 *  Contains only public key material — no private keys ever leave the device. */
export interface PublicKeyBundle {
  userId: string
  /** Device that owns this bundle. */
  deviceId: string
  /** Identity signing public key (ECDSA P-256, SPKI base64). */
  identitySigningKey: string
  /** Identity DH public key (ECDH P-256, raw base64). */
  identityDhKey: string
  /** Current signed pre-key. */
  signedPreKey: {
    keyId: number
    publicKey: string   // raw base64
    signature: string   // ECDSA signature base64
  }
  /** Available one-time pre-keys (consumed on first contact). */
  oneTimePreKeys: Array<{
    keyId: number
    publicKey: string   // raw base64
  }>
}

// ---- Double Ratchet ----

/** DH key pair used in the ratchet (stored as CryptoKey + pre-exported base64). */
export interface RatchetKeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
  publicKeyBase64: string
}

/** Double Ratchet session state between two parties. */
export interface RatchetState {
  /** Our current ratchet DH key pair. */
  dhSending: RatchetKeyPair
  /** Peer's current ratchet DH public key (null until first receive). */
  dhReceiving: CryptoKey | null
  /** Peer's DH public key as base64 (used as skipped-key lookup prefix). */
  dhReceivingBase64: string | null
  /** Root key (32 bytes, base64). */
  rootKey: string
  /** Sending chain key (null until first DH ratchet as sender, base64). */
  sendingChainKey: string | null
  /** Receiving chain key (null until first DH ratchet as receiver, base64). */
  receivingChainKey: string | null
  /** Number of messages sent in current sending chain. */
  sendingCount: number
  /** Number of messages received in current receiving chain. */
  receivingCount: number
  /** Number of messages sent in previous sending chain (included in headers). */
  previousSendingCount: number
  /** Skipped message keys for out-of-order delivery.
   *  Key format: `${dhPublicKeyBase64}:${messageNumber}` → message key base64. */
  skippedKeys: Record<string, string>
}

/** An established session between us and a peer, persisted in IndexedDB. */
export interface StoredSession {
  peerId: string
  /** Peer's device ID for this session. */
  peerDeviceId: string
  /** Compound key: `${peerId}:${peerDeviceId}` — used as IndexedDB key. */
  sessionKey: string
  state: RatchetState
  /** Associated data for AEAD: concat(initiator identity DH pub, responder identity DH pub), base64. */
  associatedData: string
  createdAt: string
  updatedAt: string
}

// ---- Message Wire Format ----

/** Message header (sent alongside ciphertext, authenticated by AEAD). */
export interface MessageHeader {
  /** Sender's current ratchet DH public key (raw base64). */
  dh: string
  /** Number of messages sent in the previous sending chain. */
  pn: number
  /** Message number in current sending chain. */
  n: number
}

/** Encrypted message — the wire format between two parties. */
export interface EncryptedMessage {
  header: MessageHeader
  /** AES-256-GCM ciphertext with 12-byte IV prepended (base64). */
  ciphertext: string
}

/** Initial message sent to establish a new session (X3DH handshake + first message). */
export interface InitialMessage {
  /** Sender's identity signing public key (SPKI base64). */
  identitySigningKey: string
  /** Sender's identity DH public key (raw base64). */
  identityDhKey: string
  /** Sender's ephemeral key used in X3DH (raw base64). */
  ephemeralKey: string
  /** Which signed pre-key from the responder's bundle was used. */
  signedPreKeyId: number
  /** Which one-time pre-key was used (null if none available). */
  oneTimePreKeyId: number | null
  /** The first encrypted message (Double Ratchet output). */
  message: EncryptedMessage
}
