'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

type PreattGroup = {
  label: string
  grades: string[]
  preatt1_date: string
  preatt2_date: string
}

type AttestationEvent = {
  id: string
  title: string
  discipline: string
  event_date: string
  preatt1_date: string | null
  preatt2_date: string | null
  status: string
  preatt_groups: PreattGroup[] | null
}

type Application = {
  id: string
  discipline: string
  current_grade: string
  target_grade: string
  req_tenure_ok: boolean | null
  req_visits_ok: boolean | null
  req_age_ok: boolean | null
  req_override_by: string | null
  paid: boolean
  preatt1_status: string | null
  preatt2_status: string | null
  result: string | null
  result_grade: string | null
  status: string
  students: { name: string } | null
}

const DISC_LABEL: Record<string, string> = {
  aikido: 'Айкидо', wushu: 'Ушу', both: 'Айкидо + Ушу',
}

const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', open: 'Приём заявок', in_progress: 'Идёт', completed: 'Завершена',
}

const PREATT_INFO: Record<string, { symbol: string; color: string }> = {
  approved:    { symbol: '✓', color: '#16a34a' },
  conditional: { symbol: '~', color: '#d97706' },
  rejected:    { symbol: '✗', color: '#ef4444' },
}

const RESULT_INFO: Record<string, { label: string; color: string }> = {
  passed:         { label: 'Сдал',     color: '#16a34a' },
  passed_remarks: { label: 'С замеч.', color: '#d97706' },
  failed:         { label: 'Не сдал',  color: '#ef4444' },
}

