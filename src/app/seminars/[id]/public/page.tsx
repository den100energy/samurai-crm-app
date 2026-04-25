'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

type Seminar = {
  id: string
  title: string
  discipline: string | null
  location: string | null
  starts_at: string
  ends_at: string
  status: string
}

type Tariff = {
  id: string
  name: string
  base_price: number | null
}

type Registration = {
  id: string
  participant_name: string
  tariff_id: string | null
  school_status: string | null
  locked_price: number | null
  deposit_amount: number | null
  total_paid: number
  status: string
  is_external: boolean
  attended: boolean
}

const STATUS_MAP: Record<string, { label: string; cls: string; printCls: string }> = {
  fully_paid:   { label: 'Оплачен',    cls: 'bg-green-100 text-green-700',   printCls: 'text-green-700 font-semibold' },
  deposit_paid: { label: 'Предоплата', cls: 'bg-yellow-100 text-yellow-700', printCls: 'text-yellow-700' },
  pending:      { label: 'Не оплачен', cls: 'bg-red-100 text-red-600',       printCls: 'text-red-600 font-semibold' },
  no_show:      { label: 'Не пришёл', cls: 'bg-gray-100 text-gray-500',      printCls: 'text-gray-500' },
}

const DISCIPLINE_LABELS: Record<string, string> = {
  aikido: 'Айкидо', wushu: 'Ушу', both: 'Айкидо + Ушу', qigong: 'Цигун',
}

export default function SeminarPublicPage() {
  const { id } = useParams<{ id: string }>()
  const [seminar, setSeminar] = useState<Seminar | null>(null)
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [regs, setRegs] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/seminars/${id}/public`)
    if (!res.ok) { setNotFound(true); setLoading(false); return }
    const data = await res.json()
    setSeminar(data.seminar)
    setTariffs(data.tariffs)
    setRegs(data.registrations)
    setLastUpdated(new Date())
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-gray-400 text-sm">Загрузка...</div>
    </div>
  )

  if (notFound || !seminar) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-gray-500">Семинар не найден</div>
    </div>
  )

  const tariffMap = Object.fromEntries(tariffs.map(t => [t.id, t]))
  const activeRegs = regs

  const countPaid    = activeRegs.filter(r => r.status === 'fully_paid').length
  const countDeposit = activeRegs.filter(r => r.status === 'deposit_paid').length
  const countPending = activeRegs.filter(r => r.status === 'pending').length
  const totalLocked  = activeRegs.reduce((s, r) => s + (r.locked_price || 0), 0)
  const totalPaid    = activeRegs.reduce((s, r) => s + (r.deposit_amount || 0) + (r.total_paid || 0), 0)

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 12mm; }
          .no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Шапка */}
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-5 mb-6">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1 font-medium">
              Школа Самурая · Список участников
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{seminar.title}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-gray-600">
              <span>
                📅 {seminar.starts_at}
                {seminar.ends_at !== seminar.starts_at ? ` — ${seminar.ends_at}` : ''}
              </span>
              {seminar.location && <span>📍 {seminar.location}</span>}
              {seminar.discipline && (
                <span>🥋 {DISCIPLINE_LABELS[seminar.discipline] || seminar.discipline}</span>
              )}
            </div>
          </div>

          {/* Кнопки — скрыты при печати */}
          <div className="flex flex-col items-end gap-2 no-print ml-4 shrink-0">
            <button
              onClick={() => window.print()}
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              🖨 Печать
            </button>
            <button
              onClick={() => load()}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              ↻ Обновить
            </button>
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                {lastUpdated.toLocaleTimeString('ru')}
              </span>
            )}
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-4 gap-3 mb-7">
          <div className="border border-gray-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{activeRegs.length}</div>
            <div className="text-xs text-gray-400 mt-0.5">Участников</div>
          </div>
          <div className="border border-green-200 bg-green-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{countPaid}</div>
            <div className="text-xs text-gray-400 mt-0.5">Оплатили</div>
          </div>
          <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-yellow-700">{countDeposit}</div>
            <div className="text-xs text-gray-400 mt-0.5">Предоплата</div>
          </div>
          <div className="border border-red-200 bg-red-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{countPending}</div>
            <div className="text-xs text-gray-400 mt-0.5">Не оплатили</div>
          </div>
        </div>

        {/* Таблица */}
        {activeRegs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Участников пока нет</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="pb-2.5 text-left text-xs text-gray-500 font-semibold w-8">#</th>
                <th className="pb-2.5 text-left text-gray-900 font-semibold">Участник</th>
                <th className="pb-2.5 text-left text-gray-900 font-semibold">Тариф</th>
                <th className="pb-2.5 text-right text-gray-900 font-semibold">Стоимость</th>
                <th className="pb-2.5 text-right text-gray-900 font-semibold">Внесено</th>
                <th className="pb-2.5 text-center text-gray-900 font-semibold">Статус</th>
              </tr>
            </thead>
            <tbody>
              {activeRegs.map((r, i) => {
                const tariff = r.tariff_id ? tariffMap[r.tariff_id] : null
                const paid = (r.deposit_amount || 0) + (r.total_paid || 0)
                const st = STATUS_MAP[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-500', printCls: 'text-gray-500' }
                const isOdd = i % 2 !== 0
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-100 ${isOdd ? 'bg-gray-50' : 'bg-white'}`}
                  >
                    <td className="py-2.5 pr-2 text-gray-400 text-xs align-middle">{i + 1}</td>
                    <td className="py-2.5 pr-3 align-middle">
                      <div className="font-medium text-gray-900">{r.participant_name}</div>
                      {r.is_external && (
                        <div className="text-xs text-orange-500 leading-tight">внешний</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-600 align-middle">
                      {tariff?.name || '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-gray-800 font-medium align-middle whitespace-nowrap">
                      {r.locked_price ? `${r.locked_price.toLocaleString('ru')} ₽` : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right align-middle whitespace-nowrap">
                      <span className={paid > 0 ? 'text-green-700 font-medium' : 'text-gray-400'}>
                        {paid > 0 ? `${paid.toLocaleString('ru')} ₽` : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 text-center align-middle">
                      {/* Экран */}
                      <span className={`no-print inline-block text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                      {/* Печать */}
                      <span className={`hidden print:inline text-xs font-medium ${st.printCls}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-900">
                <td />
                <td colSpan={2} className="pt-3 text-sm font-bold text-gray-900">
                  Итого ({activeRegs.length} чел.)
                </td>
                <td className="pt-3 text-right text-sm font-bold text-gray-900 whitespace-nowrap">
                  {totalLocked.toLocaleString('ru')} ₽
                </td>
                <td className="pt-3 text-right text-sm font-bold text-green-700 whitespace-nowrap">
                  {totalPaid.toLocaleString('ru')} ₽
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}

        {/* Подвал */}
        <div className="mt-8 pt-4 border-t border-gray-200">
          {/* Экран */}
          <div className="no-print flex items-center justify-between text-xs text-gray-400">
            <span>Школа Самурая · crm.samu-rai.ru</span>
            <span>Обновляется автоматически каждые 30 сек</span>
          </div>
          {/* Печать */}
          <div className="hidden print:block text-center text-xs text-gray-400">
            Школа Самурая · Распечатано {new Date().toLocaleDateString('ru', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  )
}
