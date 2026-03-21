'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Lead = {
  id: string
  name: string
  phone: string | null
  source: string | null
  status: string
  notes: string | null
  created_at: string
  telegram_chat_id: string | null
}

const STAGES = [
  { key: 'new', label: '🆕 Новый', color: 'bg-blue-50 border-blue-200' },
  { key: 'contacted', label: '📞 Связались', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'trial', label: '🥋 Пробное', color: 'bg-purple-50 border-purple-200' },
  { key: 'converted', label: '✅ Стал учеником', color: 'bg-green-50 border-green-200' },
  { key: 'lost', label: '❌ Отказ', color: 'bg-red-50 border-red-200' },
]

const ACTIVE_STAGES = STAGES.filter(s => s.key !== 'converted' && s.key !== 'lost')

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [view, setView] = useState<'funnel' | 'list'>('funnel')
  const [form, setForm] = useState({ name: '', phone: '', source: '', notes: '' })
  const [expandedLead, setExpandedLead] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addLead(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('leads').insert({
      name: form.name, phone: form.phone || null,
      source: form.source || null, notes: form.notes || null
    })
    setForm({ name: '', phone: '', source: '', notes: '' })
    setShowForm(false)
    load()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (status === 'trial') {
      fetch('/api/auto-send-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id }),
      })
    }
  }

  async function deleteLead(id: string) {
    if (!confirm('Удалить лид?')) return
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  // Просроченные — новые лиды без контакта более 24 часов
  const overdue = leads.filter(l => {
    if (l.status !== 'new') return false
    const hours = (Date.now() - new Date(l.created_at).getTime()) / 3600000
    return hours > 24
  })

  const activeLeads = leads.filter(l => l.status !== 'converted' && l.status !== 'lost')
  const converted = leads.filter(l => l.status === 'converted').length
  const conversionRate = leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Лиды</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="ml-auto bg-black text-white px-4 py-2 rounded-xl text-sm font-medium">
          + Добавить
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-gray-800">{leads.length}</div>
          <div className="text-xs text-gray-400">всего</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-blue-500">{activeLeads.length}</div>
          <div className="text-xs text-gray-400">активных</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-green-600">{converted}</div>
          <div className="text-xs text-gray-400">учеников</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-gray-800">{conversionRate}%</div>
          <div className="text-xs text-gray-400">конверсия</div>
        </div>
      </div>

      {/* Просроченные */}
      {overdue.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4">
          <div className="font-semibold text-orange-700 mb-1">⏰ Не связались 24+ часа ({overdue.length})</div>
          {overdue.map(l => (
            <div key={l.id} className="text-sm text-orange-600">• {l.name}{l.phone ? ` — ${l.phone}` : ''}</div>
          ))}
        </div>
      )}

      {/* Переключение вида */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('funnel')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
            ${view === 'funnel' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
          🔽 Воронка
        </button>
        <button onClick={() => setView('list')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
            ${view === 'list' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
          📋 Список
        </button>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <form onSubmit={addLead} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4 space-y-3">
          <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            placeholder="Имя *" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none text-sm" />
          <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
            placeholder="Телефон" type="tel" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none text-sm" />
          <input value={form.source} onChange={e => setForm({...form, source: e.target.value})}
            placeholder="Источник (Instagram, сарафан...)" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none text-sm" />
          <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
            placeholder="Заметки" rows={2} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none text-sm resize-none" />
          <button type="submit" className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium">Сохранить</button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : view === 'funnel' ? (
        // ВОРОНКА
        <div className="space-y-3">
          {ACTIVE_STAGES.map((stage, idx) => {
            const stageLeads = leads.filter(l => l.status === stage.key)
            const prevCount = idx === 0 ? leads.filter(l => l.status !== 'lost').length : leads.filter(l => l.status === ACTIVE_STAGES[idx-1].key).length
            const pct = prevCount > 0 && idx > 0 ? Math.round((stageLeads.length / prevCount) * 100) : null
            return (
              <div key={stage.key} className={`rounded-2xl border p-3 ${stage.color}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-800">{stage.label}</div>
                  <div className="flex items-center gap-2">
                    {pct !== null && <span className="text-xs text-gray-500">{pct}%</span>}
                    <span className="bg-white rounded-full px-2 py-0.5 text-sm font-bold text-gray-700">{stageLeads.length}</span>
                  </div>
                </div>
                {stageLeads.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-1">Нет лидов</div>
                ) : (
                  <div className="space-y-2">
                    {stageLeads.map(l => (
                      <LeadCard key={l.id} lead={l} expanded={expandedLead === l.id}
                        onToggle={() => setExpandedLead(expandedLead === l.id ? null : l.id)}
                        onStatusChange={updateStatus} onDelete={deleteLead} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {/* Итог */}
          <div className="grid grid-cols-2 gap-2">
            {STAGES.filter(s => s.key === 'converted' || s.key === 'lost').map(stage => {
              const stageLeads = leads.filter(l => l.status === stage.key)
              return (
                <div key={stage.key} className={`rounded-2xl border p-3 ${stage.color}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-700">{stage.label}</div>
                    <span className="bg-white rounded-full px-2 py-0.5 text-sm font-bold text-gray-700">{stageLeads.length}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        // СПИСОК
        <div className="space-y-2">
          {leads.length === 0 ? (
            <div className="text-center text-gray-400 py-12">Лидов пока нет</div>
          ) : leads.map(l => (
            <LeadCard key={l.id} lead={l} expanded={expandedLead === l.id}
              onToggle={() => setExpandedLead(expandedLead === l.id ? null : l.id)}
              onStatusChange={updateStatus} onDelete={deleteLead} />
          ))}
        </div>
      )}
    </main>
  )
}

const QUALITIES = [
  ['strength','Сила'],['speed','Быстрота'],['endurance','Выносливость'],
  ['agility','Ловкость'],['coordination','Координация'],['posture','Осанка'],
  ['flexibility','Гибкость'],['discipline','Дисциплина'],['sociability','Общительность'],
  ['confidence','Уверенность'],['learnability','Обучаемость'],['attentiveness','Внимательность'],
  ['emotional_balance','Уравновешенность'],['goal_orientation','Целеустремлённость'],
  ['activity','Активность'],['self_defense','Самозащита'],
]

function LeadCard({ lead, expanded, onToggle, onStatusChange, onDelete }: {
  lead: Lead
  expanded: boolean
  onToggle: () => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const stage = STAGES.find(s => s.key === lead.status)
  const hoursAgo = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 3600000)
  const timeLabel = hoursAgo < 24 ? `${hoursAgo}ч назад` : `${Math.floor(hoursAgo/24)}д назад`
  const [survey, setSurvey] = useState<any>(null)
  const [surveyLoaded, setSurveyLoaded] = useState(false)
  const [showSurvey, setShowSurvey] = useState(false)
  const [showTrainer, setShowTrainer] = useState(false)
  const [editingTrainer, setEditingTrainer] = useState(false)
  const [trainerForm, setTrainerForm] = useState<Record<string,any>>({})
  const [program, setProgram] = useState('')
  const [generating, setGenerating] = useState(false)
  const [programSaved, setProgramSaved] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [convertGroup, setConvertGroup] = useState('')
  const [converting, setConverting] = useState(false)
  const [convertedStudentId, setConvertedStudentId] = useState<string | null>(null)

  useEffect(() => {
    if (!expanded || surveyLoaded) return
    supabase.from('diagnostic_surveys').select('*').eq('lead_id', lead.id).maybeSingle()
      .then(({ data }) => {
        setSurvey(data)
        setSurveyLoaded(true)
        if (data) {
          const init: Record<string,any> = { trainer_notes: data.trainer_notes || '' }
          QUALITIES.forEach(([k]) => { init[`trainer_${k}`] = data[`trainer_${k}`] ?? 5 })
          setTrainerForm(init)
          if (data.ai_program) setProgram(data.ai_program)
        }
      })
  }, [expanded, surveyLoaded, lead.id])

  async function copySurveyLink() {
    let s = survey
    if (!s) {
      const { data } = await supabase.from('diagnostic_surveys').insert({ lead_id: lead.id }).select().single()
      s = data
      setSurvey(s)
      const init: Record<string,any> = { trainer_notes: '' }
      QUALITIES.forEach(([k]) => { init[`trainer_${k}`] = 5 })
      setTrainerForm(init)
    }
    const url = `${window.location.origin}/survey/${s.survey_token}`
    navigator.clipboard.writeText(url)
    alert(`Ссылка скопирована!\n\nОтправьте родителю:\n${url}`)
  }

  async function generateProgram() {
    if (!survey) return
    setGenerating(true)
    const res = await fetch('/api/generate-program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey }),
    })
    const data = await res.json()
    if (data.error) { alert('Ошибка: ' + data.error); setGenerating(false); return }
    setProgram(data.program)
    // Save to DB
    await supabase.from('diagnostic_surveys').update({ ai_program: data.program }).eq('id', survey.id)
    setGenerating(false)
  }

  async function saveProgram() {
    await supabase.from('diagnostic_surveys').update({ ai_program: program }).eq('id', survey.id)
    setProgramSaved(true)
    setTimeout(() => setProgramSaved(false), 2000)
  }

  async function sendProgram() {
    if (!lead.telegram_chat_id) { alert('У лида нет Telegram. Подключите через ссылку-приглашение.'); return }
    const message = `📋 <b>Индивидуальная программа — ${survey?.student_name || lead.name}</b>\n\n${program}`
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: lead.telegram_chat_id, message }),
    })
    await supabase.from('diagnostic_surveys').update({ ai_program_sent_at: new Date().toISOString() }).eq('id', survey.id)
    alert('Программа отправлена в Telegram!')
  }

  async function convertToStudent() {
    setConverting(true)
    const { data } = await supabase.from('students').insert({
      name: lead.name,
      phone: lead.phone || null,
      group_name: convertGroup || null,
      telegram_chat_id: lead.telegram_chat_id ? Number(lead.telegram_chat_id) : null,
    }).select().single()
    if (data) {
      await supabase.from('leads').update({ status: 'converted' }).eq('id', lead.id)
      await supabase.from('diagnostic_surveys').update({ student_id: data.id }).eq('lead_id', lead.id)
      onStatusChange(lead.id, 'converted')
      setConvertedStudentId(data.id)
    }
    setConverting(false)
    setShowConvert(false)
  }

  async function saveTrainer() {
    let s = survey
    if (!s) {
      const { data } = await supabase.from('diagnostic_surveys').insert({ lead_id: lead.id }).select().single()
      s = data
    }
    const payload = { ...trainerForm, trainer_filled_at: new Date().toISOString() }
    const { data } = await supabase.from('diagnostic_surveys').update(payload).eq('id', s.id).select().single()
    if (data) setSurvey(data)
    setEditingTrainer(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center px-3 py-2.5 text-left">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-800 flex items-center gap-2">
            {lead.name}
            {survey?.filled_at && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">📋 Анкета</span>}
          </div>
          <div className="text-xs text-gray-400">{lead.phone || '—'} · {timeLabel}</div>
        </div>
        <div className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600 ml-2 shrink-0">
          {stage?.label}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-50">
          {lead.source && <div className="text-xs text-gray-500 mt-2">📍 {lead.source}</div>}
          {lead.notes && <div className="text-sm text-gray-600 mt-1">{lead.notes}</div>}

          {/* Survey block */}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={copySurveyLink}
              className="flex-1 border border-blue-200 bg-blue-50 text-blue-700 text-xs py-2 rounded-lg">
              📋 Скопировать ссылку анкеты
            </button>
            {survey?.filled_at && (
              <button onClick={() => setShowSurvey(v => !v)}
                className="border border-green-200 bg-green-50 text-green-700 text-xs py-2 px-3 rounded-lg">
                {showSurvey ? 'Свернуть' : 'Смотреть'}
              </button>
            )}
          </div>

          {showSurvey && survey?.filled_at && (
            <div className="mt-3 bg-gray-50 rounded-xl p-3 text-xs space-y-2">
              <div className="font-semibold text-gray-700">📋 Анкета: {survey.student_name}{survey.student_age ? `, ${survey.student_age}` : ''}</div>
              {survey.injuries_text && <div><span className="text-gray-500">Травмы:</span> {survey.injuries_text}</div>}
              {survey.contraindications_text && <div><span className="text-gray-500">Противопоказания:</span> {survey.contraindications_text}</div>}
              {survey.other_activities_text && <div><span className="text-gray-500">Секции:</span> {survey.other_activities_text}</div>}
              {survey.prev_sport_text && <div><span className="text-gray-500">Спорт ранее:</span> {survey.prev_sport_text}</div>}
              {survey.character_notes_text && <div><span className="text-gray-500">Характер:</span> {survey.character_notes_text}</div>}
              {survey.how_can_help_text && <div><span className="text-gray-500">Ожидания:</span> {survey.how_can_help_text}</div>}
              {survey.parent_name && <div><span className="text-gray-500">Родитель:</span> {survey.parent_name} {survey.parent_phone}</div>}
              <div className="pt-1 border-t border-gray-200">
                <div className="text-gray-500 mb-1">15 качеств (1-10):</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {[
                    ['q_strength','Сила'],['q_speed','Быстрота'],['q_endurance','Выносливость'],
                    ['q_agility','Ловкость'],['q_coordination','Координация'],['q_posture','Осанка'],
                    ['q_flexibility','Гибкость'],['q_discipline','Дисциплина'],['q_sociability','Общительность'],
                    ['q_confidence','Уверенность'],['q_learnability','Обучаемость'],['q_attentiveness','Внимательность'],
                    ['q_emotional_balance','Уравновешенность'],['q_goal_orientation','Целеустремлённость'],
                    ['q_activity','Активность'],['q_self_defense','Самозащита'],
                  ].filter(([k]) => survey[k] !== null).map(([k, lbl]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-500">{lbl}</span>
                      <span className="font-medium text-gray-700">{survey[k]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Trainer assessment */}
          <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center px-3 py-2 bg-gray-50">
              <span className="text-xs font-medium text-gray-700 flex-1">
                🥋 Оценки тренера с пробного
                {survey?.trainer_filled_at && <span className="ml-2 text-green-600">✓ Заполнено</span>}
              </span>
              <div className="flex gap-1">
                {!editingTrainer && (
                  <button onClick={() => { setEditingTrainer(true); setShowTrainer(true) }}
                    className="text-xs border border-gray-200 bg-white px-2 py-0.5 rounded-lg text-gray-600">
                    {survey?.trainer_filled_at ? '✎ Изменить' : '+ Заполнить'}
                  </button>
                )}
                {survey?.trainer_filled_at && !editingTrainer && (
                  <button onClick={() => setShowTrainer(v => !v)}
                    className="text-xs border border-gray-200 bg-white px-2 py-0.5 rounded-lg text-gray-500">
                    {showTrainer ? '▲' : '▼'}
                  </button>
                )}
              </div>
            </div>

            {showTrainer && !editingTrainer && survey?.trainer_filled_at && (
              <div className="px-3 py-2 text-xs space-y-1">
                {survey.trainer_notes && (
                  <div className="mb-2 text-gray-600 italic">"{survey.trainer_notes}"</div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {QUALITIES.map(([k, lbl]) => {
                    const tVal = survey[`trainer_${k}`]
                    const pVal = survey[`q_${k}`]
                    return tVal != null ? (
                      <div key={k} className="flex justify-between items-center">
                        <span className="text-gray-500">{lbl}</span>
                        <span className="font-medium text-gray-800">
                          {tVal}
                          {pVal != null && <span className="text-gray-400 ml-1">/ р:{pVal}</span>}
                        </span>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            )}

            {editingTrainer && (
              <div className="px-3 py-3 space-y-3">
                <textarea value={trainerForm.trainer_notes || ''}
                  onChange={e => setTrainerForm(p => ({...p, trainer_notes: e.target.value}))}
                  placeholder="Заметки тренера после пробного занятия..." rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none resize-none" />
                <div className="space-y-2">
                  {QUALITIES.map(([k, lbl]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-28 shrink-0">{lbl}</span>
                      <input type="range" min={1} max={10}
                        value={trainerForm[`trainer_${k}`] ?? 5}
                        onChange={e => setTrainerForm(p => ({...p, [`trainer_${k}`]: parseInt(e.target.value)}))}
                        className="flex-1 accent-black" />
                      <span className="text-xs font-semibold text-gray-800 w-4">
                        {trainerForm[`trainer_${k}`] ?? 5}
                      </span>
                      {survey?.[`q_${k}`] != null && (
                        <span className="text-xs text-gray-400 w-8">р:{survey[`q_${k}`]}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveTrainer}
                    className="flex-1 bg-black text-white py-2 rounded-lg text-xs font-medium">
                    Сохранить оценки
                  </button>
                  <button onClick={() => setEditingTrainer(false)}
                    className="px-3 border border-gray-200 text-gray-500 py-2 rounded-lg text-xs">
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI Program */}
          {surveyLoaded && (
            <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center px-3 py-2 bg-gray-50">
                <span className="text-xs font-medium text-gray-700 flex-1">
                  ✨ Программа развития
                  {survey?.ai_program_sent_at && <span className="ml-2 text-blue-600">✓ Отправлена</span>}
                </span>
              </div>
              <div className="px-3 py-3 space-y-2">
                <button
                  onClick={generateProgram}
                  disabled={generating || !survey}
                  className="w-full bg-black text-white py-2 rounded-lg text-xs font-medium disabled:opacity-40">
                  {generating ? '⏳ Генерация...' : program ? '🔄 Перегенерировать' : '✨ Сгенерировать программу'}
                </button>
                {!survey && (
                  <div className="text-xs text-gray-400 text-center">Сначала заполните анкету</div>
                )}
                {program && (
                  <>
                    <textarea
                      value={program}
                      onChange={e => setProgram(e.target.value)}
                      rows={10}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none resize-none font-mono"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveProgram}
                        className="flex-1 border border-gray-200 bg-white text-gray-700 py-2 rounded-lg text-xs font-medium">
                        {programSaved ? '✓ Сохранено' : '💾 Сохранить'}
                      </button>
                      <button onClick={sendProgram}
                        disabled={!lead.telegram_chat_id}
                        title={!lead.telegram_chat_id ? 'Нет Telegram у лида' : ''}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-40">
                        📨 Отправить родителю
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {convertedStudentId && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
              ✅ Ученик создан!{' '}
              <a href={`/students/${convertedStudentId}`} className="underline font-medium">Открыть карточку</a>
            </div>
          )}

          {showConvert && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
              <div className="text-sm font-medium text-green-800">Создать ученика из лида</div>
              <div className="text-xs text-green-700">Имя: {lead.name}{lead.phone ? `, тел: ${lead.phone}` : ''}</div>
              <select value={convertGroup} onChange={e => setConvertGroup(e.target.value)}
                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm outline-none bg-white">
                <option value="">Выберите группу (необязательно)</option>
                {['Дети 4-9','Подростки (нач)','Подростки (оп)','Цигун','Индивидуальные'].map(g =>
                  <option key={g} value={g}>{g}</option>
                )}
              </select>
              <div className="flex gap-2">
                <button onClick={convertToStudent} disabled={converting}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50">
                  {converting ? 'Создаю...' : '✅ Создать ученика'}
                </button>
                <button onClick={() => setShowConvert(false)}
                  className="px-3 border border-gray-200 text-gray-500 py-2 rounded-lg text-xs">
                  Отмена
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-1 mt-3 flex-wrap">
            {STAGES.map(s => s.key === 'converted' ? (
              <button key={s.key}
                onClick={() => lead.status !== 'converted' ? setShowConvert(true) : undefined}
                className={`text-xs px-2 py-1 rounded-full transition-colors
                  ${lead.status === s.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
                {s.label}
              </button>
            ) : (
              <button key={s.key} onClick={() => onStatusChange(lead.id, s.key)}
                className={`text-xs px-2 py-1 rounded-full transition-colors
                  ${lead.status === s.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <button onClick={() => onDelete(lead.id)} className="text-xs text-red-400 mt-2">Удалить</button>
        </div>
      )}
    </div>
  )
}
