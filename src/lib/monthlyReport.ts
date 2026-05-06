import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Конфигурация листов: одиночные группы + объединённый лист "Основная"
type SheetConfig =
  | { title: string; type: 'single'; group: string }
  | { title: string; type: 'combined'; groups: string[] }

const SHEET_CONFIGS: SheetConfig[] = [
  { title: 'Старт',          type: 'single',   group: 'Старт' },
  { title: 'Основная',       type: 'combined', groups: ['Основная (нач.)', 'Основная (оп.)'] },
  { title: 'Цигун',          type: 'single',   group: 'Цигун' },
  { title: 'Индивидуальные', type: 'single',   group: 'Индивидуальные' },
]

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

// ─── Google Sheets REST ──────────────────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')
  const signingInput = `${header}.${payload}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(key, 'base64url')
  const jwt = `${signingInput}.${signature}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

async function sheetsGet(token: string, spreadsheetId: string) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

async function sheetsValuesUpdate(token: string, spreadsheetId: string, sheetTitle: string, values: (string | number)[][]) {
  const range = encodeURIComponent(`'${sheetTitle}'!A1`)
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
}

async function sheetsBatchUpdate(token: string, spreadsheetId: string, requests: unknown[]) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })
  return res.json()
}

// ─── Форматирование ──────────────────────────────────────────────────────────

