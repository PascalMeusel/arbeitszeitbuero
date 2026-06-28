import type { AbsenceDay, AbsenceType, Holiday, TimeEntry, User } from '../shared/domain.ts'
import {
  clampDateRange,
  dateKeysBetween,
  endOfMonth,
  endOfWeek,
  endOfYear,
  isWeekend,
  parseDateKey,
  pad2,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from '../shared/dates.ts'
import { termForDate } from '../shared/terms.ts'
import { entryWorkedMinutes } from './calculations.ts'
import type { Database } from './store.ts'
import { holidaysForYears, yearsForDateRange } from './holidays.ts'

export type TimeExportPeriod = 'day' | 'week' | 'month' | 'year' | 'all'
export type TimeExportLanguage = 'en' | 'de'

const headers = {
  en: [
    'Date',
    'Weekday',
    'Employee',
    'Email',
    'Period',
    'Expected hours',
    'Worked hours',
    'Break hours',
    'Balance hours',
    'Start times',
    'Stop times',
    'Breaks',
    'Entry count',
    'Absence',
    'Holiday',
    'Free percent',
    'Sources',
    'Notes',
  ],
  de: [
    'Datum',
    'Wochentag',
    'Mitarbeiter',
    'E-Mail',
    'Zeitraum',
    'Sollstunden',
    'Iststunden',
    'Pausenstunden',
    'Saldo Stunden',
    'Startzeiten',
    'Endzeiten',
    'Pausen',
    'Einträge',
    'Abwesenheit',
    'Feiertag',
    'Freier Anteil %',
    'Quellen',
    'Notizen',
  ],
} satisfies Record<TimeExportLanguage, string[]>

const absenceLabels: Record<TimeExportLanguage, Record<AbsenceType, string>> = {
  en: {
    vacation: 'Vacation',
    overtime_time_off: 'Overtime time off',
    sick_leave: 'Sick leave',
  },
  de: {
    vacation: 'Urlaub',
    overtime_time_off: 'Überstunden Ausgleich',
    sick_leave: 'Krankmeldung',
  },
}

function percentToFraction(percent: number | undefined) {
  if (!Number.isFinite(percent)) {
    return 1
  }

  return Math.min(1, Math.max(0, Number(percent) / 100))
}

function displayUserName(user: Pick<User, 'name' | 'role'>) {
  const trailingRole = user.role === 'employee' ? /\s+(Employee|Mitarbeiter)$/i : /\s+(Admin|Administrator)$/i
  const cleanedName = user.name.replace(trailingRole, '').trim()
  return cleanedName || user.name
}

function holidayDisplayName(holiday: Holiday | undefined) {
  if (!holiday) {
    return ''
  }

  return holiday.name
}

function localTime(value: string | undefined) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function weekdayLabel(dateKey: string, language: TimeExportLanguage) {
  return parseDateKey(dateKey).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { weekday: 'long' })
}

function formatNumber(value: number, language: TimeExportLanguage) {
  const fixed = Number(value.toFixed(2))
  return language === 'de' ? String(fixed).replace('.', ',') : String(fixed)
}

function breakMinutesForEntry(entry: TimeEntry, now: Date) {
  const tracked = entry.breaks.reduce((total, segment) => {
    const stop = segment.stoppedAt ? new Date(segment.stoppedAt) : now
    return total + Math.max(0, Math.round((stop.getTime() - new Date(segment.startedAt).getTime()) / 60000))
  }, 0)

  return tracked + (entry.manualBreakMinutes ?? 0)
}

function breaksLabel(entry: TimeEntry, language: TimeExportLanguage) {
  const tracked = entry.breaks.map((segment) => {
    const start = localTime(segment.startedAt)
    const stop = segment.stoppedAt ? localTime(segment.stoppedAt) : language === 'de' ? 'offen' : 'open'
    return `${start}-${stop}`
  })

  if (entry.manualBreakMinutes) {
    tracked.push(`${language === 'de' ? 'manuell' : 'manual'} ${entry.manualBreakMinutes} min`)
  }

  return tracked.join(' | ')
}

