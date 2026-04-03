'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name: string
  group_name: string | null
  status: string
  telegram_chat_id: string | null
}

type BroadcastHistory = {
  id: string
  audience: string
  group_name: string | null
  text: string
  sent_count: number
  no_telegram_count: number
  created_at: string
}

type SendResult = {
  sent: number
  no_telegram: number
  no_telegram_names: string[]
}

type Audience = 'active' | 'inactive' | 'expiring' | 'manual' | 'parents'

const AUDIENCE_TABS: { key: Audience; label: string; desc: string }[] = [
  { key: 'active',    label: '🟢 Активные',       desc: 'Текущие ученики' },
  { key: 'inactive',  label: '⚫ Неактивные',      desc: 'Бывшие ученики' },
  { key: 'expiring',  label: '⏰ Истекает',         desc: '≤2 занятий осталось' },
  { key: 'manual',    label: '✋ Вручную',          desc: 'Выбрать из списка' },
  { key: 'parents',   label: '👪 Родители',         desc: 'Только контакты' },
]

const GROUPS = ['Все', 'Старт', 'Основная (нач.)', 'Основная (оп.)', 'Цигун', 'Индивидуальные']

const TEMPLATES = [
  { label: '❌ Отмена занятия',       text: '⚠️ Внимание!\n\nЗанятие {дата} отменяется. Приносим извинения за неудобства.\n\nСледите за обновлениями 🙏' },
  { label: '📅 Изменение расписания', text: '📅 Изменение расписания\n\nУважаемые ученики и родители!\n\n{подробности}\n\nПо вопросам пишите тренеру.' },
  { label: '🎉 Мероприятие',          text: '🎉 Приглашаем на мероприятие!\n\n📍 Место: \n📆 Дата: \n💰 Стоимость: \n\nЗаписаться можно у тренера.' },
  { label: '🎂 Поздравление',         text: '🎉 Поздравляем, {имя}!\n\nЖелаем здоровья, боевого духа и новых побед! 🥋🏆' },
  { label: '💰 Оплата абонемента',    text: '💳 Напоминание об оплате\n\nУважаемые родители, не забудьте продлить абонемент для продолжения занятий.\n\nПо вопросам обращайтесь к тренеру 🙏' },
  { label: '💪 Мотивация',            text: '🥋 {имя}, привет!\n\nХочим напомнить — каждая тренировка делает тебя сильнее. Ждём тебя на занятиях! 💪' },
  { label: '🔔 Возвращение',          text: '👋 Мы скучаем!\n\nДавно не видели вас в Школе Самурая. Готовы снова открыть двери — свяжитесь с нами, чтобы вернуться к тренировкам 🥋' },
]

const AUDIENCE_LABELS: Record<Audience, string> = {
  active:   'Активные',
  inactive: 'Неактивные',
  expiring: 'Истекает абонемент',
  manual:   'Вручную',
  parents:  'Родители',
}

