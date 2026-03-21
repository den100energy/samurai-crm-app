'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { ROLE_LABELS, SECTIONS, UserRole } from '@/lib/auth'

type StaffUser = {
  id: string
  email: string
  role: UserRole
  name: string
  trainer_id: string | null
  permissions: string[]
  created_at: string
}

type Trainer = { id: string; name: string }
type Panel = 'permissions' | 'edit' | null

export default function AdminUsersPage() {
  const { role } = useAuth()
  const [users, setUsers] = useState<StaffUser[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', role: 'trainer', name: '', trainer_id: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Открытая панель на карточке: { userId -> 'permissions' | 'edit' | null }
  const [openPanel, setOpenPanel] = useState<Record<string, Panel>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  // Форма редактирования сотрудника
  const [editForm, setEditForm] = useState<Record<string, { name: string; email: string; password: string }>>({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [usersRes, trainersRes] = await Promise.all([
      fetch('/api/admin/users'),
      import('@/lib/supabase').then(m => m.supabase.from('trainers').select('id, name').order('name')),
    ])
    const usersData = await usersRes.json()
    const list: StaffUser[] = Array.isArray(usersData)
      ? usersData.map(u => ({ ...u, permissions: u.permissions || [] }))
      : []
    setUsers(list)
    setTrainers(trainersRes.data || [])
    setLoading(false)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.error) { setFormError(data.error) }
    else {
      setShowForm(false)
      setForm({ email: '', password: '', role: 'trainer', name: '', trainer_id: '' })
      loadAll()
    }
    setSaving(false)
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Удалить сотрудника "${name}"?`)) return
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadAll()
  }

  function togglePanel(userId: string, panel: Panel) {
    setOpenPanel(prev => ({ ...prev, [userId]: prev[userId] === panel ? null : panel }))
    // Инициализируем форму редактирования
    if (panel === 'edit') {
      const u = users.find(u => u.id === userId)
      if (u) setEditForm(prev => ({ ...prev, [userId]: { name: u.name || '', email: u.email || '', password: '' } }))
    }
  }

  function togglePerm(userId: string, key: string) {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const perms = u.permissions.includes(key)
        ? u.permissions.filter(p => p !== key)
        : [...u.permissions, key]
      return { ...u, permissions: perms }
    }))
  }

  // Переключить весь раздел (все подпункты)
  function toggleSection(userId: string, sectionKey: string) {
    const section = SECTIONS.find(s => s.key === sectionKey)
    if (!section) return
    const allKeys = section.items.map(i => i.key)
    const user = users.find(u => u.id === userId)
    if (!user) return
    const allChecked = allKeys.every(k => user.permissions.includes(k))
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const perms = allChecked
        ? u.permissions.filter(p => !allKeys.includes(p))
        : [...new Set([...u.permissions, ...allKeys])]
      return { ...u, permissions: perms }
    }))
  }

  async function savePerms(userId: string) {
    setSavingId(userId)
    const user = users.find(u => u.id === userId)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, permissions: user?.permissions || [], role: user?.role }),
    })
    setSavingId(null)
    setOpenPanel(prev => ({ ...prev, [userId]: null }))
    loadAll()
  }

  async function saveEdit(userId: string) {
    setSavingId(userId)
    const f = editForm[userId]
    if (!f) return
    const currentUser = users.find(u => u.id === userId)
    const body: Record<string, string> = { id: userId }
    if (f.name) body.name = f.name
    if (f.email && f.email !== currentUser?.email) body.email = f.email
    if (f.password) body.password = f.password
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setOpenPanel(prev => ({ ...prev, [userId]: null }))
    loadAll()
    setSavingId(null)
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

      {/* Форма добавления */}
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
              <option value="trainer">Тренер</option>
              <option value="admin">Администратор</option>
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
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2">{formError}</div>
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
        <div className="space-y-3">
          {users.map(u => {
            const panel = openPanel[u.id] ?? null
            const ef = editForm[u.id] ?? { name: '', email: '', password: '' }

            return (
              <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Шапка карточки */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800">{u.name || '—'}</div>
                    <div className="text-xs text-gray-400 truncate">{u.email}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${
                    u.role === 'founder' ? 'bg-purple-100 text-purple-700' :
                    u.role === 'admin'   ? 'bg-blue-100 text-blue-700' :
                                           'bg-green-100 text-green-700'
                  }`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </div>

                {/* Кнопки действий */}
                <div className="border-t border-gray-50 px-4 py-2.5 flex items-center gap-2">
                  {u.role !== 'founder' && (
                    <button onClick={() => togglePanel(u.id, 'permissions')}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        panel === 'permissions'
                          ? 'bg-black text-white border-black'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      🔒 Права
                    </button>
                  )}
                  <button onClick={() => togglePanel(u.id, 'edit')}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      panel === 'edit'
                        ? 'bg-black text-white border-black'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    ✏️ Изменить
                  </button>
                  <button onClick={() => deleteUser(u.id, u.name)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 ml-auto">
                    🗑 Удалить
                  </button>
                </div>

                {/* Панель прав */}
                {panel === 'permissions' && u.role !== 'founder' && (
                  <div className="border-t border-gray-100 px-4 py-4">
                    <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Доступ к разделам</div>
                    <div className="space-y-3">
                      {SECTIONS.map(section => {
                        const allKeys = section.items.map(i => i.key)
                        const checkedCount = allKeys.filter(k => u.permissions.includes(k)).length
                        const allChecked = checkedCount === allKeys.length
                        const someChecked = checkedCount > 0 && !allChecked

                        return (
                          <div key={section.key}>
                            {/* Заголовок раздела */}
                            <label className="flex items-center gap-2.5 cursor-pointer select-none mb-1.5"
                              onClick={() => toggleSection(u.id, section.key)}>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
                                ${allChecked ? 'bg-black border-black' : someChecked ? 'bg-gray-400 border-gray-400' : 'border-gray-300'}`}>
                                {(allChecked || someChecked) && <span className="text-white text-xs font-bold">{allChecked ? '✓' : '−'}</span>}
                              </div>
                              <span className="text-sm font-semibold text-gray-700">{section.emoji} {section.label}</span>
                            </label>

                            {/* Подпункты */}
                            <div className="pl-7 space-y-1.5">
                              {section.items.map(item => (
                                <label key={item.key} className="flex items-center gap-2.5 cursor-pointer select-none"
                                  onClick={() => togglePerm(u.id, item.key)}>
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                                    ${u.permissions.includes(item.key) ? 'bg-black border-black' : 'border-gray-300'}`}>
                                    {u.permissions.includes(item.key) && <span className="text-white text-[9px] font-bold">✓</span>}
                                  </div>
                                  <span className="text-sm text-gray-600">{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button onClick={() => savePerms(u.id)} disabled={savingId === u.id}
                        className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                        {savingId === u.id ? 'Сохраняю...' : 'Сохранить'}
                      </button>
                      <button onClick={() => setOpenPanel(prev => ({ ...prev, [u.id]: null }))}
                        className="px-4 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm">
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {/* Панель редактирования */}
                {panel === 'edit' && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Изменить данные</div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Имя</label>
                      <input value={ef.name} onChange={e => setEditForm(prev => ({ ...prev, [u.id]: { ...ef, name: e.target.value } }))}
                        placeholder={u.name}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Email</label>
                      <input type="email" value={ef.email} onChange={e => setEditForm(prev => ({ ...prev, [u.id]: { ...ef, email: e.target.value } }))}
                        placeholder={u.email}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Новый пароль <span className="text-gray-400">(оставьте пустым если не менять)</span></label>
                      <input type="password" value={ef.password} onChange={e => setEditForm(prev => ({ ...prev, [u.id]: { ...ef, password: e.target.value } }))}
                        placeholder="••••••••"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => saveEdit(u.id)} disabled={savingId === u.id}
                        className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                        {savingId === u.id ? 'Сохраняю...' : 'Сохранить'}
                      </button>
                      <button onClick={() => setOpenPanel(prev => ({ ...prev, [u.id]: null }))}
                        className="px-4 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm">
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
