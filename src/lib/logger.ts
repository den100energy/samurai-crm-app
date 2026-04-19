import { supabase } from './supabase'

type ErrorSource = 'client' | 'server' | 'api'

export async function logError(
  error: unknown,
  context?: Record<string, unknown>,
  source: ErrorSource = 'client'
) {
  try {
    const err = error instanceof Error ? error : new Error(String(error))
    const url = typeof window !== 'undefined' ? window.location.href : null
    let userEmail: string | null = null
    try {
      const { data } = await supabase.auth.getUser()
      userEmail = data.user?.email || null
    } catch {}

    await supabase.from('error_logs').insert({
      message: (err.message || 'Unknown error').slice(0, 2000),
      stack: err.stack ? err.stack.slice(0, 8000) : null,
      source,
      url,
      user_email: userEmail,
      context: context || null,
    })
  } catch (e) {
    console.error('[logger] Failed to log error:', e)
  }
}
