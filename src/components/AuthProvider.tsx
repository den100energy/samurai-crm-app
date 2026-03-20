'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { UserRole } from '@/lib/auth'

type AuthContextType = {
  user: User | null
  role: UserRole | null
  userName: string | null
  trainerId: string | null
  permissions: string[]
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  userName: null,
  trainerId: null,
  permissions: [],
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [trainerId, setTrainerId] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('user_profiles')
      .select('role, name, trainer_id, permissions')
      .eq('id', userId)
      .single()
    if (data) {
      setRole(data.role as UserRole)
      setUserName(data.name)
      setTrainerId(data.trainer_id)
      setPermissions(data.permissions || [])
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setRole(null)
        setUserName(null)
        setTrainerId(null)
        setPermissions([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, role, userName, trainerId, permissions, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