const GROUP_COLORS: { bg: string; text: string; border: string }[] = [
  { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
  { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' },
]

export default function AttestationPublicPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<AttestationEvent | null>(null)
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/attestations/${id}/public`)
    if (!res.ok) { setNotFound(true); setLoading(false); return }
    const data = await res.json()
    setEvent(data.event)
    setApps(data.applications)
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

  if (notFound || !event) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <span style={{ color: '#6b7280' }}>Аттестация не найдена</span>
    </div>
  )

  // Build group index map: grade → index
  const groupIndexMap = new Map<string, number>()
  if (event.preatt_groups) {
    event.preatt_groups.forEach((g, idx) => g.grades.forEach(gr => groupIndexMap.set(gr, idx)))
  }

  const studentName = (app: Application) => {
    if (!app.students) return '—'
    return Array.isArray(app.students) ? (app.students[0] as any)?.name : (app.students as any).name
  }

  // Stats
  const totalApps    = apps.length
  const admittedCount = apps.filter(a => a.req_override_by != null || (
    a.req_tenure_ok !== false && a.req_visits_ok !== false && a.req_age_ok !== false &&
    (a.req_tenure_ok !== null || a.req_visits_ok !== null || a.req_age_ok !== null)
  )).length
  const preatt1Count = apps.filter(a => a.preatt1_status === 'approved' || a.preatt1_status === 'conditional').length
  const paidCount    = apps.filter(a => a.paid).length
  const preatt2Count = apps.filter(a => a.preatt2_status === 'approved' || a.preatt2_status === 'conditional').length
  const passedCount  = apps.filter(a => a.result === 'passed' || a.result === 'passed_remarks').length

  const STATS = [
    { icon: '📋', label: 'Заявок',   val: totalApps,    bg: '#f9fafb', color: '#111827' },
    { icon: '✅', label: 'Допущено', val: admittedCount, bg: '#f0fdf4', color: '#15803d' },
    { icon: '1️⃣', label: 'Предатт.1', val: preatt1Count, bg: '#eff6ff', color: '#1d4ed8' },
    { icon: '💳', label: 'Оплатили', val: paidCount,     bg: '#fefce8', color: '#a16207' },
    { icon: '2️⃣', label: 'Предатт.2', val: preatt2Count, bg: '#eff6ff', color: '#1d4ed8' },
    { icon: '🎖', label: 'Сдали',    val: passedCount,   bg: '#f0fdf4', color: '#15803d' },
  ]

  return (
    <div className="sp">
      <style>{`
        body { background: #ffffff !important; color: #111827 !important; }
        .sp  { background: #ffffff; min-height: 100vh; color: #111827; }
        .sp * { box-sizing: border-box; }
        [data-theme="dark"] .sp { background: #ffffff !important; }

        .sp .sp-btn-print   { background: #111827 !important; color: #fff !important; border: none; border-radius: 8px; padding: 8px 16px; font-size: 14px; cursor: pointer; }
        .sp .sp-btn-print:hover { background: #374151 !important; }
        .sp .sp-btn-refresh { background: none; border: none; color: #9ca3af; font-size: 12px; cursor: pointer; }

        @media print {
          @page { size: A4 portrait; margin: 15mm 12mm; }
          .sp-no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          .sp-print-only { display: block !important; }
        }
        @media screen {
          .sp-print-only { display: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>

        {/* Шапка */}
        <div style={{ borderBottom: '2px solid #111827', paddingBottom: 20, marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 4, fontWeight: 600 }}>
              Школа Самурая · Аттестация
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1.3, margin: 0 }}>
              {event.title}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginTop: 8, fontSize: 14, color: '#374151' }}>
              <span>📅 {event.event_date}</span>
              <span>🥋 {DISC_LABEL[event.discipline] || event.discipline}</span>
              <span style={{
                fontSize: 12, padding: '2px 8px', borderRadius: 999, fontWeight: 500,
                background: event.status === 'completed' ? '#f3e8ff' : event.status === 'in_progress' ? '#dbeafe' : event.status === 'open' ? '#dcfce7' : '#f3f4f6',
                color: event.status === 'completed' ? '#7e22ce' : event.status === 'in_progress' ? '#1d4ed8' : event.status === 'open' ? '#15803d' : '#6b7280',
              }}>
                {EVENT_STATUS_LABELS[event.status] || event.status}
              </span>
            </div>
          </div>

          <div className="sp-no-print" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <button className="sp-btn-print" onClick={() => window.print()}>🖨 Печать</button>
            <button className="sp-btn-refresh" onClick={() => load()}>↻ Обновить</button>
            {lastUpdated && (
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{lastUpdated.toLocaleTimeString('ru')}</span>
            )}
          </div>
        </div>

        {/* Расписание предаттестаций */}
        {event.preatt_groups && event.preatt_groups.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {event.preatt_groups.map((g, idx) => {
              const c = GROUP_COLORS[idx % GROUP_COLORS.length]
              return (
                <div key={g.label} style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 10, padding: '6px 12px', fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{g.label}</span>
                  {g.preatt1_date && <span style={{ opacity: 0.8, marginLeft: 8 }}>П1: {g.preatt1_date}</span>}
                  {g.preatt2_date && <span style={{ opacity: 0.8, marginLeft: 8 }}>П2: {g.preatt2_date}</span>}
                </div>
              )
            })}
          </div>
        )}

        {/* Статистика */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 28 }}>
          {STATS.map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 6px', textAlign: 'center', background: s.bg }}>
              <div style={{ fontSize: 16, lineHeight: 1 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1.2, marginTop: 2 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Список */}
        {apps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>Заявок нет</div>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #111827' }}>
                <th style={{ textAlign: 'left', paddingBottom: 10, fontWeight: 600, color: '#6b7280', fontSize: 11, width: 28 }}>#</th>
                <th style={{ textAlign: 'left', paddingBottom: 10, fontWeight: 600, color: '#111827' }}>Ученик</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, fontWeight: 600, color: '#111827', width: 52 }}>Норм.</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, fontWeight: 600, color: '#111827', width: 40 }}>П1</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, fontWeight: 600, color: '#111827', width: 40 }}>П2</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, fontWeight: 600, color: '#111827', width: 32 }}>₽</th>
                <th style={{ textAlign: 'center', paddingBottom: 10, fontWeight: 600, color: '#111827', width: 64 }}>Итог</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app, i) => {
                const groupIdx = groupIndexMap.get(app.target_grade)
                const groupInfo = event.preatt_groups && groupIdx !== undefined ? event.preatt_groups[groupIdx] : null
                const groupColor = groupIdx !== undefined ? GROUP_COLORS[groupIdx % GROUP_COLORS.length] : null

                // Requirements
                const hasOverride = !!app.req_override_by
                const allChecked = app.req_tenure_ok !== null || app.req_visits_ok !== null || app.req_age_ok !== null
                const allOk = app.req_tenure_ok !== false && app.req_visits_ok !== false && app.req_age_ok !== false && allChecked

                let reqEl: React.ReactNode
                if (hasOverride) {
                  reqEl = <span style={{ fontSize: 11, fontWeight: 600, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 5px' }}>доп</span>
                } else if (!allChecked) {
                  reqEl = <span style={{ color: '#d1d5db' }}>—</span>
                } else if (allOk) {
                  reqEl = <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                } else {
                  reqEl = <span style={{ color: '#ef4444', fontWeight: 700 }}>✗</span>
                }

                const preattCell = (status: string | null) => {
                  if (!status) return <span style={{ color: '#d1d5db' }}>—</span>
                  const info = PREATT_INFO[status]
                  return <span style={{ color: info?.color, fontWeight: 700 }}>{info?.symbol}</span>
                }

                return (
                  <tr key={app.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 !== 0 ? '#f9fafb' : '#ffffff' }}>
                    <td style={{ padding: '9px 6px 9px 0', color: '#9ca3af', fontSize: 11, verticalAlign: 'middle' }}>{i + 1}</td>
                    <td style={{ padding: '9px 12px 9px 0', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, color: '#111827' }}>{studentName(app)}</span>
                        {groupInfo && groupColor && (
                          <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, border: `1px solid ${groupColor.border}`, background: groupColor.bg, color: groupColor.text, fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {groupInfo.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                        {app.current_grade} → {app.target_grade}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '9px 4px', verticalAlign: 'middle' }}>{reqEl}</td>
                    <td style={{ textAlign: 'center', padding: '9px 4px', verticalAlign: 'middle' }}>{preattCell(app.preatt1_status)}</td>
                    <td style={{ textAlign: 'center', padding: '9px 4px', verticalAlign: 'middle' }}>{preattCell(app.preatt2_status)}</td>
                    <td style={{ textAlign: 'center', padding: '9px 4px', verticalAlign: 'middle' }}>
                      {app.paid
                        ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                        : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center', padding: '9px 4px', verticalAlign: 'middle', fontSize: 12, fontWeight: 500 }}>
                      {app.result
                        ? <span style={{ color: RESULT_INFO[app.result]?.color }}>{RESULT_INFO[app.result]?.label}</span>
                        : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #111827' }}>
                <td />
                <td style={{ paddingTop: 12, fontSize: 13, fontWeight: 700, color: '#111827' }}>
                  Итого: {totalApps} чел.
                </td>
                <td colSpan={4} style={{ paddingTop: 12, textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                  сдали: {passedCount} · оплатили: {paidCount}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}

        {/* Подвал */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          <div className="sp-no-print" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9ca3af' }}>
            <span>Школа Самурая · crm.samu-rai.ru</span>
            <span>Обновляется каждые 30 сек</span>
          </div>
          <div className="sp-print-only" style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
            Школа Самурая · Распечатано {new Date().toLocaleDateString('ru', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  )
}
