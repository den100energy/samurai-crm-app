'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type SubType = {
  id: string
  name: string
  sessions_count: number | null
  price: number | null
  description: string | null
}

const emptyForm = { name: '', sessions_count: '', price: '', description: '' }

export default function SettingsPage() {
  const [types, setTypes] = useState<SubType[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('subscription_types').select('*').order('created_at')
    setTypes(data || [])
  }

  function startEdit(t: SubType) {
    setEditId(t.id)
    setForm({
      name: t.name,
      sessions_count: t.sessions_count?.toString() || '',
      price: t.price?.toString() || '',
      description: t.description || '',
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      sessions_count: form.sessions_count ? parseInt(form.sessions_count) : null,
      price: form.price ? parseFloat(form.price) : null,
      description: form.description || null,
    }
    if (editId) {
      await supabase.from('subscription_types').update(payload).eq('id', editId)
    } else {
      await supabase.from('subscription_types').insert(payload)
    }
    cancelForm()
    setSaving(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Удалить тип абонемента?')) return
    await supabase.from('subscription_types').delete().eq('id', id)
    load()
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Настройки</h1>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-gray-800">Типы абонементов</div>
          <button
            onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(!showForm) }}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl"
          >
            + Добавить
          </button>
        </div>

        {showForm && (
          <form onSubmit={save} className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <div className="text-xs font-medium text-gray-500 mb-2">
              {editId ? 'Редактировать абонемент' : 'Новый тип абонемента'}
            </div>
            <input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Название *"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={form.sessions_count}
                onChange={e => setForm({ ...form, sessions_count: e.target.value })}
                placeholder="Кол-во занятий"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
              <input
                type="number"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                placeholder="Цена (₽)"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
            <input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Описание (необязательно)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button type="button" onClick={cancelForm}
                className="px-4 border border-gray-200 text-gray-500 py-2 rounded-xl text-sm">
                Отмена
              </button>
            </div>
          </form>
        )}

        {types.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">
            Нет типов абонементов — добавьте первый
          </div>
        ) : (
          <div className="space-y-4">
            {(['Старт', 'Комбат'] as const).map(group => {
              const items = types.filter(t => t.name.startsWith(group))
              if (items.length === 0) return null
              return (
                <div key={group}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group}</div>
                  <div className="space-y-2">
                    {items.map(t => (
                      <div key={t.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 text-sm">{t.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {t.sessions_count ? `${t.sessions_count} зан.` : 'Безлимит'}
                            {t.price ? ` · ${t.price.toLocaleString('ru-RU')} ₽` : ''}
                          </div>
                          {t.description && <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => startEdit(t)} className="text-xs text-gray-400 hover:text-gray-600">✏️</button>
                          <button onClick={() => remove(t.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {types.filter(t => !t.name.startsWith('Старт') && !t.name.startsWith('Комбат')).length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Другие</div>
                <div className="space-y-2">
                  {types.filter(t => !t.name.startsWith('Старт') && !t.name.startsWith('Комбат')).map(t => (
                    <div key={t.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 text-sm">{t.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {t.sessions_count ? `${t.sessions_count} зан.` : 'Безлимит'}
                          {t.price ? ` · ${t.price.toLocaleString('ru-RU')} ₽` : ''}
                        </div>
                        {t.description && <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => startEdit(t)} className="text-xs text-gray-400 hover:text-gray-600">✏️</button>
                        <button onClick={() => remove(t.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
