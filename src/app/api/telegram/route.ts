import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CLIENT_BOT_TOKEN = process.env.TELEGRAM_CLIENT_BOT_TOKEN!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendMessage(chat_id: number, text: string) {
  await fetch(`https://api.telegram.org/bot${CLIENT_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const message = body?.message
  if (!message) return NextResponse.json({ ok: true })

  const chat_id: number = message.chat.id
  const text: string = message.text || ''
  const firstName = message.from?.first_name || 'Родитель'

  // /start TOKEN — привязка родителя к карточке
  if (text.startsWith('/start')) {
    const token = text.split(' ')[1]?.trim()

    if (!token) {
      await sendMessage(chat_id, `Привет, ${firstName}! 👋\n\nЭтот бот отправляет уведомления от Школы Самурая.\n\nДля привязки к карточке ученика используй ссылку от тренера.`)
      return NextResponse.json({ ok: true })
    }

    // Ищем по токену в leads
    const { data: lead } = await supabase
      .from('leads')
      .select('id, full_name')
      .eq('invite_token', token)
      .single()

    if (lead) {
      await supabase.from('leads').update({ telegram_chat_id: chat_id }).eq('id', lead.id)
      await sendMessage(chat_id, `Привет, ${firstName}! 👋\n\nВы успешно подключены к карточке <b>${lead.full_name}</b>.\n\nТеперь вы будете получать уведомления о занятиях, абонементе и программах развития.`)
      return NextResponse.json({ ok: true })
    }

    // Ищем по токену в students
    const { data: student } = await supabase
      .from('students')
      .select('id, name')
      .eq('invite_token', token)
      .single()

    if (student) {
      await supabase.from('students').update({ telegram_chat_id: chat_id }).eq('id', student.id)
      await sendMessage(chat_id, `Привет, ${firstName}! 👋\n\nВы успешно подключены к карточке <b>${student.name}</b>.\n\nТеперь вы будете получать уведомления о занятиях, абонементе и программах развития от Школы Самурая. 🥋`)
      return NextResponse.json({ ok: true })
    }

    // Ищем по токену в student_contacts
    const { data: contact } = await supabase
      .from('student_contacts')
      .select('id, name, student_id, students(name)')
      .eq('invite_token', token)
      .single()

    if (contact) {
      await supabase.from('student_contacts').update({ telegram_chat_id: chat_id }).eq('id', contact.id)
      const studentName = (contact.students as any)?.name || 'ученика'
      await sendMessage(chat_id, `Привет, ${firstName}! 👋\n\nВы успешно подключены как контакт ученика <b>${studentName}</b>.\n\nТеперь вы будете получать уведомления об абонементе и занятиях от Школы Самурая. 🥋`)
      return NextResponse.json({ ok: true })
    }

    // Токен не найден
    await sendMessage(chat_id, `Ссылка не распознана или устарела. Попросите тренера отправить новую ссылку-приглашение.`)
  }

  // /cabinet или "мой кабинет" — отправить ссылку на личный кабинет
  if (text === '/cabinet' || text.toLowerCase().includes('кабинет')) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://samurai-crm-app.vercel.app'

    // Ищем ученика по telegram_chat_id
    const { data: student } = await supabase
      .from('students')
      .select('name, cabinet_token')
      .eq('telegram_chat_id', chat_id)
      .single()

    if (student?.cabinet_token) {
      const url = `${appUrl}/cabinet/${student.cabinet_token}`
      await sendMessage(chat_id, `🎒 <b>Личный кабинет — ${student.name}</b>\n\n${url}\n\nЗдесь вы найдёте:\n• Абонемент и посещаемость\n• Прогресс по качествам\n• Задания от тренера\n• Достижения и аттестации`)
      return NextResponse.json({ ok: true })
    }

    // Ищем по student_contacts
    const { data: contact } = await supabase
      .from('student_contacts')
      .select('name, students(name, cabinet_token)')
      .eq('telegram_chat_id', chat_id)
      .single()

    if (contact) {
      const s = contact.students as any
      if (s?.cabinet_token) {
        const url = `${appUrl}/cabinet/${s.cabinet_token}`
        await sendMessage(chat_id, `🎒 <b>Личный кабинет — ${s.name}</b>\n\n${url}\n\nЗдесь вы найдёте прогресс, задания и информацию об абонементе.`)
        return NextResponse.json({ ok: true })
      }
    }

    await sendMessage(chat_id, `Не удалось найти ваш кабинет. Попросите тренера привязать ваш Telegram к карточке ученика.`)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
