'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name: string
  phone: string | null
  birth_date: string | null
  group_name: string | null
  status: string
}

type Subscription = {
  id: string
  type: string
  sessions_total: number | null
  sessions_left: number | null
  start_date: string | null
  end_date: string | null
  paid: boolean
  amount: number | null
}

type Attendance = {
  id: string
  date: string
  present: boolean
}

const GROUPS = ['Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']
const SUB_TYPES = ['8 занятий', '12 занятий', 'Безлимит (месяц)', 'Пробное', 'Индивидуальное']

export default function StudentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [student, setStudent] = useState<Student | null>(null)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Student>>({})
  const [showSubForm, setShowSubForm] = useState(false)
  const [subForm, setSubForm] = useState({ type: '', sessions_total: '', start_date: '', end_date: '', amount: '', paid: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: sb }, { data: at }] = await Promise.all([
        supabase.from('students').select('*').eq('id', id).single(),
        supabase.from('subscriptions').select('*').eq('student_id', id).order('created_at', { ascending: false }),
        supabase.from('attendance').select('*').eq('student_id', id).order('date', { ascending: false }).limit(20),
      ])
      if (s) { setStudent(s); setForm(s) }
      setSubs(sb || [])
      setAttendance(at || [])
    }
    load()
  }, [id])

  async function saveStudent() {
    setSaving(true)
    await supabase.from('students').update({
      name: form.name,
      phone: form.phone || null,
      birth_date: form.birth_date || null,
      group_name: form.group_name || null,
    }).eq('id', id)
    setStudent(prev => prev ? { ...prev, ...form } as Student : null)
    setEditing(false)
    setSaving(false)
  }

  async function addSubscription(e: React.FormEvent) {
    e.preventDefault()
    const sessions = subForm.sessions_total ? parseInt(subForm.sessions_total) : null
    const { data } = await supabase.from('subscriptions').insert({
      student_id: id,
      type: subForm.type,
      sessions_total: sessions,
      sessions_left: sessions,
      start_date: subForm.start_date || null,
      end_date: subForm.end_date || null,
      amount: subForm.amount ? parseFloat(subForm.amount) : null,
      paid: subForm.paid,
    }).select().single()
    if (data) setSubs(prev => [data, ...prev])
    setShowSubForm(false)
    setSubForm({ type: '', sessions_total: '', start_date: '', end_date: '', amount: '', paid: false })
  }

  async function togglePaid(subId: string, paid: boolean) {
    await supabase.from('subscriptions').update({ paid: !paid }).eq('id', subId)
    setSubs(prev => prev.map(s => s.id === subId ? { ...s, paid: !paid } : s))
  }

  async function archive() {
    if (!confirm('Архивировать ученика?')) return
    await supabase.from('students').update({ status: 'archived' }).eq('id', id)
    router.push('/students')
  }

  if (!student) return <div className="text-center text-gray-400 py-12">Загрузка...</div>

  const presentCount = attendance.filter(a => a.present).length

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/students" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Карточка ученика</h1>
        <button onClick={() => setEditing(!editing)}
          className="ml-auto text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl">
          {editing ? 'Отмена' : 'Изменить'}
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-600">
            {student.name[0]}
          </div>
          {editing ? (
            <input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-lg font-semibold outline-none" />
          ) : (
            <div>
              <div className="text-lg font-semibold text-gray-800">{student.name}</div>
              <div className="text-sm text-gray-400">{student.group_name || 'Группа не указана'}</div>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})}
              placeholder="Телефон" type="tel"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <input value={form.birth_date || ''} onChange={e => setForm({...form, birth_date: e.target.value})}
              type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <select value={form.group_name || ''} onChange={e => setForm({...form, group_name: e.target.value})}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
              <option value="">Группа</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <button onClick={saveStudent} disabled={saving}
              className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {student.phone && <div className="flex justify-between"><span className="text-gray-400">Телефон</span><span>{student.phone}</span></div>}
            {student.birth_date && <div className="flex justify-between"><span className="text-gray-400">Дата рождения</span><span>{student.birth_date}</span></div>}
            <div className="flex justify-between"><span className="text-gray-400">Посещений (последние 20)</span><span>{presentCount}</span></div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800">Абонементы</div>
          <button onClick={() => setShowSubForm(!showSubForm)}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1 rounded-xl">
            + Добавить
          </button>
        </div>

        {showSubForm && (
          <form onSubmit={addSubscription} className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <select required value={subForm.type} onChange={e => setSubForm({...subForm, type: e.target.value})}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
              <option value="">Тип абонемента *</option>
              {SUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={subForm.sessions_total} onChange={e => setSubForm({...subForm, sessions_total: e.target.value})}
              placeholder="Количество занятий" type="number"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <div className="flex gap-2">
              <input value={subForm.start_date} onChange={e => setSubForm({...subForm, start_date: e.target.value})}
                type="date" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              <input value={subForm.end_date} onChange={e => setSubForm({...subForm, end_date: e.target.value})}
                type="date" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <input value={subForm.amount} onChange={e => setSubForm({...subForm, amount: e.target.value})}
              placeholder="Сумма (руб)" type="number"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={subForm.paid} onChange={e => setSubForm({...subForm, paid: e.target.checked})} />
              Оплачен
            </label>
            <button type="submit" className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium">
              Сохранить
            </button>
          </form>
        )}

        {subs.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-2">Абонементов нет</div>
        ) : (
          <div className="space-y-2">
            {subs.map(s => (
              <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                <div>
                  <div className="text-sm font-medium">{s.type}</div>
                  <div className="text-xs text-gray-400">
                    {s.sessions_left != null ? `${s.sessions_left}/${s.sessions_total} занятий` : ''}
                    {s.end_date ? ` · до ${s.end_date}` : ''}
                    {s.amount ? ` · ${s.amount} руб` : ''}
                  </div>
                </div>
                <button onClick={() => togglePaid(s.id, s.paid)}
                  className={`text-xs px-2 py-1 rounded-full ${s.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {s.paid ? 'Оплачен' : 'Не оплачен'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="font-semibold text-gray-800 mb-3">История посещений</div>
        {attendance.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-2">Нет данных</div>
        ) : (
          <div className="space-y-1">
            {attendance.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{a.date}</span>
                <span>{a.present ? '✅ Был' : '❌ Не был'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={archive} className="w-full text-red-400 text-sm py-2">
        Архивировать ученика
      </button>
    </main>
  )
}