function expectedMinutesForDate(user: User, date: string, absences: AbsenceDay[], holiday: Holiday | undefined) {
  if (isWeekend(date) || absences.some((absence) => absence.userId === user.id && absence.date === date)) {
    return 0
  }

  const dailyMinutes = termForDate(user, date).expectedWeeklyMinutes / 5
  const expectedFraction = holiday ? 1 - percentToFraction(holiday.freePercent) : 1
  return Math.round(dailyMinutes * expectedFraction)
}

function rangeForPeriod(
  period: TimeExportPeriod,
  referenceDate: string,
  userId: string,
  entries: TimeEntry[],
  absences: AbsenceDay[],
) {
  if (period === 'day') {
    return [referenceDate, referenceDate] as const
  }

  const reference = parseDateKey(referenceDate)
  if (period === 'week') {
    return clampDateRange(startOfWeek(reference), endOfWeek(reference))
  }
  if (period === 'month') {
    return clampDateRange(startOfMonth(reference), endOfMonth(reference))
  }
  if (period === 'year') {
    return clampDateRange(startOfYear(reference), endOfYear(reference))
  }

  const userDates = [
    ...entries.filter((entry) => entry.userId === userId).map((entry) => entry.date),
    ...absences.filter((absence) => absence.userId === userId).map((absence) => absence.date),
  ].sort()

  return [userDates[0] ?? referenceDate, userDates.at(-1) ?? referenceDate] as const
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvLine(values: Array<string | number>) {
  return values.map(csvCell).join(';')
}

function safeFilenamePart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export function buildTimeCsvExport(
  database: Database,
  user: User,
  period: TimeExportPeriod,
  referenceDate: string,
  language: TimeExportLanguage,
) {
  const [startDate, endDate] = rangeForPeriod(period, referenceDate, user.id, database.timeEntries, database.absences)
  const holidays = holidaysForYears(yearsForDateRange(startDate, endDate), database.holidayOverrides, database.holidaySettings)
  const holidaysByDate = new Map(holidays.map((holiday) => [holiday.date, holiday]))
  const now = new Date()
  const employeeName = displayUserName(user)
  const periodRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`

  const rows = dateKeysBetween(startDate, endDate).map((date) => {
    const dayEntries = database.timeEntries
      .filter((entry) => entry.userId === user.id && entry.date === date)
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
    const dayAbsences = database.absences.filter((absence) => absence.userId === user.id && absence.date === date)
    const holiday = holidaysByDate.get(date)
    const expectedMinutes = expectedMinutesForDate(user, date, dayAbsences, holiday)
    const workedMinutes = dayEntries.reduce((total, entry) => total + entryWorkedMinutes(entry, now), 0)
    const breakMinutes = dayEntries.reduce((total, entry) => total + breakMinutesForEntry(entry, now), 0)
    const balanceMinutes = workedMinutes - expectedMinutes
    const absenceNames = [...new Set(dayAbsences.map((absence) => absenceLabels[language][absence.type]))]
    const sources = [...new Set(dayEntries.map((entry) => entry.source))]

    return [
      date,
      weekdayLabel(date, language),
      employeeName,
      user.email,
      periodRange,
      formatNumber(expectedMinutes / 60, language),
      formatNumber(workedMinutes / 60, language),
      formatNumber(breakMinutes / 60, language),
      formatNumber(balanceMinutes / 60, language),
      dayEntries.map((entry) => localTime(entry.startedAt)).join(' | '),
      dayEntries.map((entry) => localTime(entry.stoppedAt) || (language === 'de' ? 'offen' : 'open')).join(' | '),
      dayEntries.map((entry) => breaksLabel(entry, language)).filter(Boolean).join(' | '),
      dayEntries.length,
      absenceNames.join(' | '),
      holidayDisplayName(holiday),
      holiday ? formatNumber(holiday.freePercent, language) : '',
      sources.join(' | '),
      dayEntries.map((entry) => entry.note ?? '').filter(Boolean).join(' | '),
    ]
  })

  const csv = `\uFEFF${[headers[language], ...rows].map(csvLine).join('\r\n')}\r\n`
  const periodPart = period === 'all' ? 'all-time' : period
  const namePart = safeFilenamePart(employeeName) || 'user'
  const filename = `nrw-time-export-${namePart}-${periodPart}-${startDate}-${endDate}.csv`

  return { csv, filename, startDate, endDate }
}
