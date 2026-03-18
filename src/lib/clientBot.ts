// Клиентский Telegram-бот — утилиты для отправки сообщений родителям

const CLIENT_BOT_TOKEN = process.env.TELEGRAM_CLIENT_BOT_TOKEN!
const CLIENT_BOT_USERNAME = process.env.TELEGRAM_CLIENT_BOT_USERNAME!

export async function sendClientMessage(chat_id: number | string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${CLIENT_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
  })
  return res.json()
}

// Генерирует ссылку-приглашение для родителя
export function getInviteLink(token: string) {
  return `https://t.me/${CLIENT_BOT_USERNAME}?start=${token}`
}

// Шаблоны сообщений
export const messages = {
  surveyNewcomer: (name: string, link: string) =>
    `Здравствуйте! 👋\n\nВы записались на пробное занятие в <b>Школе Самурая</b>.\n\nЧтобы тренер подготовил индивидуальную программу для <b>${name}</b>, пожалуйста, уделите 5 минут и заполните анкету:\n\n📋 <a href="${link}">Заполнить анкету</a>\n\nЭто поможет нам лучше понять цели и особенности ребёнка.`,

  trialReminder: (name: string, date: string, time: string) =>
    `⏰ Напоминание!\n\nСегодня в <b>${time}</b> пробное занятие <b>${name}</b> в Школе Самурая.\n\nЖдём вас! 🥋`,

  programReady: (name: string) =>
    `✅ Тренер подготовил индивидуальную программу для <b>${name}</b>!\n\nПрограмма основана на результатах анкеты и диагностики на пробном занятии. Посмотрите её в приложении или дождитесь звонка тренера.`,

  subscriptionEnding: (name: string, lessonsLeft: number) =>
    `📋 У <b>${name}</b> заканчивается абонемент.\n\nОсталось занятий: <b>${lessonsLeft}</b>\n\nНе забудьте продлить абонемент, чтобы не прерывать тренировки. По вопросам оплаты свяжитесь с администратором.`,

  subscriptionExpired: (name: string) =>
    `⚠️ Абонемент <b>${name}</b> закончился.\n\nДля продолжения занятий необходимо оплатить новый абонемент. Свяжитесь с администратором Школы Самурая.`,

  progressSurvey: (name: string, link: string) =>
    `🥋 Прошёл первый месяц занятий <b>${name}</b> в Школе Самурая!\n\nПора сделать срез прогресса. Это займёт 3-4 минуты:\n\n📋 <a href="${link}">Заполнить анкету прогресса</a>\n\nПо итогам тренер подготовит новую программу на следующие 3 месяца.`,
}
