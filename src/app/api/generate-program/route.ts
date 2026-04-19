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

// Words for "Слово месяца" — rotating by current month
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
  const month = new Date().getMonth()
  return AIKIDO_WORDS[month % AIKIDO_WORDS.length]
}

function qualitiesBlock(survey: Record<string, any>): string {
  return QUALITIES
    .filter(([k]) => survey[`q_${k}`] != null || survey[`trainer_${k}`] != null)
    .map(([k, lbl]) => {
      const parent = survey[`q_${k}`] ?? '—'
      const trainer = survey[`trainer_${k}`] ?? '—'
      const diff = (survey[`q_${k}`] != null && survey[`trainer_${k}`] != null)
        ? survey[`trainer_${k}`] - survey[`q_${k}`]
        : null
      const note = diff != null && Math.abs(diff) >= 2
        ? diff > 0 ? ' (тренер видит лучше)' : ' (родитель видит лучше)'
        : ''
      return `  ${lbl}: родитель=${parent}/10, тренер=${trainer}/10${note}`
    })
    .join('\n')
}

function groupContext(group: string | null): string {
  if (!group) return ''
  if (group.includes('Старт')) return 'Группа "Старт" — младший возраст, акцент на игровую форму, базовые укэми, дисциплину и радость от движения.'
  if (group.includes('нач')) return 'Группа "Основная (нач.)" — базовый уровень, изучение основных техник айкидо, работа с партнёром.'
  if (group.includes('оп')) return 'Группа "Основная (оп.)" — продвинутый уровень, шлифовка техники, работа с оружием.'
  if (group.includes('Цигун')) return 'Группа "Цигун" — акцент на плавность, дыхание, внутреннюю работу.'
  if (group.includes('Индив')) return 'Индивидуальные занятия — персональная программа под цели ученика.'
  return ''
}

