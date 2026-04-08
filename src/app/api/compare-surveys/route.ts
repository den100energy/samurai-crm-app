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

const AIKIDO_WORDS = [
  { word: 'Рэйги', meaning: 'этикет и уважение — основа всех отношений в додзё' },
  { word: 'Заншин', meaning: 'состояние бдительности после завершения техники' },
  { word: 'Укэми', meaning: 'искусство безопасного падения — первый навык самозащиты' },
  { word: 'Маай', meaning: 'правильная дистанция между партнёрами' },
  { word: 'Ки', meaning: 'внутренняя энергия, которую мы учимся направлять' },
  { word: 'Ханми', meaning: 'боевая стойка — основа всех движений' },
  { word: 'Ирими', meaning: 'вход — движение навстречу, а не уклонение' },
  { word: 'Тенкан', meaning: 'разворот — перенаправление силы партнёра' },
  { word: 'Сикко', meaning: 'перемещение на коленях — развивает баланс и терпение' },
  { word: 'Кокю', meaning: 'дыхание — связь тела и духа' },
  { word: 'Досу', meaning: 'путь — не только в додзё, но и в жизни' },
  { word: 'Мусуби', meaning: 'единение — слияние движений с партнёром' },
]

function getWordOfMonth(): { word: string; meaning: string } {
  return AIKIDO_WORDS[new Date().getMonth() % AIKIDO_WORDS.length]
}

