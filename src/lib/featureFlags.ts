/**
 * Feature flags for gating functionalities.
 */

/**
 * PROPERTY_MANAGEMENT_ENABLED: When true, the Property Book equipment
 * management module is available in the Settings panel. Tracks accountable
 * equipment, custody transfers, and generates DA Form 2062 hand receipts.
 */
export const PROPERTY_MANAGEMENT_ENABLED = true;

/**
 * LORA_MESH_ENABLED: When true, the LoRa mesh offline messaging subsystem
 * is active. Enables BLE pairing to a LoRa radio module and mesh relay
 * of Signal Protocol messages when Supabase is unreachable.
 */
export const LORA_MESH_ENABLED = true;
