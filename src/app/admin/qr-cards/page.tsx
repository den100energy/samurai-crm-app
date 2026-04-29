'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Student = {
  id: string
  name: string
  group_name: string | null
  cabinet_token: string | null
  parent_token: string | null
}

type CardType = 'cabinet' | 'parent'
type FilterMode = 'all' | 'group' | 'select'

export default function QrCardsPage() {
  const { role } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [cardType, setCardType] = useState<CardType>('parent')
  const [origin, setOrigin] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setOrigin(window.location.origin)
    loadStudents()
  }, [])

  async function loadStudents() {
    const { data } = await supabase
      .from('students')
      .select('id, name, group_name, cabinet_token, parent_token')
      .eq('status', 'active')
      .order('name')
    const list = data ?? []
    setStudents(list)
    const uniqueGroups = [...new Set(list.map(s => s.group_name).filter(Boolean))] as string[]
    setGroups(uniqueGroups.sort())
    if (uniqueGroups.length > 0) setSelectedGroup(uniqueGroups[0])
    setLoading(false)
  }

  if (role !== 'founder' && role !== 'admin') {
    return <div className="p-8 text-center text-gray-400">Нет доступа</div>
  }

  const hasToken = (s: Student) =>
    cardType === 'cabinet' ? !!s.cabinet_token : !!s.parent_token

  const searchedStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const withToken: Student[] = (() => {
    if (filterMode === 'all') return students.filter(hasToken)
    if (filterMode === 'group') return students.filter(s => s.group_name === selectedGroup && hasToken(s))
    return students.filter(s => selectedIds.has(s.id) && hasToken(s))
  })()

  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    const visibleIds = searchedStudents.map(s => s.id)
    const allSelected = visibleIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => next.add(id))
      return next
    })
  }

  const cardLabel = cardType === 'parent' ? 'кабинет родителя' : 'кабинет ученика'
  const cardEmoji = cardType === 'parent' ? '👨‍👩‍👧' : '🥋'

  return (
    <>
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-page { margin: 0 !important; padding: 8mm !important; }
          .qr-card { page-break-inside: avoid; break-inside: avoid; }
          .print-sheet { grid-gap: 0 !important; }
        }
        @page {
          size: A4;
          margin: 0;
        }
      `}</style>

      <main className="max-w-5xl mx-auto p-4 print-page">
        {/* Панель управления */}
        <div className="no-print">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
            <h1 className="text-xl font-bold text-gray-800">QR-карточки для собрания</h1>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-4 space-y-3">

            {/* Тип карточки */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Тип карточки</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCardType('parent')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                    cardType === 'parent'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  👨‍👩‍👧 Родителям
                </button>
                <button
                  onClick={() => setCardType('cabinet')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                    cardType === 'cabinet'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  🥋 Ученикам
                </button>
              </div>
            </div>

            {/* Фильтр */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Кому печатать</div>
              <div className="flex gap-2">
                {(['all', 'group', 'select'] as FilterMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                      filterMode === mode
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    {mode === 'all' ? 'Все' : mode === 'group' ? 'Группа' : 'Выборочно'}
                  </button>
                ))}
              </div>
            </div>

            {/* Выбор группы */}
            {filterMode === 'group' && (
              <div>
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {groups.map(g => {
                    const count = students.filter(s => s.group_name === g).length
                    return <option key={g} value={g}>{g} ({count})</option>
                  })}
                </select>
              </div>
            )}

            {/* Выборочный список */}
            {filterMode === 'select' && (
              <div>
                <input
                  type="text"
                  placeholder="Поиск по имени..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
                />
                <div className="flex items-center justify-between mb-1 px-1">
                  <span className="text-xs text-gray-500">
                    Выбрано: <b>{selectedIds.size}</b>
                  </span>
                  <button
                    onClick={toggleAllVisible}
                    className="text-xs text-orange-500 hover:text-orange-600"
                  >
                    {searchedStudents.every(s => selectedIds.has(s.id)) ? 'Снять всех' : 'Выбрать всех'}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                  {searchedStudents.map(s => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="accent-orange-500"
                      />
                      <span className="text-sm text-gray-800 flex-1">{s.name}</span>
                      {s.group_name && (
                        <span className="text-xs text-gray-400">{s.group_name}</span>
                      )}
                    </label>
                  ))}
                  {searchedStudents.length === 0 && (
                    <div className="px-3 py-4 text-sm text-gray-400 text-center">Ничего не найдено</div>
                  )}
                </div>
              </div>
            )}

            {/* Счётчик */}
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              Будет напечатано: <b>{withToken.length}</b> {withToken.length === 1 ? 'карточка' : 'карточек'}
              {withToken.length > 0 && (
                <>{' · '}на листах A4: <b>{Math.ceil(withToken.length / 8)}</b>{' · '}по 8 на лист (2×4)</>
              )}
              {filterMode !== 'select' && students.filter(filterMode === 'all' ? () => true : s => s.group_name === selectedGroup).length !== withToken.length && (
                <div className="mt-1 text-red-500">
                  ⚠️ У части учеников нет токена — они пропущены
                </div>
              )}
            </div>

            <button
              onClick={() => window.print()}
              disabled={withToken.length === 0}
              className="w-full bg-black text-white py-3 rounded-xl font-medium disabled:opacity-40"
            >
              🖨 Печать
            </button>
          </div>
        </div>

        {loading && <div className="text-center text-gray-400">Загрузка...</div>}

        {/* Сетка карточек: 2×4 = 8 на лист A4 */}
        {!loading && withToken.length > 0 && (
          <div
            className="print-sheet grid grid-cols-2 gap-2 bg-white"
            style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          >
            {withToken.map(student => {
              const token = cardType === 'cabinet' ? student.cabinet_token! : student.parent_token!
              const url = `${origin}/${cardType === 'cabinet' ? 'cabinet' : 'parent'}/${token}`
              return (
                <div
                  key={student.id}
                  className="qr-card border border-dashed border-gray-300 p-3 flex gap-3 items-center"
                  style={{ height: '68mm', breakInside: 'avoid' }}
                >
                  <div className="flex-shrink-0 bg-white p-1 rounded">
                    <QRCodeSVG value={url} size={140} level="M" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-orange-600 font-bold mb-1">🥋 Школа Самурая</div>
                    <div className="text-base font-bold text-gray-900 leading-tight mb-1 break-words">
                      {student.name}
                    </div>
                    {student.group_name && (
                      <div className="text-xs text-gray-500 mb-2">{student.group_name}</div>
                    )}
                    <div className="text-[10px] text-gray-600 leading-tight">
                      <div className="font-medium">{cardEmoji} Ваш {cardLabel}</div>
                      <div className="text-gray-400 mt-0.5">Наведите камеру → откроется кабинет</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && withToken.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            {filterMode === 'select'
              ? 'Выберите учеников в списке выше'
              : 'Нет карточек для печати. Проверьте фильтр группы или токены у учеников.'}
          </div>
        )}
      </main>
    </>
  )
}
