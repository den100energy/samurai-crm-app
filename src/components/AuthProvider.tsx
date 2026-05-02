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
  assignedGroups: string[]
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  userName: null,
  trainerId: null,
  permissions: [],
  assignedGroups: [],
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [trainerId, setTrainerId] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [assignedGroups, setAssignedGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('user_profiles')
      .select('role, name, trainer_id, permissions, assigned_groups')
      .eq('id', userId)
      .single()
    if (data) {
      setRole(data.role as UserRole)
      setUserName(data.name)
      setTrainerId(data.trainer_id)
      setPermissions(data.permissions || [])
      setAssignedGroups(data.assigned_groups || [])
    }
  }

  useEffect(() => {
    let userId: string | null = null
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

    function subscribeToProfile(uid: string) {
      // Отписываемся от предыдущего канала если был
      if (realtimeChannel) supabase.removeChannel(realtimeChannel)
      realtimeChannel = supabase
        .channel(`user_profile_${uid}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${uid}`,
        }, () => {
          // Права обновились — перезагружаем профиль
          loadProfile(uid)
        })
        .subscribe()
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        userId = session.user.id
        loadProfile(userId).finally(() => setLoading(false))
        subscribeToProfile(userId)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        userId = session.user.id
        loadProfile(userId)
        subscribeToProfile(userId)
      } else {
        setRole(null)
        setUserName(null)
        setTrainerId(null)
        setPermissions([])
        setAssignedGroups([])
        if (realtimeChannel) supabase.removeChannel(realtimeChannel)
      }
    })

    return () => {
      subscription.unsubscribe()
      if (realtimeChannel) supabase.removeChannel(realtimeChannel)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, role, userName, trainerId, permissions, assignedGroups, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
