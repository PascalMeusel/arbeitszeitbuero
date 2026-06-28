export const minutesPerHour = 60
export const dayMs = 24 * 60 * 60 * 1000

export function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function dateKeysBetween(startDate: string, endDate: string) {
  const dates: string[] = []
  const cursor = parseDateKey(startDate)
  const end = parseDateKey(endDate)

  while (cursor <= end) {
    dates.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

export function isWeekend(dateKey: string) {
  const day = parseDateKey(dateKey).getDay()
  return day === 0 || day === 6
}

export function isoFromDateAndTime(dateKey: string, time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const date = parseDateKey(dateKey)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

export function startOfWeek(date: Date) {
  const copy = new Date(date)
  const day = copy.getDay() || 7
  copy.setDate(copy.getDate() - day + 1)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function endOfWeek(date: Date) {
  const copy = startOfWeek(date)
  copy.setDate(copy.getDate() + 6)
  copy.setHours(23, 59, 59, 999)
  return copy
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1)
}

export function endOfYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999)
}

export function clampDateRange(start: Date, end: Date) {
  return [toDateKey(start), toDateKey(end)] as const
}

export function formatMinutes(minutes: number) {
  const sign = minutes < 0 ? '-' : ''
  const absolute = Math.abs(Math.round(minutes))
  const hours = Math.floor(absolute / 60)
  const mins = absolute % 60
  return `${sign}${hours}:${pad2(mins)}`
}

export function formatDecimalHours(minutes: number) {
  return (minutes / 60).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })
}
