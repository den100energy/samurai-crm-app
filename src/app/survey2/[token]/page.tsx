'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const QUALITIES = [
  { key: 'q_strength', label: 'Сила' },
  { key: 'q_speed', label: 'Быстрота' },
  { key: 'q_endurance', label: 'Выносливость' },
  { key: 'q_agility', label: 'Ловкость' },
  { key: 'q_coordination', label: 'Координация' },
  { key: 'q_posture', label: 'Осанка' },
  { key: 'q_flexibility', label: 'Гибкость' },
  { key: 'q_discipline', label: 'Дисциплина' },
  { key: 'q_sociability', label: 'Общительность' },
  { key: 'q_confidence', label: 'Уверенность в себе' },
  { key: 'q_learnability', label: 'Обучаемость' },
  { key: 'q_attentiveness', label: 'Внимательность' },
  { key: 'q_emotional_balance', label: 'Уравновешенность' },
  { key: 'q_goal_orientation', label: 'Целеустремлённость' },
  { key: 'q_activity', label: 'Активность' },
  { key: 'q_self_defense', label: 'Умение постоять за себя' },
]

const BEHAVIORAL = [
  { key: 'physical_level', label: 'Физически развит' },
  { key: 'social_level', label: 'Ладит с другими' },
  { key: 'communication_level', label: 'Выражает мысли ясно' },
  { key: 'illness_frequency', label: 'Часто болеет' },
  { key: 'energy_level', label: 'Энергичный' },
  { key: 'discipline_level', label: 'Дисциплинированный' },
  { key: 'independence_level', label: 'Самостоятельный' },
  { key: 'posture_level', label: 'Хорошая осанка' },
  { key: 'learning_speed_level', label: 'Быстро усваивает новое' },
]

