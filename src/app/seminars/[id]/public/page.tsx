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
  fully_paid:   { label: 'Оплачен',    cls: 'sp-paid',    printCls: 'sp-paid-txt' },
  deposit_paid: { label: 'Предоплата', cls: 'sp-deposit', printCls: 'sp-deposit-txt' },
  pending:      { label: 'Не оплачен', cls: 'sp-pending', printCls: 'sp-pending-txt' },
  no_show:      { label: 'Не пришёл', cls: 'sp-noshow',  printCls: 'sp-noshow-txt' },
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <span style={{ color: '#9ca3af', fontSize: 14 }}>Загрузка...</span>
    </div>
  )

  if (notFound || !seminar) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <span style={{ color: '#6b7280' }}>Семинар не найден</span>
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
    <div className="sp">
      <style>{`
        /* ── Сброс тёмной темы для .sp ── */
        body                { background: #ffffff !important; color: #111827 !important; }
        .sp                 { background: #ffffff !important; min-height: 100vh; color: #111827; }
        .sp *               { box-sizing: border-box; }

        /* Фон */
        [data-theme="dark"] .sp { background: #ffffff !important; }
        [data-theme="dark"] .sp .sp-bg-white  { background: #ffffff !important; }
        [data-theme="dark"] .sp .sp-bg-stripe { background: #f9fafb !important; }

        /* Текст */
        .sp .sp-t1  { color: #111827 !important; }
        .sp .sp-t2  { color: #1f2937 !important; }
        .sp .sp-t3  { color: #374151 !important; }
        .sp .sp-t4  { color: #6b7280 !important; }
        .sp .sp-t5  { color: #9ca3af !important; }
        .sp .sp-t6  { color: #d1d5db !important; }

        /* Статусы — бейдж (экран) */
        .sp .sp-paid    { background: #dcfce7 !important; color: #15803d !important; }
        .sp .sp-deposit { background: #fef9c3 !important; color: #a16207 !important; }
        .sp .sp-pending { background: #fee2e2 !important; color: #dc2626 !important; }
        .sp .sp-noshow  { background: #f3f4f6 !important; color: #6b7280 !important; }

        /* Статусы — текст (печать) */
        .sp .sp-paid-txt    { color: #15803d !important; font-weight: 600; }
        .sp .sp-deposit-txt { color: #a16207 !important; }
        .sp .sp-pending-txt { color: #dc2626 !important; font-weight: 600; }
        .sp .sp-noshow-txt  { color: #6b7280 !important; }

        /* Статблоки */
        .sp .sp-stat        { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; text-align: center; background: #fff; }
        .sp .sp-stat-green  { border-color: #bbf7d0 !important; background: #f0fdf4 !important; }
        .sp .sp-stat-yellow { border-color: #fef08a !important; background: #fefce8 !important; }
        .sp .sp-stat-red    { border-color: #fecaca !important; background: #fef2f2 !important; }

        /* Кнопка печати */
        .sp .sp-btn-print { background: #111827 !important; color: #ffffff !important; border: none; border-radius: 8px; padding: 8px 16px; font-size: 14px; cursor: pointer; }
        .sp .sp-btn-print:hover { background: #374151 !important; }
        .sp .sp-btn-refresh { background: none; border: none; color: #9ca3af; font-size: 12px; cursor: pointer; }
        .sp .sp-btn-refresh:hover { color: #374151; }

        /* Инпуты (тёмная тема ломает) */
        [data-theme="dark"] .sp input,
        [data-theme="dark"] .sp select,
        [data-theme="dark"] .sp textarea {
          background: #ffffff !important;
          color: #111827 !important;
          border-color: #e5e7eb !important;
        }

        /* Печать */
        @media print {
          @page { size: A4 portrait; margin: 15mm 12mm; }
          .sp-no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          .sp-badge { display: none !important; }
          .sp-print-only { display: inline !important; }
        }
        @media screen {
          .sp-print-only { display: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Шапка */}
        <div style={{ borderBottom: '2px solid #111827', paddingBottom: 20, marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="sp-t5" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, fontWeight: 600 }}>
              Школа Самурая · Список участников
            </div>
            <h1 className="sp-t1" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
              {seminar.title}
            </h1>
            <div className="sp-t3" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginTop: 8, fontSize: 14 }}>
              <span>📅 {seminar.starts_at}{seminar.ends_at !== seminar.starts_at ? ` — ${seminar.ends_at}` : ''}</span>
              {seminar.location && <span>📍 {seminar.location}</span>}
              {seminar.discipline && <span>🥋 {DISCIPLINE_LABELS[seminar.discipline] || seminar.discipline}</span>}
            </div>
          </div>

          <div className="sp-no-print" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <button className="sp-btn-print" onClick={() => window.print()}>🖨 Печать</button>
            <button className="sp-btn-refresh" onClick={() => load()}>↻ Обновить</button>
            {lastUpdated && (
              <span className="sp-t5" style={{ fontSize: 11 }}>{lastUpdated.toLocaleTimeString('ru')}</span>
            )}
          </div>
        </div>

        {/* Статистика */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          <div className="sp-stat">
            <div className="sp-t1" style={{ fontSize: 28, fontWeight: 700 }}>{activeRegs.length}</div>
            <div className="sp-t5" style={{ fontSize: 12, marginTop: 2 }}>Участников</div>
          </div>
          <div className="sp-stat sp-stat-green">
            <div style={{ fontSize: 28, fontWeight: 700, color: '#15803d' }}>{countPaid}</div>
            <div className="sp-t5" style={{ fontSize: 12, marginTop: 2 }}>Оплатили</div>
          </div>
          <div className="sp-stat sp-stat-yellow">
            <div style={{ fontSize: 28, fontWeight: 700, color: '#a16207' }}>{countDeposit}</div>
            <div className="sp-t5" style={{ fontSize: 12, marginTop: 2 }}>Предоплата</div>
          </div>
          <div className="sp-stat sp-stat-red">
            <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>{countPending}</div>
            <div className="sp-t5" style={{ fontSize: 12, marginTop: 2 }}>Не оплатили</div>
          </div>
        </div>

        {/* Таблица */}
        {activeRegs.length === 0 ? (
          <div className="sp-t5" style={{ textAlign: 'center', padding: '48px 0' }}>Участников пока нет</div>
        ) : (
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #111827' }}>
                <th className="sp-t4" style={{ textAlign: 'left', paddingBottom: 10, fontSize: 12, fontWeight: 600, width: 32 }}>#</th>
                <th className="sp-t1" style={{ textAlign: 'left', paddingBottom: 10, fontWeight: 600 }}>Участник</th>
                <th className="sp-t1" style={{ textAlign: 'left', paddingBottom: 10, fontWeight: 600 }}>Тариф</th>
                <th className="sp-t1" style={{ textAlign: 'right', paddingBottom: 10, fontWeight: 600 }}>Стоимость</th>
                <th className="sp-t1" style={{ textAlign: 'right', paddingBottom: 10, fontWeight: 600 }}>Внесено</th>
                <th className="sp-t1" style={{ textAlign: 'center', paddingBottom: 10, fontWeight: 600 }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {activeRegs.map((r, i) => {
                const tariff = r.tariff_id ? tariffMap[r.tariff_id] : null
                const paid = (r.deposit_amount || 0) + (r.total_paid || 0)
                const st = STATUS_MAP[r.status] || { label: r.status, cls: 'sp-noshow', printCls: 'sp-noshow-txt' }
                return (
                  <tr
                    key={r.id}
                    className={i % 2 !== 0 ? 'sp-bg-stripe' : 'sp-bg-white'}
                    style={{ borderBottom: '1px solid #f3f4f6' }}
                  >
                    <td className="sp-t5" style={{ padding: '10px 8px 10px 0', fontSize: 12, verticalAlign: 'middle' }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px 10px 0', verticalAlign: 'middle' }}>
                      <div className="sp-t1" style={{ fontWeight: 500 }}>{r.participant_name}</div>
                      {r.is_external && <div style={{ fontSize: 12, color: '#f97316' }}>внешний</div>}
                    </td>
                    <td className="sp-t3" style={{ padding: '10px 12px 10px 0', verticalAlign: 'middle' }}>
                      {tariff?.name || '—'}
                    </td>
                    <td className="sp-t2" style={{ padding: '10px 12px 10px 0', textAlign: 'right', fontWeight: 500, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      {r.locked_price ? `${r.locked_price.toLocaleString('ru')} ₽` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px 10px 0', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span style={{ color: paid > 0 ? '#15803d' : '#d1d5db', fontWeight: paid > 0 ? 500 : 400 }}>
                        {paid > 0 ? `${paid.toLocaleString('ru')} ₽` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'center', verticalAlign: 'middle' }}>
                      <span className={`sp-badge ${st.cls}`} style={{ display: 'inline-block', fontSize: 12, padding: '3px 10px', borderRadius: 999, fontWeight: 500 }}>
                        {st.label}
                      </span>
                      <span className={`sp-print-only ${st.printCls}`} style={{ fontSize: 12 }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #111827' }}>
                <td />
                <td colSpan={2} className="sp-t1" style={{ paddingTop: 12, fontSize: 14, fontWeight: 700 }}>
                  Итого ({activeRegs.length} чел.)
                </td>
                <td className="sp-t1" style={{ paddingTop: 12, textAlign: 'right', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {totalLocked.toLocaleString('ru')} ₽
                </td>
                <td style={{ paddingTop: 12, textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>
                  {totalPaid.toLocaleString('ru')} ₽
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}

        {/* Подвал */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          <div className="sp-no-print sp-t5" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span>Школа Самурая · crm.samu-rai.ru</span>
            <span>Обновляется каждые 30 сек</span>
          </div>
          <div className="sp-print-only sp-t5" style={{ textAlign: 'center', fontSize: 12 }}>
            Школа Самурая · Распечатано {new Date().toLocaleDateString('ru', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  )
}
