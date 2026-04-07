import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const QUALITIES: [string, string][] = [
  ['strength','Сила'],['speed','Быстрота'],['endurance','Выносливость'],
  ['agility','Ловкость'],['coordination','Координация'],['posture','Осанка'],
  ['flexibility','Гибкость'],['discipline','Дисциплина'],['sociability','Общительность'],
  ['confidence','Уверенность'],['learnability','Обучаемость'],['attentiveness','Внимательность'],
  ['emotional_balance','Уравновешенность'],['goal_orientation','Целеустремлённость'],
  ['activity','Активность'],['self_defense','Самозащита'],
]

function qualityRows(
  a: Record<string, any>,
  b: Record<string, any>,
  prefix: 'q_' | 'trainer_'
): string {
  return QUALITIES
    .map(([k, lbl]) => {
      const before = a[`${prefix}${k}`] ?? null
      const after  = b[`${prefix}${k}`] ?? null
      if (before == null && after == null) return null
      const diff = before != null && after != null ? after - before : null
      const arrow = diff == null ? '' : diff > 0 ? ` ↑+${diff}` : diff < 0 ? ` ↓${diff}` : ' ='
      return `  ${lbl}: ${before ?? '—'} → ${after ?? '—'}${arrow}`
    })
    .filter(Boolean)
    .join('\n')
}

function singleSnapshot(s: Record<string, any>, prefix: 'q_' | 'trainer_'): string {
  return QUALITIES
    .map(([k, lbl]) => {
      const v = s[`${prefix}${k}`]
      return v != null ? `  ${lbl}: ${v}/10` : null
    })
    .filter(Boolean)
    .join('\n')
}

function surveyLabel(s: Record<string, any>, idx: number): string {
  return s.title || (idx === 0 ? 'Срез 1' : `Срез ${idx + 1}`)
}

export async function POST(req: NextRequest) {
  // New signature: { survey1, surveys, studentName }
  // survey1 = initial diagnostic (анкета 1)
  // surveys  = array of filled progress surveys, sorted asc by filled_at/created_at
  // Legacy: { survey1, survey2, studentName } also supported
  const body = await req.json()
  const { survey1, studentName } = body

  // Normalise: accept either `surveys` array or legacy `survey2`
  const surveys: Record<string, any>[] = Array.isArray(body.surveys)
    ? body.surveys
    : body.survey2
      ? [body.survey2]
      : []

  if (!surveys.length) {
    return NextResponse.json({ error: 'Нет данных срезов' }, { status: 400 })
  }

  const first  = surveys[0]
  const latest = surveys[surveys.length - 1]
  const prev   = surveys.length >= 2 ? surveys[surveys.length - 2] : null

  // ── Section 1: Диагностика → Первый срез (parent + trainer) ─────────────
  const hasDiag = survey1 != null
  const diagToFirstParent  = hasDiag ? qualityRows(survey1, first, 'q_') : ''
  const diagToFirstTrainer = hasDiag ? qualityRows(survey1, first, 'trainer_') : ''

  // ── Section 2: Последние два среза (если их > 1) ─────────────────────────
  let recentBlock = ''
  if (prev) {
    const prevLabel   = surveyLabel(prev, surveys.length - 2)
    const latestLabel = surveyLabel(latest, surveys.length - 1)
    const recentParent  = qualityRows(prev, latest, 'q_')
    const recentTrainer = qualityRows(prev, latest, 'trainer_')
    recentBlock = `
## НЕДАВНЯЯ ДИНАМИКА: ${prevLabel} → ${latestLabel}

Оценки родителя:
${recentParent || '— нет данных —'}

Оценки тренера:
${recentTrainer || '— нет данных —'}
`
  }

  // ── Section 3: Общая динамика (первый срез → последний) ──────────────────
  let overallBlock = ''
  if (surveys.length >= 2) {
    const overallParent  = qualityRows(first, latest, 'q_')
    const overallTrainer = qualityRows(first, latest, 'trainer_')
    overallBlock = `
## ОБЩАЯ ДИНАМИКА: ${surveyLabel(first, 0)} → ${surveyLabel(latest, surveys.length - 1)} (всего ${surveys.length} среза)

Оценки родителя:
${overallParent || '— нет данных —'}

Оценки тренера:
${overallTrainer || '— нет данных —'}
`
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const hasManySlices = surveys.length >= 2

  const diagBlock = hasDiag ? `## НАЧАЛЬНАЯ ДИАГНОСТИКА → ПЕРВЫЙ СРЕЗ

Оценки родителя:
${diagToFirstParent || '— нет данных —'}

Оценки тренера:
${diagToFirstTrainer || '— нет данных —'}

Ожидания семьи: ${survey1.how_can_help_text || '—'}
Заметки тренера (начало): ${survey1.trainer_notes || '—'}
Заметки тренера (первый срез): ${first.trainer_notes || '—'}
` : `## СРЕЗ ПРОГРЕССА (начальная диагностика отсутствует)

Оценки родителя (текущий срез):
${singleSnapshot(latest, 'q_') || '— нет данных —'}

Оценки тренера (текущий срез):
${singleSnapshot(latest, 'trainer_') || '— нет данных —'}

Заметки тренера: ${latest.trainer_notes || '—'}
`

  const prompt = `Ты опытный тренер по айкидо айкикай в клубе "Школа Самурая".

Ученик: ${studentName}
Количество срезов прогресса: ${surveys.length}

${diagBlock}${recentBlock}${overallBlock}
Составь анализ прогресса в формате:

**Что изменилось${hasManySlices ? ' в последнее время' : ' за первый месяц'}**
(3-4 конкретных наблюдения с опорой на цифры — что выросло, что осталось, что снизилось)

${hasManySlices ? `**Общий путь за всё время**
(2-3 наблюдения о долгосрочной динамике от начала до сейчас)

` : ''
}**Главные достижения**
(2-3 пункта — что реально получилось)

**На что обратить внимание**
(2-3 зоны, требующие работы в следующем периоде)

**Программа на следующий месяц**
Неделя 1: (фокус и задачи)
Неделя 2: (фокус и задачи)
Неделя 3: (фокус и задачи)
Неделя 4: (фокус и задачи)

**Слова для родителей**
(2-3 предложения — тёплый, конкретный фидбэк о том, что они могут заметить дома)

Пиши живо, по-русски, тепло и профессионально. Опирайся на конкретные цифры.`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://samurai-crm-app.vercel.app',
        'X-Title': 'Школа Самурая CRM',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('OpenRouter error:', response.status, JSON.stringify(data))
      return NextResponse.json({ error: `Ошибка AI (${response.status}): ${data.error?.message || JSON.stringify(data)}` }, { status: 500 })
    }

    const text = data.choices?.[0]?.message?.content || ''
    return NextResponse.json({ program: text })
  } catch (e) {
    console.error('OpenRouter fetch error:', e)
    return NextResponse.json({ error: 'Не удалось подключиться к AI: ' + String(e) }, { status: 500 })
  }
}
