'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type SubType = {
  id: string
  name: string
  group_type: string | null
  sessions_count: number | null
  price: number | null
  price_per_session: number | null
  duration_months: number | null
  description: string | null
  bonuses: Record<string, number> | null
  bonus_total_value: number | null
  is_for_newcomers: boolean | null
}

type TgGroup = {
  id: string
  name: string
  invite_link: string
  description: string | null
  group_names: string[]
}

const STUDENT_GROUPS = ['Старт', 'Основная (нач.)', 'Основная (оп.)', 'Цигун', 'Индивидуальные']

type BonusRow = { name: string; count: string }

const emptyForm = { name: '', group_type: 'Старт', sessions_count: '', price: '', price_per_session: '', description: '', duration_months: '', bonus_total_value: '', is_for_newcomers: false }
const emptyTgForm = { name: '', invite_link: '', description: '', group_names: [] as string[] }

export default function SettingsPage() {
  const [types, setTypes] = useState<SubType[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [bonusRows, setBonusRows] = useState<BonusRow[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [tgGroups, setTgGroups] = useState<TgGroup[]>([])
  const [tgShowForm, setTgShowForm] = useState(false)
  const [tgForm, setTgForm] = useState(emptyTgForm)
  const [tgEditId, setTgEditId] = useState<string | null>(null)
  const [tgSaving, setTgSaving] = useState(false)

  useEffect(() => { load(); loadTg() }, [])

  async function load() {
    const { data } = await supabase.from('subscription_types').select('*').order('created_at')
    setTypes(data || [])
  }

  async function loadTg() {
    const { data } = await supabase.from('telegram_groups').select('*').order('created_at')
    setTgGroups(data || [])
  }

  function startEditTg(g: TgGroup) {
    setTgEditId(g.id)
    setTgForm({ name: g.name, invite_link: g.invite_link, description: g.description || '', group_names: g.group_names || [] })
    setTgShowForm(true)
  }

  function toggleTgGroup(grp: string) {
    setTgForm(f => ({
      ...f,
      group_names: f.group_names.includes(grp)
        ? f.group_names.filter(g => g !== grp)
        : [...f.group_names, grp],
    }))
  }

  async function saveTg(e: React.FormEvent) {
    e.preventDefault()
    setTgSaving(true)
    const payload = { name: tgForm.name, invite_link: tgForm.invite_link, description: tgForm.description || null, group_names: tgForm.group_names }
    if (tgEditId) {
      await supabase.from('telegram_groups').update(payload).eq('id', tgEditId)
    } else {
      await supabase.from('telegram_groups').insert(payload)
    }
    setTgShowForm(false)
    setTgEditId(null)
    setTgForm(emptyTgForm)
    setTgSaving(false)
    loadTg()
  }

  async function removeTg(id: string) {
    if (!confirm('Удалить группу?')) return
    await supabase.from('telegram_groups').delete().eq('id', id)
    loadTg()
  }

  function startEdit(t: SubType) {
    setEditId(t.id)
    setForm({
      name: t.name,
      group_type: t.group_type || 'Старт',
      sessions_count: t.sessions_count?.toString() || '',
      price: t.price?.toString() || '',
      price_per_session: t.price_per_session?.toString() || '',
      description: t.description || '',
      duration_months: t.duration_months?.toString() || '',
      bonus_total_value: t.bonus_total_value?.toString() || '',
      is_for_newcomers: t.is_for_newcomers || false,
    })
    const rows: BonusRow[] = Object.entries(t.bonuses || {}).map(([name, count]) => ({
      name,
      count: count.toString(),
    }))
    setBonusRows(rows)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm)
    setBonusRows([])
  }

  function addBonusRow() {
    setBonusRows(prev => [...prev, { name: '', count: '1' }])
  }

  function updateBonusRow(i: number, field: keyof BonusRow, value: string) {
    setBonusRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function removeBonusRow(i: number) {
    setBonusRows(prev => prev.filter((_, idx) => idx !== i))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const bonuses: Record<string, number> = {}
    bonusRows.forEach(r => {
      if (r.name.trim()) bonuses[r.name.trim()] = parseInt(r.count) || 1
    })
    const payload = {
      name: form.name,
      group_type: form.group_type || null,
      sessions_count: form.sessions_count ? parseInt(form.sessions_count) : null,
      price: form.price ? parseFloat(form.price) : null,
      price_per_session: form.price_per_session ? parseFloat(form.price_per_session) : null,
      description: form.description || null,
      duration_months: form.duration_months ? parseFloat(form.duration_months) : null,
      bonuses,
      bonus_total_value: form.bonus_total_value ? parseFloat(form.bonus_total_value) : null,
      is_for_newcomers: form.is_for_newcomers,
    }
    if (editId) {
      await supabase.from('subscription_types').update(payload).eq('id', editId)
    } else {
      await supabase.from('subscription_types').insert(payload)
    }
    cancelForm()
    setSaving(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Удалить тип абонемента?')) return
    await supabase.from('subscription_types').delete().eq('id', id)
    load()
  }

  const groups = ['Старт', 'Комбат', ...Array.from(new Set(types.map(t => t.group_type).filter(Boolean))).filter(g => g !== 'Старт' && g !== 'Комбат')] as string[]
  const otherTypes = types.filter(t => !t.group_type || !['Старт', 'Комбат'].includes(t.group_type))

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-500 hover:text-black text-xl font-bold leading-none">←</Link>
        <h1 className="text-xl font-bold text-gray-800">Настройки</h1>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-gray-800">Типы абонементов</div>
          <button
            onClick={() => { cancelForm(); setShowForm(true) }}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl"
          >
            + Добавить
          </button>
        </div>

        {showForm && (
          <form onSubmit={save} className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <div className="text-xs font-medium text-gray-500 mb-1">
              {editId ? 'Редактировать абонемент' : 'Новый тип абонемента'}
            </div>

            <select value={form.group_type} onChange={e => setForm({ ...form, group_type: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
              <option value="Старт">Старт</option>
              <option value="Комбат">Комбат</option>
              <option value="Другое">Другое</option>
            </select>

            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Название *"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />

            <div className="flex gap-2">
              <input type="number" value={form.sessions_count}
                onChange={e => setForm({ ...form, sessions_count: e.target.value })}
                placeholder="Кол-во занятий"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              <input type="number" value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                placeholder="Цена (₽)"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex gap-2">
              <input type="number" value={form.price_per_session}
                onChange={e => setForm({ ...form, price_per_session: e.target.value })}
                placeholder="Цена 1 трен. (₽)"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              <input type="number" step="0.5" value={form.duration_months}
                onChange={e => setForm({ ...form, duration_months: e.target.value })}
                placeholder="Срок (мес), напр. 1.5"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>

            <input type="number" value={form.bonus_total_value}
              onChange={e => setForm({ ...form, bonus_total_value: e.target.value })}
              placeholder="Сумма бонусов (₽)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />

            <label className="flex items-center gap-2 px-1 cursor-pointer">
              <input type="checkbox" checked={form.is_for_newcomers}
                onChange={e => setForm({ ...form, is_for_newcomers: e.target.checked })}
                className="w-4 h-4 rounded" />
              <span className="text-sm text-gray-700">Только для новичков (первая покупка)</span>
            </label>

            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Описание (необязательно)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />

            {/* Bonus editor */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-medium text-gray-500">Бонусы</div>
                <button type="button" onClick={addBonusRow}
                  className="text-xs text-blue-500 border border-blue-200 px-2 py-0.5 rounded-lg">
                  + Добавить бонус
                </button>
              </div>
              {bonusRows.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-1">Бонусов нет</div>
              )}
              {bonusRows.map((row, i) => (
                <div key={i} className="flex gap-2 mb-1.5 items-center">
                  <input value={row.name} onChange={e => updateBonusRow(i, 'name', e.target.value)}
                    placeholder="Название бонуса"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none" />
                  <input type="number" min="1" value={row.count}
                    onChange={e => updateBonusRow(i, 'count', e.target.value)}
                    className="w-14 border border-gray-200 rounded-xl px-2 py-1.5 text-sm outline-none text-center" />
                  <button type="button" onClick={() => removeBonusRow(i)}
                    className="text-red-400 text-sm px-1">✕</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button type="button" onClick={cancelForm}
                className="px-4 border border-gray-200 text-gray-500 py-2 rounded-xl text-sm">
                Отмена
              </button>
            </div>
          </form>
        )}

        {types.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">
            Нет типов абонементов — добавьте первый
          </div>
        ) : (
          <div className="space-y-4">
            {['Старт', 'Комбат'].map(group => {
              const items = types.filter(t => t.group_type === group)
              if (!items.length) return null
              return (
                <div key={group}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group}</div>
                  <div className="space-y-2">
                    {items.map(t => <TypeCard key={t.id} t={t} onEdit={startEdit} onRemove={remove} />)}
                  </div>
                </div>
              )
            })}
            {otherTypes.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Другие</div>
                <div className="space-y-2">
                  {otherTypes.map(t => <TypeCard key={t.id} t={t} onEdit={startEdit} onRemove={remove} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Telegram группы */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-gray-800">Telegram-группы</div>
            <div className="text-xs text-gray-400 mt-0.5">Ссылки показываются родителям, отметившим галочку в анкете</div>
          </div>
          <button onClick={() => { setTgShowForm(true); setTgEditId(null); setTgForm(emptyTgForm) }}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl shrink-0">
            + Добавить
          </button>
        </div>

        {tgShowForm && (
          <form onSubmit={saveTg} className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <div className="text-xs font-medium text-gray-500 mb-1">
              {tgEditId ? 'Редактировать группу' : 'Новая группа'}
            </div>
            <input required value={tgForm.name} onChange={e => setTgForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Название группы *"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            <input required value={tgForm.invite_link} onChange={e => setTgForm(f => ({ ...f, invite_link: e.target.value }))}
              placeholder="Ссылка-приглашение * (https://t.me/+...)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none font-mono" />
            <input value={tgForm.description} onChange={e => setTgForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Описание (необязательно, например: общение учеников группы)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />

            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">
                Для каких учебных групп? <span className="font-normal text-gray-400">(если не выбрано — показывается всем)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STUDENT_GROUPS.map(grp => (
                  <button key={grp} type="button" onClick={() => toggleTgGroup(grp)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                      ${tgForm.group_names.includes(grp) ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-600'}`}>
                    {tgForm.group_names.includes(grp) ? '✓ ' : ''}{grp}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={tgSaving}
                className="flex-1 bg-black text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {tgSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button type="button" onClick={() => { setTgShowForm(false); setTgEditId(null); setTgForm(emptyTgForm) }}
                className="px-4 border border-gray-200 text-gray-500 py-2 rounded-xl text-sm">
                Отмена
              </button>
            </div>
          </form>
        )}

        {tgGroups.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">Нет групп — добавьте первую</div>
        ) : (
          <div className="space-y-2">
            {tgGroups.map(g => (
              <div key={g.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm">📢 {g.name}</div>
                  {g.description && <div className="text-xs text-gray-400 mt-0.5">{g.description}</div>}
                  <div className="text-xs text-blue-500 mt-0.5 truncate">{g.invite_link}</div>
                  {g.group_names?.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {g.group_names.map(grp => (
                        <span key={grp} className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">{grp}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 mt-0.5">Для всех групп</div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEditTg(g)} className="text-xs text-gray-400 hover:text-gray-600">✏️</button>
                  <button onClick={() => removeTg(g.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function TypeCard({ t, onEdit, onRemove }: { t: SubType; onEdit: (t: SubType) => void; onRemove: (id: string) => void }) {
  const bonusKeys = Object.keys(t.bonuses || {})
  return (
    <div className="flex items-start justify-between p-3 bg-gray-50 rounded-xl gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="font-medium text-gray-800 text-sm">{t.name}</div>
          {t.is_for_newcomers && (
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Новичок</span>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {t.sessions_count ? `${t.sessions_count} зан.` : 'Безлимит'}
          {t.duration_months ? ` · ${t.duration_months} мес.` : ''}
          {t.price ? ` · ${t.price.toLocaleString('ru-RU')} ₽` : ''}
          {t.price_per_session ? ` · ${t.price_per_session} ₽/трен.` : ''}
        </div>
        {bonusKeys.length > 0 && (
          <div className="text-xs text-blue-500 mt-0.5">
            {bonusKeys.map(b => `${b} ×${t.bonuses![b]}`).join(' · ')}
            {t.bonus_total_value ? ` = ${t.bonus_total_value.toLocaleString('ru-RU')} ₽` : ''}
          </div>
        )}
        {t.description && <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>}
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => onEdit(t)} className="text-xs text-gray-400 hover:text-gray-600">✏️</button>
        <button onClick={() => onRemove(t.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
      </div>
    </div>
  )
}
