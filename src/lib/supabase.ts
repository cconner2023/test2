import { createClient } from '@supabase/supabase-js'
import type { Database } from '../Types/database.types.generated'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('Supabase')

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Check Supabase database connectivity by performing a lightweight query.
 * Returns { connected: true } on success or { connected: false, error } on failure.
 */
export async function checkSupabaseConnection(): Promise<{
  connected: boolean
  error?: string
  latencyMs?: number
}> {
  const start = performance.now()
  try {
    // Use a simple health-check query. Even if the profiles table doesn't exist yet,
    // a PostgREST 404 error means the API is reachable (connection works).
    // A network/auth failure would throw a different error.
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
    const latencyMs = Math.round(performance.now() - start)

    if (error) {
      // PGRST116 = no rows, PGRST205 = table not found — both mean connection is OK
      if (error.code === 'PGRST116' || error.code === 'PGRST205') {
        logger.info(`Connection verified (${latencyMs}ms) — table may not exist yet but API is reachable`)
        return { connected: true, latencyMs }
      }
      // 42P01 = PostgreSQL "relation does not exist" — connection works
      if (error.code === '42P01') {
        logger.info(`Connection verified (${latencyMs}ms) — table not created yet but database is reachable`)
        return { connected: true, latencyMs }
      }
      logger.error('Connection check error:', error.message, `(code: ${error.code})`)
      return { connected: false, error: error.message }
    }

    logger.info(`Connection verified (${latencyMs}ms) — database responding`)
    return { connected: true, latencyMs }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error(`Connection failed (${latencyMs}ms):`, message)
    return { connected: false, error: message, latencyMs }
  }
}
