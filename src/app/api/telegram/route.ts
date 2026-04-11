import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CLIENT_BOT_TOKEN = process.env.TELEGRAM_CLIENT_BOT_TOKEN!
const FINANCE_CHAT_ID = process.env.TELEGRAM_FINANCE_CHAT_ID || ''

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Категории ───────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = [
  'Абонементы', 'Доплата за абон.', 'Мероприятия+', 'Товары+', 'Услуги+',
  'Проб.зан', 'МК+', 'Интенсив+', 'Аттестация+', 'Курсы+',
  'Получение кредита', 'Взнос основателя', 'Поступлений инвестиций',
]

const EXPENSE_CATEGORIES = [
  'АНО Вакикай', 'Аренда', 'Возврат', 'Возврат инвестиций',
  'ГСМ+транспорт', 'Кредит возврат', 'Маркетинг Абонементы',
  'Маркетинг Доп.Продажи', 'Маркетинг Мероп.', 'Налоги',
  'Обслуживание денег', 'Выплата Основателю', 'Промоутеры',
  'Расходники', 'Связь/интернет', 'Сервисы', 'ФОНД ОТ',
  'ФОТ - оклады', 'ФОТ бонус', 'Юрист', 'Мероприятия-', 'Товары-',
]

// ─── Парсинг сообщения ────────────────────────────────────────────────────────

function parseFinanceMessage(text: string) {
  const direction: 'income' | 'expense' = text.startsWith('+') ? 'income' : 'expense'
  const raw = text.slice(1).trim()

  // Извлекаем сумму (первое число, возможно с пробелами внутри)
  const amountMatch = raw.match(/^(\d[\d\s]*)/)
  if (!amountMatch) return null
  const amount = parseInt(amountMatch[1].replace(/\s/g, ''))
  if (!amount || isNaN(amount)) return null

  const rest = raw.slice(amountMatch[1].length).trim()

  // Определяем payment_type по ключевым словам в конце
  let payment_type: 'cash' | 'transfer' = 'cash'
  let cleanRest = rest
  if (/безнал|перевод|карта/i.test(rest)) {
    payment_type = 'transfer'
    cleanRest = rest.replace(/\s*(безнал|перевод|карта)\s*/i, ' ').trim()
  } else if (/нал|наличн/i.test(rest)) {
    cleanRest = rest.replace(/\s*(нал|наличн\w*)\s*/i, ' ').trim()
  }

  // Ищем категорию (сортируем длинные первыми, чтобы "ФОТ - оклады" раньше "ФОТ")
  const categories = direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const normalize = (s: string) => s.toLowerCase().replace(/[-+\s]/g, '')

  let category = ''
  let comment = cleanRest

  for (const cat of [...categories].sort((a, b) => b.length - a.length)) {
    if (normalize(cleanRest).startsWith(normalize(cat))) {
      category = cat
      comment = cleanRest.slice(cat.length).trim().replace(/^[-–,\s]+/, '')
      break
    }
  }

  // Если категория не распознана — весь остаток идёт в комментарий
  if (!category) {
    const words = cleanRest.split(/\s+/)
    category = words[0] || (direction === 'income' ? 'Абонементы' : 'Расходники')
    comment = words.slice(1).join(' ')
  }

  return { direction, amount, category, comment, payment_type }
}

// ─── Telegram API helpers ─────────────────────────────────────────────────────

async function sendMessage(chat_id: number, text: string, reply_markup?: object) {
  await fetch(`https://api.telegram.org/bot${CLIENT_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', reply_markup }),
  })
}

async function editMessage(chat_id: number, message_id: number, text: string) {
  await fetch(`https://api.telegram.org/bot${CLIENT_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, message_id, text, parse_mode: 'HTML' }),
  })
}

