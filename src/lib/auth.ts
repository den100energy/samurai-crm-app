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

// Все разделы системы с человекочитаемыми названиями
export const SECTIONS = [
  { key: 'students',    label: 'Ученики',        route: '/students',    emoji: '🥋' },
  { key: 'attendance',  label: 'Посещаемость',   route: '/attendance',  emoji: '✅' },
  { key: 'leads',       label: 'Лиды',           route: '/leads',       emoji: '📋' },
  { key: 'finance',     label: 'Финансы',        route: '/finance',     emoji: '💰' },
  { key: 'salary',      label: 'Зарплата',       route: '/salary',      emoji: '💵' },
  { key: 'analytics',   label: 'Аналитика',      route: '/analytics',   emoji: '📊' },
  { key: 'broadcast',   label: 'Рассылка',       route: '/broadcast',   emoji: '📣' },
  { key: 'events',      label: 'Мероприятия',    route: '/events',      emoji: '🎉' },
  { key: 'tickets',     label: 'Обращения',      route: '/tickets',     emoji: '📝' },
  { key: 'schedule',    label: 'Расписание',     route: '/schedule',    emoji: '🗓' },
  { key: 'settings',    label: 'Настройки',      route: '/settings',    emoji: '⚙️' },
]

// Founder видит всё всегда
export function hasAccess(role: UserRole, permissions: string[], sectionKey: string): boolean {
  if (role === 'founder') return true
  if (role === 'admin') {
    // Админ не видит финансы, зарплату, настройки, сотрудников
    const adminBlocked = ['finance', 'salary', 'settings']
    if (adminBlocked.includes(sectionKey)) return false
    return true
  }
  // Тренер — только по разрешениям
  return permissions.includes(sectionKey)
}

// Для proxy.ts — проверка маршрута
export function canAccessRoute(role: UserRole, permissions: string[], pathname: string): boolean {
  if (role === 'founder') return true
  const section = SECTIONS.find(s => pathname.startsWith(s.route))
  if (!section) return true // неизвестный маршрут — пропускаем
  return hasAccess(role, permissions, section.key)
}
