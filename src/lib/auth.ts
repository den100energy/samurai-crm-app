export type UserRole = 'founder' | 'admin' | 'trainer'

export const ROLE_HOME: Record<UserRole, string> = {
  founder: '/',
  admin: '/',
  trainer: '/trainer',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  founder: 'Основатель',
  admin: 'Администратор',
  trainer: 'Тренер',
}

// Routes blocked per role (middleware uses this)
export const BLOCKED_ROUTES: Record<UserRole, string[]> = {
  founder: [],
  admin: ['/finance', '/salary', '/analytics', '/settings', '/import', '/admin-users'],
  trainer: [
    '/finance', '/salary', '/analytics', '/settings', '/import', '/admin-users',
    '/leads', '/payments', '/broadcast', '/events', '/tickets', '/students',
  ],
}

// Public routes — never require auth
export const PUBLIC_ROUTES = [
  '/login',
  '/parent',
  '/checkin',
  '/survey',
  '/survey2',
  '/survey3',
  '/print',
  '/api',
]
