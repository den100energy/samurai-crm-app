import type { Metadata } from 'next'
import { Roboto_Slab } from 'next/font/google'
import './globals.css'
import FloatingBack from '@/components/FloatingBack'
import { AuthProvider } from '@/components/AuthProvider'

const robotoSlab = Roboto_Slab({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-roboto-slab',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Школа Самурая — CRM',
  description: 'Управление школой боевых искусств',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={robotoSlab.variable}>
      <body className="bg-[#1C1C1E] min-h-screen" style={{ fontFamily: 'var(--font-roboto-slab), serif' }}>
        <AuthProvider>
          {children}
          <FloatingBack />
        </AuthProvider>
      </body>
    </html>
  )
}
