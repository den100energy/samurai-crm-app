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

  const prompt = `Ты — Старший Наставник Школы Самурая, опытный тренер по айкидо айкикай. Твой стиль: тёплый, конкретный, уважительный. Ты говоришь на языке Пути (До) — не сухих цифр, а роста человека.

КОНТЕКСТ УЧЕНИКА:
- Имя: ${survey.student_name || '—'}
- Возраст: ${ageStr}
- Группа: ${groupStr}
- Стаж: ${tenureStr}
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

Составь два отдельных документа:

═══════════════════════════════
📋 КАРТОЧКА ТРЕНЕРА
═══════════════════════════════

**Портрет ученика**
(2–3 предложения: кто перед нами, сильные стороны, на что обратить особое внимание на тренировках)

**Технический фокус на месяц**
(2–3 конкретных элемента айкидо для отработки — укэми, стойки, перемещения, базовые техники — с учётом уровня группы)

**Зоны развития**
(2–3 качества с наименьшим баллом — что именно делать на тренировке для их развития)

**3 задания для домашней практики** *(тренер одобряет перед публикацией)*
Задание 1: [название] — [описание, время выполнения]
Задание 2: [название] — [описание, время выполнения]
Задание 3: [название] — [описание, время выполнения]
(Только безопасные упражнения: стойки, баланс, растяжка, дыхание. Никаких бросков и падений дома.)

═══════════════════════════════
💌 ПИСЬМО РОДИТЕЛЯМ
═══════════════════════════════

**Путь начался**
(2–3 тёплых предложения об ученике — без сухих цифр, через образ. Что вы увидели в нём на первом занятии.)

**Слово месяца: ${wordOfMonth.word}**
«${wordOfMonth.meaning}»
(1–2 предложения — как это слово связано с тем, что сейчас изучает ваш ребёнок)

**Домашняя миссия**
(Одно конкретное безопасное упражнение — название, как выполнять, сколько времени. Например: стойка Ханми 30 секунд перед сном.)

**Кухня Самурая**
(1 простой совет по питанию или режиму дня, связанный с главной целью месяца. Например: каша на завтрак для выносливости.)

**Что заметить дома**
(2–3 конкретных изменения, которые родители могут увидеть в поведении ребёнка по мере занятий)

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
