import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type {
  CalendarGroup,
  ClockAction,
  MailServerSettings,
  RequestItem,
  RequestStatus,
  RequestType,
  Role,
  UserInvitation,
} from '../shared/domain.ts'
import { dateKeysBetween, formatDecimalHours, isoFromDateAndTime, toDateKey } from '../shared/dates.ts'
import {
  addAudit,
  addNotification,
  adminUsers,
  backupInfo,
  dataFilePath,
  ensureWeeklyBackup,
  hashPassword,
  makeStoredUser,
  nowIso,
  passwordPolicyErrors,
  publicUser,
  readDatabase,
  type StoredUser,
  verifyPassword,
  writeDatabase,
} from './store.ts'
import { clockStatusForUser, openEntryForUser, summariesForUsers, summaryForUser, vacationUsedDays } from './calculations.ts'
import {
  currentHolidayYears,
  holidaySettingsSupported,
  holidayTemplateOptions,
  holidaysForYears,
  makeHolidayOverride,
  normalizeHolidaySettings,
} from './holidays.ts'
import { mailServerConfigured, sendEmail } from './mailer.ts'
import { importTimeCsv } from './csvImport.ts'
import { currentEmploymentTerm, employmentTermsFor, termForDate } from '../shared/terms.ts'
import { buildTimeCsvExport, type TimeExportLanguage, type TimeExportPeriod } from './csvExport.ts'
import { licenseStateForDatabase, verifyLicenseKey } from './license.ts'

interface AuthedRequest extends Request {
  user?: StoredUser
}

const app = express()
const port = Number(process.env.PORT ?? 4177)
const tokens = new Map<string, string>()
const moduleDir = dirname(fileURLToPath(import.meta.url))
const distDir = join(moduleDir, '..', 'dist')

app.set('trust proxy', true)
app.use(cors())
app.use(express.json({ limit: '5mb' }))

function requireAuth(request: AuthedRequest, response: Response, next: NextFunction) {
  const token = request.header('authorization')?.replace(/^Bearer\s+/i, '')
  const userId = token ? tokens.get(token) : undefined
  const database = readDatabase()
  const user = userId ? database.users.find((candidate) => candidate.id === userId && candidate.active) : undefined

  if (!user) {
    response.status(401).json({ message: 'Authentication required' })
    return
  }

  request.user = user
  if (user.mustChangePassword && request.path !== '/api/state' && request.path !== '/api/account/password') {
    response.status(428).json({ message: 'Password change required' })
    return
  }

  next()
}

function requireAdmin(request: AuthedRequest, response: Response, next: NextFunction) {
  if (request.user?.role !== 'admin') {
    response.status(403).json({ message: 'Admin access required' })
    return
  }

  next()
}

function groupPeerIdsFor(userId: string, groups: CalendarGroup[]) {
  const peerIds = new Set<string>()
  for (const group of groups) {
    if (group.memberUserIds.includes(userId)) {
      group.memberUserIds.forEach((memberId) => peerIds.add(memberId))
    }
  }
  peerIds.delete(userId)
  return peerIds
}

function calendarAccessTargetsFor(user: StoredUser, users: StoredUser[], groups: CalendarGroup[]) {
  if (user.role === 'admin') {
    return users.filter((candidate) => candidate.active && candidate.id !== user.id).map(publicUser)
  }

  const peerIds = groupPeerIdsFor(user.id, groups)
  return users.filter((candidate) => candidate.active && peerIds.has(candidate.id)).map(publicUser)
}

function visibleUsersFor(currentUser: StoredUser, users: StoredUser[], groups: CalendarGroup[]) {
  if (currentUser.role === 'admin') {
    return users.filter((user) => user.active).map(publicUser)
  }

  const peerIds = groupPeerIdsFor(currentUser.id, groups)
  return users
    .filter(
      (user) =>
        user.active && (user.id === currentUser.id || (peerIds.has(user.id) && user.calendarAccessUserIds.includes(currentUser.id))),
    )
    .map(publicUser)
}

function calendarGroupsFor(currentUser: StoredUser, groups: CalendarGroup[]) {
  if (currentUser.role === 'admin') {
    return groups
  }

  return groups.filter((group) => group.memberUserIds.includes(currentUser.id))
}

function stateForUser(currentUser: StoredUser) {
  const database = readDatabase()
  const activeUsers = database.users.filter((user) => user.active)
  const visibleCalendarUsers = visibleUsersFor(currentUser, database.users, database.calendarGroups)
  const shareableCalendarUsers = calendarAccessTargetsFor(currentUser, database.users, database.calendarGroups)
  const publicUsers =
    currentUser.role === 'admin'
      ? activeUsers.map(publicUser)
      : [
          ...new Map(
            [publicUser(currentUser), ...visibleCalendarUsers, ...shareableCalendarUsers].map((user) => [user.id, user]),
          ).values(),
        ]
  const visibleIds = new Set(visibleCalendarUsers.map((user) => user.id))
  const holidays = holidaysForYears(currentHolidayYears(), database.holidayOverrides, database.holidaySettings)
  const requestScope =
    currentUser.role === 'admin'
      ? database.requests
      : database.requests.filter((request) => request.userId === currentUser.id)

  return {
    currentUser: publicUser(currentUser),
    users: publicUsers,
    visibleCalendarUsers,
    shareableCalendarUsers,
    calendarGroups: calendarGroupsFor(currentUser, database.calendarGroups),
    timeEntries: database.timeEntries.filter((entry) => entry.userId === currentUser.id),
    adminTimeEntries: currentUser.role === 'admin' ? database.timeEntries : undefined,
    absences: database.absences.filter((absence) => visibleIds.has(absence.userId)),
    holidays,
    holidayOverrides: database.holidayOverrides,
    holidaySettings: database.holidaySettings,
    holidayTemplateOptions: holidayTemplateOptions(database.holidaySettings),
    requests: requestScope,
    notifications: database.notifications.filter((notification) => notification.userId === currentUser.id),
    importBatches:
      currentUser.role === 'admin'
        ? database.importBatches
        : database.importBatches.filter((batch) => batch.userId === currentUser.id),
    userInvitations: currentUser.role === 'admin' ? database.userInvitations.map(publicInvitation) : [],
    backup: backupInfo(),
    mailServerSettings: currentUser.role === 'admin' ? publicMailServerSettings(database.mailServerSettings) : undefined,
    licenseState: currentUser.role === 'admin' ? licenseStateForDatabase(database) : undefined,
    summaries: summariesForUsers(publicUsers, database.timeEntries, database.absences, holidays),
    clockStatus: clockStatusForUser(database.timeEntries, currentUser.id),
    todayEntry: openEntryForUser(database.timeEntries, currentUser.id),
  }
}