function qualityRows(a: Record<string, any>, b: Record<string, any>, prefix: 'q_' | 'trainer_'): string {
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

function groupContext(group: string | null): string {
  if (!group) return ''
  if (group.includes('Старт')) return 'Группа "Старт" — младший возраст, игровая форма, базовые укэми и дисциплина.'
  if (group.includes('нач')) return 'Группа "Основная (нач.)" — базовый уровень, основные техники айкидо.'
  if (group.includes('оп')) return 'Группа "Основная (оп.)" — продвинутый уровень, шлифовка техники, оружие.'
  if (group.includes('Цигун')) return 'Группа "Цигун" — плавность, дыхание, внутренняя работа.'
  return ''
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { survey1, studentName, studentContext } = body
  const wordOfMonth = getWordOfMonth()

  const surveys: Record<string, any>[] = Array.isArray(body.surveys)
    ? body.surveys
    : body.survey2 ? [body.survey2] : []

  if (!surveys.length) {
    return NextResponse.json({ error: 'Нет данных срезов' }, { status: 400 })
  }

  const first  = surveys[0]
  const latest = surveys[surveys.length - 1]
  const prev   = surveys.length >= 2 ? surveys[surveys.length - 2] : null
  const hasDiag = survey1 != null
  const hasManySlices = surveys.length >= 2

  const ctx = studentContext || {}
  const ageStr = ctx.age ? `${ctx.age} лет` : '—'
  const tenureStr = ctx.tenureMonths != null
    ? ctx.tenureMonths === 0 ? 'первый месяц' : `${ctx.tenureMonths} мес. в школе`
    : '—'
  const groupStr = ctx.group || '—'
  const groupCtx = groupContext(ctx.group)
  const attendanceStr = ctx.totalAttendance != null ? `${ctx.totalAttendance} занятий` : '—'

  // Build data blocks
  const diagBlock = hasDiag ? `## НАЧАЛЬНАЯ ДИАГНОСТИКА → ПЕРВЫЙ СРЕЗ

Оценки родителя:
${qualityRows(survey1, first, 'q_') || '— нет данных —'}

Оценки тренера:
${qualityRows(survey1, first, 'trainer_') || '— нет данных —'}

Ожидания семьи: ${survey1.how_can_help_text || '—'}
Заметки тренера (начало): ${survey1.trainer_notes || '—'}
Заметки тренера (срез): ${first.trainer_notes || '—'}
` : `## ТЕКУЩИЙ СРЕЗ (начальная диагностика отсутствует)

Оценки родителя:
${singleSnapshot(latest, 'q_') || '— нет данных —'}

Оценки тренера:
${singleSnapshot(latest, 'trainer_') || '— нет данных —'}

Заметки тренера: ${latest.trainer_notes || '—'}
`

  const recentBlock = prev ? `
## НЕДАВНЯЯ ДИНАМИКА: ${surveyLabel(prev, surveys.length - 2)} → ${surveyLabel(latest, surveys.length - 1)}

Оценки родителя:
${qualityRows(prev, latest, 'q_') || '— нет данных —'}

Оценки тренера:
${qualityRows(prev, latest, 'trainer_') || '— нет данных —'}
` : ''

  const overallBlock = hasManySlices ? `
## ОБЩАЯ ДИНАМИКА: ${surveyLabel(first, 0)} → ${surveyLabel(latest, surveys.length - 1)} (всего ${surveys.length} среза)

Оценки родителя:
${qualityRows(first, latest, 'q_') || '— нет данных —'}

Оценки тренера:
${qualityRows(first, latest, 'trainer_') || '— нет данных —'}
` : ''

  const prompt = `Ты — Старший Наставник Школы Самурая, опытный тренер по айкидо айкикай. Твой стиль: тёплый, конкретный, уважительный. Ты говоришь на языке Пути (До) — не сухих цифр, а роста человека.

КОНТЕКСТ УЧЕНИКА:
- Имя: ${studentName || '—'}
- Возраст: ${ageStr}
- Группа: ${groupStr}
- Стаж: ${tenureStr}
- Всего посещений: ${attendanceStr}
${groupCtx ? `- Специфика группы: ${groupCtx}` : ''}
- Количество срезов: ${surveys.length}

ДАННЫЕ ПРОГРЕССА:
${diagBlock}${recentBlock}${overallBlock}

---

Составь два отдельных документа:

═══════════════════════════════
📋 КАРТОЧКА ТРЕНЕРА
═══════════════════════════════

**Что изменилось${hasManySlices ? ' в последнее время' : ' за первый месяц'}**
(3–4 конкретных наблюдения с опорой на цифры — что выросло, что осталось, что снизилось)

${hasManySlices ? `**Общий путь за всё время**
(2–3 наблюдения о долгосрочной динамике от начала до сейчас)

` : ''}**Технический фокус на следующий месяц**
(2–3 конкретных элемента айкидо для отработки — с учётом слабых качеств и уровня группы)

**3 задания для домашней практики** *(тренер одобряет перед публикацией)*
Задание 1: [название] — [описание, время выполнения]
Задание 2: [название] — [описание, время выполнения]
Задание 3: [название] — [описание, время выполнения]
(Только безопасные: стойки, баланс, растяжка, дыхание. Никаких бросков дома.)

═══════════════════════════════
💌 ПИСЬМО РОДИТЕЛЯМ
═══════════════════════════════

**Путь Самурая**
(2–3 предложения об успехах ученика — без сухих цифр, через образ и наблюдение)

**Главные достижения**
(2–3 пункта — что реально получилось за этот период)

**Слово месяца: ${wordOfMonth.word}**
«${wordOfMonth.meaning}»
(1–2 предложения — как это слово отражает то, что сейчас происходит с вашим ребёнком)

**Домашняя миссия**
(Одно конкретное безопасное упражнение — название, как выполнять, сколько времени)

**Кухня Самурая**
(1 простой совет по питанию или режиму, связанный с главной целью следующего месяца)

**На что обратить внимание в следующем месяце**
(2–3 зоны развития — написано для родителей, без жаргона)

Пиши живо, по-русски. Карточку тренера — профессионально и конкретно. Письмо родителям — тепло и вдохновляюще.`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://samurai-crm-app.vercel.app',
        'X-Title': 'Samurai School CRM',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1800,
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
