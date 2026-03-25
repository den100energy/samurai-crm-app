'use client'

import { useEffect, useState } from 'react'
import { isHintSeen, markHintSeen, HINTS, HintId } from '@/lib/onboarding'

type Props = {
  id: HintId
  className?: string
}

export function OnboardingHint({ id, className = '' }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!isHintSeen(id))
  }, [id])

  function dismiss() {
    markHintSeen(id)
    setVisible(false)
  }

  if (!visible) return null

  const hint = HINTS[id]

  return (
    <div className={`relative bg-amber-50 border border-amber-200 rounded-2xl p-4 ${className}`}>
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-amber-400 hover:text-amber-600 text-lg leading-none"
        aria-label="Закрыть подсказку"
      >
        ×
      </button>
      <div className="pr-6">
        <div className="font-semibold text-amber-800 text-sm mb-1">💡 {hint.title}</div>
        <div className="text-sm text-amber-700 leading-relaxed">{hint.text}</div>
      </div>
    </div>
  )
}
