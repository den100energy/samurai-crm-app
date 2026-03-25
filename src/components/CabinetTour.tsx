'use client'

import { useEffect, useState } from 'react'

type Slide = {
  tab: string
  icon: string
  title: string
  text: string
}

type Props = {
  storageKey: string
  slides: Slide[]
  personName?: string
}

export function CabinetTour({ storageKey, slides, personName }: Props) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(storageKey)) {
      setVisible(true)
    }
  }, [storageKey])

  function finish() {
    localStorage.setItem(storageKey, '1')
    setVisible(false)
  }

  if (!visible) return null

  const slide = slides[step]
  const isLast = step === slides.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Прогресс-точки */}
        <div className="flex justify-center gap-1.5 pt-4 pb-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${
                i === step ? 'w-5 h-1.5 bg-black' : 'w-1.5 h-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Контент */}
        <div className="px-6 py-4 text-center">
          <div className="text-5xl mb-3">{slide.icon}</div>
          {step === 0 && personName && (
            <div className="text-xs text-gray-400 mb-1">Привет, {personName}!</div>
          )}
          <div className="text-lg font-bold text-gray-900 mb-2">{slide.title}</div>
          <div className="text-sm text-gray-500 leading-relaxed">{slide.text}</div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 px-6 pb-6 pt-2">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-4 py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-500"
            >
              ←
            </button>
          )}
          <button
            onClick={isLast ? finish : () => setStep(s => s + 1)}
            className="flex-1 bg-black text-white py-2.5 rounded-2xl text-sm font-medium"
          >
            {isLast ? 'Начать!' : 'Далее →'}
          </button>
          {step === 0 && (
            <button
              onClick={finish}
              className="px-4 py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-400"
            >
              Пропустить
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
