import type { Metadata, Viewport } from 'next'
import { Roboto_Slab } from 'next/font/google'
import './globals.css'
import FloatingBack from '@/components/FloatingBack'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { InstallPrompt } from '@/components/InstallPrompt'

const robotoSlab = Roboto_Slab({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-roboto-slab',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Школа Самурая — CRM',
  description: 'Управление школой боевых искусств',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Самурай',
  },
}

export const viewport: Viewport = {
  themeColor: '#1C1C1E',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={robotoSlab.variable} data-theme="dark">
      <body className="app-bg min-h-screen" style={{ fontFamily: 'var(--font-roboto-slab), serif' }}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <FloatingBack />
            <InstallPrompt />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
