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
  skippedKeys: Record<string, string | { key: string; ts: number }>
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
  /** Peer's identity DH public key (raw base64), used to seal outbound messages. */
  peerIdentityDhKey: string
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

// ---- Sender Keys (Group Messaging) ----

/**
 * Sender key state for group messaging — one record per (group, member, device).
 *
 * Each group member maintains their own sender key. To send a group message the
 * member encrypts once with AES-256-GCM using a key derived from this chain,
 * then publishes the single ciphertext to the group. Recipients decrypt using
 * their locally-stored copy of the sender's key (received via distribution).
 */
export interface SenderKeyState {
  /** ID of the group this key belongs to. */
  groupId: string
  /** User ID of the key owner. */
  memberId: string
  /** Device ID of the key owner. */
  deviceId: string
  /** Compound key: `${groupId}:${memberId}:${deviceId}` — used as IndexedDB key. */
  senderKeyId: string
  /** Symmetric chain key for message key derivation (base64). */
  chainKey: string
  /** Current message index in the chain — increments on every send. */
  iteration: number
  /** ECDSA P-256 signing public key exported in SPKI format (base64).
   *  Authenticates messages from this sender to all group members. */
  signingPublicKey: string
  /** ECDSA P-256 signing private key — present only for OUR own sender keys.
   *  Non-extractable; stored by structured-clone in IndexedDB. */
  signingPrivateKey?: CryptoKey
  createdAt: string
}

/**
 * Distribution message — the public portion of a SenderKeyState.
 *
 * Sent via an existing 1:1 pairwise session to share the sender's key
 * material with each group member. The recipient stores this in their
 * local senderKeys IDB store so they can decrypt future group messages.
 */
export interface SenderKeyDistribution {
  /** Wire-type discriminator. */
  type: 'sender-key-distribution'
  /** Group this distribution belongs to. */
  groupId: string
  /** User ID of the distributing member. */
  memberId: string
  /** Device ID of the distributing member. */
  deviceId: string
  /** Current chain key (base64) — allows recipient to start from this point. */
  chainKey: string
  /** Current iteration at time of distribution. */
  iteration: number
  /** ECDSA P-256 signing public key (SPKI base64) — used to verify future messages. */
  signingPublicKey: string
}

/**
 * Wire format for a sender-key encrypted group message.
 *
 * Encrypted once by the sender and fanned out to all group members
 * at the transport layer. Each recipient independently decrypts using
 * their locally-stored copy of the sender's SenderKeyState.
 */
export interface SenderKeyMessage {
  /** Group this message belongs to. */
  groupId: string
  /** Sender's user ID. */
  senderId: string
  /** Sender's device ID. */
  senderDeviceId: string
  /** Chain iteration at which this message was encrypted. */
  iteration: number
  /** AES-256-GCM ciphertext with 12-byte IV prepended (base64). */
  ciphertext: string
  /** ECDSA-SHA256 signature over (groupId + senderId + iteration + ciphertext) (base64). */
  signature: string
}
