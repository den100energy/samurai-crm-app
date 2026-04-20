/** Возвращает дату в формате YYYY-MM-DD по ЛОКАЛЬНОМУ времени браузера.
 *  toISOString() использует UTC и даёт неверную дату для UTC+3 (до 3:00 ночи). */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Конвертирует ISO-дату "YYYY-MM-DD" в читаемый формат "DD-MM-YYYY". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}
