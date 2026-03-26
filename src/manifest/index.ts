/**
 * Application Manifest — Machine-readable architecture map.
 *
 * Import this module to explore the full dependency graph:
 *   features → stores → services → tables → IDB
 *
 * Intended for AI assistants, architecture audits, and onboarding.
 * Not imported at runtime — tree-shaken unless explicitly used.
 */

export { features, type FeatureId } from './features';
export { stores, type StoreId } from './stores';
export { services, type ServiceId } from './services';
export { hooks, type HookId } from './hooks';
export {
  supabaseTables, indexedDBDatabases,
  type TableName, type IdbName,
} from './tables';
