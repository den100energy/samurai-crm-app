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

  // Physical metrics from latest survey with height/weight
  const latestPhys = [...surveys].reverse().find((s: Record<string, any>) => s.height_cm != null || s.weight_kg != null)
  const heightStr = latestPhys?.height_cm != null ? `${latestPhys.height_cm} см` : '—'
  const weightStr = latestPhys?.weight_kg != null ? `${latestPhys.weight_kg} кг` : '—'
  const bmiStr = latestPhys?.height_cm != null && latestPhys?.weight_kg != null
    ? (() => {
        const bmi = latestPhys.weight_kg / (latestPhys.height_cm / 100) ** 2
        const cat = bmi < 18.5 ? 'дефицит веса' : bmi < 25 ? 'норма' : bmi < 30 ? 'избыточный вес' : 'ожирение'
        return `${bmi.toFixed(1)} (${cat})`
      })()
    : '—'

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

  const prompt = `Ты — Старший Наставник Школы Самурая, опытный тренер по айкидо айкикай и ушу. Твой стиль: тёплый, конкретный, уважительный.

СТИЛИ ШКОЛЫ (важно для терминологии и техник):
- Айкидо: стиль Айкикай — используй терминологию и техники именно этого направления (Иккё, Никё, Санкё, Котэгаэши, Иримinage, Шихонаге, Тенчинаге и др.)
- Ушу: стиль Шаолиньцуань (северный Шаолинь) — акцент на стойки Мабу и Гунбу, базовый комплекс Цзибэньгун, прыжки, удары ногами, акробатика.

КОНТЕКСТ УЧЕНИКА:
- Имя: ${studentName || '—'}
- Возраст: ${ageStr}
- Группа: ${groupStr}
- Стаж: ${tenureStr}
- Всего посещений: ${attendanceStr}
- Рост: ${heightStr}
- Вес: ${weightStr}
- ИМТ: ${bmiStr}
${groupCtx ? `- Специфика группы: ${groupCtx}` : ''}
- Количество срезов: ${surveys.length}

ДАННЫЕ ПРОГРЕССА:
${diagBlock}${recentBlock}${overallBlock}

---

ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА (нарушение недопустимо):

1. ЗАДАНИЯ: Придумай ровно 3 домашних задания. Эти же 3 задания (дословно) войдут в оба документа.
   - Каждое задание должно содержать: айкидо-термин или конкретное движение, точное время/количество повторений, кто помогает (один/с родителем).
   - ЗАПРЕЩЕНО: "растяжка основных групп мышц", "медитация", "упражнения на баланс" — только конкретика.
   - Примеры хороших заданий: "Стойка Ханми — встань в левостороннюю боевую стойку перед зеркалом, удерживай 30 сек, 5 раз. Один.", "Поклон Рэй — перед сном сделай поклон как в додзё, думая о чём-то хорошем из дня. Один."

2. КУХНЯ САМУРАЯ: Совет должен быть напрямую связан с качеством которое мы развиваем в этом месяце.
   - Если цель — выносливость: "Тарелка каши (овсянка или гречка) за 1.5 часа до тренировки даст энергию на весь зал."
   - Если цель — концентрация: "Грецкие орехи — 5-7 штук в день. Омега-3 питает мозг и помогает запоминать техники."
   - ЗАПРЕЩЕНО: "ешьте больше овощей и фруктов" и другие общие советы.

3. КАЧЕСТВА СО СНИЖЕНИЕМ: Если какое-то качество снизилось — в карточке тренера напиши конкретный план (что именно делать на тренировке). В письме родителям — сформулируй как зону роста, не как проблему.

4. СТИЛЬ ЗАДАНИЙ ДЛЯ УЧЕНИКА: Пиши обращаясь к ученику напрямую ("ты", "встань", "попробуй"), не в третьем лице.

5. ТЕХНИЧЕСКИЙ ФОКУС: Используй конкретные техники и термины айкидо (Укэми, Иккё, Тенкан, Ирими, Ханми, Сикко и т.д.), не общие слова.

---

Составь два документа строго в этом формате:

═══════════════════════════════
📋 КАРТОЧКА ТРЕНЕРА
═══════════════════════════════

**Что изменилось${hasManySlices ? ' в последнее время' : ' за первый месяц'}**
(3–4 наблюдения с конкретными цифрами и их интерпретацией)

${hasManySlices ? `**Общий путь за всё время**
(2–3 наблюдения о долгосрочной динамике)

` : ''}**Технический фокус на следующий месяц**
(2–3 конкретные техники/элемента айкидо с пояснением — почему именно они, какую качество прокачивают)

**Реакция на снижение** *(только если есть снижение)*
(Что конкретно делать на тренировке — упражнения, подходы, методы)

**3 домашних задания** *(одобри или скорректируй перед публикацией)*
Задание 1: [название на русском] — [точное описание: поза, время, количество, один или с родителем]
Задание 2: [название на русском] — [точное описание]
Задание 3: [название на русском] — [точное описание]

═══════════════════════════════
💌 ПИСЬМО РОДИТЕЛЯМ
═══════════════════════════════

**Путь Самурая**
(2–3 предложения — конкретный момент или образ, который запомнился тренеру. Не абстракции.)

**Главные достижения**
(2–3 пункта — конкретные успехи этого месяца)

**Слово месяца: ${wordOfMonth.word}**
«${wordOfMonth.meaning}»
(1–2 предложения — конкретный пример из тренировок этого ученика, где это слово проявилось)

**Домашние задания на месяц** *(те же 3 задания что в карточке тренера, слово в слово)*
Задание 1: ...
Задание 2: ...
Задание 3: ...

**Кухня Самурая**
(1 конкретный совет под цель месяца — продукт/привычка + объяснение зачем именно это)

**На что обратить внимание**
(2–3 пункта для родителей — позитивно, без термина "снижение", только зоны роста)

Пиши живо, по-русски. Карточку тренера — профессионально. Письмо родителям — тепло, как от живого человека.

---

После обоих документов добавь блок с заданиями в JSON (ровно те же 3 задания из "Карточки тренера", дословно):

## TASKS_JSON
[
  {"title": "Название задания 1", "description": "Полное описание: движение, время/повторения, один или с родителем"},
  {"title": "Название задания 2", "description": "..."},
  {"title": "Название задания 3", "description": "..."}
]`

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

    const raw = data.choices?.[0]?.message?.content || ''
    // Split program text and JSON tasks block
    const jsonMarker = '## TASKS_JSON'
    const markerIdx = raw.indexOf(jsonMarker)
    const program = markerIdx >= 0 ? raw.slice(0, markerIdx).trimEnd() : raw
    let tasks: { title: string; description: string }[] = []
    if (markerIdx >= 0) {
      try {
        const jsonStr = raw.slice(markerIdx + jsonMarker.length).trim()
        const arr = JSON.parse(jsonStr)
        if (Array.isArray(arr)) tasks = arr.slice(0, 3)
      } catch { /* ignore parse errors */ }
    }
    return NextResponse.json({ program, tasks })
  } catch (e) {
    console.error('OpenRouter fetch error:', e)
    return NextResponse.json({ error: 'Не удалось подключиться к AI: ' + String(e) }, { status: 500 })
  }
}
