'use client'

import { useEffect, useState } from 'react'

type Platform = 'ios' | 'android' | null

export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Уже установлено как PWA — не показываем
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    if (isStandalone) return

    // Уже отклонили раньше
    if (localStorage.getItem('pwa-dismissed')) return

    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream
    const isAndroid = /android/i.test(ua)

    if (isIOS) {
      // На iOS Safari нет beforeinstallprompt — показываем инструкцию
      const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua)
      if (isSafari) {
        setPlatform('ios')
        setVisible(true)
      }
      return
    }

    if (isAndroid) {
      setPlatform('android')
      // Ждём событие от браузера
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setVisible(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function dismiss() {
    localStorage.setItem('pwa-dismissed', '1')
    setVisible(false)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-dismissed', '1')
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div
        className="rounded-2xl p-4 shadow-2xl border"
        style={{ backgroundColor: '#2C2C2E', borderColor: '#3A3A3C' }}
      >
        <div className="flex items-start gap-3">
          <div className="text-3xl shrink-0">🥋</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-white mb-1">
              Добавить на главный экран
            </div>

            {platform === 'ios' ? (
              <p className="text-xs text-[#8E8E93] leading-relaxed">
                Нажмите{' '}
                <span className="inline-flex items-center gap-0.5 text-white font-medium">
                  <svg className="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
                  </svg>
                  {' '}Поделиться
                </span>
                {' '}→{' '}
                <span className="text-white font-medium">На экран «Домой»</span>
                {' '}— и приложение появится как иконка
              </p>
            ) : (
              <p className="text-xs text-[#8E8E93]">
                Установите приложение для удобного доступа без браузера
              </p>
            )}
          </div>

          <button
            onClick={dismiss}
            className="text-[#48484A] hover:text-white transition-colors shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {platform === 'android' && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={install}
              className="flex-1 bg-white text-black text-sm font-semibold py-2.5 rounded-xl"
            >
              Установить
            </button>
            <button
              onClick={dismiss}
              className="px-4 border border-[#3A3A3C] text-[#8E8E93] text-sm py-2.5 rounded-xl"
            >
              Не сейчас
            </button>
          </div>
        )}

        {platform === 'ios' && (
          <button
            onClick={dismiss}
            className="mt-3 w-full border border-[#3A3A3C] text-[#8E8E93] text-sm py-2 rounded-xl"
          >
            Понятно
          </button>
        )}
      </div>
    </div>
  )
}
