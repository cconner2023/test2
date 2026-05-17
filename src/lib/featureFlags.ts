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
 * GUIDED_TOURS_ENABLED: When true, the Guided Tours interactive walkthrough
 * system is available. Provides auto-playing step-by-step feature tours
 * with spotlight overlays and tooltip navigation.
 */
export const GUIDED_TOURS_ENABLED = true;

/**
 * BURN_CALCULATOR_ENABLED: When true, the TBSA/Parkland burn assessment
 * calculator is available in the Knowledge Base calculators section.
 */
export const BURN_CALCULATOR_ENABLED = true;

/**
 * BLOOD_PRODUCTS_ENABLED: When true, the Blood Products quick reference
 * (MTP, DCR, transfusion protocols) is available in the Knowledge Base.
 */
export const BLOOD_PRODUCTS_ENABLED = false;
