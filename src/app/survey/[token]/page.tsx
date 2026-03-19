'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BEHAVIORAL = [
  { level: 'physical_level', imp: 'physical_importance', label: 'Физически развит' },
  { level: 'social_level', imp: 'social_importance', label: 'Ладит с другими' },
  { level: 'communication_level', imp: 'communication_importance', label: 'Выражает мысли ясно' },
  { level: 'illness_frequency', imp: 'health_importance', label: 'Часто болеет' },
  { level: 'energy_level', imp: null, label: 'Энергичный' },
  { level: 'discipline_level', imp: 'discipline_importance', label: 'Дисциплинированный' },
  { level: 'independence_level', imp: 'independence_importance', label: 'Самостоятельный' },
  { level: 'posture_level', imp: 'posture_importance', label: 'Хорошая осанка' },
  { level: 'learning_speed_level', imp: 'learning_speed_importance', label: 'Быстро усваивает новое' },
]

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

type FormState = Record<string, string | number>

const initForm = (): FormState => {
  const f: FormState = {
    student_name: '', student_age: '',
    injuries_text: '', contraindications_text: '',
    other_activities_text: '', prev_sport_text: '',
    character_notes_text: '', how_can_help_text: '',
    parent_name: '', parent_phone: '',
  }
  BEHAVIORAL.forEach(b => {
    f[b.level] = 0
    if (b.imp) f[b.imp] = 0
  })
  QUALITIES.forEach(q => { f[q.key] = 5 })
  return f
}

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>()
  const [survey, setSurvey] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(initForm())
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('diagnostic_surveys')
        .select('*')
        .eq('survey_token', token)
        .maybeSingle()
      setSurvey(data)
      setLoading(false)
    }
    load()
  }, [token])

  function set(key: string, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function submit() {
    setSubmitting(true)
    const payload: Record<string, any> = { filled_at: new Date().toISOString() }
    Object.entries(form).forEach(([k, v]) => {
      if (typeof v === 'number') payload[k] = v || null
      else payload[k] = (v as string).trim() || null
    })
    await supabase.from('diagnostic_surveys').update(payload).eq('survey_token', token)
    setDone(true)
    setSubmitting(false)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Загрузка...</div>
  if (!survey) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Анкета не найдена</div>
  if (survey.filled_at || done) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl mb-4">🥋</div>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Анкета заполнена!</h1>
      <p className="text-gray-500 text-sm">Спасибо! Тренер изучит данные перед пробным занятием и подготовит индивидуальный подход для вашего ребёнка.</p>
    </div>
  )

  const TOTAL = 4

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto p-4">
        {/* Header */}
        <div className="text-center py-4 mb-2">
          <div className="text-2xl font-bold text-gray-800">⚔️ Школа Самурая</div>
          <div className="text-sm text-gray-500 mt-1">Анкета диагностики — заполняет родитель</div>
        </div>

        {/* Progress */}
        <div className="flex gap-1 mb-6">
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i < step ? 'bg-black' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Step 1: Basic info + medical */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Об ученике</h2>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Имя ученика *</label>
              <input value={form.student_name as string} onChange={e => set('student_name', e.target.value)}
                placeholder="Имя и фамилия" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Возраст</label>
              <input value={form.student_age as string} onChange={e => set('student_age', e.target.value)}
                placeholder="Например: 8 лет" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Травмы или перенесённые операции</label>
              <textarea value={form.injuries_text as string} onChange={e => set('injuries_text', e.target.value)}
                rows={2} placeholder="Если нет — оставьте пустым"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white resize-none" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Противопоказания к нагрузкам</label>
              <textarea value={form.contraindications_text as string} onChange={e => set('contraindications_text', e.target.value)}
                rows={2} placeholder="Если нет — оставьте пустым"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white resize-none" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Другие секции и занятия</label>
              <input value={form.other_activities_text as string} onChange={e => set('other_activities_text', e.target.value)}
                placeholder="Футбол, рисование... и сколько часов в неделю"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Предыдущий опыт в спорте</label>
              <input value={form.prev_sport_text as string} onChange={e => set('prev_sport_text', e.target.value)}
                placeholder="Что занимался раньше" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Особенности характера, страхи, пожелания</label>
              <textarea value={form.character_notes_text as string} onChange={e => set('character_notes_text', e.target.value)}
                rows={3} placeholder="Что важно знать тренеру"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white resize-none" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Как мы можем быть максимально полезны?</label>
              <textarea value={form.how_can_help_text as string} onChange={e => set('how_can_help_text', e.target.value)}
                rows={2} placeholder="Ваши ожидания от занятий"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white resize-none" />
            </div>
            <button onClick={() => setStep(2)} disabled={!(form.student_name as string).trim()}
              className="w-full bg-black text-white py-3 rounded-xl font-medium disabled:opacity-40">
              Далее →
            </button>
          </div>
        )}

        {/* Step 2: Behavioral assessment */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-bold text-gray-800 text-lg">Оценка поведения</h2>
            <p className="text-sm text-gray-500">Оцените текущий уровень (1–5) и насколько это важно для вас.</p>
            {BEHAVIORAL.map(b => (
              <div key={b.level} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="font-medium text-gray-800 mb-3">{b.label}</div>
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1.5">Текущий уровень</div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => set(b.level, n)}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors
                          ${form[b.level] === n ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {b.imp && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1.5">Важность для вас</div>
                    <div className="flex gap-1.5">
                      {[['1', 'Не важно'], ['2', 'Важно'], ['3', 'Очень важно']].map(([n, lbl]) => (
                        <button key={n} type="button" onClick={() => set(b.imp!, parseInt(n))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors
                            ${form[b.imp!] === parseInt(n) ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="px-6 border border-gray-200 text-gray-600 py-3 rounded-xl">← Назад</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-black text-white py-3 rounded-xl font-medium">Далее →</button>
            </div>
          </div>
        )}

        {/* Step 3: 15 qualities */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">15 качеств самурая</h2>
            <p className="text-sm text-gray-500">Оцените каждое качество от 1 до 10, как вы сами видите своего ребёнка сейчас.</p>
            {QUALITIES.map(q => (
              <div key={q.key} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">{q.label}</span>
                  <span className="text-xl font-bold text-gray-800 w-8 text-right">{form[q.key]}</span>
                </div>
                <input type="range" min={1} max={10} value={form[q.key] as number}
                  onChange={e => set(q.key, parseInt(e.target.value))}
                  className="w-full accent-black" />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>1 — слабо</span><span>10 — отлично</span>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="px-6 border border-gray-200 text-gray-600 py-3 rounded-xl">← Назад</button>
              <button onClick={() => setStep(4)} className="flex-1 bg-black text-white py-3 rounded-xl font-medium">Далее →</button>
            </div>
          </div>
        )}

        {/* Step 4: Parent contact */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Контакт родителя</h2>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Ваше имя *</label>
              <input value={form.parent_name as string} onChange={e => set('parent_name', e.target.value)}
                placeholder="Имя и фамилия" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Телефон *</label>
              <input value={form.parent_phone as string} onChange={e => set('parent_phone', e.target.value)}
                placeholder="+7 999 000 00 00" type="tel"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white" />
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
              Нажимая «Отправить», вы соглашаетесь на обработку персональных данных в соответствии с политикой конфиденциальности Школы Самурая.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="px-6 border border-gray-200 text-gray-600 py-3 rounded-xl">← Назад</button>
              <button onClick={submit}
                disabled={submitting || !(form.parent_name as string).trim() || !(form.parent_phone as string).trim()}
                className="flex-1 bg-black text-white py-3 rounded-xl font-medium disabled:opacity-40">
                {submitting ? 'Отправка...' : '✓ Отправить анкету'}
              </button>
            </div>
          </div>
        )}

        <div className="pb-20" />
      </div>
    </div>
  )
}