function parseString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseDateKeyInput(value: unknown, fallback = toDateKey(new Date())) {
  const date = parseString(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback
}

function parseRole(value: unknown): Role {
  return value === 'admin' ? 'admin' : 'employee'
}

function parseMinutes(value: unknown) {
  const minutes = Number(value)
  return Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0
}

function parsePercent(value: unknown, fallback = 100) {
  const percent = Number(value)
  return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : fallback
}

function parseBoolean(value: unknown) {
  return value === true || value === 'true' || value === '1' || value === 1
}

function parseExportPeriod(value: unknown): TimeExportPeriod {
  const period = parseString(value)
  return period === 'day' || period === 'week' || period === 'month' || period === 'year' || period === 'all'
    ? period
    : 'month'
}

function parseExportLanguage(value: unknown): TimeExportLanguage {
  return parseString(value) === 'de' ? 'de' : 'en'
}

function parseUserIds(value: unknown, users: StoredUser[], excludedUserId?: string) {
  const activeUserIds = new Set(users.filter((user) => user.active && user.id !== excludedUserId).map((user) => user.id))
  const ids = Array.isArray(value) ? value.filter((id: unknown): id is string => typeof id === 'string') : []
  return [...new Set(ids.filter((id) => activeUserIds.has(id)))]
}

function validateRequestType(value: unknown): RequestType | undefined {
  const allowed: RequestType[] = ['vacation', 'overtime_payout', 'overtime_time_off', 'time_correction', 'sick_leave']
  return allowed.find((type) => type === value)
}

function assertRequestDateRange(request: RequestItem) {
  if ((request.type === 'vacation' || request.type === 'overtime_time_off' || request.type === 'sick_leave') && (!request.startDate || !request.endDate)) {
    throw new Error('A start and end date are required')
  }
  if (request.startDate && request.endDate && request.startDate > request.endDate) {
    throw new Error('The end date cannot be before the start date')
  }
}

function createAbsencesForRequest(database: ReturnType<typeof readDatabase>, request: RequestItem) {
  if (!request.startDate || !request.endDate) {
    return
  }

  const absenceType =
    request.type === 'vacation' ? 'vacation' : request.type === 'sick_leave' ? 'sick_leave' : 'overtime_time_off'
  const label = request.type === 'vacation' ? 'Vacation' : request.type === 'sick_leave' ? 'Sick leave' : 'Overtime time off'

  for (const date of dateKeysBetween(request.startDate, request.endDate)) {
    const exists = database.absences.some(
      (absence) =>
        absence.userId === request.userId &&
        absence.date === date &&
        absence.type === absenceType &&
        absence.requestId === request.id,
    )
    if (exists) {
      continue
    }

    database.absences.push({
      id: randomUUID(),
      userId: request.userId,
      date,
      type: absenceType,
      requestId: request.id,
      label,
      createdAt: nowIso(),
    })
  }
}

function applyTimeCorrection(database: ReturnType<typeof readDatabase>, request: RequestItem) {
  if (!request.correctionDate || !request.proposedStartTime || !request.proposedEndTime) {
    throw new Error('A date, start time, and end time are required for time corrections')
  }

  const createdAt = nowIso()
  database.timeEntries.push({
    id: randomUUID(),
    userId: request.userId,
    date: request.correctionDate,
    startedAt: isoFromDateAndTime(request.correctionDate, request.proposedStartTime),
    stoppedAt: isoFromDateAndTime(request.correctionDate, request.proposedEndTime),
    breaks: [],
    manualBreakMinutes: request.proposedBreakMinutes ?? 0,
    source: 'approved_correction',
    requestId: request.id,
    note: request.reason,
    createdAt,
    updatedAt: createdAt,
  })
}

function undoApprovedRequestEffects(database: ReturnType<typeof readDatabase>, request: RequestItem) {
  database.absences = database.absences.filter((absence) => absence.requestId !== request.id)
  database.timeEntries = database.timeEntries.filter(
    (entry) => entry.requestId !== request.id || entry.source !== 'approved_correction',
  )
}

function displayUserName(user: StoredUser) {
  const trailingRole = user.role === 'employee' ? /\s+(Employee|Mitarbeiter)$/i : /\s+(Admin|Administrator)$/i
  const cleanedName = user.name.replace(trailingRole, '').trim()
  return cleanedName || user.name
}

function requestTypeLabel(type: RequestType) {
  const labels: Record<RequestType, string> = {
    vacation: 'Vacation',
    overtime_payout: 'Overtime payout',
    overtime_time_off: 'Overtime time off',
    time_correction: 'Time correction',
    sick_leave: 'Sick leave',
  }
  return labels[type]
}

function requestStatusLabel(status: RequestStatus) {
  return status[0].toUpperCase() + status.slice(1)
}

function responsibleAdminsFor(database: ReturnType<typeof readDatabase>, employee: StoredUser) {
  const assignedAdmin = employee.responsibleAdminUserId
    ? database.users.find((user) => user.id === employee.responsibleAdminUserId && user.role === 'admin' && user.active)
    : undefined

  return assignedAdmin ? [assignedAdmin] : adminUsers(database)
}

function appBaseUrlFor(request: Request) {
  const configured = process.env.APP_BASE_URL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, '')
  }

  const origin = request.get('origin')
  if (origin) {
    return origin.replace(/\/+$/, '')
  }

  return `${request.protocol}://${request.get('host')}`.replace(/\/+$/, '')
}

function requestLink(baseUrl: string, requestId: string) {
  return `${baseUrl}/?tab=requests&request=${encodeURIComponent(requestId)}`
}

function invitationTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function publicInvitation(invitation: ReturnType<typeof readDatabase>['userInvitations'][number]): UserInvitation {
  return {
    id: invitation.id,
    userId: invitation.userId,
    email: invitation.email,
    role: invitation.role,
    createdBy: invitation.createdBy,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
  }
}

function publicMailServerSettings(settings: ReturnType<typeof readDatabase>['mailServerSettings']): MailServerSettings | undefined {
  if (!settings) {
    return undefined
  }

  return {
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    user: settings.user,
    fromAddress: settings.fromAddress,
    passwordConfigured: settings.password.length > 0,
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
  }
}

