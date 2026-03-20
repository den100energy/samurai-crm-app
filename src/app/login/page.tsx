'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ROLE_HOME, UserRole } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('Неверный email или пароль')
      setLoading(false)
      return
    }

    // Получаем роль
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (!profile?.role) {
      setError('Профиль не найден. Обратитесь к администратору.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    router.push(ROLE_HOME[profile.role as UserRole])
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥋</div>
          <h1 className="text-2xl font-bold text-gray-800">Школа Самурая</h1>
          <p className="text-gray-400 text-sm mt-1">Система управления</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@samurai.ru"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-gray-400 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-1.5">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none text-sm focus:border-gray-400 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
