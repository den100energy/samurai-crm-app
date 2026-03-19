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
  const { survey } = await req.json()

  // Build qualities comparison table
  const qualitiesText = QUALITIES
    .filter(([k]) => survey[`q_${k}`] != null || survey[`trainer_${k}`] != null)
    .map(([k, lbl]) => {
      const parent = survey[`q_${k}`] ?? '—'
      const trainer = survey[`trainer_${k}`] ?? '—'
      return `  ${lbl}: родитель=${parent}/10, тренер=${trainer}/10`
    }).join('\n')

  const prompt = `Ты опытный тренер по айкидо айкикай в клубе "Школа Самурая". Клуб также ведёт ушу как факультатив.

Тебе нужно составить персональную программу развития на 1 месяц для нового ученика на основе данных диагностики.

ДАННЫЕ УЧЕНИКА:
- Имя: ${survey.student_name || '—'}
- Возраст: ${survey.student_age || '—'}
- Травмы/операции: ${survey.injuries_text || 'нет'}
- Противопоказания: ${survey.contraindications_text || 'нет'}
- Другие секции: ${survey.other_activities_text || 'нет'}
- Предыдущий спорт: ${survey.prev_sport_text || 'нет'}
- Особенности характера: ${survey.character_notes_text || '—'}
- Ожидания семьи: ${survey.how_can_help_text || '—'}

ОЦЕНКИ 15 КАЧЕСТВ (шкала 1-10):
${qualitiesText}

ЗАМЕТКИ ТРЕНЕРА С ПРОБНОГО ЗАНЯТИЯ:
${survey.trainer_notes || '—'}

Составь программу в следующем формате:

**Анализ ученика**
(2-3 предложения: кто перед нами, что выделяется, общее впечатление)

**Сильные стороны**
(2-3 пункта — на что опираемся)

**Зоны развития**
(2-3 приоритетных направления с объяснением почему)

**Программа на 1 месяц**
Неделя 1: (фокус и задачи)
Неделя 2: (фокус и задачи)
Неделя 3: (фокус и задачи)
Неделя 4: (фокус и задачи)

**Рекомендации для родителей**
(3-4 конкретных совета что делать дома или на что обращать внимание)

Пиши живо, по-русски, тепло и профессионально. Не используй шаблонные фразы. Учитывай специфику айкидо айкикай — принципы ненасилия, работа с балансом, партнёрское взаимодействие.`

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
