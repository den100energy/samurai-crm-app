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
  '/cabinet',
  '/api',
]

// Иерархия разделов с подпунктами
export const SECTIONS = [
  {
    key: 'students', label: 'Ученики', route: '/students', emoji: '🥋',
    items: [
      { key: 'students.view',    label: 'Просмотр списка' },
      { key: 'students.edit',    label: 'Редактировать карточку' },
      { key: 'students.add',     label: 'Добавить ученика' },
      { key: 'students.cabinet', label: 'Открывать кабинет ученика' },
    ],
  },
  {
    key: 'attendance', label: 'Посещаемость', route: '/attendance', emoji: '✅',
    items: [
      { key: 'attendance.view', label: 'Просмотр' },
      { key: 'attendance.edit', label: 'Отмечать посещения' },
    ],
  },
  {
    key: 'leads', label: 'Лиды', route: '/leads', emoji: '📋',
    items: [
      { key: 'leads.view',    label: 'Просмотр заявок' },
      { key: 'leads.edit',    label: 'Редактировать лид' },
      { key: 'leads.convert', label: 'Конвертировать в ученика' },
    ],
  },
  {
    key: 'finance', label: 'Финансы', route: '/finance', emoji: '💰',
    items: [
      { key: 'finance.view', label: 'Просмотр платежей' },
      { key: 'finance.add',  label: 'Добавить платёж' },
    ],
  },
  {
    key: 'salary', label: 'Зарплата', route: '/salary', emoji: '💵',
    items: [
      { key: 'salary.view', label: 'Просмотр расчётов' },
    ],
  },
  {
    key: 'analytics', label: 'Аналитика', route: '/analytics', emoji: '📊',
    items: [
      { key: 'analytics.view', label: 'Просмотр аналитики' },
    ],
  },
  {
    key: 'broadcast', label: 'Рассылка', route: '/broadcast', emoji: '📣',
    items: [
      { key: 'broadcast.send', label: 'Отправить рассылку' },
    ],
  },
  {
    key: 'events', label: 'Мероприятия', route: '/events', emoji: '🎉',
    items: [
      { key: 'events.view',     label: 'Просмотр' },
      { key: 'events.edit',     label: 'Редактировать' },
      { key: 'events.register', label: 'Записать учеников' },
    ],
  },
  {
    key: 'tickets', label: 'Обращения', route: '/tickets', emoji: '📝',
    items: [
      { key: 'tickets.view', label: 'Просмотр обращений' },
      { key: 'tickets.edit', label: 'Обрабатывать' },
    ],
  },
  {
    key: 'schedule', label: 'Расписание', route: '/schedule', emoji: '🗓',
    items: [
      { key: 'schedule.view', label: 'Просмотр' },
      { key: 'schedule.edit', label: 'Редактировать' },
    ],
  },
  {
    key: 'settings', label: 'Настройки', route: '/settings', emoji: '⚙️',
    items: [
      { key: 'settings.edit', label: 'Управление настройками' },
    ],
  },
]

// Разделы, заблокированные для admin (независимо от permissions)
const ADMIN_BLOCKED = ['finance', 'salary', 'settings']

// Есть ли доступ к разделу (по section key)
export function hasAccess(role: UserRole, permissions: string[], sectionKey: string): boolean {
  if (role === 'founder') return true
  if (role === 'admin') return !ADMIN_BLOCKED.includes(sectionKey)
  // trainer — есть хотя бы одно разрешение в этом разделе
  return permissions.some(p => p === sectionKey || p.startsWith(sectionKey + '.'))
}

// Для proxy.ts — проверка маршрута
export function canAccessRoute(role: UserRole, permissions: string[], pathname: string): boolean {
  if (role === 'founder') return true
  const section = SECTIONS.find(s => pathname.startsWith(s.route))
  if (!section) return true
  return hasAccess(role, permissions, section.key)
}