function invitationLink(baseUrl: string, token: string) {
  return `${baseUrl}/invite/${encodeURIComponent(token)}`
}

function invitationIsUsable(invitation: ReturnType<typeof readDatabase>['userInvitations'][number] | undefined) {
  return Boolean(invitation && !invitation.acceptedAt && new Date(invitation.expiresAt).getTime() >= Date.now())
}

function requestDetailLines(request: RequestItem, employee: StoredUser) {
  const lines = [
    `Employee: ${displayUserName(employee)} <${employee.email}>`,
    `Type: ${requestTypeLabel(request.type)}`,
    `Status: ${requestStatusLabel(request.status)}`,
    `Submitted: ${request.createdAt}`,
  ]

  if (request.startDate || request.endDate) {
    lines.push(`Date range: ${request.startDate ?? '-'} to ${request.endDate ?? '-'}`)
  }

  if (request.minutes) {
    lines.push(`Time amount: ${formatDecimalHours(request.minutes)} hours`)
  }

  if (request.correctionDate || request.proposedStartTime || request.proposedEndTime) {
    lines.push(
      `Correction: ${request.correctionDate ?? '-'}, ${request.proposedStartTime ?? '-'} to ${request.proposedEndTime ?? '-'}, break ${request.proposedBreakMinutes ?? 0} minutes`,
    )
  }

  if (request.doctorNoteName) {
    lines.push(`Doctor note: attached (${request.doctorNoteName})`)
  } else if (request.type === 'sick_leave') {
    lines.push('Doctor note: not attached')
  }

  lines.push(`Reason: ${request.reason || '-'}`)
  return lines
}

async function notifyAdminsForRequest(
  database: ReturnType<typeof readDatabase>,
  request: RequestItem,
  user: StoredUser,
  baseUrl: string,
) {
  const admins = responsibleAdminsFor(database, user)
  const title = 'New request'
  const userName = displayUserName(user)
  const typeLabel = requestTypeLabel(request.type)
  const link = requestLink(baseUrl, request.id)
  const message = `${userName} submitted a ${typeLabel.toLowerCase()} request.`
  for (const admin of admins) {
    addNotification(database, admin.id, title, message, 'request', request.id)
  }

  await sendEmail(
    database,
    admins,
    `Approval needed: ${typeLabel} request from ${userName}`,
    [
      'A new request needs your review.',
      '',
      ...requestDetailLines(request, user),
      '',
      `Review link: ${link}`,
      '',
      'Open the link while logged in with an admin account. The link does not grant access by itself.',
    ].join('\n'),
  )
}

async function notifyEmployeeForDecision(
  database: ReturnType<typeof readDatabase>,
  request: RequestItem,
  employee: StoredUser,
  admin: StoredUser,
  baseUrl: string,
) {
  const typeLabel = requestTypeLabel(request.type)
  const decision = requestStatusLabel(request.status)
  const link = requestLink(baseUrl, request.id)

  addNotification(
    database,
    employee.id,
    `Request ${request.status}`,
    `Your ${typeLabel.toLowerCase()} request was ${request.status}.`,
    'request',
    request.id,
  )

  await sendEmail(
    database,
    [employee],
    `Your ${typeLabel} request was ${request.status}`,
    [
      `Your request was ${decision.toLowerCase()}.`,
      '',
      ...requestDetailLines(request, employee),
      `Decided by: ${displayUserName(admin)} <${admin.email}>`,
      `Decided at: ${request.decidedAt ?? '-'}`,
      `Admin note: ${request.adminNote || '-'}`,
      '',
      `View link: ${link}`,
    ].join('\n'),
  )
}

async function notifyEmployeeForUndo(
  database: ReturnType<typeof readDatabase>,
  request: RequestItem,
  employee: StoredUser,
  admin: StoredUser,
  baseUrl: string,
) {
  const typeLabel = requestTypeLabel(request.type)
  const link = requestLink(baseUrl, request.id)

  addNotification(
    database,
    employee.id,
    'Approval undone',
    `The approval for your ${typeLabel.toLowerCase()} request was undone.`,
    'request',
    request.id,
  )

  await sendEmail(
    database,
    [employee],
    `Approval undone: ${typeLabel} request`,
    [
      `The approval for your ${typeLabel.toLowerCase()} request was undone.`,
      '',
      ...requestDetailLines(request, employee),
      `Undone by: ${displayUserName(admin)} <${admin.email}>`,
      `Undone at: ${request.undoneAt ?? '-'}`,
      '',
      `View link: ${link}`,
    ].join('\n'),
  )
}

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    dataFile: dataFilePath(),
    backup: backupInfo(),
  })
})

app.post('/api/login', (request, response) => {
  const email = parseString(request.body.email).toLowerCase()
  const password = parseString(request.body.password)
  const database = readDatabase()
  const user = database.users.find((candidate) => candidate.email.toLowerCase() === email && candidate.active)

  if (!user || !verifyPassword(user, password)) {
    response.status(401).json({ message: 'Invalid email or password' })
    return
  }

  const token = randomUUID()
  tokens.set(token, user.id)
  addAudit(database, user.id, 'login', 'user', user.id)
  writeDatabase(database)
  response.json({ token, user: publicUser(user) })
})

app.post('/api/register', (_request, response) => {
  response.status(403).json({ message: 'Registration requires an invitation link from an admin.' })
})

app.get('/api/invitations/:token', (request, response) => {
  const database = readDatabase()
  const tokenHash = invitationTokenHash(request.params.token)
  const invitation = database.userInvitations.find((candidate) => candidate.tokenHash === tokenHash)
  const user = invitation ? database.users.find((candidate) => candidate.id === invitation.userId && candidate.active) : undefined

  if (!invitation || !invitationIsUsable(invitation) || !user) {
    response.status(404).json({ message: 'Invitation is invalid, expired, or already used.' })
    return
  }

  response.json({
    name: user.name,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  })
})

