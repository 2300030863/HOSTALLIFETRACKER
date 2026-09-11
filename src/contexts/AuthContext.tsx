import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { syncLocalDataToCloud, clearLocalUserStorage } from '@/services/dbServices'
import type { Profile } from '@/types'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  updateProfile: (payload: Partial<Profile>) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const getRedirectUrl = (path: string = 'reset-password') => {
  const envUrl = import.meta.env.VITE_APP_URL || import.meta.env.VITE_PUBLIC_SITE_URL
  const baseUrl = envUrl ? envUrl.replace(/\/$/, '') : window.location.origin
  return `${baseUrl}/${path.replace(/^\//, '')}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const fetchProfile = useCallback(async (userId: string, currentUser?: User | null) => {
    try {
      // Non-blocking sync
      syncLocalDataToCloud(userId).catch(() => {})

      let { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!data && currentUser) {
        const newProfile = {
          id: userId,
          full_name: currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'User',
          email: currentUser?.email || '',
        }
        const { data: created } = await supabase
          .from('profiles')
          .upsert(newProfile)
          .select()
          .single()

        if (created) data = created as Profile
        else data = newProfile as Profile
      }

      setProfile(data)
    } catch {
      console.error('Failed to fetch profile')
      setProfile(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const result = await supabase.auth.getSession()
        const initialSession = result?.data?.session ?? null
        setSession(initialSession)
        setUser(initialSession?.user ?? null)

        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id, initialSession.user)
        }
      } catch {
        console.warn('Failed to get initial session (Supabase may not be configured)')
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    }

    initAuth()

    // Listen for auth changes
    let unsubscribe: (() => void) | undefined
    try {
      const result = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          setSession(newSession)
          setUser(newSession?.user ?? null)

          if (event === 'SIGNED_IN' && newSession?.user) {
            await fetchProfile(newSession.user.id, newSession.user)
          }

          if (event === 'SIGNED_OUT') {
            setProfile(null)
          }
        }
      )
      unsubscribe = result?.data?.subscription?.unsubscribe
    } catch {
      console.warn('Failed to set up auth listener')
    }

    return () => {
      unsubscribe?.()
    }
  }, [fetchProfile])

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = getRedirectUrl('reset-password')
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: redirectUrl,
        },
      })
      if (error) return { error: error.message }
      return { error: null }
    } catch {
      return { error: 'An unexpected error occurred. Please try again.' }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) return { error: error.message }
      return { error: null }
    } catch {
      return { error: 'An unexpected error occurred. Please try again.' }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    clearLocalUserStorage()
  }

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = getRedirectUrl('reset-password')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      })
      if (error) return { error: error.message }
      return { error: null }
    } catch {
      return { error: 'An unexpected error occurred. Please try again.' }
    }
  }

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return { error: error.message }
      return { error: null }
    } catch {
      return { error: 'An unexpected error occurred. Please try again.' }
    }
  }

  const updateProfile = async (payload: Partial<Profile>) => {
    try {
      if (!user) return { error: 'Not authenticated' }
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email || '', ...payload, updated_at: new Date().toISOString() })

      if (error) return { error: error.message }
      await fetchProfile(user.id, user)
      return { error: null }
    } catch {
      return { error: 'Failed to update profile' }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        initialized,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
