import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const isConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'your_supabase_project_url' &&
  supabaseAnonKey !== 'your_supabase_anon_key'

if (!isConfigured) {
  console.warn(
    '⚠️ Supabase credentials not configured.\n' +
    'Please update your .env file with valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'Get these from: https://supabase.com/dashboard → Project Settings → API'
  )
}

// Create client with placeholder values when not configured (app will show setup guidance)
export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : (new Proxy({} as SupabaseClient, {
      get(_target, prop) {
        if (prop === 'auth') {
          return new Proxy({} as SupabaseClient['auth'], {
            get() {
              return async () => ({ data: { session: null, user: null, subscription: { unsubscribe: () => {} } }, error: { message: 'Supabase not configured. Please add your credentials to the .env file.' } })
            },
          })
        }
        if (prop === 'from') {
          return () => ({
            select: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'Not configured' } }) }) }),
            insert: () => ({ data: null, error: { message: 'Not configured' } }),
            update: () => ({ eq: () => ({ data: null, error: { message: 'Not configured' } }) }),
            delete: () => ({ eq: () => ({ data: null, error: { message: 'Not configured' } }) }),
          })
        }
        return () => ({})
      },
    }) as SupabaseClient)

export const isSupabaseConfigured = isConfigured