export default function Survey2Page() {
  const { token } = useParams<{ token: string }>()
  const [survey, setSurvey] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [filledBy, setFilledBy] = useState<'parent' | 'student' | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [physical, setPhysical] = useState({ height_cm: '', weight_kg: '' })
  const [form, setForm] = useState<Record<string, number>>(() => {
    const f: Record<string, number> = {}
    QUALITIES.forEach(q => { f[q.key] = 5 })
    BEHAVIORAL.forEach(b => { f[b.key] = 5 })
    return f
  })

  useEffect(() => {
    supabase.from('progress_surveys').select('*').eq('survey_token', token).maybeSingle()
      .then(({ data }) => {
        setSurvey(data)
        if (data?.filled_at) setStep(99)
        setLoading(false)
      })
  }, [token])

  async function submit() {
    if (!survey) return
    setSubmitting(true)
    const payload: Record<string, any> = {
      filled_by: filledBy,
      filled_at: new Date().toISOString(),
      ...form,
    }
    const h = parseFloat(physical.height_cm)
    const w = parseFloat(physical.weight_kg)
    if (!isNaN(h) && h > 50 && h < 250) payload.height_cm = h
    if (!isNaN(w) && w > 3 && w < 300) payload.weight_kg = w
    await supabase.from('progress_surveys').update(payload).eq('id', survey.id)
    setStep(99)
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>
  )

  if (!survey) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 p-6 text-center">
      <div>
        <div className="text-4xl mb-3">🔍</div>
        <p>Анкета не найдена или ссылка устарела</p>
      </div>
    </div>
  )

  // Заполнено
  if (step === 99) return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-5">🥋</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-3">Спасибо!</h1>
      <p className="text-gray-600 max-w-sm leading-relaxed">
        Тренер изучит ваши ответы и подготовит персональную программу на следующий период.
        Вы получите её в Telegram.
      </p>
    </div>
  )

  // Шаг 0 — кто вы + вводный текст
  if (step === 0) return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white p-5 max-w-lg mx-auto">
      <div className="text-center pt-8 pb-6">
        <div className="text-5xl mb-3">🥋</div>
        <h1 className="text-xl font-bold text-gray-800">Школа Самурая</h1>
        <p className="text-gray-500 text-sm mt-1">Срез прогресса — 1 месяц</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Кто заполняет анкету?</p>
        <div className="space-y-2">
          <button onClick={() => setFilledBy('parent')}
            className={`w-full py-3 rounded-xl text-sm font-medium border transition-colors
              ${filledBy === 'parent' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-700'}`}>
            👨‍👩‍👧 Я родитель
          </button>
          <button onClick={() => setFilledBy('student')}
            className={`w-full py-3 rounded-xl text-sm font-medium border transition-colors
              ${filledBy === 'student' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-700'}`}>
            🥷 Я ученик
          </button>
        </div>
      </div>

      {filledBy === 'parent' && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 mb-5 space-y-3">
          <p className="font-semibold text-gray-800">Месяц занятий — это уже маленькая победа! 🎉</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Прошёл первый месяц в Школе Самурая. Тренер видит прогресс на занятиях —
            но ваш взгляд со стороны, как родителя, не заменит ничто.
          </p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5">✅</span>
              <span>Тренер скорректирует программу именно под вашего ребёнка</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5">📊</span>
              <span>Вы увидите прогресс в цифрах — что изменилось за месяц</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5">🎯</span>
              <span>Следующие 3 месяца будут работать именно на ваши приоритеты</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">Займёт 3–4 минуты. Нет правильных ответов — только ваш взгляд.</p>
        </div>
      )}

      {filledBy === 'student' && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 mb-5 space-y-3">
          <p className="font-semibold text-gray-800">Привет, самурай! Месяц позади 💪</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Ты уже месяц занимаешься в Школе Самурая. Это серьёзно —
            мало кто проходит этот путь.
          </p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5">💪</span>
              <span>Твои ощущения — главный ориентир для тренера</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5">🎯</span>
              <span>Программа на следующие 3 месяца будет построена под тебя</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5">⚡</span>
              <span>Честно ответь — и тренировки станут ещё эффективнее</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">3–4 минуты. Отвечай как чувствуешь — без правильных ответов.</p>
        </div>
      )}

      {filledBy && (
        <button onClick={() => setStep(1)}
          className="w-full bg-black text-white py-3.5 rounded-2xl font-medium text-sm">
          Начать →
        </button>
      )}
    </div>
  )

  // Шаг 1 — поведенческие вопросы
  if (step === 1) return (
    <div className="min-h-screen bg-white p-5 max-w-lg mx-auto pb-24">
      <div className="mb-6">
        <div className="flex gap-1.5 mb-1">
          <div className="h-1 flex-1 bg-black rounded-full" />
          <div className="h-1 flex-1 bg-gray-200 rounded-full" />
        </div>
        <p className="text-xs text-gray-400 text-right">Шаг 1 из 2</p>
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-1">Как сейчас?</h2>
      <p className="text-sm text-gray-500 mb-6">
        Оцените каждое качество от 1 до 10 — как оно проявляется прямо сейчас
      </p>

      {/* Физические показатели */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 space-y-3">
        <div className="text-sm font-semibold text-gray-700">📏 Физические показатели <span className="font-normal text-gray-400">(необязательно)</span></div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Рост, см</label>
            <input
              type="number" inputMode="decimal" placeholder="например: 132"
              value={physical.height_cm}
              onChange={e => setPhysical(p => ({ ...p, height_cm: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Вес, кг</label>
            <input
              type="number" inputMode="decimal" placeholder="например: 34.5"
              value={physical.weight_kg}
              onChange={e => setPhysical(p => ({ ...p, weight_kg: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white" />
          </div>
        </div>
        <p className="text-xs text-gray-400">Тренер использует эти данные для расчёта нагрузки и рекомендаций по питанию</p>
      </div>

      <div className="space-y-6">
        {BEHAVIORAL.map(b => (
          <div key={b.key}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm text-gray-700">{b.label}</span>
              <span className="text-sm font-bold text-gray-900 w-5 text-right">{form[b.key]}</span>
            </div>
            <input type="range" min={1} max={10}
              value={form[b.key]}
              onChange={e => setForm(p => ({ ...p, [b.key]: parseInt(e.target.value) }))}
              className="w-full accent-black" />
            <div className="flex justify-between text-xs text-gray-300 mt-0.5">
              <span>1 — совсем нет</span>
              <span>10 — отлично</span>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <button onClick={() => setStep(2)}
          className="w-full bg-black text-white py-3.5 rounded-2xl font-medium text-sm max-w-lg mx-auto block">
          Далее →
        </button>
      </div>
    </div>
  )

  // Шаг 2 — 16 качеств
  if (step === 2) return (
    <div className="min-h-screen bg-white p-5 max-w-lg mx-auto pb-24">
      <div className="mb-6">
        <div className="flex gap-1.5 mb-1">
          <div className="h-1 flex-1 bg-black rounded-full" />
          <div className="h-1 flex-1 bg-black rounded-full" />
        </div>
        <p className="text-xs text-gray-400 text-right">Шаг 2 из 2</p>
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-1">16 качеств самурая</h2>
      <p className="text-sm text-gray-500 mb-6">
        Оцените каждое качество от 1 до 10 — как оно проявляется сегодня
      </p>

      <div className="space-y-6">
        {QUALITIES.map(q => (
          <div key={q.key}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm text-gray-700">{q.label}</span>
              <span className="text-sm font-bold text-gray-900 w-5 text-right">{form[q.key]}</span>
            </div>
            <input type="range" min={1} max={10}
              value={form[q.key]}
              onChange={e => setForm(p => ({ ...p, [q.key]: parseInt(e.target.value) }))}
              className="w-full accent-black" />
            <div className="flex justify-between text-xs text-gray-300 mt-0.5">
              <span>1</span>
              <span>10</span>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <button onClick={submit} disabled={submitting}
          className="w-full bg-black text-white py-3.5 rounded-2xl font-medium text-sm max-w-lg mx-auto block disabled:opacity-50">
          {submitting ? 'Отправляю...' : 'Отправить ответы ✓'}
        </button>
      </div>
    </div>
  )

  return null
}