function fmt(d: string | null | undefined): string {
  if (!d) return ''
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${day}.${m}.${y}`
}

function fmtShort(d: string): string {
  const [, m, day] = d.split('-')
  return `${day}.${m}`
}

function subLabel(type: string | null): string {
  if (!type) return 'Абонемент'
  return type.includes('|') ? type.split('|')[1] : type
}

type Sub = {
  student_id: string; type: string | null; sessions_left: number | null
  end_date: string | null; created_at: string; is_pending: boolean
}

// ─── Генерация данных листа (одна или несколько групп) ───────────────────────

async function generateSheetData(groups: string[], year: number, month: number, showGroup: boolean) {
  const mm = String(month).padStart(2, '0')
  const startDate = `${year}-${mm}-01`
  const nm = month === 12 ? 1 : month + 1
  const ny = month === 12 ? year + 1 : year
  const endDate = `${ny}-${String(nm).padStart(2, '0')}-01`

  // Все посещения по всем группам этого листа
  const { data: attRows } = await supabase
    .from('attendance').select('date, student_id, group_name')
    .in('group_name', groups).eq('present', true)
    .gte('date', startDate).lt('date', endDate)

  // Уникальные даты тренировок + для объединённого листа отмечаем группу
  const dateGroupMap = new Map<string, string>() // date → группа (для заголовка)
  ;(attRows || []).forEach(a => {
    const d = String(a.date).slice(0, 10)
    if (!dateGroupMap.has(d)) {
      // Для объединённого листа добавляем сокращение группы
      const groupSuffix = showGroup
        ? (a.group_name === 'Основная (нач.)' ? '\nнач.' : '\nоп.')
        : ''
      dateGroupMap.set(d, groupSuffix)
    }
  })
  const trainingDates = Array.from(dateGroupMap.keys()).sort()
  if (trainingDates.length === 0) return null

  // Все студенты из всех групп этого листа
  const { data: students } = await supabase
    .from('students').select('id, name, group_name')
    .in('group_name', groups).eq('status', 'active')
    .order('group_name').order('name')
  if (!students || students.length === 0) return null

  // Для каждого студента собираем все его посещения (включая гостевые в других группах листа)
  // Дополнительно ищем посещения студентов как гостей в любых группах
  const studentIds = students.map(s => s.id)
  const { data: allAttRows } = await supabase
    .from('attendance').select('date, student_id')
    .in('student_id', studentIds).eq('present', true)
    .gte('date', startDate).lt('date', endDate)

  // attMap: studentId → Set<date> (все их посещения за месяц, в любой группе)
  const attMap = new Map<string, Set<string>>()
  ;(allAttRows || []).forEach(a => {
    const d = String(a.date).slice(0, 10)
    // Учитываем только даты которые есть в заголовке листа
    if (dateGroupMap.has(d)) {
      if (!attMap.has(a.student_id)) attMap.set(a.student_id, new Set())
      attMap.get(a.student_id)!.add(d)
    }
  })

  // Абонементы
  const { data: subsData } = await supabase
    .from('subscriptions').select('id, student_id, type, sessions_left, end_date, created_at, is_pending')
    .in('student_id', studentIds).order('created_at', { ascending: true })

  const subMap = new Map<string, Sub[]>()
  ;(subsData || []).filter(s => !s.is_pending).forEach(sub => {
    if (!subMap.has(sub.student_id)) subMap.set(sub.student_id, [])
    subMap.get(sub.student_id)!.push(sub as Sub)
  })

  // Заголовок
  const groupCol = showGroup ? ['Группа'] : []
  const header = [
    'Клиент', ...groupCol, 'Абонемент',
    ...trainingDates.map((d, i) => `${i + 1}\n${fmtShort(d)}${dateGroupMap.get(d) || ''}`),
    'Пос.\nтрен.', 'Посетил\nпо 1 абон.', 'Осталось\nпо 1 абон.', 'Итого\nпо 1 абон.',
    'Пос.\nпо 2 абон.', 'Осталось\nпо 2 абон.', 'Итого\nосталось', 'Статус',
    'Начало\n1 абон.', 'Конец\n1 абон.', 'Начало\n2 абон.', 'Конец\n2 абон.',
  ]

  const today = new Date().toISOString().split('T')[0]
  const rows: (string | number)[][] = [header]

  for (const student of students) {
    const attended = attMap.get(student.id) || new Set<string>()
    const subs = subMap.get(student.id) || []

    // Абонементы, активные в этом месяце
    const relevant = subs.filter(s =>
      s.created_at.slice(0, 10) < endDate && (!s.end_date || s.end_date >= startDate)
    )
    const pool = relevant.length > 0 ? relevant : subs.slice(-2)
    const sub1 = pool.length >= 2 ? pool[pool.length - 2] : (pool[0] || null)
    const sub2 = pool.length >= 2 ? pool[pool.length - 1] : null

    const totalAttended = attended.size
    let att1 = totalAttended, att2 = 0
    if (sub2 && sub1) {
      const c = sub2.created_at.slice(0, 10)
      att1 = Array.from(attended).filter(d => d < c).length
      att2 = Array.from(attended).filter(d => d >= c).length
    }

    const activeSub = sub2 || sub1
    let status = ''
    if (activeSub) {
      const daysLeft = activeSub.end_date
        ? Math.ceil((new Date(activeSub.end_date).getTime() - new Date(today).getTime()) / 86400000)
        : null
      const sl = activeSub.sessions_left
      if ((sl !== null && sl <= 0) || (activeSub.end_date && activeSub.end_date < today)) status = 'Окончен'
      else if ((sl !== null && sl <= 3) || (daysLeft !== null && daysLeft <= 14)) status = 'Заканчивается'
      else status = 'Актив'
    }

    const sub1Remaining = sub1?.sessions_left ?? (sub1 ? '∞' : '')
    const sub1Total = sub1 && sub1.sessions_left !== null ? (sub1.sessions_left as number) + att1 : (sub1 ? '∞' : '')
    const sub2Remaining = sub2?.sessions_left ?? (sub2 ? '∞' : '')
    const totalRemaining = (() => {
      const vals = [sub1, sub2].filter(Boolean) as Sub[]
      if (vals.some(s => s.sessions_left === null)) return '∞'
      return vals.reduce((acc, s) => acc + (s.sessions_left || 0), 0)
    })()

    // Сокращённое название группы для столбца
    const groupShort = student.group_name === 'Основная (нач.)' ? 'нач.'
      : student.group_name === 'Основная (оп.)' ? 'оп.'
      : (student.group_name || '')

    rows.push([
      student.name,
      ...(showGroup ? [groupShort] : []),
      subLabel((sub2 || sub1)?.type ?? null),
      ...trainingDates.map(d => attended.has(d) ? fmtShort(d) : ''),
      totalAttended, att1, sub1Remaining, sub1Total,
      sub2 ? att2 : '', sub2 ? sub2Remaining : '',
      totalRemaining, status,
      sub1 ? fmt(sub1.created_at) : '', sub1 ? fmt(sub1.end_date) : '',
      sub2 ? fmt(sub2.created_at) : '', sub2 ? fmt(sub2.end_date) : '',
    ])
  }

  return { rows, colCount: header.length }
}

// ─── Главная функция ─────────────────────────────────────────────────────────

export async function generateMonthlyReport(month: number, year: number) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!
  const token = await getGoogleAccessToken()
  const sp = await sheetsGet(token, spreadsheetId)
  const existingSheets: { properties: { title: string; sheetId: number } }[] = sp.sheets || []

  const monthName = MONTH_NAMES_RU[month - 1]
  const yearShort = String(year).slice(2)
  const results: { group: string; status: string; rows?: number }[] = []

  for (const config of SHEET_CONFIGS) {
    const sheetTitle = `${config.title} ${monthName} ${yearShort}`
    const groups = config.type === 'combined' ? config.groups : [config.group]
    const showGroup = config.type === 'combined'

    // Удаляем старый лист если есть
    const old = existingSheets.find(s => s.properties?.title === sheetTitle)
    if (old?.properties?.sheetId != null) {
      await sheetsBatchUpdate(token, spreadsheetId, [{ deleteSheet: { sheetId: old.properties.sheetId } }])
    }

    const data = await generateSheetData(groups, year, month, showGroup)
    if (!data) { results.push({ group: config.title, status: 'нет данных' }); continue }

    const addResp = await sheetsBatchUpdate(token, spreadsheetId, [
      { addSheet: { properties: { title: sheetTitle } } },
    ])
    const sheetId = addResp.replies?.[0]?.addSheet?.properties?.sheetId
    await sheetsValuesUpdate(token, spreadsheetId, sheetTitle, data.rows)

    if (sheetId != null) {
      await sheetsBatchUpdate(token, spreadsheetId, [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 }, wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' } },
            fields: 'userEnteredFormat(textFormat,backgroundColor,wrapStrategy,verticalAlignment)',
          },
        },
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
        { autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: data.colCount } } },
      ])
    }
    results.push({ group: config.title, status: 'ok', rows: data.rows.length - 1 })
  }

  return { ok: true, month, year, results, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` }
}
