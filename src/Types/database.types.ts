export type { Json, Database, Enums } from './database.types.generated'

// Convenience aliases for typed columns that the DB stores as plain text
export type CompletionType = 'read' | 'test'
export type CompletionResult = 'GO' | 'NO_GO'
