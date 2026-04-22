import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { TelegramIcon, VkIcon, MaxIcon } from '@/components/MessengerIcon'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Props = { params: Promise<{ token: string }> }

async function findRecipientName(token: string): Promise<string | null> {
  const { data: student } = await admin
    .from('students').select('name').eq('invite_token', token).maybeSingle()
  if (student) return student.name

  const { data: lead } = await admin
    .from('leads').select('full_name').eq('invite_token', token).maybeSingle()
  if (lead) return lead.full_name

  const { data: contact } = await admin
    .from('student_contacts').select('name').eq('invite_token', token).maybeSingle()
  if (contact) return contact.name

  if (token.startsWith('tr_')) {
    const { data: trainer } = await admin
      .from('trainers').select('name').eq('telegram_invite_token', token).maybeSingle()
    if (trainer) return trainer.name
  }

  return null
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const name = await findRecipientName(token)
  if (!name) notFound()

  const tgUsername = process.env.TELEGRAM_CLIENT_BOT_USERNAME
  const vkGroupShort = process.env.NEXT_PUBLIC_VK_GROUP_SHORT_NAME
  const maxUsername = process.env.NEXT_PUBLIC_MAX_BOT_USERNAME

  const tgUrl = tgUsername ? `https://t.me/${tgUsername}?start=${token}` : null
  const vkUrl = vkGroupShort ? `https://vk.me/${vkGroupShort}?ref=${token}` : null
  const maxUrl = maxUsername ? `https://max.ru/${maxUsername}?start=${token}` : null

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥋</div>
          <h1 className="text-2xl font-semibold mb-2">Школа Самурая</h1>
          <p className="text-white/70">
            Привет, <b>{name}</b>!<br />
            Выберите мессенджер для получения уведомлений:
          </p>
        </div>

        <div className="space-y-3">
          <MessengerButton
            label="Telegram"
            icon={<TelegramIcon />}
            background="#229ED9"
            url={tgUrl}
          />
          <MessengerButton
            label="ВКонтакте"
            icon={<VkIcon />}
            background="#0077FF"
            url={vkUrl}
          />
          <MessengerButton
            label="Макс"
            icon={<MaxIcon />}
            background="linear-gradient(135deg, #4FB7E5 0%, #8651E8 100%)"
            url={maxUrl}
          />
        </div>

        <p className="text-white/40 text-sm text-center mt-8">
          После подключения вы будете получать уведомления о занятиях, абонементе и расписании.
        </p>
      </div>
    </div>
  )
}

function MessengerButton({
  label, icon, background, url,
}: { label: string; icon: ReactNode; background: string; url: string | null }) {
  if (!url) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 text-white/40 cursor-not-allowed">
        <span className="w-7 h-7 flex items-center justify-center opacity-50">{icon}</span>
        <span className="flex-1 font-medium">{label}</span>
        <span className="text-xs uppercase tracking-wide">Скоро</span>
      </div>
    )
  }
  return (
    <a
      href={url}
      className="flex items-center gap-3 p-4 rounded-xl text-white font-medium transition-transform active:scale-[0.98]"
      style={{ background }}
    >
      <span className="w-7 h-7 flex items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="text-xl">→</span>
    </a>
  )
}

