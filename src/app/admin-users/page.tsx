'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { ROLE_LABELS, UserRole } from '@/lib/auth'

type StaffUser = {
  id: string
  email: string
  role: UserRole
  name: string
  trainer_id: string | null
  created_at: string
}

type Trainer = { id: string; name: string }

export default function AdminUsersPage() {
  const { role } = useAuth()
  const [users, setUsers] = useState<StaffUser[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', role: 'admin', name: '', trainer_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [usersRes, trainersRes] = await Promise.all([
      fetch('/api/admin/users'),
      import('@/lib/supabase').then(m => m.supabase.from('trainers').select('id, name').order('name')),
    ])
    const usersData = await usersRes.json()
    setUsers(Array.isArray(usersData) ? usersData : [])
    setTrainers(trainersRes.data || [])
    setLoading(false)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setShowForm(false)
      setForm({ email: '', password: '', role: 'admin', name: '', trainer_id: '' })
      loadAll()
    }
    setSaving(false)
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Удалить сотрудника ${name}?`)) return
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadAll()
  }

  if (role !== 'founder') {
    return <div className="p-8 text-center text-gray-400">Нет доступа</div>
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Сотрудники</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="ml-auto bg-black text-white px-4 py-2 rounded-xl text-sm font-medium">
          + Добавить
        </button>
      </div>

      {showForm && (
        <form onSubmit={createUser} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Имя</label>
            <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              placeholder="Евгения Филонова"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Email</label>
            <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              placeholder="trainer@samurai.ru"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Пароль</label>
            <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
              placeholder="Минимум 6 символов"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Роль</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
              <option value="admin">Администратор</option>
              <option value="trainer">Тренер</option>
              <option value="founder">Основатель</option>
            </select>
          </div>
          {form.role === 'trainer' && trainers.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Связать с тренером</label>
              <select value={form.trainer_id} onChange={e => setForm({...form, trainer_id: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
                <option value="">— не выбрано —</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2">{error}</div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Создаю...' : 'Создать'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm">
              Отмена
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : users.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Нет сотрудников</div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800">{u.name || '—'}</div>
                <div className="text-sm text-gray-400 truncate">{u.email}</div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${
                u.role === 'founder' ? 'bg-purple-100 text-purple-700' :
                u.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                'bg-green-100 text-green-700'
              }`}>
                {ROLE_LABELS[u.role] || u.role}
              </span>
              <button onClick={() => deleteUser(u.id, u.name)}
                className="text-red-400 text-sm border border-red-100 px-2 py-1 rounded-lg hover:bg-red-50 shrink-0">
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
