import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { IntakeForm } from './Components/Public/IntakeForm'
import './intake.css'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables for intake bundle')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Parse passcode from the URL hash fragment.
function parsePasscodeFromHash(): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(hash)
  return params.get('p') ?? ''
}

const initialPasscode = parsePasscodeFromHash()

const root = document.getElementById('intake-root')
if (!root) throw new Error('intake-root mount node missing')

createRoot(root).render(
  <StrictMode>
    <IntakeForm supabase={supabase} initialPasscode={initialPasscode} />
  </StrictMode>,
)
