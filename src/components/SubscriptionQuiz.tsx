'use client'

import { useState } from 'react'

type SubType = {
  id: string
  name: string
  group_type: string | null
  sessions_count: number | null
  price: number | null
  price_per_session: number | null
  duration_months: number | null
  bonuses: Record<string, number> | null
  bonus_total_value: number | null
  is_for_newcomers: boolean | null
}

type Props = {
  types: SubType[]
}

type Answers = {
  frequency: 'low' | 'mid' | 'high' | 'max' | null
  duration: 'short' | 'mid' | 'long' | null
  priority: 'price' | 'bonuses' | 'value' | null
}

// frequency → примерное кол-во занятий в месяц
const FREQUENCY_SESSIONS: Record<string, number> = {
  low: 6,   // 1-2 раза в нед
  mid: 10,  // 2-3 раза в нед
  high: 14, // 3-4 раза в нед
  max: 20,  // почти каждый день
}

// duration → желаемый срок в месяцах
const DURATION_MONTHS: Record<string, number> = {
  short: 1.5,
  mid: 3,
  long: 5,
}

function scoreType(type: SubType, answers: Answers): number {
  if (!answers.frequency || !answers.duration || !answers.priority) return 0
  if (type.is_for_newcomers) return 0 // не показываем "нов"
  if (!type.sessions_count || !type.price) return 0

  const sessPerMonth = FREQUENCY_SESSIONS[answers.frequency]
  const wantedMonths = DURATION_MONTHS[answers.duration]
  const neededSessions = sessPerMonth * wantedMonths
  const actualMonths = type.duration_months || 1

  // Базовый критерий — занятий должно хватить ±30%
  const sessionFit = type.sessions_count >= neededSessions * 0.7 && type.sessions_count <= neededSessions * 1.6

  let score = 0
  if (sessionFit) score += 10

  // Штраф за сильное несоответствие сроку
  const monthDiff = Math.abs(actualMonths - wantedMonths)
  score -= monthDiff * 2

  // Приоритет
  if (answers.priority === 'price') {
    // чем меньше цена за занятие — тем лучше, но штрафуем большие абонементы
    score += (500 - (type.price_per_session || 500)) / 20
    if (type.sessions_count > 24) score -= 3
  }
  if (answers.priority === 'bonuses') {
    score += (type.bonus_total_value || 0) / 200
  }
  if (answers.priority === 'value') {
    // баланс: бонусы + цена за занятие
    score += (type.bonus_total_value || 0) / 400
    score += (500 - (type.price_per_session || 500)) / 30
  }

  return score
}

function getReason(type: SubType, answers: Answers): string {
  const parts: string[] = []
  if (!answers.frequency || !answers.duration || !answers.priority) return ''

  const sessPerMonth = FREQUENCY_SESSIONS[answers.frequency]
  const months = type.duration_months || 1
  const approxSess = Math.round(sessPerMonth * months)

  parts.push(`при вашей частоте посещений хватит примерно на ${months} мес. (≈${approxSess} занятий)`)

  if ((type.bonus_total_value || 0) > 0) {
    parts.push(`включены бонусы на ${type.bonus_total_value!.toLocaleString('ru-RU')} ₽`)
  }
  if (answers.priority === 'price') {
    parts.push(`цена занятия ${type.price_per_session} ₽ — одна из низких`)
  }

  return parts.join(', ')
}

const STEPS = ['frequency', 'duration', 'priority'] as const

