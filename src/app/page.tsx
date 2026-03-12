import Link from 'next/link'

const sections = [
  { href: '/students', emoji: '🥋', title: 'Ученики', desc: 'Список, группы, абонементы' },
  { href: '/attendance', emoji: '✅', title: 'Посещаемость', desc: 'Отметить занятие' },
  { href: '/payments', emoji: '💰', title: 'Платежи', desc: 'Оплата и абонементы' },
  { href: '/leads', emoji: '📋', title: 'Лиды', desc: 'Новые заявки' },
]

export default function Home() {
  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-gray-800">⚔️ Школа Самурая</h1>
        <p className="text-gray-500 mt-1">Центр физического развития и самозащиты</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-95">
            <div className="text-4xl mb-2">{s.emoji}</div>
            <div className="font-semibold text-gray-800">{s.title}</div>
            <div className="text-sm text-gray-500 mt-1">{s.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  )
}
