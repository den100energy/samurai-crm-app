'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const GROUPS = ['Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']

export default function NewStudentPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', phone: '', birth_date: '', group_name: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('students').insert({
      name: form.name.trim(),
      phone: form.phone || null,
      birth_date: form.birth_date || null,
      group_name: form.group_name || null,
    })
    router.push('/students')
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/students" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Новый ученик</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Имя и фамилия *</label>
          <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400"
            placeholder="Иван Иванов" />
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Телефон</label>
          <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400"
            placeholder="+7 999 000 00 00" type="tel" />
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Дата рождения</label>
          <input value={form.birth_date} onChange={e => setForm({...form, birth_date: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400"
            type="date" />
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Группа</label>
          <select value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 bg-white">
            <option value="">Выберите группу</option>
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <button type="submit" disabled={saving}
          className="w-full bg-black text-white py-3 rounded-xl font-medium mt-2 disabled:opacity-50">
          {saving ? 'Сохранение...' : 'Добавить ученика'}
        </button>
      </form>
    </main>
  )
}
