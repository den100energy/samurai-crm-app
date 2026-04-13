'use client'

import { useState, useEffect, useRef } from 'react'
import {
  TrainingLogData,
  emptyTrainingLogData,
  WUSHU_SECTIONS,
  AIKIDO_SECTIONS,
  QIGONG_ITEMS,
  AIKIDO_ATTACKS_ITEMS,
  AIKIDO_TECHNIQUE_ITEMS,
  AIKIDO_POSITIONS,
  AIKIDO_VARIANTS,
} from '@/lib/training-checklists'
import { supabase } from '@/lib/supabase'

type Props = {
  isOpen: boolean
  onClose: () => void
  groupName: string
  trainerName: string
  date: string
  existingLog?: {
    id: string
    data: TrainingLogData
  } | null
}

type TechniqueRow = {
  position: string
  attack: string
  technique: string
  variant: string
}

const emptyRow = (): TechniqueRow => ({ position: '', attack: '', technique: '', variant: '' })

function parseTechniqueRows(items: string[]): TechniqueRow[] {
  const rows = items
    .filter(s => s.startsWith('ROW:'))
    .map(s => {
      const [pos, atk, tech, variant] = s.replace('ROW:', '').split('|')
      return { position: pos || '', attack: atk || '', technique: tech || '', variant: variant || '' }
    })
  return rows.length > 0 ? rows : [emptyRow()]
}

function serializeTechniqueRows(rows: TechniqueRow[]): string[] {
  return rows
    .filter(r => r.position || r.attack || r.technique || r.variant)
    .map(r => `ROW:${r.position}|${r.attack}|${r.technique}|${r.variant}`)
}

// Сгруппированные атаки для <select>
const ATTACK_GROUPS = (() => {
  const groups: Record<string, typeof AIKIDO_ATTACKS_ITEMS[number][]> = {}
  for (const item of AIKIDO_ATTACKS_ITEMS) {
    const g = item.group || 'Другое'
    if (!groups[g]) groups[g] = []
    groups[g].push(item)
  }
  return groups
})()

// Сгруппированные техники для <select>
const TECHNIQUE_GROUPS = (() => {
  const groups: Record<string, typeof AIKIDO_TECHNIQUE_ITEMS[number][]> = {}
  for (const item of AIKIDO_TECHNIQUE_ITEMS) {
    const g = item.group || 'Другое'
    if (!groups[g]) groups[g] = []
    groups[g].push(item)
  }
  return groups
})()

