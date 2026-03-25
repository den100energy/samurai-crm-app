// Все тексты онбординга в одном месте — легко редактировать

const STORAGE_KEY = 'samurai_hints_seen'

export function isHintSeen(id: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return seen.includes(id)
  } catch {
    return false
  }
}

export function markHintSeen(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!seen.includes(id)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen, id]))
    }
  } catch {}
}

export function resetAllHints(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('samurai_cabinet_tour_done')
  localStorage.removeItem('samurai_parent_tour_done')
}

// ─── Тексты подсказок для CRM ───────────────────────────────────────────────

export const HINTS = {
  dashboard_welcome: {
    title: 'Добро пожаловать в Самурай CRM!',
    text: 'Это главный дашборд. Здесь видно всё сразу — ученики, абонементы, воронка лидов. Начни с добавления первого ученика в разделе «Ученики».',
  },
  students_list: {
    title: '🥋 Список учеников',
    text: 'Здесь все ученики школы. Нажми «+ Добавить», чтобы внести первого ученика. В карточке ученика — абонементы, посещения, прогресс и контакты.',
  },
  attendance: {
    title: '✅ Отметка посещений',
    text: 'Выбери дату и отметь кто пришёл на тренировку. Занятия списываются с абонемента автоматически. Можно отмечать задним числом.',
  },
  leads: {
    title: '📋 Воронка лидов',
    text: 'Здесь заявки с пробных занятий. Переводи лида по этапам: Новый → Пробное → Думает → Оплатил. После оплаты конвертируй в ученика одной кнопкой.',
  },
  finance: {
    title: '💰 Финансы',
    text: 'Записывай все поступления и расходы школы. Можно привязать платёж к конкретному ученику. Аналитика по месяцам доступна в разделе «Аналитика».',
  },
  tickets: {
    title: '📝 Обращения',
    text: 'Сюда приходят сообщения от учеников и родителей — болезни, переносы, вопросы. Возьми в работу и отметь как решено.',
  },
  trainer_cabinet: {
    title: '👤 Твой кабинет тренера',
    text: 'Здесь твои ученики, расписание и задачи. Если у кого-то из учеников давно не было среза прогресса — увидишь список внизу. Контакты можно обновить в настройках.',
  },
} as const

export type HintId = keyof typeof HINTS

// ─── Слайды туров для кабинетов ─────────────────────────────────────────────

export const CABINET_TOUR_SLIDES = [
  {
    tab: 'home',
    icon: '🏠',
    title: 'Главная',
    text: 'Расписание тренировок, статус абонемента и сегодняшняя тренировка. Всё самое важное на одном экране.',
  },
  {
    tab: 'progress',
    icon: '📈',
    title: 'Прогресс',
    text: 'Оценки тренера по 16 качествам — смотри как растёшь со временем. Появляется после первого среза.',
  },
  {
    tab: 'tasks',
    icon: '✅',
    title: 'Задания',
    text: 'Тренер даёт задания на дом. Отмечай выполненные — тренер это видит.',
  },
  {
    tab: 'achievements',
    icon: '🏆',
    title: 'Достижения',
    text: 'Пояса, соревнования, семинары и история твоего пути в Школе Самурая.',
  },
  {
    tab: 'tickets',
    icon: '📝',
    title: 'Связь с тренером',
    text: 'Напиши тренеру если заболел, хочешь перенести занятие или есть вопрос. Ответ придёт сюда.',
  },
]

export const PARENT_TOUR_SLIDES = [
  {
    tab: 'sub',
    icon: '💳',
    title: 'Абонемент',
    text: 'Сколько занятий осталось и когда заканчивается абонемент. Здесь видно текущий статус.',
  },
  {
    tab: 'attendance',
    icon: '📅',
    title: 'Посещения',
    text: 'Календарь посещений — когда ребёнок был на тренировках за последние 3 месяца.',
  },
  {
    tab: 'progress',
    icon: '📈',
    title: 'Прогресс',
    text: 'Оценки тренера по 16 качествам и динамика развития ребёнка. Появляется после первого среза.',
  },
  {
    tab: 'tickets',
    icon: '📝',
    title: 'Связь с тренером',
    text: 'Напишите тренеру напрямую — болезнь, вопрос, перенос занятия. Отвечаем быстро.',
  },
]
