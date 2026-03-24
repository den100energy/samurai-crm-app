/** Возвращает дату в формате YYYY-MM-DD по ЛОКАЛЬНОМУ времени браузера.
 *  toISOString() использует UTC и даёт неверную дату для UTC+3 (до 3:00 ночи). */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
