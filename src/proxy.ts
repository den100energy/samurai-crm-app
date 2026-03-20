import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PUBLIC_ROUTES, ROLE_HOME, UserRole, canAccessRoute } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Пропускаем публичные маршруты без проверки
  const isPublic = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  if (isPublic) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Нет сессии → на логин
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Получаем роль и permissions
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, permissions')
    .eq('id', session.user.id)
    .single()

  const role = profile?.role as UserRole | undefined
  const permissions: string[] = profile?.permissions || []

  // Нет профиля → на логин
  if (!role) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Тренер пытается зайти на / → редирект на /trainer
  if (role === 'trainer' && pathname === '/') {
    return NextResponse.redirect(new URL('/trainer', request.url))
  }

  // Проверяем доступ к маршруту
  if (!canAccessRoute(role, permissions, pathname)) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
