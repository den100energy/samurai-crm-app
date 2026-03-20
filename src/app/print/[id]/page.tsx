'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PrintContractPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: student }, { data: profile }, { data: subs }] = await Promise.all([
        supabase.from('students').select('*').eq('id', id).single(),
        supabase.from('student_profiles').select('*').eq('student_id', id).maybeSingle(),
        supabase.from('subscriptions').select('*, subscription_types(name)').eq('student_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      setData({ student, profile, sub: subs })
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="p-8 text-gray-400">Загрузка...</div>
  if (!data?.student) return <div className="p-8 text-gray-500">Ученик не найден</div>

  const { student, profile, sub } = data

  // Формируем ФИО
  const fullName = profile?.last_name
    ? [profile.last_name, profile.first_name, profile.middle_name].filter(Boolean).join(' ')
    : student.name

  const today = new Date()
  const dateStr = `«${today.getDate().toString().padStart(2,'0')}» ${['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][today.getMonth()]} ${today.getFullYear()} г.`

  const birthDate = student.birth_date
    ? new Date(student.birth_date).toLocaleDateString('ru-RU')
    : '____________'

  const subName = sub?.subscription_types?.name || sub?.type || '________________________'
  const subSessions = sub?.sessions_total || '____'
  const subAmount = sub?.amount ? `${sub.amount.toLocaleString('ru-RU')} (${numberToWords(sub.amount)}) рублей` : '________________________'
  const subStartDate = sub?.start_date ? new Date(sub.start_date).toLocaleDateString('ru-RU') : '____________'
  const subEndDate = sub?.end_date ? new Date(sub.end_date).toLocaleDateString('ru-RU') : '____________'

  return (
    <div className="bg-white">
      {/* Кнопка печати — скрывается при печати */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-10">
        <button onClick={() => window.print()}
          className="bg-black text-white px-6 py-2.5 rounded-xl text-sm font-medium shadow-lg">
          🖨️ Распечатать
        </button>
        <button onClick={() => window.close()}
          className="border border-gray-200 bg-white text-gray-600 px-4 py-2.5 rounded-xl text-sm">
          ✕
        </button>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          .page-break { page-break-after: always; }
        }
        @page { margin: 20mm; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; }
      `}</style>

      {/* ===== ДОГОВОР ===== */}
      <div className="max-w-3xl mx-auto p-10 print:p-0">
        <div className="text-center mb-6">
          <p className="font-bold text-base">ДОГОВОР на приобретение абонемента № ______________</p>
        </div>

        <div className="flex justify-between mb-6 text-sm">
          <span>г. Шахты</span>
          <span>{dateStr}</span>
        </div>

        <p className="text-sm leading-relaxed mb-4">
          Настоящий документ «Договор на приобретение абонемента» представляет собой соглашение ИП Филоновой Евгении Алексеевны, действующей под фирменным наименованием ЦЕНТР ФИЗИЧЕСКОГО РАЗВИТИЯ И САМОЗАЩИТЫ «ШКОЛА САМУРАЯ» (далее — «ЦЕНТР ФРиС») и <strong className="underline">{fullName}</strong>, именуемой (-ым) в дальнейшем КЛИЕНТ, о нижеследующем:
        </p>

        <div className="text-sm leading-relaxed space-y-3">
          <p className="font-bold">1. ПРЕДМЕТ ДОГОВОРА</p>
          <p>1.1. КЛИЕНТ поручает, а ЦЕНТР ФРиС принимает на себя обязательство по оказанию КЛИЕНТУ спортивно-оздоровительных и развивающих услуг, включая тренировки по единоборствам, индивидуальные занятия, консультации, мастер-классы, разработку индивидуальных программ (далее – Услуги). Перечень, объём и стоимость Услуг — в Приложении №1.</p>
          <p>1.2. При повторном приобретении абонемента настоящий Договор считается продлённым.</p>
          <p>1.3. Оплата производится единоразово или по графику согласно Приложению №2.</p>
          <p>1.5. Подписывая настоящий Договор, КЛИЕНТ подтверждает ознакомление с его условиями в полном объёме и принимает их без изъятий.</p>

          <p className="font-bold mt-4">2. ПРАВА И ОБЯЗАННОСТИ СТОРОН</p>
          <p>2.1. КЛИЕНТ имеет право посещать Центр по расписанию, получать услуги согласно абонементу, пользоваться оборудованием.</p>
          <p>2.2. КЛИЕНТ обязан: соблюдать Правила посещения; уведомлять об отсутствии не менее чем за 6 часов; своевременно оплачивать услуги; сообщать о медицинских противопоказаниях.</p>
          <p>2.3–2.4. ЦЕНТР ФРиС вправе отказать в доступе при нарушениях и обязуется оказывать услуги в согласованное время.</p>

          <p className="font-bold mt-4">3. ПРИОСТАНОВЛЕНИЕ И РАСТОРЖЕНИЕ</p>
          <p>3.1–3.2. Договор расторгается по инициативе Центра при нарушениях или по заявлению Клиента.</p>
          <p>3.3. Возврат стоимости неоказанных услуг — в течение 10 дней с пересчётом по полному прайсу.</p>

          <p className="font-bold mt-4">4. ЗАМОРОЗКА АБОНЕМЕНТА</p>
          <p>4.1. При болезни (со справкой) — однократная заморозка до 30 дней или автоматическое продление на 7 дней. Справка предоставляется в течение 3 дней с даты выдачи.</p>

          <p className="font-bold mt-4">5. СРОК ДЕЙСТВИЯ</p>
          <p>5.1. Договор вступает в силу с момента оплаты и действует в течение срока абонемента.</p>

          <p className="font-bold mt-4">6. ПЕРСОНАЛЬНЫЕ ДАННЫЕ</p>
          <p>6.1. КЛИЕНТ даёт согласие на обработку персональных данных (ФИО, дата рождения, телефон, email) в целях оказания услуг, сбора статистики и маркетинга. Согласие действует 5 лет с автоматической пролонгацией согласно ст. 9 ФЗ-152.</p>
        </div>

        {/* Реквизиты и подписи */}
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="font-bold mb-2">ЦЕНТР ФРиС:</p>
            <p>г. Шахты, ул. Ленина, д.120 кв.13</p>
            <p>Место услуг: г. Шахты, ул. Советская, д.252</p>
            <p>ОГРНИП: 323619600220476</p>
            <p>ИНН: 611601534851</p>
            <p>E-mail: vakikai@gmail.com</p>
            <p className="mt-6">ИП Филонова Е.А. _______________</p>
          </div>
          <div>
            <p className="font-bold mb-2">КЛИЕНТ:</p>
            <p>ФИО: <strong>{fullName}</strong></p>
            <p>Телефон: {student.phone || '________________________'}</p>
            <p>Дата рождения: {birthDate}</p>
            {profile?.address && <p>Адрес: {profile.address}</p>}
            <p>E-mail: {profile?.email || student.email || '________________________'}</p>
            <p className="mt-6">Подпись: _______________ / {fullName.split(' ').slice(0,2).join(' ')}</p>
          </div>
        </div>
      </div>

      {/* ===== ПРИЛОЖЕНИЕ 1 ===== */}
      <div className="page-break" />
      <div className="max-w-3xl mx-auto p-10 print:p-0">
        <div className="text-center mb-6">
          <p className="font-bold">Приложение №1 к договору на приобретение абонемента № ______________</p>
          <p className="font-bold">от {dateStr}</p>
        </div>

        <p className="text-sm mb-4">
          ИП Филонова Евгения Алексеевна (ЦЕНТР ФРиС) и <strong>{fullName}</strong> (КЛИЕНТ) подписали настоящее Приложение №1 о нижеследующем.
        </p>

        <table className="w-full border-collapse border border-gray-400 text-sm mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-left">Наименование услуги</th>
              <th className="border border-gray-400 px-3 py-2 text-center">Количество</th>
              <th className="border border-gray-400 px-3 py-2 text-center">Длительность</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 px-3 py-2">Групповые занятия ({subName})</td>
              <td className="border border-gray-400 px-3 py-2 text-center">{subSessions}</td>
              <td className="border border-gray-400 px-3 py-2 text-center">60 мин.</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-3 py-2">Программа индивидуального развития</td>
              <td className="border border-gray-400 px-3 py-2 text-center"></td>
              <td className="border border-gray-400 px-3 py-2 text-center"></td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-3 py-2">Тренировки с оружием (бонус)</td>
              <td className="border border-gray-400 px-3 py-2 text-center"></td>
              <td className="border border-gray-400 px-3 py-2 text-center"></td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-3 py-2">Мастер-классы (бонус)</td>
              <td className="border border-gray-400 px-3 py-2 text-center"></td>
              <td className="border border-gray-400 px-3 py-2 text-center"></td>
            </tr>
          </tbody>
        </table>

        <div className="text-sm space-y-1 mb-6">
          <p>Срок действия абонемента: с <strong>{subStartDate}</strong> по <strong>{subEndDate}</strong></p>
          <p>График занятий: _____ раз в неделю, ПН / ВТ / СР / ЧТ / ПТ / СБ (нужное подчеркнуть)</p>
          <p>Стоимость абонемента: <strong>{subAmount}</strong></p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm mt-8">
          <p>ЦЕНТР ФРиС: ИП Филонова Е.А. _______________</p>
          <p>КЛИЕНТ: _______________ / {fullName.split(' ').slice(0,2).join(' ')}</p>
        </div>
      </div>

      {/* ===== ПРИЛОЖЕНИЕ 2 (только если есть данные об оплате) ===== */}
      {sub && (
        <>
          <div className="page-break" />
          <div className="max-w-3xl mx-auto p-10 print:p-0">
            <div className="text-center mb-6">
              <p className="font-bold">Приложение №2 к договору на приобретение абонемента № ______________</p>
              <p className="font-bold">от {dateStr}</p>
            </div>
            <p className="text-sm mb-4">
              ИП Филонова Евгения Алексеевна (ЦЕНТР ФРиС) и <strong>{fullName}</strong> (КЛИЕНТ) подписали настоящее Приложение №2.
            </p>
            <p className="text-sm mb-4">Общая стоимость Договора: <strong>{subAmount}</strong></p>

            <table className="w-full border-collapse border border-gray-400 text-sm mb-6">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-3 py-2">Дата погашения до</th>
                  <th className="border border-gray-400 px-3 py-2">Сумма, рублей</th>
                </tr>
              </thead>
              <tbody>
                {[1,2,3,4].map(i => (
                  <tr key={i}>
                    <td className="border border-gray-400 px-3 py-3"></td>
                    <td className="border border-gray-400 px-3 py-3"></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-8 text-sm mt-8">
              <p>ЦЕНТР ФРиС: ИП Филонова Е.А. _______________</p>
              <p>КЛИЕНТ: _______________ / {fullName.split(' ').slice(0,2).join(' ')}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Упрощённый перевод числа в слова (только для круглых сумм)
function numberToWords(n: number): string {
  if (!n) return ''
  const thousands = Math.floor(n / 1000)
  const hundreds = n % 1000
  const parts = []
  if (thousands > 0) parts.push(`${thousands} тысяч`)
  if (hundreds > 0) parts.push(`${hundreds}`)
  return parts.join(' ') || `${n}`
}
