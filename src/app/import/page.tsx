'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

type Row = {
  name: string
  phone: string
  group_name: string
  birth_date: string
}

const GROUPS = ['Дети 4-9', 'Подростки (нач)', 'Подростки (оп)', 'Цигун', 'Индивидуальные']

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Фамилия', 'Имя', 'Группа', 'Телефон', 'Дата рождения'],
    ['Иванов', 'Артём', 'Дети 4-9', '', ''],
    ['Петрова', 'Мария', 'Подростки (нач)', '', ''],
    ['Сидоров', 'Кирилл', 'Подростки (оп)', '', ''],
    ['', '', 'Цигун', '', ''],
    ['', '', 'Индивидуальные', '', ''],
  ])
  ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 16 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ученики')
  XLSX.writeFile(wb, 'шаблон_импорта_учеников.xlsx')
}

export default function ImportPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    setRows([])
    setDone(false)
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    const isCsv = file.name.toLowerCase().endsWith('.csv')

    reader.onload = (evt) => {
      try {
        let workbook
        if (isCsv) {
          const text = evt.target?.result as string
          workbook = XLSX.read(text, { type: 'string' })
        } else {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer)
          workbook = XLSX.read(data, { type: 'array' })
        }
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (json.length === 0) {
          setError('Файл пустой или не содержит данных')
          return
        }

        const parsed: Row[] = json.map((r: any) => {
          const lastName = String(r['Фамилия'] || r['фамилия'] || '').trim()
          const firstName = String(r['Имя'] || r['имя'] || '').trim()
          const fullName = lastName && firstName
            ? `${lastName} ${firstName}`
            : String(r['ФИО'] || r['name'] || r['Name'] || r['Имя'] || '').trim()
          return {
            name: fullName,
            phone: String(r['Телефон'] || r['Phone'] || r['phone'] || '').trim(),
            group_name: String(r['Группа'] || r['Group'] || r['group'] || '').trim(),
            birth_date: String(r['Дата рождения'] || r['birth_date'] || r['Дата'] || '').trim(),
          }
        }).filter(r => r.name.length > 0)

        if (parsed.length === 0) {
          setError('Не найдены строки с именами. Убедись что есть колонка "Имя" или "ФИО"')
          return
        }
        setRows(parsed)
      } catch {
        setError('Не удалось прочитать файл. Используй .xlsx или .csv формат')
      }
    }
    if (isCsv) {
      reader.readAsText(file, 'windows-1251')
    } else {
      reader.readAsArrayBuffer(file)
    }
  }

  async function doImport() {
    setImporting(true)
    setImported(0)
    let count = 0
    for (const row of rows) {
      await supabase.from('students').insert({
        name: row.name,
        phone: row.phone || null,
        group_name: row.group_name || null,
        birth_date: row.birth_date || null,
        status: 'active',
      })
      count++
      setImported(count)
    }
    setImporting(false)
    setDone(true)
  }

  function updateRow(idx: number, field: keyof Row, value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/students" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Импорт учеников</h1>
      </div>

      {/* Инструкция */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 text-sm text-blue-700">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">📋 Как подготовить файл:</div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ⬇ Скачать шаблон
          </button>
        </div>
        <div className="text-blue-600">
          Скачай шаблон, вставь своих учеников и загрузи обратно.
        </div>
        <div className="font-mono bg-white rounded-lg px-3 py-2 mt-2 text-xs text-gray-700">
          Фамилия | Имя | Группа | Телефон | Дата рождения
        </div>
        <div className="mt-2">Группы: <span className="font-medium">{GROUPS.join(', ')}</span></div>
      </div>

      {/* Загрузка файла */}
      {!rows.length && !done && (
        <label className="block w-full cursor-pointer">
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-gray-400 transition-colors">
            <div className="text-4xl mb-2">📂</div>
            <div className="font-medium text-gray-700">Нажми чтобы выбрать файл</div>
            <div className="text-sm text-gray-400 mt-1">.xlsx, .xls, .csv</div>
          </div>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
        </label>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">
          ❌ {error}
        </div>
      )}

      {/* Предпросмотр */}
      {rows.length > 0 && !done && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-800">Найдено: {rows.length} учеников</div>
            <label className="text-sm text-blue-600 cursor-pointer">
              Другой файл
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            </label>
          </div>

          <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
            {rows.map((r, idx) => (
              <div key={idx} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">#{idx + 1}</span>
                  <button onClick={() => removeRow(idx)} className="text-gray-300 hover:text-red-400 text-lg">×</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={r.name} onChange={e => updateRow(idx, 'name', e.target.value)}
                    placeholder="Имя *" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none col-span-2" />
                  <input value={r.phone} onChange={e => updateRow(idx, 'phone', e.target.value)}
                    placeholder="Телефон" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none" />
                  <select value={r.group_name} onChange={e => updateRow(idx, 'group_name', e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none bg-white">
                    <option value="">Группа</option>
                    {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {importing ? (
            <div className="text-center py-4">
              <div className="text-gray-600 mb-2">Импортируем... {imported} / {rows.length}</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-black h-2 rounded-full transition-all"
                  style={{ width: `${(imported / rows.length) * 100}%` }} />
              </div>
            </div>
          ) : (
            <button onClick={doImport}
              className="w-full bg-black text-white py-3 rounded-xl font-medium">
              Импортировать {rows.length} учеников
            </button>
          )}
        </>
      )}

      {/* Успех */}
      {done && (
        <div className="text-center py-8">
          <div className="text-5xl mb-4">✅</div>
          <div className="text-xl font-bold text-gray-800 mb-2">Готово!</div>
          <div className="text-gray-500 mb-6">Импортировано {imported} учеников</div>
          <Link href="/students"
            className="bg-black text-white px-6 py-3 rounded-xl font-medium">
            Перейти к ученикам
          </Link>
        </div>
      )}
    </main>
  )
}
