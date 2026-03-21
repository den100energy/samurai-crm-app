import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// CRM-бот (@samurai_school_crm_bot) — для финансового чата сотрудников
const CRM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const FINANCE_CHAT_ID = process.env.TELEGRAM_FINANCE_CHAT_ID || ''

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Категории ────────────────────────────────────────────────────────────────

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

// ─── Парсинг ──────────────────────────────────────────────────────────────────

function parseFinanceMessage(text: string) {
  const direction: 'income' | 'expense' = text.startsWith('+') ? 'income' : 'expense'
  const raw = text.slice(1).trim()

  const amountMatch = raw.match(/^(\d[\d\s]*)/)
  if (!amountMatch) return null
  const amount = parseInt(amountMatch[1].replace(/\s/g, ''))
  if (!amount || isNaN(amount)) return null

  let rest = raw.slice(amountMatch[1].length).trim()

  // Определяем payment_type
  let payment_type: 'cash' | 'transfer' = 'cash'
  if (/безнал|перевод|карта/i.test(rest)) {
    payment_type = 'transfer'
    rest = rest.replace(/\s*(безнал|перевод|карта)\s*/i, ' ').trim()
  } else if (/\bнал\b|наличн/i.test(rest)) {
    rest = rest.replace(/\s*\bнал\b|наличн\w*\s*/i, ' ').trim()
  }

  // Ищем категорию (длинные первыми)
  const categories = direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const normalize = (s: string) => s.toLowerCase().replace(/[-+.\s]/g, '')

  let category = ''
  let comment = rest

  for (const cat of [...categories].sort((a, b) => b.length - a.length)) {
    if (normalize(rest).startsWith(normalize(cat))) {
      category = cat
      comment = rest.slice(cat.length).trim().replace(/^[-–,\s]+/, '')
      break
    }
  }

  if (!category) {
    const words = rest.split(/\s+/)
    category = words[0] || (direction === 'income' ? 'Абонементы' : 'Расходники')
    comment = words.slice(1).join(' ')
  }

  return { direction, amount, category, comment, payment_type }
}

// ─── Telegram helpers ─────────────────────────────────────────────────────────

async function send(chat_id: number, text: string, reply_markup?: object, thread_id?: number) {
  await fetch(`https://api.telegram.org/bot${CRM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id, text, parse_mode: 'HTML', reply_markup,
      ...(thread_id ? { message_thread_id: thread_id } : {}),
    }),
  })
}

async function editMsg(chat_id: number, message_id: number, text: string) {
  await fetch(`https://api.telegram.org/bot${CRM_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, message_id, text, parse_mode: 'HTML' }),
  })
}

async function answerCb(id: string) {
  await fetch(`https://api.telegram.org/bot${CRM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id }),
  })
}

// ─── Обработчик финансового сообщения ────────────────────────────────────────

async function handleFinance(chat_id: number, text: string, sender: string, thread_id?: number) {
  const parsed = parseFinanceMessage(text)

  if (!parsed) {
    await send(chat_id,
      `❌ Не понял формат. Примеры:\n\n` +
      `<code>+ 5700 Абонементы Иванов Иван</code>\n` +
      `<code>- 74160 Аренда апрель</code>\n` +
      `<code>+ 6000 Абонементы Петров безнал</code>`,
      undefined, thread_id
    )
    return
  }

  const today = new Date().toISOString().split('T')[0]
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
    await send(chat_id, '❌ Ошибка сохранения. Попробуй ещё раз.', undefined, thread_id)
    return
  }

  const sign = parsed.direction === 'income' ? '💰 Доход' : '💸 Расход'
  const payLabel = parsed.payment_type === 'cash' ? 'наличные' : 'перевод'
  const dateLabel = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  const msg =
    `${sign} · <b>${parsed.amount.toLocaleString()} ₽</b>\n` +
    `📂 ${parsed.category}\n` +
    (parsed.comment ? `💬 ${parsed.comment}\n` : '') +
    `💳 ${payLabel} · 📅 ${dateLabel}\n` +
    `👤 ${sender}`

  await send(chat_id, msg, {
    inline_keyboard: [[
      { text: '✅ Записать', callback_data: `fin_ok:${pending.id}` },
      { text: '❌ Отмена', callback_data: `fin_no:${pending.id}` },
    ]]
  }, thread_id)
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Callback (кнопка)
  if (body?.callback_query) {
    const cb = body.callback_query
    const data: string = cb.data || ''
    const chat_id: number = cb.message.chat.id
    const message_id: number = cb.message.message_id
    await answerCb(cb.id)

    if (data.startsWith('fin_ok:')) {
      const id = data.replace('fin_ok:', '')
      const { data: p } = await supabase.from('payments').select('*').eq('id', id).eq('status', 'pending').single()
      if (p) {
        await supabase.from('payments').update({ status: 'confirmed' }).eq('id', id)
        const sign = p.direction === 'income' ? '+' : '-'
        await editMsg(chat_id, message_id,
          `✅ <b>Записано</b>\n${sign}${Number(p.amount).toLocaleString()} ₽ · ${p.category}` +
          (p.description ? `\n💬 ${p.description}` : '')
        )
      } else {
        await editMsg(chat_id, message_id, '⚠️ Уже обработано')
      }
    }

    if (data.startsWith('fin_no:')) {
      const id = data.replace('fin_no:', '')
      await supabase.from('payments').delete().eq('id', id).eq('status', 'pending')
      await editMsg(chat_id, message_id, '❌ Отменено')
    }

    return NextResponse.json({ ok: true })
  }

  // Обычное сообщение
  const message = body?.message
  if (!message) return NextResponse.json({ ok: true })

  const chat_id: number = message.chat.id
  const text: string = message.text || ''
  const firstName: string = message.from?.first_name || ''
  const thread_id: number | undefined = message.message_thread_id

  // Финансовые команды (из любого чата если нет FINANCE_CHAT_ID, или из нужного чата)
  const isAllowed = !FINANCE_CHAT_ID || String(chat_id) === String(FINANCE_CHAT_ID)

  if (isAllowed && (text.startsWith('+') || text.startsWith('-'))) {
    await handleFinance(chat_id, text, firstName, thread_id)
    return NextResponse.json({ ok: true })
  }

  if (isAllowed && text === '/help') {
    await send(chat_id,
      `<b>Как записывать операции:</b>\n\n` +
      `<b>Доход:</b> <code>+ сумма категория комментарий</code>\n` +
      `<b>Расход:</b> <code>- сумма категория комментарий</code>\n\n` +
      `<b>Безнал:</b> добавь слово <code>безнал</code>\n\n` +
      `<b>Категории доходов:</b>\n${INCOME_CATEGORIES.join(' · ')}\n\n` +
      `<b>Категории расходов:</b>\n${EXPENSE_CATEGORIES.join(' · ')}`,
      undefined, thread_id
    )
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