export function TrainingLogSheet({ isOpen, onClose, groupName, trainerName, date, existingLog }: Props) {
  const [log, setLog] = useState<TrainingLogData>(emptyTrainingLogData())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [techniqueRows, setTechniqueRows] = useState<TechniqueRow[]>([emptyRow()])
  const [appliedTechNotes, setAppliedTechNotes] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    // Ушу
    warmup: true,
    fitness: false,
    basic: false,
    applied: false,
    taolu: false,
    qigong: false,
    // Айкидо
    aikido_warmup: true,
    aikido_stretch: false,
    aikido_fitness: false,
    ukemi: false,
    movement: false,
    attacks: false,
    techniques: false,
    weapons: false,
  })
  const [martialArt, setMartialArt] = useState<'wushu' | 'aikido'>(
    groupName.includes('Цигун') || groupName === 'Дети 4-9 лет' || groupName.includes('Подростки') ? 'wushu' : 'aikido'
  )
  const sheetRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)

  // Загрузка существующего лога
  useEffect(() => {
    if (existingLog) {
      setLog(existingLog.data)
      setTechniqueRows(parseTechniqueRows(existingLog.data.aikido_techniques))
      // applied tech notes хранятся в taolu_items[0] для айкидо
      setAppliedTechNotes(existingLog.data.taolu_items[0] || '')
    } else {
      setLog(emptyTrainingLogData())
      setTechniqueRows([emptyRow()])
      setAppliedTechNotes('')
    }
    setSaved(false)
  }, [existingLog, isOpen])

  // Свайп вниз для закрытия
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const onTouchStart = (e: TouchEvent) => {
      startXRef.current = e.touches[0].clientX
      startYRef.current = e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - startYRef.current
      const dx = e.touches[0].clientX - startXRef.current
      if (dy > 50 && Math.abs(dx) < 30) onClose()
    }
    sheet.addEventListener('touchstart', onTouchStart, { passive: true })
    sheet.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      sheet.removeEventListener('touchstart', onTouchStart)
      sheet.removeEventListener('touchmove', onTouchMove)
    }
  }, [onClose])

  function toggleItem(key: keyof TrainingLogData, itemId: string) {
    if (key === 'aikido_etiquette') return
    setLog(prev => {
      const arr = prev[key] as string[]
      return { ...prev, [key]: arr.includes(itemId) ? arr.filter(i => i !== itemId) : [...arr, itemId] }
    })
  }

  function toggleSection(id: string) {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function getGroupedItems(items: readonly { id: string; label: string; icon: string; group?: string }[]) {
    const groups: Record<string, typeof items> = {}
    for (const item of items) {
      const g = item.group || 'Общее'
      if (!groups[g]) groups[g] = []
      ;(groups[g] as { id: string; label: string; icon: string; group?: string }[]).push(item)
    }
    return groups
  }

  function updateRow(idx: number, field: keyof TechniqueRow, value: string) {
    setTechniqueRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function addRow() {
    if (techniqueRows.length < 7) setTechniqueRows(prev => [...prev, emptyRow()])
  }

  function removeRow(idx: number) {
    setTechniqueRows(prev => {
      const next = prev.filter((_, i) => i !== idx)
      return next.length > 0 ? next : [emptyRow()]
    })
  }

  async function saveLog() {
    if (!trainerName) return
    setSaving(true)

    // Для айкидо: сериализуем строки техник и прикладные заметки
    const saveData: TrainingLogData = martialArt === 'aikido'
      ? {
          ...log,
          aikido_techniques: serializeTechniqueRows(techniqueRows),
          taolu_items: appliedTechNotes ? [appliedTechNotes] : [],
        }
      : { ...log }

    if (existingLog) {
      await supabase
        .from('training_logs')
        .update({ ...saveData, updated_at: new Date().toISOString() })
        .eq('id', existingLog.id)
    } else {
      await supabase.from('training_logs').insert({
        group_name: groupName,
        trainer_name: trainerName,
        date,
        ...saveData,
      })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => onClose(), 800)
  }

  // Кастомный рендер для раздела техник (только Айкидо)
  function renderAikidoTechniques() {
    const expanded = expandedSections['techniques']
    const filledRows = techniqueRows.filter(r => r.position || r.attack || r.technique || r.variant).length

    const selectCls = 'flex-1 min-w-0 border border-gray-200 rounded-lg px-1.5 py-1.5 text-xs outline-none focus:border-indigo-400 bg-white text-gray-800'

    return (
      <div key="techniques" className="border-b border-gray-100">
        <button
          onClick={() => toggleSection('techniques')}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🥋</span>
            <span className="font-medium text-gray-800">Техники</span>
            {filledRows > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                {filledRows}
              </span>
            )}
          </div>
          <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {expanded && (
          <div className="px-4 pb-4">
            {/* Строки техник */}
            <div className="space-y-2 mb-3">
              {techniqueRows.map((row, idx) => (
                <div key={idx} className="bg-gray-50 rounded-xl p-2 relative pr-8">
                  <div className="text-xs text-gray-400 font-medium mb-1.5">Техника {idx + 1}</div>
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    {/* Положение */}
                    <select
                      value={row.position}
                      onChange={e => updateRow(idx, 'position', e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Положение</option>
                      {AIKIDO_POSITIONS.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>

                    {/* Вариант */}
                    <select
                      value={row.variant}
                      onChange={e => updateRow(idx, 'variant', e.target.value)}
                      className={selectCls}
                    >
                      {AIKIDO_VARIANTS.map(v => (
                        <option key={v.id} value={v.id}>{v.id === '' ? 'Вариант' : v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Атака */}
                    <select
                      value={row.attack}
                      onChange={e => updateRow(idx, 'attack', e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Атака</option>
                      {Object.entries(ATTACK_GROUPS).map(([grp, items]) => (
                        <optgroup key={grp} label={grp}>
                          {items.map(item => (
                            <option key={item.id} value={item.id}>{item.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    {/* Техника */}
                    <select
                      value={row.technique}
                      onChange={e => updateRow(idx, 'technique', e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Техника</option>
                      {Object.entries(TECHNIQUE_GROUPS).map(([grp, items]) => (
                        <optgroup key={grp} label={grp}>
                          {items.map(item => (
                            <option key={item.id} value={item.id}>{item.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Удалить строку */}
                  <button
                    onClick={() => removeRow(idx)}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full text-sm transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Кнопка + добавить строку */}
            {techniqueRows.length < 7 && (
              <button
                onClick={addRow}
                className="w-full border border-dashed border-gray-300 text-gray-500 text-sm py-2 rounded-xl hover:border-indigo-400 hover:text-indigo-600 transition-colors mb-3"
              >
                + Добавить технику
              </button>
            )}

            {/* Прикладные и иные техники — свободный текст */}
            <div>
              <div className="text-xs text-gray-500 font-medium mb-1">Прикладные и иные техники</div>
              <textarea
                value={appliedTechNotes}
                onChange={e => setAppliedTechNotes(e.target.value)}
                placeholder="Произвольные техники, особенности выполнения..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderSection(section: { id: string; title: string; icon: string; items: readonly { id: string; label: string; icon: string; group?: string }[]; dataKey: keyof TrainingLogData }) {
    // Кастомный рендер для техник айкидо
    if (section.id === 'techniques' && martialArt === 'aikido') {
      return renderAikidoTechniques()
    }

    const expanded = expandedSections[section.id]
    const checkedCount = (log[section.dataKey] as string[]).length
    const total = section.items.length
    const isComplete = checkedCount === total && total > 0

    return (
      <div key={section.id} className="border-b border-gray-100 last:border-b-0">
        <button
          onClick={() => toggleSection(section.id)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{section.icon}</span>
            <span className="font-medium text-gray-800 text-left">{section.title}</span>
            {checkedCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                isComplete ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {checkedCount}/{total}
              </span>
            )}
          </div>
          <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {expanded && (
          <div className="px-4 pb-3">
            {(() => {
              const grouped = getGroupedItems(section.items)
              return Object.entries(grouped).map(([grpName, items]) => (
                <div key={grpName} className="mb-2 last:mb-0">
                  <div className="text-xs text-gray-500 font-medium mb-1">{grpName}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map(item => {
                      const checked = (log[section.dataKey] as string[]).includes(item.id)
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleItem(section.dataKey, item.id)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm border transition-all
                            ${checked
                              ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                            }`}
                        >
                          <span className="text-xs">{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}
      </div>
    )
  }

  if (!isOpen) return null

  const sections = martialArt === 'wushu' ? WUSHU_SECTIONS : AIKIDO_SECTIONS

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 transition-opacity" onClick={onClose} />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative w-full bg-white rounded-t-3xl max-h-[90vh] flex flex-col animate-slide-up"
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">📝 Журнал тренировки</h2>
            <p className="text-xs text-gray-500">
              {groupName} · {new Date(date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Martial Art Toggle */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
          <button
            onClick={() => setMartialArt('wushu')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
              ${martialArt === 'wushu' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            🥋 Ушу
          </button>
          <button
            onClick={() => setMartialArt('aikido')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
              ${martialArt === 'aikido' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            ⚔️ Айкидо
          </button>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto">
          {sections.map(renderSection)}

          {/* Цигун — для обоих */}
          <div className="border-b border-gray-100">
            {(() => {
              const expanded = expandedSections['qigong']
              const qigongChecked = log.qigong_items.length
              return (
                <>
                  <button
                    onClick={() => toggleSection('qigong')}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧘</span>
                      <span className="font-medium text-gray-800">Цигун и медитация</span>
                      {qigongChecked > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          {qigongChecked}
                        </span>
                      )}
                    </div>
                    <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {QIGONG_ITEMS.map(item => {
                          const checked = log.qigong_items.includes(item.id)
                          return (
                            <button
                              key={item.id}
                              onClick={() => setLog(prev => ({
                                ...prev,
                                qigong_items: checked
                                  ? prev.qigong_items.filter(i => i !== item.id)
                                  : [...prev.qigong_items, item.id],
                              }))}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm border transition-all
                                ${checked ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                            >
                              <span className="text-xs">{item.icon}</span>
                              <span>{item.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Notes */}
          <div className="px-4 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ✍️ Заметка тренера <span className="text-gray-400 font-normal">(необязательно)</span>
            </label>
            <textarea
              value={log.notes}
              onChange={e => setLog(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Например: «Иккё — работали стоя с катаэ дори, большинство путают омотэ/ура»"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-3">
          <button
            onClick={saveLog}
            disabled={saving}
            className={`w-full py-3 rounded-xl font-medium text-white transition-colors
              ${saving ? 'bg-gray-400' : saved ? 'bg-green-500' : 'bg-black hover:bg-gray-800'}`}
          >
            {saved ? '✓ Сохранено!' : saving ? 'Сохранение...' : existingLog ? 'Обновить журнал' : 'Сохранить журнал'}
          </button>
        </div>
      </div>
    </div>
  )
}
