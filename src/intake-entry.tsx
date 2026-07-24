import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { IntakeForm } from './Components/Public/IntakeForm'
import { OutsideInviteView } from './Components/Public/OutsideInviteView'
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

// Parse passcode from the URL hash fragment (inbound QR: `#p=<passcode>`).
function parsePasscodeFromHash(): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(hash)
  return params.get('p') ?? ''
}

// Outbound outside-entity invite (medic-emailed link): the raw token rides in the
// query (`?i=<token>`) and the fragment_secret in the hash (`#k=<fragment>`). The
// fragment stays client-side — it never reaches the server on this open.
function parseInvite(): { token: string; fragment: string } | null {
  if (typeof window === 'undefined') return null
  const token = new URLSearchParams(window.location.search).get('i')
  if (!token) return null
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('k') ?? ''
  return { token, fragment }
}

const root = document.getElementById('intake-root')
if (!root) throw new Error('intake-root mount node missing')

const invite = parseInvite()

createRoot(root).render(
  <StrictMode>
    {invite ? (
      <OutsideInviteView supabase={supabase} token={invite.token} fragment={invite.fragment} />
    ) : (
      <IntakeForm supabase={supabase} initialPasscode={parsePasscodeFromHash()} />
    )}
  </StrictMode>,
)
