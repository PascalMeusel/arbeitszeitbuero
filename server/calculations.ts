import type {
  AbsenceDay,
  ClockStatus,
  Holiday,
  PeriodTotals,
  TimeEntry,
  User,
  UserSummary,
} from '../shared/domain.ts'
import {
  clampDateRange,
  dateKeysBetween,
  endOfMonth,
  endOfWeek,
  endOfYear,
  isWeekend,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toDateKey,
} from '../shared/dates.ts'
import { holidayByDate } from './holidays.ts'
import { termForDate } from '../shared/terms.ts'

function percentToFraction(percent: number | undefined) {
  if (!Number.isFinite(percent)) {
    return 1
  }

  return Math.min(1, Math.max(0, Number(percent) / 100))
}

export function entryWorkedMinutes(entry: TimeEntry, now = new Date()) {
  const stop = entry.stoppedAt ? new Date(entry.stoppedAt) : now
  const rawMinutes = Math.max(0, (stop.getTime() - new Date(entry.startedAt).getTime()) / 60000)
  const trackedBreakMinutes = entry.breaks.reduce((total, segment) => {
    const breakStop = segment.stoppedAt ? new Date(segment.stoppedAt) : now
    return total + Math.max(0, (breakStop.getTime() - new Date(segment.startedAt).getTime()) / 60000)
  }, 0)
  return Math.max(0, Math.round(rawMinutes - trackedBreakMinutes - (entry.manualBreakMinutes ?? 0)))
}

export function clockStatusForUser(entries: TimeEntry[], userId: string): ClockStatus {
  const openEntry = entries.find((entry) => entry.userId === userId && !entry.stoppedAt)
  if (!openEntry) {
    return 'off_work'
  }

  const openBreak = openEntry.breaks.some((segment) => !segment.stoppedAt)
  return openBreak ? 'on_break' : 'working'
}

export function openEntryForUser(entries: TimeEntry[], userId: string) {
  return entries.find((entry) => entry.userId === userId && !entry.stoppedAt)
}

function expectedMinutesForRange(
  user: User,
  startDate: string,
  endDate: string,
  holidays: Holiday[],
  absences: AbsenceDay[],
) {
  const holidaysByDate = holidayByDate(holidays)
  const absenceDates = new Set(
    absences
      .filter((absence) => absence.userId === user.id && absence.date >= startDate && absence.date <= endDate)
      .map((absence) => absence.date),
  )

  return dateKeysBetween(startDate, endDate).reduce((total, date) => {
    if (isWeekend(date) || absenceDates.has(date)) {
      return total
    }

    const dailyMinutes = termForDate(user, date).expectedWeeklyMinutes / 5
    const holiday = holidaysByDate.get(date)
    const expectedFraction = holiday ? 1 - percentToFraction(holiday.freePercent) : 1
    return total + dailyMinutes * expectedFraction
  }, 0)
}

function workedMinutesForRange(entries: TimeEntry[], userId: string, startDate: string, endDate: string) {
  return entries
    .filter((entry) => entry.userId === userId && entry.date >= startDate && entry.date <= endDate)
    .reduce((total, entry) => total + entryWorkedMinutes(entry), 0)
}

function totalsForRange(
  user: User,
  entries: TimeEntry[],
  absences: AbsenceDay[],
  holidays: Holiday[],
  startDate: string,
  endDate: string,
): PeriodTotals {
  const workedMinutes = workedMinutesForRange(entries, user.id, startDate, endDate)
  const expectedMinutes = Math.round(expectedMinutesForRange(user, startDate, endDate, holidays, absences))
  return {
    workedMinutes,
    expectedMinutes,
    plusMinusMinutes: workedMinutes - expectedMinutes,
  }
}

export function vacationUsedDays(user: User, absences: AbsenceDay[], holidays: Holiday[], year: number) {
  const holidaysByDate = holidayByDate(holidays)
  return absences.reduce((total, absence) => {
    if (absence.userId !== user.id || absence.type !== 'vacation' || !absence.date.startsWith(`${year}-`) || isWeekend(absence.date)) {
      return total
    }

    const holiday = holidaysByDate.get(absence.date)
    return total + (holiday ? 1 - percentToFraction(holiday.freePercent) : 1)
  }, 0)
}

export function summaryForUser(
  user: User,
  entries: TimeEntry[],
  absences: AbsenceDay[],
  holidays: Holiday[],
  referenceDate = new Date(),
): UserSummary {
  const [weekStart, weekEnd] = clampDateRange(startOfWeek(referenceDate), endOfWeek(referenceDate))
  const [monthStart, monthEnd] = clampDateRange(startOfMonth(referenceDate), endOfMonth(referenceDate))
  const [yearStart, yearEnd] = clampDateRange(startOfYear(referenceDate), endOfYear(referenceDate))
  const year = referenceDate.getFullYear()
  const usedDays = vacationUsedDays(user, absences, holidays, year)
  const yearlyVacationDays = termForDate(user, toDateKey(referenceDate)).yearlyVacationDays

  const week = totalsForRange(user, entries, absences, holidays, weekStart, weekEnd)
  const month = totalsForRange(user, entries, absences, holidays, monthStart, monthEnd)
  const yearTotals = totalsForRange(user, entries, absences, holidays, yearStart, yearEnd)
  const yearWithAdjustment = {
    ...yearTotals,
    plusMinusMinutes: yearTotals.plusMinusMinutes + user.balanceAdjustmentMinutes,
  }

  return {
    userId: user.id,
    week,
    month,
    year: yearWithAdjustment,
    vacation: {
      yearlyDays: yearlyVacationDays,
      usedDays,
      remainingDays: yearlyVacationDays + user.vacationAdjustmentDays - usedDays,
    },
  }
}

export function summariesForUsers(
  users: User[],
  entries: TimeEntry[],
  absences: AbsenceDay[],
  holidays: Holiday[],
) {
  return users.map((user) => summaryForUser(user, entries, absences, holidays))
}

export function todayEntry(entries: TimeEntry[], userId: string) {
  const today = toDateKey(new Date())
  return entries.find((entry) => entry.userId === userId && entry.date === today && !entry.stoppedAt)
}
