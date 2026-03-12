import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Школа Самурая — CRM',
  description: 'Управление школой боевых искусств',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}