app.post('/api/invitations/:token/accept', (request, response) => {
  const password = parseString(request.body.password)
  const passwordConfirm = parseString(request.body.passwordConfirm)
  const database = readDatabase()
  const tokenHash = invitationTokenHash(request.params.token)
  const invitation = database.userInvitations.find((candidate) => candidate.tokenHash === tokenHash)
  const user = invitation ? database.users.find((candidate) => candidate.id === invitation.userId && candidate.active) : undefined

  if (!invitation || !invitationIsUsable(invitation) || !user) {
    response.status(404).json({ message: 'Invitation is invalid, expired, or already used.' })
    return
  }

  if (password !== passwordConfirm) {
    response.status(400).json({ message: 'Passwords do not match' })
    return
  }

  const policyErrors = passwordPolicyErrors(password, user.email, user.name)
  if (policyErrors.length > 0) {
    response.status(400).json({ message: policyErrors.join(' ') })
    return
  }

  const passwordSalt = randomBytes(16).toString('hex')
  user.passwordSalt = passwordSalt
  user.passwordHash = hashPassword(password, passwordSalt)
  user.mustChangePassword = false
  invitation.acceptedAt = nowIso()
  addAudit(database, user.id, 'invitation_accepted', 'user', user.id, { invitationId: invitation.id })
  writeDatabase(database)

  const authToken = randomUUID()
  tokens.set(authToken, user.id)
  response.status(201).json({ token: authToken, user: publicUser(user) })
})

app.post('/api/account/password', requireAuth, (request: AuthedRequest, response) => {
  const currentPassword = parseString(request.body.currentPassword)
  const password = parseString(request.body.password)
  const passwordConfirm = parseString(request.body.passwordConfirm)
  const database = readDatabase()
  const user = database.users.find((candidate) => candidate.id === request.user!.id && candidate.active)

  if (!user) {
    response.status(401).json({ message: 'Authentication required' })
    return
  }

  if (!verifyPassword(user, currentPassword)) {
    response.status(400).json({ message: 'Current password is incorrect' })
    return
  }

  if (password !== passwordConfirm) {
    response.status(400).json({ message: 'Passwords do not match' })
    return
  }

  if (verifyPassword(user, password)) {
    response.status(400).json({ message: 'New password must be different from the current password' })
    return
  }

  const policyErrors = passwordPolicyErrors(password, user.email, user.name)
  if (policyErrors.length > 0) {
    response.status(400).json({ message: policyErrors.join(' ') })
    return
  }

  const passwordSalt = randomBytes(16).toString('hex')
  user.passwordSalt = passwordSalt
  user.passwordHash = hashPassword(password, passwordSalt)
  user.mustChangePassword = false
  addAudit(database, user.id, 'password_changed', 'user', user.id, { forced: Boolean(request.user!.mustChangePassword) })
  writeDatabase(database)
  response.json(stateForUser(user))
})

app.post('/api/admin/invitations', requireAuth, requireAdmin, async (request: AuthedRequest, response) => {
  try {
    const database = readDatabase()
    const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
    const name = parseString(request.body.name)
    const email = parseString(request.body.email).toLowerCase()
    const role = parseRole(request.body.role)
    const weeklyHours = Number(request.body.expectedWeeklyHours)
    const vacationDays = Number(request.body.yearlyVacationDays)
    const targetBalanceHours = Number(request.body.targetBalanceHours)
    const targetRemainingVacationDays = Number(request.body.targetRemainingVacationDays)
    const responsibleAdminUserId = parseString(request.body.responsibleAdminUserId)
    const expectedWeeklyMinutes = Number.isFinite(weeklyHours) && weeklyHours > 0 ? Math.round(weeklyHours * 60) : 40 * 60
    const yearlyVacationDays = Number.isFinite(vacationDays) && vacationDays >= 0 ? Math.round(vacationDays) : 30

    if (name.length < 2) {
      response.status(400).json({ message: 'Name is required' })
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      response.status(400).json({ message: 'A valid email address is required' })
      return
    }

    if (database.users.some((user) => user.email.toLowerCase() === email)) {
      response.status(409).json({ message: 'Email is already registered' })
      return
    }

    const licenseAfterInvite = licenseStateForDatabase(database, 1)
    if (!licenseAfterInvite.valid) {
      response.status(402).json({ message: licenseAfterInvite.message })
      return
    }

    const user = makeStoredUser(name, email, role, randomBytes(48).toString('hex'), expectedWeeklyMinutes, yearlyVacationDays)
    if (role === 'employee') {
      const responsibleAdmin = responsibleAdminUserId
        ? database.users.find((candidate) => candidate.id === responsibleAdminUserId && candidate.role === 'admin' && candidate.active)
        : admin
      user.responsibleAdminUserId = responsibleAdmin?.id
    }
    if (Number.isFinite(targetBalanceHours)) {
      user.balanceAdjustmentMinutes = Math.round(targetBalanceHours * 60)
    }
    if (Number.isFinite(targetRemainingVacationDays)) {
      user.vacationAdjustmentDays = targetRemainingVacationDays - yearlyVacationDays
    }

    const inviteToken = randomBytes(32).toString('base64url')
    const createdAt = nowIso()
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const invitation = {
      id: randomUUID(),
      userId: user.id,
      email: user.email,
      role,
      tokenHash: invitationTokenHash(inviteToken),
      createdBy: admin.id,
      createdAt,
      expiresAt,
    }

    database.users.push(user)
    database.userInvitations.unshift(invitation)
    addAudit(database, admin.id, 'user_invited', 'user', user.id, { invitationId: invitation.id, email: user.email, role })

    const link = invitationLink(appBaseUrlFor(request), inviteToken)
    await sendEmail(
      database,
      [user],
      'Invitation to NRW Time Tracker',
      [
        `Hello ${displayUserName(user)},`,
        '',
        'An admin created an account for you in NRW Time Tracker.',
        'Please use this invitation link to set your password:',
        link,
        '',
        `This invitation is only valid for: ${user.email}`,
        `It expires at: ${expiresAt}`,
        '',
        'Hallo,',
        'ein Admin hat ein Konto für dich in der NRW Zeiterfassung erstellt.',
        'Bitte öffne den Link, um dein Passwort festzulegen.',
      ].join('\n'),
    )

    writeDatabase(database)
    response.status(201).json(stateForUser(admin))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Invitation failed' })
  }
})

