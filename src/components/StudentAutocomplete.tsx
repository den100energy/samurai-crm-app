'use client'

import { useEffect, useRef, useState } from 'react'

type StudentHit = { id: string; name: string; phone: string | null }

function maskPhone(phone: string | null): string {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.length < 10) return '***'
  const local = d.slice(-10)
  return `+7 ${local.slice(0, 3)} ***-**-${local.slice(-2)}`
}

type Props = {
  value: string
  onChange: (v: string) => void
  onSelect: (s: StudentHit) => void
  placeholder?: string
  inputClassName?: string
  required?: boolean
}

export function StudentAutocomplete({ value, onChange, onSelect, placeholder, inputClassName, required }: Props) {
  const [hits, setHits] = useState<StudentHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (value.trim().length < 2) { setHits([]); setOpen(false); return }

    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/students/search?q=${encodeURIComponent(value.trim())}`)
        const data: StudentHit[] = await res.json()
        setHits(data)
        setOpen(data.length > 0)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [value])

  // Закрыть дропдаун при клике снаружи
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(s: StudentHit) {
    onSelect(s)
    setOpen(false)
    setHits([])
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</div>
      )}
      {open && hits.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {hits.map(s => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={() => select(s)}
                className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors flex items-center justify-between gap-3"
              >
                <span className="text-sm font-medium text-gray-800 truncate">{s.name}</span>
                {s.phone && (
                  <span className="text-xs text-gray-400 shrink-0">{maskPhone(s.phone)}</span>
                )}
              </button>
            </li>
          ))}
          <li className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
            Начните вводить фамилию или имя
          </li>
        </ul>
      )}
    </div>
  )
}
