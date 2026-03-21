import { NextRequest, NextResponse } from 'next/server'

const QUALITIES = [
  ['strength','Сила'],['speed','Быстрота'],['endurance','Выносливость'],
  ['agility','Ловкость'],['coordination','Координация'],['posture','Осанка'],
  ['flexibility','Гибкость'],['discipline','Дисциплина'],['sociability','Общительность'],
  ['confidence','Уверенность'],['learnability','Обучаемость'],['attentiveness','Внимательность'],
  ['emotional_balance','Уравновешенность'],['goal_orientation','Целеустремлённость'],
  ['activity','Активность'],['self_defense','Самозащита'],
]

export async function POST(req: NextRequest) {
  const { survey1, survey2, studentName } = await req.json()

  // Build comparison table: before (survey1 parent) vs after (survey2 parent)
  const qualitiesTable = QUALITIES
    .map(([k, lbl]) => {
      const before = survey1[`q_${k}`] ?? null
      const after = survey2[`q_${k}`] ?? null
      if (before == null && after == null) return null
      const diff = before != null && after != null ? after - before : null
      const arrow = diff == null ? '' : diff > 0 ? ` ↑+${diff}` : diff < 0 ? ` ↓${diff}` : ' ='
      return `  ${lbl}: до=${before ?? '—'}/10, после=${after ?? '—'}/10${arrow}`
    })
    .filter(Boolean)
    .join('\n')

  const trainerBefore = QUALITIES
    .map(([k, lbl]) => survey1[`trainer_${k}`] != null ? `  ${lbl}: ${survey1[`trainer_${k}`]}/10` : null)
    .filter(Boolean).join('\n')

  const trainerAfter = QUALITIES
    .map(([k, lbl]) => survey2[`trainer_${k}`] != null ? `  ${lbl}: ${survey2[`trainer_${k}`]}/10` : null)
    .filter(Boolean).join('\n')

  const prompt = `Ты опытный тренер по айкидо айкикай в клубе "Школа Самурая".

Ученик: ${studentName}
Прошёл первый месяц занятий. Сравни две анкеты: начальную диагностику и срез через месяц.

ОЦЕНКИ РОДИТЕЛЯ — ДО и ПОСЛЕ (16 качеств):
${qualitiesTable || '— нет данных —'}

ОЦЕНКИ ТРЕНЕРА ДО (с пробного занятия):
${trainerBefore || '— нет данных —'}

ОЦЕНКИ ТРЕНЕРА ПОСЛЕ (через месяц):
${trainerAfter || '— нет данных —'}

Ожидания семьи в начале: ${survey1.how_can_help_text || '—'}
Заметки тренера до: ${survey1.trainer_notes || '—'}
Заметки тренера после: ${survey2.trainer_notes || '—'}

Составь анализ прогресса в формате:

**Что изменилось за месяц**
(3-4 конкретных наблюдения с опорой на цифры — что выросло, что осталось, что снизилось)

**Главные достижения**
(2-3 пункта — что реально получилось)

**На что обратить внимание**
(2-3 зоны, требующие работы в следующем месяце)

**Программа на следующий месяц**
Неделя 1: (фокус и задачи)
Неделя 2: (фокус и задачи)
Неделя 3: (фокус и задачи)
Неделя 4: (фокус и задачи)

**Слова для родителей**
(2-3 предложения — тёплый, конкретный фидбэк о том, что они могут заметить дома)

Пиши живо, по-русски, тепло и профессионально. Опирайся на конкретные цифры.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://samurai-crm.vercel.app',
      'X-Title': 'Школа Самурая CRM',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-3-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message || 'Ошибка генерации' }, { status: 500 })
  }

  const text = data.choices?.[0]?.message?.content || ''
  return NextResponse.json({ program: text })
}