app.delete('/api/admin/invitations/:id', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const invitation = database.userInvitations.find((candidate) => candidate.id === request.params.id)

  if (!invitation) {
    response.status(404).json({ message: 'Invitation not found' })
    return
  }

  if (invitation.acceptedAt) {
    response.status(409).json({ message: 'Accepted invitations cannot be canceled' })
    return
  }

  const targetUser = database.users.find((user) => user.id === invitation.userId)
  const hasOperationalData = Boolean(
    targetUser &&
      (database.timeEntries.some((entry) => entry.userId === targetUser.id) ||
        database.absences.some((absence) => absence.userId === targetUser.id) ||
        database.requests.some((item) => item.userId === targetUser.id) ||
        database.importBatches.some((batch) => batch.userId === targetUser.id)),
  )

  if (hasOperationalData) {
    response.status(409).json({ message: 'Invitation cannot be canceled because this user already has time or request data.' })
    return
  }

  database.userInvitations = database.userInvitations.filter((item) => item.id !== invitation.id)
  database.users = database.users.filter((user) => user.id !== invitation.userId)
  database.notifications = database.notifications.filter((notification) => notification.userId !== invitation.userId)
  database.calendarGroups = database.calendarGroups.map((group) => ({
    ...group,
    memberUserIds: group.memberUserIds.filter((userId) => userId !== invitation.userId),
  }))
  database.users = database.users.map((user) => ({
    ...user,
    calendarAccessUserIds: user.calendarAccessUserIds.filter((userId) => userId !== invitation.userId),
  }))

  addAudit(database, admin.id, 'invitation_canceled', 'user_invitation', invitation.id, {
    userId: invitation.userId,
    email: invitation.email,
  })
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.get('/api/state', requireAuth, (request: AuthedRequest, response) => {
  response.json(stateForUser(request.user!))
})

app.get('/api/exports/time-csv', requireAuth, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const currentUser = database.users.find((candidate) => candidate.id === request.user!.id)!
  const requestedUserId = parseString(request.query.userId) || currentUser.id

  if (currentUser.role !== 'admin' && requestedUserId !== currentUser.id) {
    response.status(403).json({ message: 'You can only export your own time data' })
    return
  }

  const targetUser = database.users.find((user) => user.id === requestedUserId && user.active)
  if (!targetUser) {
    response.status(404).json({ message: 'User not found' })
    return
  }

  const period = parseExportPeriod(request.query.period)
  const referenceDate = parseDateKeyInput(request.query.date)
  const language = parseExportLanguage(request.query.language)
  const exportFile = buildTimeCsvExport(database, publicUser(targetUser), period, referenceDate, language)

  addAudit(database, currentUser.id, 'time_csv_exported', 'user', targetUser.id, {
    period,
    startDate: exportFile.startDate,
    endDate: exportFile.endDate,
  })
  writeDatabase(database)

  response.setHeader('Content-Type', 'text/csv; charset=utf-8')
  response.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"`)
  response.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
  response.send(exportFile.csv)
})

