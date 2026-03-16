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

/**
 * MAP_OVERLAY_ENABLED: When true, the MGRS Map & Tactical Overlay module
 * is available. Provides MGRS conversion, waypoint/route plotting, and
 * offline-capable map viewing for evacuation and mission planning.
 */
export const MAP_OVERLAY_ENABLED = true;

/**
 * CALENDAR_ENABLED: When true, the Calendar & Troops-to-Task scheduling
 * module is available. Provides event management, personnel slot assignment,
 * and readiness gap tracking for unit operations.
 */
export const CALENDAR_ENABLED = false;