export async function POST(req: NextRequest) {
  const { survey, studentContext } = await req.json()
  const wordOfMonth = getWordOfMonth()

  const ctx = studentContext || {}
  const ageStr = ctx.age ? `${ctx.age} лет` : '—'
  const tenureStr = ctx.tenureMonths != null
    ? ctx.tenureMonths === 0 ? 'первый месяц' : `${ctx.tenureMonths} мес. в школе`
    : '—'
  const groupStr = ctx.group || survey.group_name || '—'
  const groupCtx = groupContext(ctx.group || survey.group_name)

  const heightStr = survey.height_cm != null ? `${survey.height_cm} см` : '—'
  const weightStr = survey.weight_kg != null ? `${survey.weight_kg} кг` : '—'
  const bmiStr = survey.height_cm != null && survey.weight_kg != null
    ? (() => {
        const bmi = survey.weight_kg / (survey.height_cm / 100) ** 2
        const cat = bmi < 18.5 ? 'дефицит веса' : bmi < 25 ? 'норма' : bmi < 30 ? 'избыточный вес' : 'ожирение'
        return `${bmi.toFixed(1)} (${cat})`
      })()
    : '—'

  const prompt = `Ты — Старший Наставник Школы Самурая, опытный тренер по айкидо айкикай и ушу. Твой стиль: тёплый, конкретный, уважительный.

СТИЛИ ШКОЛЫ (важно для терминологии и техник):
- Айкидо: стиль Айкикай — используй терминологию и техники именно этого направления (Иккё, Никё, Санкё, Котэгаэши, Иримinage, Шихонаге, Тенчинаге и др.)
- Ушу: стиль Шаолиньцуань (северный Шаолинь) — акцент на стойки Мабу и Гунбу, базовый комплекс Цзибэньгун, прыжки, удары ногами, акробатика.

КОНТЕКСТ УЧЕНИКА:
- Имя: ${survey.student_name || '—'}
- Возраст: ${ageStr}
- Группа: ${groupStr}
- Стаж: ${tenureStr}
- Рост: ${heightStr}
- Вес: ${weightStr}
- ИМТ: ${bmiStr}
${groupCtx ? `- Специфика группы: ${groupCtx}` : ''}
- Травмы/операции: ${survey.injuries_text || 'нет'}
- Противопоказания: ${survey.contraindications_text || 'нет'}
- Другие секции: ${survey.other_activities_text || 'нет'}
- Предыдущий спорт: ${survey.prev_sport_text || 'нет'}
- Особенности характера: ${survey.character_notes_text || '—'}
- Ожидания семьи: ${survey.how_can_help_text || '—'}

ОЦЕНКИ 16 КАЧЕСТВ (шкала 1–10):
${qualitiesBlock(survey)}

ЗАМЕТКИ ТРЕНЕРА С ПРОБНОГО ЗАНЯТИЯ:
${survey.trainer_notes || '—'}

---

ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА (нарушение недопустимо):

1. ЗАДАНИЯ: Придумай ровно 3 домашних задания. Эти же 3 задания (дословно) войдут в оба документа.
   - Каждое задание: айкидо-термин или конкретное движение + точное время/повторения + кто выполняет (один/с родителем).
   - ЗАПРЕЩЕНО: "растяжка мышц", "медитация", "упражнения на баланс" — только конкретика.
   - Хорошие примеры: "Стойка Ханми — встань перед зеркалом в левостороннюю боевую стойку, удерживай 30 сек, 5 раз. Один.", "Поклон Рэй — перед сном сделай поклон как в додзё, вспомни одно хорошее за день. Один."

2. КУХНЯ САМУРАЯ: Конкретный продукт или привычка, напрямую связанные с главной целью месяца + объяснение зачем.
   - Пример для выносливости: "Гречка или овсянка за 1.5 часа до тренировки — медленные углеводы дают равномерную энергию на весь зал."
   - Пример для концентрации: "5-7 грецких орехов в день — омега-3 помогает мозгу быстрее запоминать новые движения."
   - ЗАПРЕЩЕНО: "ешьте больше овощей и фруктов" и любые общие советы.

3. СТИЛЬ ЗАДАНИЙ: Обращайся к ученику напрямую ("ты", "встань", "сделай"), не в третьем лице.

4. ТЕХНИЧЕСКИЙ ФОКУС: Называй конкретные техники айкидо (Укэми, Иккё, Никё, Тенкан, Ирими, Ханми, Сикко, Рэйги и т.д.), не общие "стойки и перемещения".

5. ПОРТРЕТ УЧЕНИКА: Опирайся на заметки тренера и характеристику — найди один конкретный образ или момент, не пиши шаблонно.

---

Составь два документа строго в этом формате:

═══════════════════════════════
📋 КАРТОЧКА ТРЕНЕРА
═══════════════════════════════

**Портрет ученика**
(2–3 предложения: кто перед нами, что выделяется, конкретный образ из заметок)

**Сильные стороны — на что опираемся**
(2–3 качества с высоким баллом — как использовать их в тренировках)

**Технический фокус на первый месяц**
(2–3 конкретные техники/элемента айкидо с пояснением зачем именно они)

**Зоны развития — план действий**
(2–3 качества с низким баллом + что конкретно делать на тренировке: упражнения, игры, подходы)

**3 домашних задания** *(одобри или скорректируй перед публикацией)*
Задание 1: [название] — [точное описание, время, один/с родителем]
Задание 2: [название] — [точное описание, время, один/с родителем]
Задание 3: [название] — [точное описание, время, один/с родителем]

═══════════════════════════════
💌 ПИСЬМО РОДИТЕЛЯМ
═══════════════════════════════

**Путь начался**
(2–3 предложения — конкретный момент или образ с первого занятия, не абстракция)

**Слово месяца: ${wordOfMonth.word}**
«${wordOfMonth.meaning}»
(1–2 предложения — как это слово уже проявляется в вашем ребёнке)

**Домашние задания на месяц** *(те же 3 задания что в карточке тренера, слово в слово)*
Задание 1: ...
Задание 2: ...
Задание 3: ...

**Кухня Самурая**
(1 конкретный совет под цель месяца — продукт/привычка + почему именно это)

**Что заметить дома**
(2–3 конкретных изменения в поведении ребёнка, которые появятся по мере занятий)

Пиши живо, по-русски. Карточку тренера — профессионально. Письмо родителям — тепло, как от живого человека, который знает этого ребёнка.

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
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
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
