import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

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

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  )
}

function VkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.785 16.241s.288-.032.435-.193c.135-.148.131-.425.131-.425s-.018-1.301.582-1.494c.592-.19 1.351 1.268 2.156 1.829.61.422 1.072.33 1.072.33l2.155-.03s1.127-.071.593-.964c-.044-.073-.311-.658-1.6-1.864-1.35-1.263-1.169-1.059.456-3.246.99-1.332 1.386-2.145 1.262-2.493-.117-.332-.85-.244-.85-.244l-2.44.015s-.181-.025-.315.056c-.131.079-.215.262-.215.262s-.384 1.027-.896 1.901c-1.081 1.844-1.514 1.941-1.69 1.826-.412-.267-.309-1.075-.309-1.648 0-1.793.272-2.541-.527-2.733-.265-.064-.46-.106-1.137-.113-.869-.009-1.605.003-2.022.207-.277.136-.491.439-.361.457.16.022.523.099.715.362.249.34.24 1.103.24 1.103s.143 2.099-.333 2.358c-.327.178-.776-.185-1.74-1.857-.493-.857-.866-1.804-.866-1.804s-.072-.176-.201-.27c-.156-.114-.374-.151-.374-.151l-2.32.015s-.348.01-.476.161c-.114.135-.009.413-.009.413s1.817 4.252 3.875 6.395c1.886 1.964 4.028 1.835 4.028 1.835h.969z" />
    </svg>
  )
}

// Лого Макс — белое толстое кольцо в форме речевого облачка с маленькой точкой внутри.
// Воспроизводит фирменную иконку (ring + dot) из dev.max.ru.
function MaxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="white"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.05-1.34A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 16.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13z"
      />
      <circle cx="12" cy="12" r="2.2" fill="white" />
    </svg>
  )
}
