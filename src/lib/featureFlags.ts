/**
 * Feature flags for gating functionalities.
 */

/**
 * LORA_MESH_ENABLED: When true, the LoRa mesh offline messaging subsystem
 * is active. Enables BLE pairing to a LoRa radio module and mesh relay
 * of Signal Protocol messages when Supabase is unreachable.
 * Note: This controls runtime subsystem initialization, not UI visibility.
 * UI gating is handled by the access/stage system in CatData.
 */
export const LORA_MESH_ENABLED = true;

/**
 * BURN_CALCULATOR_ENABLED: When true, the TBSA/Parkland burn assessment
 * calculator is available in the Knowledge Base calculators section.
 */
export const BURN_CALCULATOR_ENABLED = true;