app.post('/api/clock', requireAuth, (request: AuthedRequest, response) => {
  const action = parseString(request.body.action) as ClockAction
  const database = readDatabase()
  const user = database.users.find((candidate) => candidate.id === request.user!.id)!
  const currentEntry = openEntryForUser(database.timeEntries, user.id)
  const timestamp = nowIso()

  if (action === 'start_work') {
    if (currentEntry) {
      response.status(409).json({ message: 'Work is already running' })
      return
    }

    database.timeEntries.push({
      id: randomUUID(),
      userId: user.id,
      date: toDateKey(new Date()),
      startedAt: timestamp,
      breaks: [],
      source: 'clock',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  } else if (action === 'start_break') {
    if (!currentEntry || currentEntry.breaks.some((segment) => !segment.stoppedAt)) {
      response.status(409).json({ message: 'No active work entry or break already running' })
      return
    }

    currentEntry.breaks.push({ id: randomUUID(), startedAt: timestamp })
    currentEntry.updatedAt = timestamp
  } else if (action === 'stop_break') {
    const openBreak = currentEntry?.breaks.find((segment) => !segment.stoppedAt)
    if (!openBreak || !currentEntry) {
      response.status(409).json({ message: 'No break is running' })
      return
    }

    openBreak.stoppedAt = timestamp
    currentEntry.updatedAt = timestamp
  } else if (action === 'stop_work') {
    if (!currentEntry) {
      response.status(409).json({ message: 'No work entry is running' })
      return
    }

    const openBreak = currentEntry.breaks.find((segment) => !segment.stoppedAt)
    if (openBreak) {
      openBreak.stoppedAt = timestamp
    }
    currentEntry.stoppedAt = timestamp
    currentEntry.updatedAt = timestamp
  } else {
    response.status(400).json({ message: 'Unsupported clock action' })
    return
  }

  addAudit(database, user.id, action, 'time_entry', currentEntry?.id ?? 'new')
  writeDatabase(database)
  response.json(stateForUser(user))
})

app.post('/api/requests', requireAuth, async (request: AuthedRequest, response) => {
  try {
    const type = validateRequestType(request.body.type)
    if (!type) {
      response.status(400).json({ message: 'Unsupported request type' })
      return
    }

    const database = readDatabase()
    const user = database.users.find((candidate) => candidate.id === request.user!.id)!
    const createdAt = nowIso()
    const item: RequestItem = {
      id: randomUUID(),
      userId: user.id,
      type,
      status: 'pending',
      startDate: parseString(request.body.startDate) || undefined,
      endDate: parseString(request.body.endDate) || undefined,
      minutes: parseMinutes(request.body.minutes) || undefined,
      correctionDate: parseString(request.body.correctionDate) || undefined,
      proposedStartTime: parseString(request.body.proposedStartTime) || undefined,
      proposedEndTime: parseString(request.body.proposedEndTime) || undefined,
      proposedBreakMinutes: parseMinutes(request.body.proposedBreakMinutes),
      doctorNoteName: parseString(request.body.doctorNoteName) || undefined,
      doctorNoteDataUrl: parseString(request.body.doctorNoteDataUrl) || undefined,
      reason: parseString(request.body.reason),
      createdAt,
    }

    assertRequestDateRange(item)
    database.requests.unshift(item)
    addAudit(database, user.id, 'request_created', 'request', item.id, { type: item.type })
    await notifyAdminsForRequest(database, item, user, appBaseUrlFor(request))
    writeDatabase(database)
    response.status(201).json(stateForUser(user))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Request failed' })
  }
})

app.post('/api/requests/:id/decision', requireAuth, requireAdmin, async (request: AuthedRequest, response) => {
  try {
    const database = readDatabase()
    const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
    const item = database.requests.find((candidate) => candidate.id === request.params.id)
    const decision = parseString(request.body.decision)

    if (!item || item.status !== 'pending') {
      response.status(404).json({ message: 'Pending request not found' })
      return
    }

    if (decision !== 'approved' && decision !== 'rejected') {
      response.status(400).json({ message: 'Decision must be approved or rejected' })
      return
    }

    item.status = decision
    item.decidedAt = nowIso()
    item.decidedBy = admin.id
    item.adminNote = parseString(request.body.adminNote)

    if (decision === 'approved' && (item.type === 'vacation' || item.type === 'overtime_time_off' || item.type === 'sick_leave')) {
      createAbsencesForRequest(database, item)
    }

    if (decision === 'approved' && item.type === 'time_correction') {
      applyTimeCorrection(database, item)
    }

    const employee = database.users.find((user) => user.id === item.userId)
    if (employee) {
      await notifyEmployeeForDecision(database, item, employee, admin, appBaseUrlFor(request))
    }

    addAudit(database, admin.id, `request_${decision}`, 'request', item.id, { type: item.type })
    writeDatabase(database)
    response.json(stateForUser(admin))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Decision failed' })
  }
})

app.post('/api/requests/:id/undo', requireAuth, requireAdmin, async (request: AuthedRequest, response) => {
  try {
    const database = readDatabase()
    const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
    const item = database.requests.find((candidate) => candidate.id === request.params.id)

    if (!item || item.status !== 'approved') {
      response.status(404).json({ message: 'Approved request not found' })
      return
    }

    undoApprovedRequestEffects(database, item)
    item.status = 'undone'
    item.undoneAt = nowIso()
    item.undoneBy = admin.id

    const employee = database.users.find((user) => user.id === item.userId)
    if (employee) {
      await notifyEmployeeForUndo(database, item, employee, admin, appBaseUrlFor(request))
    }

    addAudit(database, admin.id, 'request_approval_undone', 'request', item.id, { type: item.type })
    writeDatabase(database)
    response.json(stateForUser(admin))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Undo failed' })
  }
})

app.patch('/api/users/:id/settings', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const user = database.users.find((candidate) => candidate.id === request.params.id)

  if (!user) {
    response.status(404).json({ message: 'User not found' })
    return
  }

  const weeklyHours = Number(request.body.expectedWeeklyHours)
  const vacationDays = Number(request.body.yearlyVacationDays)
  const effectiveFrom = parseDateKeyInput(request.body.effectiveFrom)
  const targetBalanceHours = Number(request.body.targetBalanceHours)
  const targetRemainingVacationDays = Number(request.body.targetRemainingVacationDays)
  const responsibleAdminUserId = parseString(request.body.responsibleAdminUserId)
  const requestedRole = 'role' in request.body ? parseRole(request.body.role) : undefined
  const updates: Record<string, unknown> = {}

  if (requestedRole && requestedRole !== user.role) {
    if (user.id === admin.id && requestedRole !== 'admin') {
      response.status(400).json({ message: 'You cannot remove your own admin permission.' })
      return
    }

    const activeAdmins = database.users.filter((candidate) => candidate.active && candidate.role === 'admin')
    if (user.role === 'admin' && requestedRole !== 'admin' && activeAdmins.length <= 1) {
      response.status(400).json({ message: 'At least one active admin is required.' })
      return
    }

    user.role = requestedRole
    updates.role = requestedRole

    if (requestedRole === 'admin') {
      user.responsibleAdminUserId = undefined
      updates.responsibleAdminUserId = null
    } else {
      const responsibleAdmin = responsibleAdminUserId
        ? database.users.find((candidate) => candidate.id === responsibleAdminUserId && candidate.role === 'admin' && candidate.active)
        : admin
      user.responsibleAdminUserId = responsibleAdmin?.id
      updates.responsibleAdminUserId = responsibleAdmin?.id ?? null
    }
  }

  if ((Number.isFinite(weeklyHours) && weeklyHours > 0) || (Number.isFinite(vacationDays) && vacationDays >= 0)) {
    const terms = employmentTermsFor(user)
    const activeTerm = termForDate({ ...user, employmentTerms: terms }, effectiveFrom)
    const nextTerm = {
      id: terms.find((term) => term.effectiveFrom === effectiveFrom)?.id ?? randomUUID(),
      effectiveFrom,
      expectedWeeklyMinutes: Number.isFinite(weeklyHours) && weeklyHours > 0
        ? Math.round(weeklyHours * 60)
        : activeTerm.expectedWeeklyMinutes,
      yearlyVacationDays: Number.isFinite(vacationDays) && vacationDays >= 0
        ? Math.round(vacationDays)
        : activeTerm.yearlyVacationDays,
      createdAt: terms.find((term) => term.effectiveFrom === effectiveFrom)?.createdAt ?? nowIso(),
    }
    user.employmentTerms = [...terms.filter((term) => term.effectiveFrom !== effectiveFrom), nextTerm].sort((left, right) =>
      left.effectiveFrom.localeCompare(right.effectiveFrom),
    )
    const currentTerm = currentEmploymentTerm(user)
    user.expectedWeeklyMinutes = currentTerm.expectedWeeklyMinutes
    user.yearlyVacationDays = currentTerm.yearlyVacationDays
    updates.employmentTerm = {
      effectiveFrom,
      expectedWeeklyMinutes: nextTerm.expectedWeeklyMinutes,
      yearlyVacationDays: nextTerm.yearlyVacationDays,
    }
  }

  if (Number.isFinite(targetBalanceHours)) {
    const holidays = holidaysForYears(currentHolidayYears(), database.holidayOverrides, database.holidaySettings)
    const rawUser = { ...publicUser(user), balanceAdjustmentMinutes: 0 }
    const rawSummary = summaryForUser(rawUser, database.timeEntries, database.absences, holidays)
    user.balanceAdjustmentMinutes = Math.round(targetBalanceHours * 60 - rawSummary.year.plusMinusMinutes)
    updates.targetBalanceHours = targetBalanceHours
  }
  if (Number.isFinite(targetRemainingVacationDays)) {
    const holidays = holidaysForYears(currentHolidayYears(), database.holidayOverrides, database.holidaySettings)
    const usedDays = vacationUsedDays(publicUser(user), database.absences, holidays, new Date().getFullYear())
    user.vacationAdjustmentDays = targetRemainingVacationDays + usedDays - user.yearlyVacationDays
    updates.targetRemainingVacationDays = targetRemainingVacationDays
  }
  if (user.role === 'employee' && 'responsibleAdminUserId' in request.body) {
    const responsibleAdmin = responsibleAdminUserId
      ? database.users.find((candidate) => candidate.id === responsibleAdminUserId && candidate.role === 'admin' && candidate.active)
      : undefined
    user.responsibleAdminUserId = responsibleAdmin?.id
    updates.responsibleAdminUserId = responsibleAdmin?.id ?? null
  }

  addAudit(database, admin.id, 'user_settings_updated', 'user', user.id, updates)
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.delete('/api/users/:id', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const user = database.users.find((candidate) => candidate.id === request.params.id)

  if (!user || !user.active) {
    response.status(404).json({ message: 'Active user not found' })
    return
  }

  if (user.id === admin.id) {
    response.status(400).json({ message: 'You cannot remove your own account.' })
    return
  }

  const activeAdmins = database.users.filter((candidate) => candidate.active && candidate.role === 'admin')
  if (user.role === 'admin' && activeAdmins.length <= 1) {
    response.status(400).json({ message: 'At least one active admin is required.' })
    return
  }

  user.active = false
  user.calendarAccessUserIds = []
  user.responsibleAdminUserId = undefined
  database.users.forEach((candidate) => {
    candidate.calendarAccessUserIds = candidate.calendarAccessUserIds.filter((id) => id !== user.id)
    if (candidate.responsibleAdminUserId === user.id) {
      candidate.responsibleAdminUserId = undefined
    }
  })
  database.calendarGroups.forEach((group) => {
    group.memberUserIds = group.memberUserIds.filter((id) => id !== user.id)
  })
  database.userInvitations = database.userInvitations.filter((invitation) => invitation.userId !== user.id || invitation.acceptedAt)
  for (const [token, userId] of tokens.entries()) {
    if (userId === user.id) {
      tokens.delete(token)
    }
  }

  addAudit(database, admin.id, 'user_removed', 'user', user.id, { email: user.email, role: user.role })
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.post('/api/imports/time-csv', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  try {
    const database = readDatabase()
    const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
    const userId = parseString(request.body.userId)
    const csv = typeof request.body.csv === 'string' ? request.body.csv : ''
    const fileName = parseString(request.body.fileName) || 'zeitguru-export.csv'
    const targetUser = database.users.find((user) => user.id === userId && user.active)

    if (!targetUser) {
      response.status(404).json({ message: 'Employee not found' })
      return
    }

    if (csv.trim().length === 0) {
      response.status(400).json({ message: 'CSV content is required' })
      return
    }

    const batch = importTimeCsv(database, { userId: targetUser.id, importedBy: admin.id, csv, fileName })
    addAudit(database, admin.id, 'time_csv_imported', 'import_batch', batch.id, {
      userId: targetUser.id,
      importedRows: batch.importedRows,
      skippedRows: batch.skippedRows,
    })
    writeDatabase(database)
    response.status(201).json(stateForUser(admin))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'CSV import failed' })
  }
})

app.post('/api/backups/weekly', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const backupPath = ensureWeeklyBackup()
  addAudit(database, admin.id, 'weekly_backup_created', 'backup', backupPath)
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.get('/api/holidays/template-options', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const settings = normalizeHolidaySettings({
    country: parseString(request.query.country),
    state: parseString(request.query.state) || undefined,
    region: parseString(request.query.region) || undefined,
    language: parseString(request.query.language) || undefined,
  })

  response.json(holidayTemplateOptions(settings))
})

app.patch('/api/holidays/settings', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const nextSettings = normalizeHolidaySettings({
    country: parseString(request.body.country),
    state: parseString(request.body.state) || undefined,
    region: parseString(request.body.region) || undefined,
    language: parseString(request.body.language) || undefined,
    updatedAt: nowIso(),
    updatedBy: admin.id,
  })

  if (!holidaySettingsSupported(nextSettings)) {
    response.status(400).json({ message: 'Unsupported holiday country, state, or region' })
    return
  }

  database.holidaySettings = nextSettings
  addAudit(database, admin.id, 'holiday_settings_updated', 'settings', 'holidays', { ...nextSettings })
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.patch('/api/settings/mail-server', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const existing = database.mailServerSettings
  const host = parseString(request.body.host)
  const port = Number(request.body.port)
  const secure = parseBoolean(request.body.secure)
  const user = parseString(request.body.user)
  const passwordInput = typeof request.body.password === 'string' ? request.body.password : ''
  const password = passwordInput.length > 0 ? passwordInput : existing?.password ?? ''
  const fromAddress = parseString(request.body.fromAddress)

  if (!host) {
    response.status(400).json({ message: 'SMTP host is required' })
    return
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    response.status(400).json({ message: 'SMTP port must be between 1 and 65535' })
    return
  }

  if (!/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(fromAddress) && !/^.+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(fromAddress)) {
    response.status(400).json({ message: 'A valid from address is required' })
    return
  }

  database.mailServerSettings = {
    host,
    port,
    secure,
    user,
    password,
    fromAddress,
    passwordConfigured: password.length > 0,
    updatedAt: nowIso(),
    updatedBy: admin.id,
  }

  addAudit(database, admin.id, 'mail_server_settings_updated', 'settings', 'mail_server', {
    host,
    port,
    secure,
    userConfigured: user.length > 0,
    passwordConfigured: password.length > 0,
    fromAddress,
  })
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.post('/api/settings/mail-server/test', requireAuth, requireAdmin, async (request: AuthedRequest, response) => {
  try {
    const database = readDatabase()
    const admin = database.users.find((candidate) => candidate.id === request.user!.id)!

    if (!mailServerConfigured(database)) {
      response.status(400).json({ message: 'No mail server is configured' })
      return
    }

    await sendEmail(
      database,
      [admin],
      'NRW Zeiterfassung: SMTP-Test',
      [
        'This is a test email from NRW Zeiterfassung.',
        '',
        'Dies ist eine Test-E-Mail aus der NRW Zeiterfassung.',
        `Sent at: ${nowIso()}`,
      ].join('\n'),
    )

    addAudit(database, admin.id, 'mail_server_test_sent', 'settings', 'mail_server')
    writeDatabase(database)
    response.json(stateForUser(admin))
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Mail server test failed' })
  }
})

app.delete('/api/settings/mail-server', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!

  if (!database.mailServerSettings) {
    response.status(404).json({ message: 'No mail server is configured' })
    return
  }

  database.mailServerSettings = undefined
  addAudit(database, admin.id, 'mail_server_settings_deleted', 'settings', 'mail_server')
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.patch('/api/settings/license', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const licenseKey = parseString(request.body.licenseKey)

  if (!licenseKey) {
    response.status(400).json({ message: 'License key is required' })
    return
  }

  const verification = verifyLicenseKey(licenseKey)
  if (!verification.details) {
    response.status(400).json({ message: verification.error ?? 'License key is invalid' })
    return
  }

  database.licenseSettings = {
    licenseKey,
    updatedAt: nowIso(),
    updatedBy: admin.id,
  }

  addAudit(database, admin.id, 'license_settings_updated', 'settings', 'license', {
    licenseId: verification.details.licenseId,
    holderName: verification.details.holderName,
    plan: verification.details.plan,
    activeUserLimit: verification.details.activeUserLimit,
    validUntil: verification.details.validUntil ?? null,
  })
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.delete('/api/settings/license', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!

  if (!database.licenseSettings) {
    response.status(404).json({ message: 'No license is configured' })
    return
  }

  database.licenseSettings = undefined
  addAudit(database, admin.id, 'license_settings_deleted', 'settings', 'license')
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.patch('/api/users/:id/calendar-access', requireAuth, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const actor = database.users.find((candidate) => candidate.id === request.user!.id)!
  const user = database.users.find((candidate) => candidate.id === request.params.id)

  if (!user || (actor.role !== 'admin' && actor.id !== user.id)) {
    response.status(403).json({ message: 'You can only change your own calendar sharing' })
    return
  }

  const allowedIds = new Set(calendarAccessTargetsFor(user, database.users, database.calendarGroups).map((target) => target.id))
  const ids = parseUserIds(request.body.calendarAccessUserIds, database.users, user.id)
  user.calendarAccessUserIds = ids.filter((id) => allowedIds.has(id))

  addAudit(database, actor.id, 'calendar_access_updated', 'user', user.id)
  writeDatabase(database)
  response.json(stateForUser(actor))
})

app.post('/api/calendar-groups', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const name = parseString(request.body.name)

  if (!name) {
    response.status(400).json({ message: 'Group name is required' })
    return
  }

  const group: CalendarGroup = {
    id: randomUUID(),
    name,
    memberUserIds: parseUserIds(request.body.memberUserIds, database.users),
    createdAt: nowIso(),
  }

  database.calendarGroups.unshift(group)
  addAudit(database, admin.id, 'calendar_group_created', 'calendar_group', group.id)
  writeDatabase(database)
  response.status(201).json(stateForUser(admin))
})

app.patch('/api/calendar-groups/:id', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const group = database.calendarGroups.find((candidate) => candidate.id === request.params.id)
  const name = parseString(request.body.name)

  if (!group) {
    response.status(404).json({ message: 'Group not found' })
    return
  }

  if (!name) {
    response.status(400).json({ message: 'Group name is required' })
    return
  }

  group.name = name
  group.memberUserIds = parseUserIds(request.body.memberUserIds, database.users)
  addAudit(database, admin.id, 'calendar_group_updated', 'calendar_group', group.id)
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.delete('/api/calendar-groups/:id', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const groupId = parseString(request.params.id)
  const before = database.calendarGroups.length
  database.calendarGroups = database.calendarGroups.filter((group) => group.id !== groupId)

  if (database.calendarGroups.length === before) {
    response.status(404).json({ message: 'Group not found' })
    return
  }

  addAudit(database, admin.id, 'calendar_group_deleted', 'calendar_group', groupId)
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.post('/api/holidays/overrides', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const date = parseString(request.body.date)
  const name = parseString(request.body.name)
  const type = parseString(request.body.type)
  const freePercent = parsePercent(request.body.freePercent)

  if (!date || !name || (type !== 'custom' && type !== 'disabled')) {
    response.status(400).json({ message: 'Date, name, and override type are required' })
    return
  }

  const override = makeHolidayOverride(date, name, type, freePercent, admin.id)
  database.holidayOverrides = database.holidayOverrides.filter((item) => item.date !== date)
  database.holidayOverrides.unshift(override)
  addAudit(database, admin.id, 'holiday_override_created', 'holiday', override.id)
  writeDatabase(database)
  response.status(201).json(stateForUser(admin))
})

app.patch('/api/holidays/overrides/:id', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const overrideId = parseString(request.params.id)
  const override = database.holidayOverrides.find((item) => item.id === overrideId)
  const date = parseString(request.body.date)
  const name = parseString(request.body.name)
  const type = parseString(request.body.type)
  const freePercent = parsePercent(request.body.freePercent)

  if (!override) {
    response.status(404).json({ message: 'Holiday override not found' })
    return
  }

  if (!date || !name || (type !== 'custom' && type !== 'disabled')) {
    response.status(400).json({ message: 'Date, name, and override type are required' })
    return
  }

  override.date = date
  override.name = name
  override.type = type
  override.freePercent = freePercent
  database.holidayOverrides = [
    override,
    ...database.holidayOverrides.filter((item) => item.id !== override.id && item.date !== date),
  ]

  addAudit(database, admin.id, 'holiday_override_updated', 'holiday', override.id)
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.delete('/api/holidays/overrides/:id', requireAuth, requireAdmin, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const admin = database.users.find((candidate) => candidate.id === request.user!.id)!
  const overrideId = parseString(request.params.id)
  const before = database.holidayOverrides.length
  database.holidayOverrides = database.holidayOverrides.filter((override) => override.id !== overrideId)

  if (database.holidayOverrides.length === before) {
    response.status(404).json({ message: 'Holiday override not found' })
    return
  }

  addAudit(database, admin.id, 'holiday_override_deleted', 'holiday', overrideId)
  writeDatabase(database)
  response.json(stateForUser(admin))
})

app.patch('/api/notifications/:id/read', requireAuth, (request: AuthedRequest, response) => {
  const database = readDatabase()
  const user = database.users.find((candidate) => candidate.id === request.user!.id)!
  const notification = database.notifications.find(
    (candidate) => candidate.id === request.params.id && candidate.userId === user.id,
  )

  if (!notification) {
    response.status(404).json({ message: 'Notification not found' })
    return
  }

  notification.read = true
  writeDatabase(database)
  response.json(stateForUser(user))
})

ensureWeeklyBackup()
setInterval(() => {
  try {
    ensureWeeklyBackup()
  } catch (error) {
    console.error('Weekly backup check failed', error)
  }
}, 24 * 60 * 60 * 1000)

if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/.*/, (_request, response) => {
    response.sendFile(join(distDir, 'index.html'))
  })
}

app.listen(port, '0.0.0.0', () => {
  console.info(`NRW time tracker listening on http://localhost:${port}`)
})
