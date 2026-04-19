'use client'

import { Component, ReactNode, useEffect } from 'react'
import { logError } from '@/lib/logger'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    logError(error, { componentStack: info.componentStack, type: 'react' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Что-то пошло не так</h1>
            <p className="text-gray-500 text-sm mb-2">Ошибка зафиксирована в логе.</p>
            <p className="text-xs text-gray-400 mb-6 break-words">{this.state.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload() }}
              className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-medium">
              Перезагрузить
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function GlobalErrorHandlers() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      logError(event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'window.error',
      })
    }
    function handleRejection(event: PromiseRejectionEvent) {
      logError(event.reason, { type: 'unhandledrejection' })
    }
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])
  return null
}

export function ErrorCatcher({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <GlobalErrorHandlers />
      {children}
    </ErrorBoundary>
  )
}
