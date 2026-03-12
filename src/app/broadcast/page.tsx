'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Student = { id: string; name: string; phone: string | null; group_name: string | null }

const GROUPS = ['Все активные', 'Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']

const TEMPLATES = [
  { label: '📅 Изменение расписания', text: 'Уважаемые родители и ученики! Сообщаем об изменении расписания: ' },
  { label: '🎉 Мероприятие', text: 'Приглашаем вас на мероприятие! Дата: , место: , стоимость: ' },
  { label: '❌ Отмена занятия', text: 'Внимание! Занятие отменяется. Дата: . Приносим извинения за неудобства.' },
  { label: '🎂 Поздравление', text: 'Поздравляем с днём рождения! Желаем здоровья, успехов и новых побед! 🥋' },
  { label: '💰 Напоминание об оплате', text: 'Напоминаем, что заканчивается абонемент. Просим продлить для продолжения занятий.' },
]

export default function BroadcastPage() {
  const [group, setGroup] = useState(GROUPS[0])
  const [message, setMessage] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    async function load() {
      let query = supabase.from('students').select('id, name, phone, group_name').eq('status', 'active')
      if (group !== 'Все активные') query = query.eq('group_name', group)
      const { data } = await query.order('name')
      setStudents(data || [])
    }
    load()
  }, [group])

  async function sendToMe() {
    if (!message.trim()) return alert('Введите текст сообщения')
    setSending(true)

    const header = `📢 <b>Рассылка: ${group}</b>\n<i>Текст сообщения:</i>\n\n${message}\n\n`
    const contacts = students
      .map(s => `• ${s.name}${s.phone ? ` — ${s.phone}` : ' — телефон не указан'}`)
      .join('\n')
    const footer = `\n\n👥 Всего: ${students.length} учеников`

    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: header + contacts + footer }),
    })

    setSending(false)
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Рассылка</h1>
      </div>

      {/* Выбор группы */}
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-2">Кому отправить</div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {GROUPS.map(g => (
            <button key={g} onClick={() => setGroup(g)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${group === g ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Шаблоны */}
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-2">Шаблоны</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TEMPLATES.map(t => (
            <button key={t.label} onClick={() => setMessage(t.text)}
              className="whitespace-nowrap px-3 py-1.5 rounded-full text-sm border border-gray-200 text-gray-600 bg-white hover:bg-gray-50">
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Текст сообщения */}
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-2">Текст сообщения</div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          placeholder="Введите текст или выберите шаблон выше..."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 resize-none"
        />
        <div className="text-xs text-gray-400 mt-1 text-right">{message.length} символов</div>
      </div>

      {/* Список получателей */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="font-medium text-gray-800">Получатели</div>
          <div className="text-sm text-gray-400">{students.length} чел.</div>
        </div>
        {students.length === 0 ? (
          <div className="text-sm text-gray-400">Нет учеников в этой группе</div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {students.map(s => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{s.name}</span>
                <span className="text-gray-400">{s.phone || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-sm text-yellow-700">
        💡 Бот пришлёт тебе список с контактами и текстом — ты отправляешь вручную или копируешь текст.
      </div>

      <button onClick={sendToMe} disabled={sending || students.length === 0}
        className="w-full bg-black text-white py-3 rounded-xl font-medium disabled:opacity-50">
        {sent ? '✓ Отправлено в Telegram!' : sending ? 'Отправка...' : `📨 Получить список (${students.length} чел.)`}
      </button>
    </main>
  )
}