async function answerCallback(callback_query_id: string) {
  await fetch(`https://api.telegram.org/bot${CLIENT_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id }),
  })
}

// ─── Финансовый обработчик ────────────────────────────────────────────────────

async function handleFinanceMessage(chat_id: number, text: string, sender: string) {
  const parsed = parseFinanceMessage(text)

  if (!parsed) {
    await sendMessage(chat_id,
      `❌ Не понял формат. Примеры:\n\n` +
      `<code>+ 5700 Абонементы Иванов Иван</code>\n` +
      `<code>- 74160 Аренда апрель</code>\n` +
      `<code>+ 6000 Абонементы Киселев безнал</code>`
    )
    return
  }

  const today = new Date().toISOString().split('T')[0]

  // Сохраняем как pending
  const { data: pending, error } = await supabase.from('payments').insert({
    amount: parsed.amount,
    direction: parsed.direction,
    category: parsed.category,
    description: parsed.comment || null,
    payment_type: parsed.payment_type,
    paid_at: today,
    status: 'pending',
  }).select().single()

  if (error || !pending) {
    await sendMessage(chat_id, '❌ Ошибка сохранения. Попробуй ещё раз.')
    return
  }

  const sign = parsed.direction === 'income' ? '💰 Доход' : '💸 Расход'
  const payLabel = parsed.payment_type === 'cash' ? 'наличные' : 'перевод'
  const dateLabel = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  const confirmText =
    `${sign} · <b>${parsed.amount.toLocaleString()} ₽</b>\n` +
    `📂 ${parsed.category}\n` +
    (parsed.comment ? `💬 ${parsed.comment}\n` : '') +
    `💳 ${payLabel} · 📅 ${dateLabel}\n` +
    `👤 ${sender}`

  await sendMessage(chat_id, confirmText, {
    inline_keyboard: [[
      { text: '✅ Записать', callback_data: `fin_ok:${pending.id}` },
      { text: '❌ Отмена', callback_data: `fin_no:${pending.id}` },
    ]]
  })
}

// ─── Главный обработчик ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()

  // ── Callback query (нажатие кнопки) ─────────────────────────────────────────
  if (body?.callback_query) {
    const cb = body.callback_query
    const data: string = cb.data || ''
    const chat_id: number = cb.message.chat.id
    const message_id: number = cb.message.message_id

    await answerCallback(cb.id)

    if (data.startsWith('fin_ok:')) {
      const id = data.replace('fin_ok:', '')
      const { data: pending } = await supabase
        .from('payments').select('*').eq('id', id).eq('status', 'pending').single()

      if (pending) {
        await supabase.from('payments').update({ status: 'confirmed' }).eq('id', id)
        const sign = pending.direction === 'income' ? '+' : '-'
        await editMessage(chat_id, message_id,
          `✅ <b>Записано</b>\n${sign}${Number(pending.amount).toLocaleString()} ₽ · ${pending.category}` +
          (pending.description ? `\n💬 ${pending.description}` : '')
        )
      } else {
        await editMessage(chat_id, message_id, '⚠️ Запись не найдена или уже обработана')
      }
    }

    if (data.startsWith('fin_no:')) {
      const id = data.replace('fin_no:', '')
      await supabase.from('payments').delete().eq('id', id).eq('status', 'pending')
      await editMessage(chat_id, message_id, '❌ Отменено')
    }

    return NextResponse.json({ ok: true })
  }

  // ── Обычное сообщение ────────────────────────────────────────────────────────
  const message = body?.message
  if (!message) return NextResponse.json({ ok: true })

  const chat_id: number = message.chat.id
  const text: string = message.text || ''
  const firstName = message.from?.first_name || ''

  // Финансовый чат — обрабатываем + и -
  const isFinanceChat = FINANCE_CHAT_ID && String(chat_id) === String(FINANCE_CHAT_ID)
  if (isFinanceChat && (text.startsWith('+') || text.startsWith('-'))) {
    await handleFinanceMessage(chat_id, text, firstName)
    return NextResponse.json({ ok: true })
  }

  // Команда /help в финансовом чате
  if (isFinanceChat && text === '/help') {
    await sendMessage(chat_id,
      `<b>Как записывать операции:</b>\n\n` +
      `<b>Доход:</b>\n<code>+ 5700 Абонементы Иванов Иван</code>\n\n` +
      `<b>Расход:</b>\n<code>- 74160 Аренда апрель</code>\n\n` +
      `<b>Безнал:</b> добавь слово <code>безнал</code>\n` +
      `<code>+ 6000 Абонементы Петров безнал</code>\n\n` +
      `<b>Категории доходов:</b>\n${INCOME_CATEGORIES.join(', ')}\n\n` +
      `<b>Категории расходов:</b>\n${EXPENSE_CATEGORIES.join(', ')}`
    )
    return NextResponse.json({ ok: true })
  }

  // ── Клиентский бот ───────────────────────────────────────────────────────────

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://samurai-crm-app.vercel.app'

  function cabinetButton(url: string, label = '🎒 Открыть личный кабинет') {
    return { inline_keyboard: [[{ text: label, url }]] }
  }

  if (text.startsWith('/start')) {
    const token = text.split(' ')[1]?.trim()

    if (!token) {
      // Уже привязан — показать кабинет(ы)
      const { data: linked } = await supabase
        .from('students').select('name, cabinet_token').eq('telegram_chat_id', chat_id).single()
      if (linked?.cabinet_token) {
        await sendMessage(chat_id,
          `🥋 <b>${linked.name}</b>, добро пожаловать!\n\nШкола Самурая — ваш личный кабинет:`,
          cabinetButton(`${appUrl}/cabinet/${linked.cabinet_token}`)
        )
        return NextResponse.json({ ok: true })
      }
      // Родительские контакты — может быть несколько детей
      const { data: linkedContacts } = await supabase
        .from('student_contacts').select('students(name, cabinet_token)').eq('telegram_chat_id', chat_id)
      const cabinets = (linkedContacts || [])
        .map(c => (c.students as any))
        .filter(s => s?.cabinet_token)
      if (cabinets.length === 1) {
        await sendMessage(chat_id,
          `🥋 Добро пожаловать!\n\nЛичный кабинет <b>${cabinets[0].name}</b>:`,
          cabinetButton(`${appUrl}/cabinet/${cabinets[0].cabinet_token}`)
        )
        return NextResponse.json({ ok: true })
      }
      if (cabinets.length > 1) {
        await sendMessage(chat_id,
          `🥋 Добро пожаловать!\n\nВыберите кабинет:`,
          { inline_keyboard: cabinets.map(s => [{ text: `🎒 ${s.name}`, url: `${appUrl}/cabinet/${s.cabinet_token}` }]) }
        )
        return NextResponse.json({ ok: true })
      }
      await sendMessage(chat_id,
        `Привет, ${firstName}! 👋\n\nЭтот бот отправляет уведомления от Школы Самурая.\n\nДля привязки к карточке ученика используй ссылку от тренера.`
      )
      return NextResponse.json({ ok: true })
    }

    const { data: lead } = await supabase.from('leads').select('id, full_name').eq('invite_token', token).single()
    if (lead) {
      await supabase.from('leads').update({ telegram_chat_id: chat_id }).eq('id', lead.id)
      await sendMessage(chat_id,
        `Привет, ${firstName}! 👋\n\nВы успешно подключены к карточке <b>${lead.full_name}</b>.\n\nТеперь вы будете получать уведомления о занятиях, абонементе и программах развития.`
      )
      return NextResponse.json({ ok: true })
    }

    const { data: student } = await supabase
      .from('students').select('id, name, cabinet_token').eq('invite_token', token).single()
    if (student) {
      await supabase.from('students').update({ telegram_chat_id: chat_id }).eq('id', student.id)
      const markup = student.cabinet_token
        ? cabinetButton(`${appUrl}/cabinet/${student.cabinet_token}`)
        : undefined
      await sendMessage(chat_id,
        `Привет, ${firstName}! 👋\n\nВы успешно подключены к карточке <b>${student.name}</b>.\n\nТеперь вы будете получать уведомления о занятиях и абонементе. 🥋`,
        markup
      )
      return NextResponse.json({ ok: true })
    }

    const { data: contact } = await supabase
      .from('student_contacts').select('id, name, student_id, students(name, cabinet_token)').eq('invite_token', token).single()
    if (contact) {
      await supabase.from('student_contacts').update({ telegram_chat_id: chat_id }).eq('id', contact.id)
      const s = (contact.students as any)
      const studentName = s?.name || 'ученика'
      const markup = s?.cabinet_token
        ? cabinetButton(`${appUrl}/cabinet/${s.cabinet_token}`, '🎒 Кабинет ученика')
        : undefined
      await sendMessage(chat_id,
        `Привет, ${firstName}! 👋\n\nВы успешно подключены как контакт ученика <b>${studentName}</b>.\n\nТеперь вы будете получать уведомления от Школы Самурая. 🥋`,
        markup
      )
      return NextResponse.json({ ok: true })
    }

    await sendMessage(chat_id, `Ссылка не распознана или устарела. Попросите тренера отправить новую ссылку-приглашение.`)
    return NextResponse.json({ ok: true })
  }

  if (text === '/cabinet' || text.toLowerCase().includes('кабинет')) {
    const { data: student } = await supabase
      .from('students').select('name, cabinet_token').eq('telegram_chat_id', chat_id).single()
    if (student?.cabinet_token) {
      await sendMessage(chat_id,
        `🎒 <b>Личный кабинет — ${student.name}</b>\n\nАбонемент · Посещаемость · Прогресс · Задания`,
        cabinetButton(`${appUrl}/cabinet/${student.cabinet_token}`)
      )
      return NextResponse.json({ ok: true })
    }

    const { data: linkedContacts } = await supabase
      .from('student_contacts').select('students(name, cabinet_token)').eq('telegram_chat_id', chat_id)
    const cabinets = (linkedContacts || [])
      .map(c => (c.students as any))
      .filter(s => s?.cabinet_token)
    if (cabinets.length === 1) {
      await sendMessage(chat_id,
        `🎒 <b>Личный кабинет — ${cabinets[0].name}</b>`,
        cabinetButton(`${appUrl}/cabinet/${cabinets[0].cabinet_token}`)
      )
      return NextResponse.json({ ok: true })
    }
    if (cabinets.length > 1) {
      await sendMessage(chat_id,
        `🎒 Выберите кабинет:`,
        { inline_keyboard: cabinets.map(s => [{ text: `🎒 ${s.name}`, url: `${appUrl}/cabinet/${s.cabinet_token}` }]) }
      )
      return NextResponse.json({ ok: true })
    }

    await sendMessage(chat_id, `Не удалось найти ваш кабинет. Попросите тренера привязать ваш Telegram к карточке ученика.`)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