export function SubscriptionQuiz({ types }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({ frequency: null, duration: null, priority: null })
  const [done, setDone] = useState(false)

  function reset() {
    setStep(0)
    setAnswers({ frequency: null, duration: null, priority: null })
    setDone(false)
  }

  function answer(key: keyof Answers, val: string) {
    const next = { ...answers, [key]: val } as Answers
    setAnswers(next)
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      setDone(true)
    }
  }

  // Выбираем топ-2 абонемента
  const recommended = done
    ? types
        .map(t => ({ type: t, score: scoreType(t, answers) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
    : []

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); reset() }}
        className="w-full mt-3 py-2.5 rounded-xl border border-dashed border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
      >
        🎯 Помочь выбрать абонемент
      </button>
    )
  }

  return (
    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-blue-800">🎯 Подбор абонемента</div>
        <button onClick={() => setOpen(false)} className="text-blue-400 hover:text-blue-600 text-lg leading-none">✕</button>
      </div>

      {!done && (
        <>
          {/* Прогресс */}
          <div className="flex gap-1 mb-4">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-blue-500' : 'bg-blue-200'}`} />
            ))}
          </div>

          {step === 0 && (
            <div>
              <div className="text-sm text-blue-700 font-medium mb-3">Как часто планируете ходить на тренировки?</div>
              <div className="space-y-2">
                {[
                  { val: 'low', label: '1–2 раза в неделю', sub: '≈ 6–8 занятий в месяц' },
                  { val: 'mid', label: '2–3 раза в неделю', sub: '≈ 10–12 занятий в месяц' },
                  { val: 'high', label: '3–4 раза в неделю', sub: '≈ 14–16 занятий в месяц' },
                  { val: 'max', label: 'Почти каждый день', sub: '≈ 20+ занятий в месяц' },
                ].map(o => (
                  <button key={o.val} onClick={() => answer('frequency', o.val)}
                    className="w-full text-left px-4 py-3 bg-white rounded-xl border border-blue-100 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <div className="text-sm font-medium text-gray-800">{o.label}</div>
                    <div className="text-xs text-gray-400">{o.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="text-sm text-blue-700 font-medium mb-3">На какой срок рассчитываете?</div>
              <div className="space-y-2">
                {[
                  { val: 'short', label: 'Попробовать', sub: 'До 1.5 месяца' },
                  { val: 'mid', label: 'На сезон', sub: '2–3 месяца' },
                  { val: 'long', label: 'Надолго', sub: '4 месяца и более' },
                ].map(o => (
                  <button key={o.val} onClick={() => answer('duration', o.val)}
                    className="w-full text-left px-4 py-3 bg-white rounded-xl border border-blue-100 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <div className="text-sm font-medium text-gray-800">{o.label}</div>
                    <div className="text-xs text-gray-400">{o.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-sm text-blue-700 font-medium mb-3">Что для вас важнее?</div>
              <div className="space-y-2">
                {[
                  { val: 'price', label: '💰 Минимальная стоимость', sub: 'Платить как можно меньше сейчас' },
                  { val: 'bonuses', label: '🎁 Бонусы и подарки', sub: 'Больше включено в абонемент' },
                  { val: 'value', label: '⚖️ Лучшее соотношение', sub: 'Цена и бонусы в балансе' },
                ].map(o => (
                  <button key={o.val} onClick={() => answer('priority', o.val)}
                    className="w-full text-left px-4 py-3 bg-white rounded-xl border border-blue-100 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <div className="text-sm font-medium text-gray-800">{o.label}</div>
                    <div className="text-xs text-gray-400">{o.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="mt-3 text-xs text-blue-400 hover:text-blue-600">
              ← Назад
            </button>
          )}
        </>
      )}

      {done && (
        <div>
          {recommended.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">
              Не нашлось подходящего варианта. Уточните запрос у администратора.
            </div>
          ) : (
            <>
              <div className="text-sm text-blue-700 font-medium mb-3">✅ Рекомендуем вам:</div>
              <div className="space-y-3">
                {recommended.map(({ type }, idx) => {
                  const bonusKeys = Object.keys(type.bonuses || {})
                  return (
                    <div key={type.id} className={`bg-white rounded-xl border p-4 ${idx === 0 ? 'border-blue-300' : 'border-gray-100'}`}>
                      {idx === 0 && (
                        <div className="text-xs font-semibold text-blue-600 mb-1.5">⭐ Лучший вариант</div>
                      )}
                      <div className="font-semibold text-gray-800 text-sm">{type.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {type.sessions_count} занятий
                        {type.duration_months ? ` · ${type.duration_months} мес.` : ''}
                      </div>
                      <div className="text-base font-bold text-gray-800 mt-1.5">
                        {type.price?.toLocaleString('ru-RU')} ₽
                        {type.price_per_session && (
                          <span className="text-xs font-normal text-gray-400 ml-2">{type.price_per_session} ₽/занятие</span>
                        )}
                      </div>
                      {bonusKeys.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-green-600 font-medium mb-1">🎁 Бонусы на {type.bonus_total_value?.toLocaleString('ru-RU')} ₽:</div>
                          <div className="flex flex-wrap gap-1">
                            {bonusKeys.map(b => (
                              <span key={b} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                                {b} ×{type.bonuses![b]}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-2 text-xs text-gray-400 italic">
                        {getReason(type, answers)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          <button onClick={reset} className="mt-3 text-xs text-blue-500 hover:text-blue-700">
            ← Пройти заново
          </button>
        </div>
      )}
    </div>
  )
}
