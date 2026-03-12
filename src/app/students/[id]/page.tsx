'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name: string
  phone: string | null
  birth_date: string | null
  group_name: string | null
  status: string
  parent_token: string | null
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

type Belt = {
  id: string
  belt_name: string
  date: string
  notes: string | null
}

const GROUPS = ['Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']
const SUB_TYPES = ['8 занятий', '12 занятий', 'Безлимит (месяц)', 'Пробное', 'Индивидуальное']
const BELTS = ['Белый', 'Жёлтый', 'Оранжевый', 'Зелёный', 'Синий', 'Фиолетовый', 'Коричневый', 'Чёрный']

const BELT_COLORS: Record<string, string> = {
  'Белый': 'bg-gray-100 text-gray-700',
  'Жёлтый': 'bg-yellow-100 text-yellow-700',
  'Оранжевый': 'bg-orange-100 text-orange-700',
  'Зелёный': 'bg-green-100 text-green-700',
  'Синий': 'bg-blue-100 text-blue-700',
  'Фиолетовый': 'bg-purple-100 text-purple-700',
  'Коричневый': 'bg-amber-100 text-amber-800',
  'Чёрный': 'bg-gray-800 text-white',
}

export default function StudentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [student, setStudent] = useState<Student | null>(null)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [belts, setBelts] = useState<Belt[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Student>>({})
  const [showSubForm, setShowSubForm] = useState(false)
  const [subForm, setSubForm] = useState({ type: '', sessions_total: '', start_date: '', end_date: '', amount: '', paid: false })
  const [showBeltForm, setShowBeltForm] = useState(false)
  const [beltForm, setBeltForm] = useState({ belt_name: '', date: new Date().toISOString().split('T')[0], notes: '' })
  const [showQR, setShowQR] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: sb }, { data: at }, { data: bl }] = await Promise.all([
        supabase.from('students').select('*').eq('id', id).single(),
        supabase.from('subscriptions').select('*').eq('student_id', id).order('created_at', { ascending: false }),
        supabase.from('attendance').select('*').eq('student_id', id).order('date', { ascending: false }).limit(20),
        supabase.from('belts').select('*').eq('student_id', id).order('date', { ascending: false }),
      ])
      if (s) { setStudent(s); setForm(s) }
      setSubs(sb || [])
      setAttendance(at || [])
      setBelts(bl || [])
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

  async function addBelt(e: React.FormEvent) {
    e.preventDefault()
    const { data } = await supabase.from('belts').insert({
      student_id: id,
      belt_name: beltForm.belt_name,
      date: beltForm.date,
      notes: beltForm.notes || null,
    }).select().single()
    if (data) setBelts(prev => [data, ...prev])
    setShowBeltForm(false)
    setBeltForm({ belt_name: '', date: new Date().toISOString().split('T')[0], notes: '' })
  }

  async function deleteBelt(beltId: string) {
    await supabase.from('belts').delete().eq('id', beltId)
    setBelts(prev => prev.filter(b => b.id !== beltId))
  }

  async function sendReminder() {
    if (!student) return
    const activeSub = subs[0]
    const subInfo = activeSub
      ? activeSub.sessions_left != null
        ? `Осталось занятий: ${activeSub.sessions_left}`
        : activeSub.end_date
        ? `Абонемент до: ${activeSub.end_date}`
        : ''
      : 'Абонемент не найден'
    const message = `👋 Напоминание для тренера:\n\nУченик: <b>${student.name}</b>\nГруппа: ${student.group_name || '—'}\n${subInfo}\n\nТелефон: ${student.phone || '—'}`
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    alert('Напоминание отправлено в Telegram!')
  }

  function copyParentLink() {
    if (!student?.parent_token) return alert('Токен не найден')
    const url = `${window.location.origin}/parent/${student.parent_token}`
    navigator.clipboard.writeText(url)
    alert('Ссылка скопирована!\n' + url)
  }

  function openWhatsApp() {
    if (!student?.phone) return alert('Телефон не указан')
    const phone = student.phone.replace(/\D/g, '')
    const activeSub = subs[0]
    const subInfo = activeSub?.sessions_left != null
      ? `Осталось занятий: ${activeSub.sessions_left}`
      : activeSub?.end_date
      ? `Абонемент до: ${activeSub.end_date}`
      : ''
    const text = encodeURIComponent(`Здравствуйте! Напоминаем о занятиях в Школе Самурая.\n${subInfo}`)
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
  }

  async function archive() {
    if (!confirm('Архивировать ученика?')) return
    await supabase.from('students').update({ status: 'archived' }).eq('id', id)
    router.push('/students')
  }

  if (!student) return <div className="text-center text-gray-400 py-12">Загрузка...</div>

  const presentCount = attendance.filter(a => a.present).length
  const currentBelt = belts[0]
  const checkinUrl = typeof window !== 'undefined' ? `${window.location.origin}/checkin/${id}` : ''

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

      {/* Student info */}
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
              {currentBelt && (
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${BELT_COLORS[currentBelt.belt_name] || 'bg-gray-100 text-gray-600'}`}>
                  {currentBelt.belt_name} пояс
                </span>
              )}
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
            {student.phone && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Телефон</span>
                <div className="flex items-center gap-2">
                  <span>{student.phone}</span>
                  <button onClick={openWhatsApp}
                    className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    WA
                  </button>
                </div>
              </div>
            )}
            {student.birth_date && <div className="flex justify-between"><span className="text-gray-400">Дата рождения</span><span>{student.birth_date}</span></div>}
            <div className="flex justify-between"><span className="text-gray-400">Посещений (последние 20)</span><span>{presentCount}</span></div>
          </div>
        )}
      </div>

      {/* QR code */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-gray-800">QR-код для отметки</div>
          <button onClick={() => setShowQR(!showQR)}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1 rounded-xl">
            {showQR ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        {showQR && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="p-3 bg-white border border-gray-200 rounded-2xl">
              <QRCodeSVG value={checkinUrl} size={180} />
            </div>
            <div className="text-xs text-gray-400 text-center">Ученик сканирует — посещение записывается</div>
            <button onClick={() => { navigator.clipboard.writeText(checkinUrl); alert('Ссылка скопирована!') }}
              className="text-xs text-gray-500 underline">
              Скопировать ссылку
            </button>
          </div>
        )}
      </div>

      {/* Subscriptions */}
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

      {/* Belts */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-800">Пояса и аттестации</div>
          <button onClick={() => setShowBeltForm(!showBeltForm)}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1 rounded-xl">
            + Добавить
          </button>
        </div>

        {showBeltForm && (
          <form onSubmit={addBelt} className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <select required value={beltForm.belt_name} onChange={e => setBeltForm({...beltForm, belt_name: e.target.value})}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
              <option value="">Выберите пояс *</option>
              {BELTS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <input value={beltForm.date} onChange={e => setBeltForm({...beltForm, date: e.target.value})}
              type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <input value={beltForm.notes} onChange={e => setBeltForm({...beltForm, notes: e.target.value})}
              placeholder="Заметка (необязательно)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <button type="submit" className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium">
              Сохранить
            </button>
          </form>
        )}

        {belts.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-2">Аттестаций нет</div>
        ) : (
          <div className="space-y-2">
            {belts.map((b, i) => (
              <div key={b.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${BELT_COLORS[b.belt_name] || 'bg-gray-100 text-gray-600'}`}>
                    {b.belt_name}
                  </span>
                  <div>
                    <div className="text-xs text-gray-500">{b.date}</div>
                    {b.notes && <div className="text-xs text-gray-400">{b.notes}</div>}
                  </div>
                  {i === 0 && <span className="text-xs text-gray-400">(текущий)</span>}
                </div>
                <button onClick={() => deleteBelt(b.id)} className="text-xs text-red-400">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attendance */}
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

      <button onClick={copyParentLink}
        className="w-full border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl mb-2">
        🔗 Ссылка для родителя
      </button>
      <button onClick={sendReminder}
        className="w-full border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl mb-2">
        📨 Отправить напоминание в Telegram
      </button>
      <button onClick={archive} className="w-full text-red-400 text-sm py-2">
        Архивировать ученика
      </button>
    </main>
  )
}
