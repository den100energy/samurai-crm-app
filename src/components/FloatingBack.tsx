'use client'

import { usePathname, useRouter } from 'next/navigation'

export default function FloatingBack() {
  const pathname = usePathname()
  const router = useRouter()

  // Don't show on home page
  if (pathname === '/') return null

  return (
    <button
      onClick={() => router.back()}
      className="fixed bottom-6 right-5 z-50 bg-black text-white w-12 h-12 rounded-full shadow-lg text-xl font-bold flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all"
      aria-label="Назад"
    >
      ←
    </button>
  )
}