export default function BroadcastPage() {
  const [audience, setAudience] = useState<Audience>('active')
  const [group, setGroup] = useState('Все')
  const [text, setText] = useState('')
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [manualSearch, setManualSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [history, setHistory] = useState<BroadcastHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(true)

  // Загрузить всех учеников один раз
  useEffect(() => {
    async function load() {
      setLoadingStudents(true)
      const { data } = await supabase
        .from('students')
        .select('id, name, group_name, status, telegram_chat_id')
        .order('name')
      setAllStudents(data || [])
      setLoadingStudents(false)
    }
    load()

    // История
    fetch('/api/broadcast')
      .then(r => r.json())
      .then(d => Array.isArray(d) && setHistory(d))
      .catch(() => {})
  }, [])

  // Вычислить получателей для текущих настроек
  const recipients = useMemo(() => {
    if (audience === 'manual') {
      return allStudents.filter(s => selectedIds.has(s.id))
    }
    if (audience === 'expiring') {
      // Для expiring не знаем без запроса к subscriptions — покажем всех активных как приближение
      return allStudents.filter(s => s.status === 'active')
    }
    if (audience === 'parents') {
      // Показываем активных как прокси (реальные родители считаются на сервере)
      let list = allStudents.filter(s => s.status === 'active')
      if (group !== 'Все') list = list.filter(s => s.group_name === group)
      return list
    }

    let list = allStudents.filter(s =>
      audience === 'active'
        ? s.status === 'active'
        : ['inactive', 'archived'].includes(s.status)
    )
    if (group !== 'Все') list = list.filter(s => s.group_name === group)
    return list
  }, [audience, group, allStudents, selectedIds])

  const withBot = recipients.filter(s => s.telegram_chat_id).length
  const withoutBot = recipients.length - withBot

  const showGroupFilter = ['active', 'inactive', 'parents'].includes(audience)

  const filteredForManual = useMemo(() => {
    let list = allStudents.filter(s => s.status === 'active' || s.status === 'inactive')
    if (manualSearch.length >= 2) {
      list = list.filter(s => s.name.toLowerCase().includes(manualSearch.toLowerCase()))
    }
    return list
  }, [allStudents, manualSearch])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(filteredForManual.map(s => s.id)))
  }

  function clearAll() {
    setSelectedIds(new Set())
  }

  async function send() {
    if (!text.trim()) return alert('Введите текст сообщения')
    if (recipients.length === 0) return alert('Нет получателей')

    setSending(true)
    setResult(null)

    const body: Record<string, unknown> = { audience, group, text }
    if (audience === 'manual') body.student_ids = [...selectedIds]

    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data: SendResult = await res.json()
    setResult(data)
    setSending(false)

    // Обновить историю
    fetch('/api/broadcast')
      .then(r => r.json())
      .then(d => Array.isArray(d) && setHistory(d))
      .catch(() => {})
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  const btnBase = 'whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors border'

  return (
    <main className="max-w-lg mx-auto p-4 pb-12">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Рассылка</h1>
      </div>

      {/* Аудитория */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Аудитория</div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {AUDIENCE_TABS.map(t => (
            <button key={t.key}
              onClick={() => { setAudience(t.key); setResult(null); setSelectedIds(new Set()) }}
              className={`${btnBase} shrink-0 ${
                audience === t.key
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-400 mt-1.5">
          {AUDIENCE_TABS.find(t => t.key === audience)?.desc}
          {audience === 'expiring' && ' — список уточняется при отправке'}
          {audience === 'parents' && ' — отправка только родителям (через контакты)'}
        </div>
      </div>

      {/* Фильтр по группе */}
      {showGroupFilter && (
        <div className="mb-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Группа</div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {GROUPS.map(g => (
              <button key={g} onClick={() => setGroup(g)}
                className={`${btnBase} shrink-0 ${
                  group === g
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Шаблоны */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Шаблоны</div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {TEMPLATES.map(t => (
            <button key={t.label} onClick={() => setText(t.text)}
              className={`${btnBase} shrink-0 bg-white text-gray-600 border-gray-200 hover:bg-gray-50`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Текст сообщения */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Текст сообщения</div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={6}
          placeholder="Введите текст... Используйте {имя} для персонализации"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 resize-none"
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-blue-500">
            💡 <code className="bg-blue-50 px-1 rounded">{'{имя}'}</code> заменится на имя каждого ученика
          </span>
          <span className="text-xs text-gray-400">{text.length} симв.</span>
        </div>
      </div>

      {/* Блок получателей */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="font-medium text-gray-800 text-sm">Получатели</div>
          <div className="flex items-center gap-3 text-xs">
            {audience !== 'expiring' && (
              <>
                <span className="text-green-600">🟢 {withBot} с ботом</span>
                {withoutBot > 0 && <span className="text-gray-400">⚫ {withoutBot} без бота</span>}
              </>
            )}
            <span className="font-medium text-gray-600">{recipients.length} чел.</span>
          </div>
        </div>

        {/* Ручной выбор */}
        {audience === 'manual' ? (
          <div className="p-3">
            <div className="flex gap-2 mb-2">
              <input
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                placeholder="Поиск ученика..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
              />
              <button onClick={selectAll} className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                Все
              </button>
              <button onClick={clearAll} className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                Сброс
              </button>
            </div>

            {selectedIds.size > 0 && (
              <div className="text-xs text-blue-600 mb-2 font-medium">
                ✓ Выбрано: {selectedIds.size} чел.
              </div>
            )}

            <div className="space-y-1 max-h-56 overflow-y-auto">
              {filteredForManual.length === 0 ? (
                <div className="text-sm text-gray-400 py-2 text-center">Введите имя для поиска</div>
              ) : (
                filteredForManual.map(s => (
                  <label key={s.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      className="w-4 h-4 rounded accent-black"
                    />
                    <span className="text-sm text-gray-700 flex-1">{s.name}</span>
                    <span className="text-xs text-gray-400">{s.group_name || '—'}</span>
                    <span className="text-xs">{s.telegram_chat_id ? '🟢' : '⚫'}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Обычный список */
          loadingStudents ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Загрузка...</div>
          ) : recipients.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Нет учеников</div>
          ) : (
            <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
              {recipients.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="text-xs">{s.telegram_chat_id ? '🟢' : '⚫'}</span>
                  <span className="text-sm text-gray-700 flex-1">{s.name}</span>
                  <span className="text-xs text-gray-400">{s.group_name || '—'}</span>
                </div>
              ))}
            </div>
          )
        )}

        {audience !== 'manual' && withoutBot > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              ⚫ {withoutBot} чел. без бота — им сообщение не дойдёт автоматически
            </span>
          </div>
        )}
      </div>

      {/* Результат отправки */}
      {result && (
        <div className="mb-4 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <div className="bg-green-50 border-b border-green-100 px-4 py-3 flex items-center gap-2">
            <span className="text-green-600 text-lg">✅</span>
            <div>
              <div className="font-semibold text-green-800 text-sm">
                Отправлено {result.sent} чел. напрямую
              </div>
              {result.no_telegram > 0 && (
                <div className="text-xs text-green-600">
                  + {result.no_telegram} без бота (не доставлено)
                </div>
              )}
            </div>
          </div>
          {result.no_telegram_names.length > 0 && (
            <div className="bg-white px-4 py-3">
              <div className="text-xs text-gray-500 mb-1.5">Без бота — свяжитесь вручную:</div>
              <div className="text-sm text-gray-700 leading-relaxed">
                {result.no_telegram_names.join(', ')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Кнопка отправки */}
      <button
        onClick={send}
        disabled={sending || recipients.length === 0 || !text.trim()}
        className="w-full py-3.5 rounded-2xl font-semibold text-base transition-all disabled:opacity-40
          bg-black text-white hover:bg-gray-900 active:scale-[0.98]">
        {sending
          ? '⏳ Отправка...'
          : `🚀 Отправить${audience === 'manual' ? ` (${selectedIds.size} чел.)` : ` (${recipients.length} чел.)`}`
        }
      </button>

      {audience === 'parents' && (
        <div className="mt-2 text-center text-xs text-gray-400">
          Отправка только родителям, у которых подключён бот
        </div>
      )}

      {/* История рассылок */}
      <div className="mt-6">
        <button
          onClick={() => setShowHistory(p => !p)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <span className="font-medium text-gray-800 text-sm">📋 История рассылок</span>
          <span className="text-gray-400 text-sm">{showHistory ? '▲' : '▼'} {history.length}</span>
        </button>

        {showHistory && (
          <div className="mt-2 space-y-2">
            {history.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-4">Рассылок пока не было</div>
            ) : (
              history.map(h => (
                <div key={h.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-xs text-gray-400">
                      {AUDIENCE_LABELS[h.audience as Audience] || h.audience}
                      {h.group_name ? ` · ${h.group_name}` : ''}
                    </div>
                    <div className="text-xs text-gray-400 shrink-0">{formatDate(h.created_at)}</div>
                  </div>
                  <div className="text-sm text-gray-700 line-clamp-2 mb-1.5">{h.text}</div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-600">✅ {h.sent_count} доставлено</span>
                    {h.no_telegram_count > 0 && (
                      <span className="text-gray-400">⚫ {h.no_telegram_count} без бота</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  )
}
