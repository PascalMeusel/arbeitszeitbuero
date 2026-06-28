import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Database,
  Download,
  Languages,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  RotateCcw,
  Send,
  Settings,
  ShieldCheck,
  Timer,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import type {
  CalendarGroup,
  ClockAction,
  ClockStatus,
  AbsenceType,
  Holiday,
  HolidayOverrideType,
  HolidaySettings,
  HolidayTemplateOptions,
  LicensePlan,
  LicenseState,
  MailServerSettings,
  RequestItem,
  RequestType,
  Role,
  StatePayload,
  TimeEntry,
  User,
  UserInvitation,
  UserSummary,
} from '../shared/domain.ts'
import {
  addDays,
  clampDateRange,
  dateKeysBetween,
  endOfMonth,
  endOfWeek,
  endOfYear,
  formatDecimalHours,
  isWeekend,
  parseDateKey,
  pad2,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toDateKey,
} from '../shared/dates.ts'
import { currentEmploymentTerm, employmentTermsFor, termForDate } from '../shared/terms.ts'

const apiBase = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:4177')

type Tab = 'dashboard' | 'calendar' | 'requests' | 'adminUsers' | 'adminGroups' | 'adminFreeDays' | 'adminSettings'
type Language = 'en' | 'de'
type TimeExportPeriod = 'day' | 'week' | 'month' | 'year' | 'all'

const translations = {
  en: {
    appName: 'Arbeitszeitbüro',
    dashboard: 'Dashboard',
    calendar: 'Calendar',
    requests: 'Requests',
    admin: 'Admin',
    users: 'Users',
    freeDays: 'Free Days',
    settings: 'Settings',
    signOut: 'Sign out',
    signIn: 'Sign in',
    register: 'Register',
    createAccount: 'Create account',
    alreadyRegistered: 'Use existing account',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    safePasswordHint: 'At least 12 characters with uppercase, lowercase, number, symbol, and no name/email words.',
    numericFieldsRequired: 'Please fill all numeric fields with valid numbers.',
    weeklyHoursRequired: 'Weekly hours must be greater than 0.',
    invitationRequired: 'Registration requires an invitation from an admin.',
    completeInviteTitle: 'Complete invitation',
    invitationIntro: 'Set a safe password for the email address that was invited.',
    invitedEmailLocked: 'Invited email',
    inviteExpiresAt: 'Invite expires',
    createPassword: 'Create password',
    changePasswordTitle: 'Change password',
    forcedPasswordChangeIntro: 'Set a new safe password before continuing.',
    currentPassword: 'Current password',
    newPassword: 'New password',
    saveNewPassword: 'Save new password',
    invalidInvite: 'This invitation is invalid, expired, or already used.',
    demoAdmin: 'Admin demo',
    demoEmployee: 'Employee demo',
    offWork: 'Off work',
    working: 'Working',
    onBreak: 'On break',
    startWork: 'Start Work',
    startBreak: 'Start Break',
    stopBreak: 'Stop Break',
    stopWork: 'Stop Work',
    confirmClockOutTitle: 'Stop work?',
    confirmClockOutBody: 'This will clock you out and close the current work entry.',
    clockRunning: 'Tracked work time',
    breakTaken: 'Break taken',
    timeBalance: 'Time Balance',
    referenceDate: 'Reference date',
    expected: 'Expected',
    balance: 'Balance',
    clockLog: 'Time Log',
    when: 'When',
    noClockEvents: 'No clock actions yet.',
    previousDay: 'Previous day',
    nextDay: 'Next day',
    chooseLogDate: 'Choose log date',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    allTime: 'Entire time',
    vacation: 'Vacation',
    used: 'used',
    notifications: 'Notifications',
    noUnread: 'No unread notifications.',
    thisMonth: 'This Month',
    calendarAccess: 'Calendar Access',
    saveAccess: 'Save Access',
    groups: 'Groups',
    newGroup: 'New group',
    groupName: 'Group name',
    groupMembers: 'Members',
    createGroup: 'Create group',
    editGroup: 'Edit group',
    saveGroup: 'Save group',
    deleteGroup: 'Delete group',
    confirmGroupChangeTitle: 'Save group changes?',
    confirmGroupChangeBody: 'Changing group members affects who can share calendars with whom.',
    confirmDeleteGroupTitle: 'Delete group?',
    confirmDeleteGroupBody: 'Members will lose this group connection for calendar sharing.',
    noShareableCalendarUsers: 'No group members available.',
    newRequest: 'New Request',
    allRequests: 'All Requests',
    myRequests: 'My Requests',
    noRequests: 'No requests yet.',
    type: 'Type',
    overtimePayout: 'Overtime payout',
    overtimeTimeOff: 'Overtime time off',
    timeCorrection: 'Time correction',
    sickLeave: 'Sick leave',
    doctorNote: 'Doctor note',
    doctorNoteAttached: 'Doctor note attached',
    downloadDoctorNote: 'Open doctor note',
    date: 'Date',
    start: 'Start',
    end: 'End',
    breakMinutes: 'Break minutes',
    startDate: 'Start date',
    endDate: 'End date',
    minutes: 'Minutes',
    reason: 'Reason',
    submitRequest: 'Submit Request',
    hours: 'hours',
    employeeSettings: 'Employee Settings',
    inviteNewUser: 'Invite new user',
    sendInvite: 'Create user and send invite',
    inviteEmailSent: 'Invite email sent',
    userRole: 'Role',
    startingTerms: 'Starting terms',
    initialBalances: 'Initial balances',
    pendingInvites: 'Pending invites',
    noPendingInvites: 'No pending invites.',
    acceptedInvites: 'Accepted invites',
    confirmInviteTitle: 'Create user and send invite?',
    confirmInviteBody: 'This creates the user, links the email address, and sends an invitation to set the password.',
    cancelInvite: 'Cancel invite',
    confirmCancelInviteTitle: 'Cancel invite?',
    confirmCancelInviteBody: 'This removes the pending invitation and frees the email address so it can be invited again later.',
    selectEmployee: 'Select user',
    selectedEmployee: 'Selected user',
    noEmployeeSelected: 'No user selected.',
    employmentTerms: 'Employment terms',
    currentTerms: 'Term history',
    appliesSince: 'Applies since',
    effectiveFrom: 'Effective from',
    currentSettings: 'Current settings',
    editTerms: 'Edit terms',
    editAdjustments: 'Edit balance',
    editResponsibleAdmin: 'Edit responsible admin',
    permissions: 'Permissions',
    editPermissions: 'Edit permissions',
    currentRole: 'Current role',
    confirmRoleTitle: 'Save role change?',
    confirmRoleBody: 'This changes which administrative functions this user can access.',
    removeUser: 'Remove user',
    removeUserDangerTitle: 'Remove user',
    confirmRemoveUserTitle: 'Remove this user?',
    confirmRemoveUserBody: 'This deactivates the account and removes calendar sharing and group membership. Historical time data is kept for records.',
    exportBeforeRemove: 'Export all time data before removing',
    removeWithoutExport: 'Remove without export',
    saveImportantChange: 'Save important change',
    confirmEmploymentTermTitle: 'Save employment terms?',
    confirmEmploymentTermBody: 'This changes expected work time or vacation entitlement from the selected date and affects calculations for that period.',
    confirmAdjustmentTitle: 'Save balance override?',
    confirmAdjustmentBody: 'This overwrites the current vacation or +/- balance for this year. Use it only for imports or corrections.',
    confirmResponsibleAdminTitle: 'Save responsible admin?',
    confirmResponsibleAdminBody: 'Future request emails for this employee will follow this assignment.',
    weeklyHours: 'Weekly hours',
    vacationDays: 'Vacation days',
    currentVacationRemainingDays: 'Current remaining vacation',
    currentBalanceHours: 'Current +/- hours',
    responsibleAdmin: 'Responsible admin',
    allAdminsFallback: 'All admins',
    save: 'Save',
    holidayTemplates: 'Holiday templates',
    holidayCountry: 'Country',
    holidayState: 'State',
    holidayRegion: 'Region',
    holidayTemplateLanguage: 'Holiday language',
    saveHolidayTemplate: 'Save holiday template',
    noHolidayState: 'Country-wide',
    noHolidayRegion: 'No region',
    templatePublicHolidays: 'Template public holidays',
    manualHolidayHint: 'Manual changes are applied on top of the selected template.',
    holidayName: 'Name',
    holidayFreePercent: 'Free percentage (%)',
    action: 'Action',
    addHoliday: 'Add holiday',
    disableHoliday: 'Disable holiday date',
    editHoliday: 'Edit holiday',
    manualHoliday: 'Manual holiday',
    manualHolidayChanges: 'Manual changes',
    noHolidayOverrides: 'No manual changes yet.',
    cancelEdit: 'Cancel edit',
    removeHolidayChange: 'Remove change',
    apply: 'Apply',
    csvImport: 'CSV Import',
    csvExport: 'CSV Export',
    exportFor: 'Export for',
    exportPeriod: 'Period',
    exportCsv: 'Export CSV',
    employee: 'Employee',
    fileName: 'File name',
    csvContent: 'CSV content',
    importCsv: 'Import CSV',
    recentImports: 'Recent imports',
    noImports: 'No imports yet.',
    imported: 'imported',
    skipped: 'skipped',
    backup: 'Backups',
    dataFile: 'Data file',
    backupFolder: 'Backup folder',
    lastBackup: 'Last weekly backup',
    createBackup: 'Create weekly backup',
    mailServer: 'Mail server',
    noMailServer: 'No mail server configured. Emails use the environment fallback or are logged only.',
    smtpHost: 'SMTP host',
    smtpPort: 'SMTP port',
    smtpSecure: 'TLS/SSL',
    smtpUser: 'SMTP user',
    smtpPassword: 'SMTP password',
    smtpFrom: 'From address',
    passwordSaved: 'Password saved',
    passwordPlaceholder: 'Leave blank to keep saved password',
    saveMailServer: 'Save mail server',
    testMailServer: 'Send test email',
    deleteMailServer: 'Delete mail server',
    confirmDeleteMailServerTitle: 'Delete mail server?',
    confirmDeleteMailServerBody: 'Invites, request notifications, and approval emails depend on this configuration. Delete it only if you are replacing it or using an environment fallback.',
    license: 'License',
    licenseStatus: 'License status',
    activeUsers: 'Active users',
    activeUserLimit: 'Active user limit',
    freeUserLimit: 'Free user limit',
    licenseKey: 'License key',
    licenseKeyPlaceholder: 'Paste signed license key',
    licenseKeyRequired: 'Paste a license key before saving.',
    saveLicense: 'Save license',
    deleteLicense: 'Delete license',
    noLicenseConfigured: 'No license key configured. Community use is allowed up to 10 active users.',
    paidLicense: 'Paid license',
    freeGrantLicense: 'Free grant',
    communityLicenseStatus: 'Community use',
    licensedStatus: 'Licensed',
    overLimitStatus: 'Over limit',
    invalidLicenseStatus: 'Invalid license',
    expiredLicenseStatus: 'Expired license',
    missingPublicKeyStatus: 'Server public key missing',
    holder: 'Holder',
    contact: 'Contact',
    plan: 'Plan',
    issuedAt: 'Issued at',
    validUntil: 'Valid until',
    licenseMessage: 'Message',
    confirmDeleteLicenseTitle: 'Delete license?',
    confirmDeleteLicenseBody: 'Without this license the app falls back to the free 10 active-user limit. Keep the key if the company is above that limit.',
    saveSettings: 'Save settings',
    confirm: 'Confirm',
    cancel: 'Cancel',
    noneYet: 'None yet',
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    undone: 'undone',
    approvedActions: 'Approved Actions',
    noApprovedActions: 'No approved actions for this user.',
    undoApproval: 'Undo approval',
    confirmUndoApprovalTitle: 'Undo approval?',
    confirmUndoApprovalBody: 'This removes the applied calendar or time-entry effect and marks the request as undone.',
    approvedAt: 'Approved at',
    approvedBy: 'Approved by',
    calendarLegend: 'Legend',
    publicHolidayLegend: 'Public holiday',
    vacationLegend: 'Approved vacation',
    sickLeaveLegend: 'Sick leave',
    timeOffLegend: 'Overtime time off',
  },
  de: {
    appName: 'Arbeitszeitbüro',
    dashboard: 'Übersicht',
    calendar: 'Kalender',
    requests: 'Anträge',
    admin: 'Admin',
    users: 'Benutzer',
    freeDays: 'Freie Tage',
    settings: 'Einstellungen',
    signOut: 'Abmelden',
    signIn: 'Einloggen',
    register: 'Registrieren',
    createAccount: 'Konto erstellen',
    alreadyRegistered: 'Bestehendes Konto nutzen',
    name: 'Name',
    email: 'E-Mail',
    password: 'Passwort',
    confirmPassword: 'Passwort bestätigen',
    safePasswordHint: 'Mindestens 12 Zeichen mit Groß-/Kleinbuchstaben, Zahl, Symbol und ohne Name/E-Mail.',
    numericFieldsRequired: 'Bitte fülle alle Zahlenfelder mit gültigen Zahlen aus.',
    weeklyHoursRequired: 'Wochenstunden müssen größer als 0 sein.',
    invitationRequired: 'Registrierung benötigt eine Einladung durch einen Admin.',
    completeInviteTitle: 'Einladung abschließen',
    invitationIntro: 'Lege ein sicheres Passwort für die eingeladene E-Mail-Adresse fest.',
    invitedEmailLocked: 'Eingeladene E-Mail',
    inviteExpiresAt: 'Einladung gültig bis',
    createPassword: 'Passwort erstellen',
    changePasswordTitle: 'Passwort ändern',
    forcedPasswordChangeIntro: 'Lege ein neues sicheres Passwort fest, bevor du fortfährst.',
    currentPassword: 'Aktuelles Passwort',
    newPassword: 'Neues Passwort',
    saveNewPassword: 'Neues Passwort speichern',
    invalidInvite: 'Diese Einladung ist ungültig, abgelaufen oder bereits genutzt.',
    demoAdmin: 'Admin Demo',
    demoEmployee: 'Mitarbeiter Demo',
    offWork: 'Nicht eingestempelt',
    working: 'Arbeit läuft',
    onBreak: 'In Pause',
    startWork: 'Arbeit starten',
    startBreak: 'Pause starten',
    stopBreak: 'Pause beenden',
    stopWork: 'Arbeit beenden',
    confirmClockOutTitle: 'Arbeit beenden?',
    confirmClockOutBody: 'Dadurch wirst du ausgestempelt und der aktuelle Arbeitseintrag wird geschlossen.',
    clockRunning: 'Erfasste Arbeitszeit',
    breakTaken: 'Pause genommen',
    timeBalance: 'Zeitkonto',
    referenceDate: 'Bezugsdatum',
    expected: 'Soll',
    balance: 'Saldo',
    clockLog: 'Zeitprotokoll',
    when: 'Zeitpunkt',
    noClockEvents: 'Noch keine Zeitaktionen.',
    previousDay: 'Vorheriger Tag',
    nextDay: 'Nächster Tag',
    chooseLogDate: 'Protokolldatum wählen',
    day: 'Tag',
    week: 'Woche',
    month: 'Monat',
    year: 'Jahr',
    allTime: 'Gesamter Zeitraum',
    vacation: 'Urlaub',
    used: 'genutzt',
    notifications: 'Benachrichtigungen',
    noUnread: 'Keine ungelesenen Benachrichtigungen.',
    thisMonth: 'Dieser Monat',
    calendarAccess: 'Kalenderfreigabe',
    saveAccess: 'Freigabe speichern',
    groups: 'Gruppen',
    newGroup: 'Neue Gruppe',
    groupName: 'Gruppenname',
    groupMembers: 'Mitglieder',
    createGroup: 'Gruppe erstellen',
    editGroup: 'Gruppe bearbeiten',
    saveGroup: 'Gruppe speichern',
    deleteGroup: 'Gruppe löschen',
    confirmGroupChangeTitle: 'Gruppenänderungen speichern?',
    confirmGroupChangeBody: 'Änderungen an Gruppenmitgliedern beeinflussen, wer Kalender mit wem teilen kann.',
    confirmDeleteGroupTitle: 'Gruppe löschen?',
    confirmDeleteGroupBody: 'Mitglieder verlieren diese Gruppenverbindung für die Kalenderfreigabe.',
    noShareableCalendarUsers: 'Keine Gruppenmitglieder verfügbar.',
    newRequest: 'Neuer Antrag',
    allRequests: 'Alle Anträge',
    myRequests: 'Meine Anträge',
    noRequests: 'Noch keine Anträge.',
    type: 'Typ',
    overtimePayout: 'Überstunden auszahlen',
    overtimeTimeOff: 'Überstunden Ausgleich',
    timeCorrection: 'Zeitkorrektur',
    sickLeave: 'Krankmeldung',
    doctorNote: 'Ärztliche Bescheinigung',
    doctorNoteAttached: 'Ärztliche Bescheinigung angehängt',
    downloadDoctorNote: 'Bescheinigung öffnen',
    date: 'Datum',
    start: 'Start',
    end: 'Ende',
    breakMinutes: 'Pausenminuten',
    startDate: 'Startdatum',
    endDate: 'Enddatum',
    minutes: 'Minuten',
    reason: 'Begründung',
    submitRequest: 'Antrag senden',
    hours: 'Stunden',
    employeeSettings: 'Mitarbeiter-Einstellungen',
    inviteNewUser: 'Neuen Benutzer einladen',
    sendInvite: 'Benutzer erstellen und Einladung senden',
    inviteEmailSent: 'Einladungs-E-Mail gesendet',
    userRole: 'Rolle',
    startingTerms: 'Startbedingungen',
    initialBalances: 'Startsalden',
    pendingInvites: 'Offene Einladungen',
    noPendingInvites: 'Keine offenen Einladungen.',
    acceptedInvites: 'Angenommene Einladungen',
    confirmInviteTitle: 'Benutzer erstellen und Einladung senden?',
    confirmInviteBody: 'Dadurch wird der Benutzer erstellt, die E-Mail-Adresse verknüpft und eine Einladung zum Festlegen des Passworts gesendet.',
    cancelInvite: 'Einladung abbrechen',
    confirmCancelInviteTitle: 'Einladung abbrechen?',
    confirmCancelInviteBody: 'Dadurch wird die offene Einladung entfernt und die E-Mail-Adresse kann später erneut eingeladen werden.',
    selectEmployee: 'Benutzer auswählen',
    selectedEmployee: 'Ausgewählter Benutzer',
    noEmployeeSelected: 'Kein Benutzer ausgewählt.',
    employmentTerms: 'Arbeitsbedingungen',
    currentTerms: 'Verlauf der Bedingungen',
    appliesSince: 'Gültig seit',
    effectiveFrom: 'Gültig ab',
    currentSettings: 'Aktuelle Einstellungen',
    editTerms: 'Bedingungen bearbeiten',
    editAdjustments: 'Saldo bearbeiten',
    editResponsibleAdmin: 'Zuständigen Admin bearbeiten',
    permissions: 'Berechtigungen',
    editPermissions: 'Berechtigungen bearbeiten',
    currentRole: 'Aktuelle Rolle',
    confirmRoleTitle: 'Rollenänderung speichern?',
    confirmRoleBody: 'Das ändert, auf welche Admin-Funktionen dieser Benutzer zugreifen kann.',
    removeUser: 'Benutzer entfernen',
    removeUserDangerTitle: 'Benutzer entfernen',
    confirmRemoveUserTitle: 'Diesen Benutzer entfernen?',
    confirmRemoveUserBody: 'Das deaktiviert das Konto und entfernt Kalenderfreigaben und Gruppenmitgliedschaften. Historische Zeitdaten bleiben für Nachweise erhalten.',
    exportBeforeRemove: 'Alle Zeitdaten vor dem Entfernen exportieren',
    removeWithoutExport: 'Ohne Export entfernen',
    saveImportantChange: 'Wichtige Änderung speichern',
    confirmEmploymentTermTitle: 'Arbeitsbedingungen speichern?',
    confirmEmploymentTermBody: 'Das ändert Soll-Arbeitszeit oder Urlaubsanspruch ab dem gewählten Datum und beeinflusst die Berechnung für diesen Zeitraum.',
    confirmAdjustmentTitle: 'Saldo-Überschreibung speichern?',
    confirmAdjustmentBody: 'Das überschreibt den aktuellen Urlaub oder das +/- Stundenkonto für dieses Jahr. Nutze es nur für Importe oder Korrekturen.',
    confirmResponsibleAdminTitle: 'Zuständigen Admin speichern?',
    confirmResponsibleAdminBody: 'Künftige Antrags-E-Mails für diesen Mitarbeiter folgen dieser Zuordnung.',
    weeklyHours: 'Wochenstunden',
    vacationDays: 'Urlaubstage',
    currentVacationRemainingDays: 'Aktuell verbleibende Urlaubstage',
    currentBalanceHours: 'Aktuelles +/- Stundenkonto',
    responsibleAdmin: 'Zuständiger Admin',
    allAdminsFallback: 'Alle Admins',
    save: 'Speichern',
    holidayTemplates: 'Feiertagsvorlagen',
    holidayCountry: 'Land',
    holidayState: 'Bundesland / Staat',
    holidayRegion: 'Region',
    holidayTemplateLanguage: 'Feiertagssprache',
    saveHolidayTemplate: 'Feiertagsvorlage speichern',
    noHolidayState: 'Landesweit',
    noHolidayRegion: 'Keine Region',
    templatePublicHolidays: 'Feiertage aus Vorlage',
    manualHolidayHint: 'Manuelle Änderungen werden zusätzlich zur gewählten Vorlage angewendet.',
    holidayName: 'Name',
    holidayFreePercent: 'Freier Anteil (%)',
    action: 'Aktion',
    addHoliday: 'Feiertag hinzufügen',
    disableHoliday: 'Feiertag deaktivieren',
    editHoliday: 'Feiertag bearbeiten',
    manualHoliday: 'Manueller Feiertag',
    manualHolidayChanges: 'Manuelle Änderungen',
    noHolidayOverrides: 'Noch keine manuellen Änderungen.',
    cancelEdit: 'Bearbeitung abbrechen',
    removeHolidayChange: 'Änderung entfernen',
    apply: 'Anwenden',
    csvImport: 'CSV Import',
    csvExport: 'CSV Export',
    exportFor: 'Export für',
    exportPeriod: 'Zeitraum',
    exportCsv: 'CSV exportieren',
    employee: 'Mitarbeiter',
    fileName: 'Dateiname',
    csvContent: 'CSV Inhalt',
    importCsv: 'CSV importieren',
    recentImports: 'Letzte Importe',
    noImports: 'Noch keine Importe.',
    imported: 'importiert',
    skipped: 'übersprungen',
    backup: 'Backups',
    dataFile: 'Datenbankdatei',
    backupFolder: 'Backup-Ordner',
    lastBackup: 'Letztes Wochenbackup',
    createBackup: 'Wochenbackup erstellen',
    mailServer: 'Mailserver',
    noMailServer: 'Kein Mailserver konfiguriert. E-Mails nutzen den Umgebungs-Fallback oder werden nur protokolliert.',
    smtpHost: 'SMTP Host',
    smtpPort: 'SMTP Port',
    smtpSecure: 'TLS/SSL',
    smtpUser: 'SMTP Benutzer',
    smtpPassword: 'SMTP Passwort',
    smtpFrom: 'Absenderadresse',
    passwordSaved: 'Passwort gespeichert',
    passwordPlaceholder: 'Leer lassen, um das gespeicherte Passwort zu behalten',
    saveMailServer: 'Mailserver speichern',
    testMailServer: 'Test-E-Mail senden',
    deleteMailServer: 'Mailserver löschen',
    confirmDeleteMailServerTitle: 'Mailserver löschen?',
    confirmDeleteMailServerBody: 'Einladungen, Antragsbenachrichtigungen und Genehmigungs-E-Mails hängen von dieser Konfiguration ab. Lösche sie nur, wenn du sie ersetzt oder einen Umgebungs-Fallback nutzt.',
    license: 'Lizenz',
    licenseStatus: 'Lizenzstatus',
    activeUsers: 'Aktive Benutzer',
    activeUserLimit: 'Limit aktiver Benutzer',
    freeUserLimit: 'Kostenloses Benutzerlimit',
    licenseKey: 'Lizenzschlüssel',
    licenseKeyPlaceholder: 'Signierten Lizenzschlüssel einfügen',
    licenseKeyRequired: 'Bitte füge vor dem Speichern einen Lizenzschlüssel ein.',
    saveLicense: 'Lizenz speichern',
    deleteLicense: 'Lizenz löschen',
    noLicenseConfigured: 'Kein Lizenzschlüssel konfiguriert. Die Community-Nutzung ist bis 10 aktive Benutzer erlaubt.',
    paidLicense: 'Bezahlte Lizenz',
    freeGrantLicense: 'Kostenfreie Sonderlizenz',
    communityLicenseStatus: 'Community-Nutzung',
    licensedStatus: 'Lizenziert',
    overLimitStatus: 'Über dem Limit',
    invalidLicenseStatus: 'Ungültige Lizenz',
    expiredLicenseStatus: 'Abgelaufene Lizenz',
    missingPublicKeyStatus: 'Öffentlicher Serverschlüssel fehlt',
    holder: 'Lizenznehmer',
    contact: 'Kontakt',
    plan: 'Tarif',
    issuedAt: 'Ausgestellt am',
    validUntil: 'Gültig bis',
    licenseMessage: 'Meldung',
    confirmDeleteLicenseTitle: 'Lizenz löschen?',
    confirmDeleteLicenseBody: 'Ohne diese Lizenz fällt die App auf das kostenlose Limit von 10 aktiven Benutzern zurück. Behalte den Schlüssel, wenn die Firma darüber liegt.',
    saveSettings: 'Einstellungen speichern',
    confirm: 'Bestätigen',
    cancel: 'Abbrechen',
    noneYet: 'Noch keines',
    pending: 'offen',
    approved: 'genehmigt',
    rejected: 'abgelehnt',
    undone: 'zurückgenommen',
    approvedActions: 'Genehmigte Aktionen',
    noApprovedActions: 'Keine genehmigten Aktionen für diese Person.',
    undoApproval: 'Genehmigung rückgängig machen',
    confirmUndoApprovalTitle: 'Genehmigung rückgängig machen?',
    confirmUndoApprovalBody: 'Dadurch wird die angewendete Kalender- oder Zeiterfassungswirkung entfernt und der Antrag als zurückgenommen markiert.',
    approvedAt: 'Genehmigt am',
    approvedBy: 'Genehmigt von',
    calendarLegend: 'Legende',
    publicHolidayLegend: 'Feiertag',
    vacationLegend: 'Genehmigter Urlaub',
    sickLeaveLegend: 'Krankmeldung',
    timeOffLegend: 'Überstunden Ausgleich',
  },
}

type T = typeof translations.en

interface ApiError {
  message: string
}

interface ClockActivityEvent {
  id: string
  action: ClockAction
  at: string
}

interface InvitationPreview {
  name: string
  email: string
  role: Role
  expiresAt: string
}

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ')
}

function formatShownNumber(value: number) {
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })
}

function numberInputValue(value: number) {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : ''
}

function parseDecimalInput(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (normalized.length === 0) {
    return undefined
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function filenameFromContentDisposition(value: string | null) {
  if (!value) {
    return undefined
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1])
  }

  const plainMatch = value.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1]
}

function requestLabel(type: RequestType, t: T) {
  const labels: Record<RequestType, string> = {
    vacation: t.vacation,
    overtime_payout: t.overtimePayout,
    overtime_time_off: t.overtimeTimeOff,
    time_correction: t.timeCorrection,
    sick_leave: t.sickLeave,
  }
  return labels[type]
}

function absenceLabel(type: AbsenceType, t: T) {
  const labels: Record<AbsenceType, string> = {
    vacation: t.vacation,
    overtime_time_off: t.overtimeTimeOff,
    sick_leave: t.sickLeave,
  }
  return labels[type]
}

function licenseStatusLabel(state: LicenseState, t: T) {
  const labels: Record<LicenseState['status'], string> = {
    community: t.communityLicenseStatus,
    licensed: t.licensedStatus,
    over_limit: t.overLimitStatus,
    invalid: t.invalidLicenseStatus,
    expired: t.expiredLicenseStatus,
    missing_public_key: t.missingPublicKeyStatus,
  }
  return labels[state.status]
}

function licensePlanLabel(plan: LicensePlan | undefined, t: T) {
  if (plan === 'free_grant') {
    return t.freeGrantLicense
  }
  return t.paidLicense
}

function dateOnlyLabel(value: string | undefined) {
  return value ? value.slice(0, 10) : ''
}

function requestDateDetail(request: RequestItem) {
  if (request.startDate && request.endDate) {
    return request.startDate === request.endDate ? request.startDate : `${request.startDate} - ${request.endDate}`
  }
  if (request.correctionDate) {
    return request.correctionDate
  }
  if (request.minutes) {
    return `${formatDecimalHours(request.minutes)} h`
  }
  return ''
}

function displayUserName(user: User | undefined) {
  if (!user) {
    return ''
  }

  const trailingRole = user.role === 'employee' ? /\s+(Employee|Mitarbeiter)$/i : /\s+(Admin|Administrator)$/i
  const cleanedName = user.name.replace(trailingRole, '').trim()
  return cleanedName || user.name
}

function clockLabel(status: ClockStatus, t: T) {
  if (status === 'working') {
    return t.working
  }
  if (status === 'on_break') {
    return t.onBreak
  }
  return t.offWork
}

function holidayDisplayName(holiday: Holiday, language: Language) {
  void language
  return holiday.name
}

function holidayDisplayLabel(holiday: Holiday, language: Language) {
  const name = holidayDisplayName(holiday, language)
  return holiday.freePercent === 100 ? name : `${name} (${formatShownNumber(holiday.freePercent)}%)`
}

function durationBetweenMs(startedAt: string, stoppedAt: string | undefined, now: Date) {
  const start = new Date(startedAt).getTime()
  const stop = stoppedAt ? new Date(stoppedAt).getTime() : now.getTime()
  return Math.max(0, stop - start)
}

function entryElapsedMs(entry: TimeEntry | undefined, now: Date) {
  if (!entry) {
    return 0
  }

  return durationBetweenMs(entry.startedAt, entry.stoppedAt, now)
}

function entryBreakMs(entry: TimeEntry | undefined, now: Date) {
  if (!entry) {
    return 0
  }

  const trackedBreakMs = entry.breaks.reduce(
    (total, segment) => total + durationBetweenMs(segment.startedAt, segment.stoppedAt, now),
    0,
  )
  return trackedBreakMs + (entry.manualBreakMinutes ?? 0) * 60_000
}

function entryWorkedMs(entry: TimeEntry | undefined, now: Date) {
  if (!entry) {
    return 0
  }

  return Math.max(0, entryElapsedMs(entry, now) - entryBreakMs(entry, now))
}

function workedMsForEntries(entries: TimeEntry[], userId: string, startDate: string, endDate: string, now: Date) {
  return entries
    .filter((entry) => entry.userId === userId && entry.date >= startDate && entry.date <= endDate)
    .reduce((total, entry) => total + entryWorkedMs(entry, now), 0)
}

function freePercentToFraction(percent: number | undefined) {
  if (!Number.isFinite(percent)) {
    return 1
  }
  return Math.min(1, Math.max(0, Number(percent) / 100))
}

function expectedMsForRange(
  user: User,
  absences: StatePayload['absences'],
  holidays: Holiday[],
  startDate: string,
  endDate: string,
) {
  const holidayByDate = new Map(holidays.map((holiday) => [holiday.date, holiday]))
  const absenceDates = new Set(
    absences
      .filter((absence) => absence.userId === user.id && absence.date >= startDate && absence.date <= endDate)
      .map((absence) => absence.date),
  )

  return dateKeysBetween(startDate, endDate).reduce((total, date) => {
    if (isWeekend(date) || absenceDates.has(date)) {
      return total
    }

    const dailyMs = (termForDate(user, date).expectedWeeklyMinutes / 5) * 60_000
    const holiday = holidayByDate.get(date)
    const expectedFraction = holiday ? 1 - freePercentToFraction(holiday.freePercent) : 1
    return total + dailyMs * expectedFraction
  }, 0)
}

function vacationUsedDaysForYear(user: User, absences: StatePayload['absences'], holidays: Holiday[], year: number) {
  const holidayByDate = new Map(holidays.map((holiday) => [holiday.date, holiday]))
  return absences.reduce((total, absence) => {
    if (absence.userId !== user.id || absence.type !== 'vacation' || !absence.date.startsWith(`${year}-`) || isWeekend(absence.date)) {
      return total
    }

    const holiday = holidayByDate.get(absence.date)
    return total + (holiday ? 1 - freePercentToFraction(holiday.freePercent) : 1)
  }, 0)
}

function clockActivityEventsForEntries(entries: TimeEntry[], userId: string) {
  const events: ClockActivityEvent[] = []

  for (const entry of entries.filter((candidate) => candidate.userId === userId)) {
    events.push({ id: `${entry.id}-start`, action: 'start_work', at: entry.startedAt })

    for (const segment of entry.breaks) {
      events.push({ id: `${entry.id}-${segment.id}-start`, action: 'start_break', at: segment.startedAt })
      if (segment.stoppedAt) {
        events.push({ id: `${entry.id}-${segment.id}-stop`, action: 'stop_break', at: segment.stoppedAt })
      }
    }

    if (entry.stoppedAt) {
      events.push({ id: `${entry.id}-stop`, action: 'stop_work', at: entry.stoppedAt })
    }
  }

  return events.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
}

function clockActivityDateKey(event: ClockActivityEvent) {
  return toDateKey(new Date(event.at))
}

function clockActionLabel(action: ClockAction, t: T) {
  const labels: Record<ClockAction, string> = {
    start_work: t.startWork,
    start_break: t.startBreak,
    stop_break: t.stopBreak,
    stop_work: t.stopWork,
  }
  return labels[action]
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}`
}

function formatSignedDuration(milliseconds: number) {
  return `${milliseconds >= 0 ? '+' : '-'}${formatDuration(Math.abs(milliseconds))}`
}

function formatDateTime(value: string, language: Language) {
  return new Date(value).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

function useLiveNow(enabled: boolean) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!enabled) {
      setNow(new Date())
      return undefined
    }

    const update = () => setNow(new Date())
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [enabled])

  return now
}

function currentMonthTitle(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function firstCalendarDay(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  first.setDate(first.getDate() - offset)
  return first
}

function buildCalendarDays(month: Date) {
  const start = firstCalendarDay(month)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return toDateKey(date)
  })
}

function tabFromUrl(role: User['role']): Tab | undefined {
  const params = new URLSearchParams(window.location.search)
  const requestedTab = params.get('tab')

  if (params.has('request')) {
    return 'requests'
  }

  if (requestedTab === 'dashboard' || requestedTab === 'calendar' || requestedTab === 'requests') {
    return requestedTab
  }

  if (
    role === 'admin' &&
    (requestedTab === 'adminUsers' ||
      requestedTab === 'adminGroups' ||
      requestedTab === 'adminFreeDays' ||
      requestedTab === 'adminSettings')
  ) {
    return requestedTab
  }

  return undefined
}

function requestIdFromUrl() {
  return new URLSearchParams(window.location.search).get('request') ?? ''
}

function invitationTokenFromUrl() {
  const pathMatch = window.location.pathname.match(/^\/invite\/([^/]+)/)
  return pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : new URLSearchParams(window.location.search).get('invite') ?? ''
}

function useAuthToken() {
  const [token, setTokenState] = useState(() => localStorage.getItem('time-tracker-token') ?? '')

  const setToken = useCallback((nextToken: string) => {
    if (nextToken) {
      localStorage.setItem('time-tracker-token', nextToken)
    } else {
      localStorage.removeItem('time-tracker-token')
    }
    setTokenState(nextToken)
  }, [])

  return [token, setToken] as const
}

function useLanguage() {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('time-tracker-language')
    return saved === 'de' ? 'de' : 'en'
  })

  const setLanguage = useCallback((nextLanguage: Language) => {
    localStorage.setItem('time-tracker-language', nextLanguage)
    setLanguageState(nextLanguage)
  }, [])

  return [language, setLanguage] as const
}

function App() {
  const simpleMode = window.location.pathname.includes('simple') || window.location.search.includes('simple=1')
  const inviteToken = invitationTokenFromUrl()
  const [language, setLanguage] = useLanguage()
  const t = translations[language]
  const [token, setToken] = useAuthToken()
  const [state, setState] = useState<StatePayload | null>(null)
  const [invitationPreview, setInvitationPreview] = useState<InvitationPreview | null>(null)
  const [tab, setTab] = useState<Tab>(simpleMode ? 'dashboard' : 'dashboard')
  const [selectedRequestId, setSelectedRequestId] = useState(() => requestIdFromUrl())
  const [deepLinkApplied, setDeepLinkApplied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function api<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ message: 'Request failed' }))) as ApiError
      throw new Error(payload.message)
    }

    return (await response.json()) as T
  }

  useEffect(() => {
    if (!token) {
      return
    }

    let cancelled = false

    async function loadState() {
      try {
        const response = await fetch(`${apiBase}/api/state`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          throw new Error('Session expired')
        }
        const payload = (await response.json()) as StatePayload
        if (!cancelled) {
          setState(payload)
          setError('')
        }
      } catch (requestError) {
        if (!cancelled) {
          setToken('')
          setState(null)
          setError(requestError instanceof Error ? requestError.message : 'Session expired')
        }
      }
    }

    void loadState()

    return () => {
      cancelled = true
    }
  }, [token, setToken])

  useEffect(() => {
    if (!inviteToken) {
      return
    }

    let cancelled = false

    async function loadInvitation() {
      setLoading(true)
      try {
        const response = await fetch(`${apiBase}/api/invitations/${encodeURIComponent(inviteToken)}`)
        if (!response.ok) {
          const body = (await response.json().catch(() => ({ message: t.invalidInvite }))) as ApiError
          throw new Error(body.message)
        }
        const preview = (await response.json()) as InvitationPreview
        if (!cancelled) {
          setInvitationPreview(preview)
          setError('')
        }
      } catch (requestError) {
        if (!cancelled) {
          setInvitationPreview(null)
          setError(requestError instanceof Error ? requestError.message : t.invalidInvite)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInvitation()

    return () => {
      cancelled = true
    }
  }, [inviteToken, t.invalidInvite])

  useEffect(() => {
    if (simpleMode || !state || deepLinkApplied) {
      return
    }

    const linkedTab = tabFromUrl(state.currentUser.role)
    if (linkedTab) {
      setTab(linkedTab)
    }
    setSelectedRequestId(requestIdFromUrl())
    setDeepLinkApplied(true)
  }, [deepLinkApplied, simpleMode, state])

  async function login(email: string, password: string) {
    setLoading(true)
    try {
      const payload = await fetch(`${apiBase}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!payload.ok) {
        const body = (await payload.json().catch(() => ({ message: 'Login failed' }))) as ApiError
        throw new Error(body.message)
      }

      const body = (await payload.json()) as { token: string }
      setToken(body.token)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function acceptInvitation(password: string, passwordConfirm: string) {
    setLoading(true)
    try {
      const payload = await fetch(`${apiBase}/api/invitations/${encodeURIComponent(inviteToken)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, passwordConfirm }),
      })
      if (!payload.ok) {
        const body = (await payload.json().catch(() => ({ message: 'Invitation failed' }))) as ApiError
        throw new Error(body.message)
      }

      const body = (await payload.json()) as { token: string }
      window.history.replaceState({}, '', '/')
      setToken(body.token)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Invitation failed')
    } finally {
      setLoading(false)
    }
  }

  async function changePassword(currentPassword: string, password: string, passwordConfirm: string) {
    setLoading(true)
    try {
      const payload = await api<StatePayload>('/api/account/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, password, passwordConfirm }),
      })
      setState(payload)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Password change failed')
    } finally {
      setLoading(false)
    }
  }

  async function updateState(path: string, options: RequestInit) {
    setLoading(true)
    try {
      const payload = await api<StatePayload>(path, options)
      setState(payload)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  async function downloadTimeCsv(userId: string, period: TimeExportPeriod, date: string) {
    setLoading(true)
    try {
      const query = new URLSearchParams({
        userId,
        period,
        date,
        language,
      })
      const response = await fetch(`${apiBase}/api/exports/time-csv?${query.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ message: 'CSV export failed' }))) as ApiError
        throw new Error(payload.message)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filenameFromContentDisposition(response.headers.get('Content-Disposition')) ?? `nrw-time-export-${period}.csv`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(url), 500)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'CSV export failed')
    } finally {
      setLoading(false)
    }
  }

  async function loadHolidayTemplateOptions(settings: Partial<HolidaySettings>) {
    const query = new URLSearchParams()
    if (settings.country) {
      query.set('country', settings.country)
    }
    if (settings.state) {
      query.set('state', settings.state)
    }
    if (settings.region) {
      query.set('region', settings.region)
    }
    if (settings.language) {
      query.set('language', settings.language)
    }

    return api<HolidayTemplateOptions>(`/api/holidays/template-options?${query.toString()}`)
  }

  if (inviteToken) {
    return (
      <InvitationScreen
        error={error}
        invitation={invitationPreview}
        language={language}
        loading={loading}
        t={t}
        onAccept={acceptInvitation}
        onLanguageChange={setLanguage}
      />
    )
  }

  if (!token || !state) {
    return (
      <LoginScreen
        error={error}
        language={language}
        loading={loading}
        t={t}
        onLanguageChange={setLanguage}
        onLogin={login}
      />
    )
  }

  if (state.currentUser.mustChangePassword) {
    return (
      <PasswordChangeScreen
        error={error}
        language={language}
        loading={loading}
        t={t}
        user={state.currentUser}
        onChange={changePassword}
        onLanguageChange={setLanguage}
        onLogout={() => {
          setToken('')
          setState(null)
        }}
      />
    )
  }

  const currentSummary = state.summaries.find((summary) => summary.userId === state.currentUser.id)

  return (
    <main className={classNames('app-shell', simpleMode && 'simple-shell')}>
      <header className="topbar">
        <div className="brand-mark">
          <Timer size={20} />
        </div>
        <div className="brand-copy">
          <h1>{t.appName}</h1>
          <p>{displayUserName(state.currentUser)}</p>
        </div>
        {!simpleMode && (
          <nav className="tabs" aria-label="Primary">
            <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')} type="button">
              <Timer size={18} />
              {t.dashboard}
            </button>
            <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')} type="button">
              <CalendarDays size={18} />
              {t.calendar}
            </button>
            <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')} type="button">
              <BriefcaseBusiness size={18} />
              {t.requests}
            </button>
            {state.currentUser.role === 'admin' && (
              <>
                <button className={tab === 'adminUsers' ? 'active' : ''} onClick={() => setTab('adminUsers')} type="button">
                  <ShieldCheck size={18} />
                  {t.users}
                </button>
                <button className={tab === 'adminGroups' ? 'active' : ''} onClick={() => setTab('adminGroups')} type="button">
                  <Users size={18} />
                  {t.groups}
                </button>
                <button className={tab === 'adminFreeDays' ? 'active' : ''} onClick={() => setTab('adminFreeDays')} type="button">
                  <CalendarDays size={18} />
                  {t.freeDays}
                </button>
                <button className={tab === 'adminSettings' ? 'active' : ''} onClick={() => setTab('adminSettings')} type="button">
                  <Settings size={18} />
                  {t.settings}
                </button>
              </>
            )}
          </nav>
        )}
        <button
          className="icon-button"
          title={language === 'en' ? 'Deutsch' : 'English'}
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'de' : 'en')}
        >
          <Languages size={18} />
        </button>
        <button
          className="icon-button"
          title={t.signOut}
          type="button"
          onClick={() => {
            setToken('')
            setState(null)
          }}
        >
          <LogOut size={18} />
        </button>
      </header>

      {error && <div className="status-banner">{error}</div>}

      <section className="content-band">
        {(tab === 'dashboard' || simpleMode) && currentSummary && (
          <DashboardView
            language={language}
            loading={loading}
            simpleMode={simpleMode}
            state={state}
            t={t}
            onClock={(action) =>
              updateState('/api/clock', {
                method: 'POST',
                body: JSON.stringify({ action }),
              })
            }
            onReadNotification={(id) =>
              updateState(`/api/notifications/${id}/read`, {
                method: 'PATCH',
                body: JSON.stringify({ read: true }),
              })
            }
            onExportCsv={downloadTimeCsv}
          />
        )}

        {tab === 'calendar' && !simpleMode && (
          <CalendarView
            state={state}
            loading={loading}
            language={language}
            t={t}
            onUpdateAccess={(ids) =>
              updateState(`/api/users/${state.currentUser.id}/calendar-access`, {
                method: 'PATCH',
                body: JSON.stringify({ calendarAccessUserIds: ids }),
              })
            }
          />
        )}

        {tab === 'requests' && !simpleMode && (
          <RequestsView
            state={state}
            loading={loading}
            selectedRequestId={selectedRequestId}
            t={t}
            onCreate={(body) =>
              updateState('/api/requests', {
                method: 'POST',
                body: JSON.stringify(body),
              })
            }
            onDecision={(requestId, decision) =>
              updateState(`/api/requests/${requestId}/decision`, {
                method: 'POST',
                body: JSON.stringify({ decision }),
              })
            }
          />
        )}

        {tab === 'adminUsers' && !simpleMode && state.currentUser.role === 'admin' && (
          <AdminUsersView
            state={state}
            loading={loading}
            t={t}
            onUpdateUser={(userId, body) =>
              updateState(`/api/users/${userId}/settings`, {
                method: 'PATCH',
                body: JSON.stringify(body),
              })
            }
            onRemoveUser={(userId) =>
              updateState(`/api/users/${userId}`, {
                method: 'DELETE',
              })
            }
            onInviteUser={(body) =>
              updateState('/api/admin/invitations', {
                method: 'POST',
                body: JSON.stringify(body),
              })
            }
            onCancelInvite={(invitationId) =>
              updateState(`/api/admin/invitations/${invitationId}`, {
                method: 'DELETE',
              })
            }
            onImportCsv={(body) =>
              updateState('/api/imports/time-csv', {
                method: 'POST',
                body: JSON.stringify(body),
              })
            }
            onUndoApproval={(requestId) =>
              updateState(`/api/requests/${requestId}/undo`, {
                method: 'POST',
              })
            }
            onExportCsv={downloadTimeCsv}
          />
        )}

        {tab === 'adminGroups' && !simpleMode && state.currentUser.role === 'admin' && (
          <GroupAdminPanel
            state={state}
            loading={loading}
            t={t}
            onCreateGroup={(body) =>
              updateState('/api/calendar-groups', {
                method: 'POST',
                body: JSON.stringify(body),
              })
            }
            onUpdateGroup={(id, body) =>
              updateState(`/api/calendar-groups/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
              })
            }
            onDeleteGroup={(id) =>
              updateState(`/api/calendar-groups/${id}`, {
                method: 'DELETE',
              })
            }
          />
        )}

        {tab === 'adminFreeDays' && !simpleMode && state.currentUser.role === 'admin' && (
          <HolidayAdmin
            state={state}
            loading={loading}
            language={language}
            t={t}
            onLoadHolidayTemplateOptions={loadHolidayTemplateOptions}
            onUpdateHolidaySettings={(body) =>
              updateState('/api/holidays/settings', {
                method: 'PATCH',
                body: JSON.stringify(body),
              })
            }
            onHolidayOverride={(body) =>
              updateState('/api/holidays/overrides', {
                method: 'POST',
                body: JSON.stringify(body),
              })
            }
            onUpdateOverride={(id, body) =>
              updateState(`/api/holidays/overrides/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
              })
            }
            onDeleteOverride={(id) =>
              updateState(`/api/holidays/overrides/${id}`, {
                method: 'DELETE',
              })
            }
          />
        )}

        {tab === 'adminSettings' && !simpleMode && state.currentUser.role === 'admin' && (
          <SettingsView
            state={state}
            loading={loading}
            t={t}
            onCreateBackup={() =>
              updateState('/api/backups/weekly', {
                method: 'POST',
              })
            }
            onUpdateMailServer={(body) =>
              updateState('/api/settings/mail-server', {
                method: 'PATCH',
                body: JSON.stringify(body),
              })
            }
            onTestMailServer={() =>
              updateState('/api/settings/mail-server/test', {
                method: 'POST',
              })
            }
            onDeleteMailServer={() =>
              updateState('/api/settings/mail-server', {
                method: 'DELETE',
              })
            }
            onUpdateLicense={(body) =>
              updateState('/api/settings/license', {
                method: 'PATCH',
                body: JSON.stringify(body),
              })
            }
            onDeleteLicense={() =>
              updateState('/api/settings/license', {
                method: 'DELETE',
              })
            }
          />
        )}
      </section>
    </main>
  )
}

function LoginScreen({
  error,
  language,
  loading,
  t,
  onLanguageChange,
  onLogin,
}: {
  error: string
  language: Language
  loading: boolean
  t: T
  onLanguageChange: (language: Language) => void
  onLogin: (email: string, password: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    void onLogin(email, password)
  }

  return (
    <main className="login-layout">
      <section className="login-panel">
        <button
          className="icon-button language-login"
          title={language === 'en' ? 'Deutsch' : 'English'}
          type="button"
          onClick={() => onLanguageChange(language === 'en' ? 'de' : 'en')}
        >
          <Languages size={18} />
        </button>
        <div className="brand-mark">
          <Timer size={24} />
        </div>
        <h1>{t.appName}</h1>
        <form onSubmit={submit}>
          <label>
            {t.email}
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            {t.password}
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          <p className="password-hint">{t.invitationRequired}</p>
          {error && <p className="form-error">{error}</p>}
          <button disabled={loading} className="primary-button" type="submit">
            <LogIn size={18} />
            {t.signIn}
          </button>
        </form>
      </section>
    </main>
  )
}

function InvitationScreen({
  error,
  invitation,
  language,
  loading,
  t,
  onAccept,
  onLanguageChange,
}: {
  error: string
  invitation: InvitationPreview | null
  language: Language
  loading: boolean
  t: T
  onAccept: (password: string, passwordConfirm: string) => Promise<void>
  onLanguageChange: (language: Language) => void
}) {
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    void onAccept(password, passwordConfirm)
  }

  return (
    <main className="login-layout">
      <section className="login-panel">
        <button
          className="icon-button language-login"
          title={language === 'en' ? 'Deutsch' : 'English'}
          type="button"
          onClick={() => onLanguageChange(language === 'en' ? 'de' : 'en')}
        >
          <Languages size={18} />
        </button>
        <div className="brand-mark">
          <UserPlus size={24} />
        </div>
        <h1>{t.completeInviteTitle}</h1>
        <p className="password-hint">{t.invitationIntro}</p>
        {invitation ? (
          <form onSubmit={submit}>
            <div className="invite-preview">
              <span>{t.name}</span>
              <strong>{invitation.name}</strong>
              <span>{t.invitedEmailLocked}</span>
              <strong>{invitation.email}</strong>
              <span>{t.userRole}</span>
              <strong>{invitation.role === 'admin' ? t.admin : t.employee}</strong>
              <span>{t.inviteExpiresAt}</span>
              <strong>{new Date(invitation.expiresAt).toLocaleString()}</strong>
            </div>
            <label>
              {t.password}
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
            </label>
            <label>
              {t.confirmPassword}
              <input value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} type="password" />
            </label>
            <p className="password-hint">{t.safePasswordHint}</p>
            {error && <p className="form-error">{error}</p>}
            <button disabled={loading} className="primary-button" type="submit">
              <UserPlus size={18} />
              {t.createPassword}
            </button>
          </form>
        ) : (
          <p className={error ? 'form-error' : 'password-hint'}>{loading ? t.pending : error || t.invalidInvite}</p>
        )}
      </section>
    </main>
  )
}

function PasswordChangeScreen({
  error,
  language,
  loading,
  t,
  user,
  onChange,
  onLanguageChange,
  onLogout,
}: {
  error: string
  language: Language
  loading: boolean
  t: T
  user: User
  onChange: (currentPassword: string, password: string, passwordConfirm: string) => Promise<void>
  onLanguageChange: (language: Language) => void
  onLogout: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    void onChange(currentPassword, password, passwordConfirm)
  }

  return (
    <main className="login-layout">
      <section className="login-panel">
        <button
          className="icon-button language-login"
          title={language === 'en' ? 'Deutsch' : 'English'}
          type="button"
          onClick={() => onLanguageChange(language === 'en' ? 'de' : 'en')}
        >
          <Languages size={18} />
        </button>
        <div className="brand-mark">
          <ShieldCheck size={24} />
        </div>
        <h1>{t.changePasswordTitle}</h1>
        <p className="password-hint">{t.forcedPasswordChangeIntro}</p>
        <form onSubmit={submit}>
          <div className="invite-preview">
            <span>{t.name}</span>
            <strong>{displayUserName(user)}</strong>
            <span>{t.email}</span>
            <strong>{user.email}</strong>
          </div>
          <label>
            {t.currentPassword}
            <input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" />
          </label>
          <label>
            {t.newPassword}
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          <label>
            {t.confirmPassword}
            <input value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} type="password" />
          </label>
          <p className="password-hint">{t.safePasswordHint}</p>
          {error && <p className="form-error">{error}</p>}
          <div className="auth-actions">
            <button disabled={loading} className="primary-button" type="submit">
              <ShieldCheck size={18} />
              {t.saveNewPassword}
            </button>
            <button disabled={loading} className="secondary-button" type="button" onClick={onLogout}>
              <LogOut size={18} />
              {t.signOut}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

function DashboardView({
  language,
  state,
  simpleMode,
  loading,
  t,
  onClock,
  onReadNotification,
  onExportCsv,
}: {
  language: Language
  state: StatePayload
  simpleMode: boolean
  loading: boolean
  t: T
  onClock: (action: ClockAction) => void
  onReadNotification: (id: string) => void
  onExportCsv: (userId: string, period: TimeExportPeriod, date: string) => void | Promise<void>
}) {
  const unread = state.notifications.filter((notification) => !notification.read)

  return (
    <div className={classNames('dashboard-grid', simpleMode && 'dashboard-grid-simple')}>
      <ClockPanel
        status={state.clockStatus}
        timeEntries={state.timeEntries}
        currentUserId={state.currentUser.id}
        loading={loading}
        t={t}
        onClock={onClock}
      />
      <SummaryPanel state={state} user={state.currentUser} timeEntries={state.timeEntries} t={t} />
      <TimeExportPanel
        users={[state.currentUser]}
        selectedUserId={state.currentUser.id}
        loading={loading}
        t={t}
        onExportCsv={onExportCsv}
      />
      <ClockActivityLog entries={state.timeEntries} userId={state.currentUser.id} language={language} t={t} />
      {!simpleMode && (
        <section className="panel notifications-panel">
          <div className="panel-title">
            <Bell size={18} />
            <h2>{t.notifications}</h2>
          </div>
          <div className="notification-list">
            {unread.length === 0 && <p className="muted">{t.noUnread}</p>}
            {unread.slice(0, 5).map((notification) => (
              <article key={notification.id} className="notification-row">
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                </div>
                <button title="Mark read" className="icon-button" type="button" onClick={() => onReadNotification(notification.id)}>
                  <Check size={16} />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ClockPanel({
  status,
  timeEntries,
  currentUserId,
  loading,
  t,
  onClock,
}: {
  status: ClockStatus
  timeEntries: TimeEntry[]
  currentUserId: string
  loading: boolean
  t: T
  onClock: (action: ClockAction) => void
}) {
  const liveNow = useLiveNow(status !== 'off_work')
  const today = toDateKey(liveNow)
  const todaysEntries = timeEntries.filter((entry) => entry.userId === currentUserId && entry.date === today)
  const breakMs = todaysEntries.reduce((total, entry) => total + entryBreakMs(entry, liveNow), 0)
  const workedMs = todaysEntries.reduce((total, entry) => total + entryWorkedMs(entry, liveNow), 0)
  const [confirmStopWork, setConfirmStopWork] = useState(false)

  return (
    <section className="panel clock-panel">
      <div className="clock-status">
        <span className={classNames('status-dot', status)}></span>
        {clockLabel(status, t)}
      </div>
      <div className="clock-face">
        <ClockFaceIcon running={status === 'working'} />
        <span>{liveNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="clock-live-stats">
        <div>
          <span>{t.clockRunning}</span>
          <strong>{formatDuration(workedMs)}</strong>
        </div>
        <div>
          <span>{t.breakTaken}</span>
          <strong>{formatDuration(breakMs)}</strong>
        </div>
      </div>
      <div className="clock-actions">
        {status === 'off_work' && (
          <button disabled={loading} className="primary-button" onClick={() => onClock('start_work')} type="button">
            <BriefcaseBusiness size={20} />
            {t.startWork}
          </button>
        )}
        {status === 'working' && (
          <>
            <button disabled={loading} className="primary-button" onClick={() => onClock('start_break')} type="button">
              <Coffee size={20} />
              {t.startBreak}
            </button>
            <button disabled={loading} className="secondary-button" onClick={() => setConfirmStopWork(true)} type="button">
              <Timer size={20} />
              {t.stopWork}
            </button>
          </>
        )}
        {status === 'on_break' && (
          <button disabled={loading} className="primary-button" onClick={() => onClock('stop_break')} type="button">
            <Check size={20} />
            {t.stopBreak}
          </button>
        )}
      </div>
      {confirmStopWork && (
        <ConfirmDialog
          title={t.confirmClockOutTitle}
          body={t.confirmClockOutBody}
          confirmLabel={t.stopWork}
          cancelLabel={t.cancel}
          loading={loading}
          onCancel={() => setConfirmStopWork(false)}
          onConfirm={() => {
            setConfirmStopWork(false)
            onClock('stop_work')
          }}
        />
      )}
    </section>
  )
}

function ClockFaceIcon({ running }: { running: boolean }) {
  return (
    <svg className="clock-icon" width="42" height="42" viewBox="0 0 42 42" aria-hidden="true" focusable="false">
      <circle className="clock-icon-rim" cx="21" cy="21" r="16" />
      <line className="clock-icon-hour-hand" x1="21" y1="21" x2="21" y2="14" />
      <line className={classNames('clock-icon-pointer', running && 'clock-icon-pointer-running')} x1="21" y1="21" x2="21" y2="9" />
      <circle className="clock-icon-center" cx="21" cy="21" r="2" />
    </svg>
  )
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{body}</p>
        <div className="modal-actions">
          <button disabled={loading} className="secondary-button" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button disabled={loading} className="primary-button" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryPanel({ state, user, timeEntries, t }: { state: StatePayload; user: User; timeEntries: TimeEntry[]; t: T }) {
  const [referenceDate, setReferenceDate] = useState(() => toDateKey(new Date()))
  const hasOpenEntry = timeEntries.some((entry) => entry.userId === user.id && !entry.stoppedAt)
  const liveNow = useLiveNow(hasOpenEntry)
  const reference = parseDateKey(referenceDate)
  const [weekStart, weekEnd] = clampDateRange(startOfWeek(reference), endOfWeek(reference))
  const [monthStart, monthEnd] = clampDateRange(startOfMonth(reference), endOfMonth(reference))
  const [yearStart, yearEnd] = clampDateRange(startOfYear(reference), endOfYear(reference))
  const weekWorkedMs = workedMsForEntries(timeEntries, user.id, weekStart, weekEnd, liveNow)
  const monthWorkedMs = workedMsForEntries(timeEntries, user.id, monthStart, monthEnd, liveNow)
  const yearWorkedMs = workedMsForEntries(timeEntries, user.id, yearStart, yearEnd, liveNow)
  const weekExpectedMs = expectedMsForRange(user, state.absences, state.holidays, weekStart, weekEnd)
  const monthExpectedMs = expectedMsForRange(user, state.absences, state.holidays, monthStart, monthEnd)
  const yearExpectedMs = expectedMsForRange(user, state.absences, state.holidays, yearStart, yearEnd)
  const usedVacationDays = vacationUsedDaysForYear(user, state.absences, state.holidays, reference.getFullYear())
  const yearlyVacationDays = termForDate(user, referenceDate).yearlyVacationDays
  const remainingVacationDays = yearlyVacationDays + user.vacationAdjustmentDays - usedVacationDays
  const balanceAdjustmentMs = user.balanceAdjustmentMinutes * 60_000

  return (
    <section className="panel summary-panel">
      <div className="panel-title summary-title">
        <div className="summary-heading">
          <Timer size={18} />
          <h2>{t.timeBalance}</h2>
        </div>
        <label className="summary-reference">
          {t.referenceDate}
          <input value={referenceDate} type="date" onChange={(event) => setReferenceDate(event.target.value || toDateKey(new Date()))} />
        </label>
      </div>
      <div className="summary-cards">
        <Metric
          label={t.week}
          value={formatDuration(weekWorkedMs)}
          detail={`${t.expected}: ${formatDuration(weekExpectedMs)} · ${t.balance}: ${formatSignedDuration(weekWorkedMs - weekExpectedMs)}`}
        />
        <Metric
          label={t.month}
          value={formatDuration(monthWorkedMs)}
          detail={`${t.expected}: ${formatDuration(monthExpectedMs)} · ${t.balance}: ${formatSignedDuration(monthWorkedMs - monthExpectedMs)}`}
        />
        <Metric
          label={t.year}
          value={formatDuration(yearWorkedMs)}
          detail={`${t.expected}: ${formatDuration(yearExpectedMs)} · ${t.balance}: ${formatSignedDuration(yearWorkedMs - yearExpectedMs + balanceAdjustmentMs)}`}
        />
        <Metric
          label={t.vacation}
          value={formatShownNumber(remainingVacationDays)}
          detail={`${formatShownNumber(usedVacationDays)}/${formatShownNumber(yearlyVacationDays)} ${t.used}`}
        />
      </div>
    </section>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function TimeExportPanel({
  users,
  selectedUserId,
  loading,
  t,
  onExportCsv,
}: {
  users: User[]
  selectedUserId: string
  loading: boolean
  t: T
  onExportCsv: (userId: string, period: TimeExportPeriod, date: string) => void | Promise<void>
}) {
  const [userId, setUserId] = useState(selectedUserId)
  const [period, setPeriod] = useState<TimeExportPeriod>('month')
  const [date, setDate] = useState(() => toDateKey(new Date()))
  const selectedUser = users.find((user) => user.id === userId) ?? users[0]
  const canChooseUser = users.length > 1

  useEffect(() => {
    if (selectedUserId && users.some((user) => user.id === selectedUserId)) {
      setUserId(selectedUserId)
    }
  }, [selectedUserId, users])

  return (
    <section className="panel time-export-panel">
      <div className="panel-title">
        <Download size={18} />
        <h2>{t.csvExport}</h2>
      </div>
      <form
        className="time-export-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (selectedUser) {
            onExportCsv(selectedUser.id, period, date)
          }
        }}
      >
        {canChooseUser && (
          <label>
            {t.exportFor}
            <select value={selectedUser?.id ?? ''} onChange={(event) => setUserId(event.target.value)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {displayUserName(user)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t.exportPeriod}
          <select value={period} onChange={(event) => setPeriod(event.target.value as TimeExportPeriod)}>
            <option value="day">{t.day}</option>
            <option value="week">{t.week}</option>
            <option value="month">{t.month}</option>
            <option value="year">{t.year}</option>
            <option value="all">{t.allTime}</option>
          </select>
        </label>
        {period !== 'all' && (
          <label>
            {t.referenceDate}
            <input value={date} type="date" onChange={(event) => event.target.value && setDate(event.target.value)} />
          </label>
        )}
        <button disabled={loading || !selectedUser} className="primary-button" type="submit">
          <Download size={16} />
          {t.exportCsv}
        </button>
      </form>
    </section>
  )
}

function ClockActivityLog({
  entries,
  userId,
  language,
  t,
}: {
  entries: TimeEntry[]
  userId: string
  language: Language
  t: T
}) {
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const events = useMemo(
    () => clockActivityEventsForEntries(entries, userId).filter((event) => clockActivityDateKey(event) === selectedDate),
    [entries, selectedDate, userId],
  )

  return (
    <section className="panel clock-log-panel">
      <div className="panel-title clock-log-title">
        <div className="clock-log-heading">
          <Timer size={18} />
          <h2>{t.clockLog}</h2>
        </div>
        <div className="clock-log-controls">
          <button
            className="icon-button"
            title={t.previousDay}
            type="button"
            onClick={() => setSelectedDate((date) => addDays(date, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <input
            aria-label={t.chooseLogDate}
            title={t.chooseLogDate}
            value={selectedDate}
            type="date"
            onChange={(event) => {
              if (event.target.value) {
                setSelectedDate(event.target.value)
              }
            }}
          />
          <button
            className="icon-button"
            title={t.nextDay}
            type="button"
            onClick={() => setSelectedDate((date) => addDays(date, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="muted clock-log-empty">{t.noClockEvents}</p>
      ) : (
        <div className="clock-log-table-wrap">
          <table className="clock-log-table">
            <thead>
              <tr>
                <th>{t.when}</th>
                <th>{t.action}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <time dateTime={event.at}>{formatDateTime(event.at, language)}</time>
                  </td>
                  <td>
                    <span className={classNames('action-chip', event.action)}>{clockActionLabel(event.action, t)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function CalendarView({
  state,
  loading,
  language,
  t,
  onUpdateAccess,
}: {
  state: StatePayload
  loading: boolean
  language: Language
  t: T
  onUpdateAccess: (ids: string[]) => void
}) {
  const [month, setMonth] = useState(() => new Date())
  const [selectedUsers, setSelectedUsers] = useState<string[]>(() => state.visibleCalendarUsers.map((user) => user.id))
  const [sharingIds, setSharingIds] = useState<string[]>(state.currentUser.calendarAccessUserIds)
  const shareableIds = useMemo(() => new Set(state.shareableCalendarUsers.map((user) => user.id)), [state.shareableCalendarUsers])
  const days = buildCalendarDays(month)
  const holidayByDate = new Map(state.holidays.map((holiday) => [holiday.date, holiday]))
  const userById = new Map(state.users.map((user) => [user.id, user]))

  useEffect(() => {
    setSelectedUsers((current) => {
      const visibleIds = new Set(state.visibleCalendarUsers.map((user) => user.id))
      const next = current.filter((id) => visibleIds.has(id))
      return next.length > 0 ? next : state.visibleCalendarUsers.map((user) => user.id)
    })
  }, [state.visibleCalendarUsers])

  useEffect(() => {
    setSharingIds(state.currentUser.calendarAccessUserIds.filter((id) => shareableIds.has(id)))
  }, [shareableIds, state.currentUser.calendarAccessUserIds])

  function moveMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  function toggleSelected(id: string) {
    setSelectedUsers((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function toggleSharing(id: string) {
    setSharingIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <div className="calendar-layout">
      <section className="panel calendar-panel">
        <div className="calendar-header">
          <button className="icon-button" title="Previous month" type="button" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={18} />
          </button>
          <h2>{currentMonthTitle(month)}</h2>
          <button className="icon-button" title="Next month" type="button" onClick={() => moveMonth(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="user-filter">
          {state.visibleCalendarUsers.map((user) => (
            <button
              key={user.id}
              className={selectedUsers.includes(user.id) ? 'active' : ''}
              type="button"
              onClick={() => toggleSelected(user.id)}
            >
              <Users size={16} />
              {displayUserName(user)}
            </button>
          ))}
        </div>
        <div className="calendar-legend" aria-label={t.calendarLegend}>
          <span className="legend-item">
            <i className="legend-swatch holiday"></i>
            {t.publicHolidayLegend}
          </span>
          <span className="legend-item">
            <i className="legend-swatch vacation"></i>
            {t.vacationLegend}
          </span>
          <span className="legend-item">
            <i className="legend-swatch sick_leave"></i>
            {t.sickLeaveLegend}
          </span>
          <span className="legend-item">
            <i className="legend-swatch overtime_time_off"></i>
            {t.timeOffLegend}
          </span>
        </div>
        <div className="calendar-grid">
          {(language === 'de'
            ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          ).map((day) => (
            <span className="weekday" key={day}>
              {day}
            </span>
          ))}
          {days.map((date) => {
            const dayAbsences = state.absences.filter(
              (absence) => absence.date === date && selectedUsers.includes(absence.userId),
            )
            const holiday = holidayByDate.get(date)
            const inMonth = parseDateKey(date).getMonth() === month.getMonth()
            return (
              <div key={date} className={classNames('calendar-day', !inMonth && 'muted-day', isWeekend(date) && 'weekend')}>
                <span>{Number(date.slice(8, 10))}</span>
                {holiday && <small className="holiday-pill">{holidayDisplayLabel(holiday, language)}</small>}
                {dayAbsences.map((absence) => (
                  <small key={absence.id} className={classNames('absence-pill', absence.type)}>
                    {displayUserName(userById.get(absence.userId))}: {absenceLabel(absence.type, t)}
                  </small>
                ))}
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel sharing-panel">
        <div className="panel-title">
          <Users size={18} />
          <h2>{t.calendarAccess}</h2>
        </div>
        <div className="access-list">
          {state.shareableCalendarUsers.length === 0 && <p className="muted">{t.noShareableCalendarUsers}</p>}
          {state.shareableCalendarUsers.map((user) => (
            <label key={user.id} className="check-row">
              <input checked={sharingIds.includes(user.id)} type="checkbox" onChange={() => toggleSharing(user.id)} />
              <span>
                {displayUserName(user)}
                <small>{user.email}</small>
              </span>
            </label>
          ))}
        </div>
        <button disabled={loading} className="primary-button" type="button" onClick={() => onUpdateAccess(sharingIds)}>
          <Check size={18} />
          {t.saveAccess}
        </button>
      </section>
    </div>
  )
}

function RequestsView({
  state,
  loading,
  selectedRequestId,
  t,
  onCreate,
  onDecision,
}: {
  state: StatePayload
  loading: boolean
  selectedRequestId: string
  t: T
  onCreate: (body: Record<string, unknown>) => void
  onDecision: (requestId: string, decision: 'approved' | 'rejected') => void
}) {
  return (
    <div className="requests-layout">
      <RequestForm loading={loading} t={t} onCreate={onCreate} />
      <section className="panel requests-list-panel">
        <div className="panel-title">
          <BriefcaseBusiness size={18} />
          <h2>{state.currentUser.role === 'admin' ? t.allRequests : t.myRequests}</h2>
        </div>
        <div className="request-list">
          {state.requests.length === 0 && <p className="muted">{t.noRequests}</p>}
          {state.requests.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              users={state.users}
              isAdmin={state.currentUser.role === 'admin'}
              highlighted={request.id === selectedRequestId}
              loading={loading}
              t={t}
              onDecision={onDecision}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function RequestForm({
  loading,
  t,
  onCreate,
}: {
  loading: boolean
  t: T
  onCreate: (body: Record<string, unknown>) => void
}) {
  const [type, setType] = useState<RequestType>('vacation')
  const [startDate, setStartDate] = useState(toDateKey(new Date()))
  const [endDate, setEndDate] = useState(addDays(toDateKey(new Date()), 1))
  const [minutes, setMinutes] = useState('60')
  const [correctionDate, setCorrectionDate] = useState(toDateKey(new Date()))
  const [proposedStartTime, setProposedStartTime] = useState('09:00')
  const [proposedEndTime, setProposedEndTime] = useState('17:00')
  const [proposedBreakMinutes, setProposedBreakMinutes] = useState('30')
  const [doctorNoteName, setDoctorNoteName] = useState('')
  const [doctorNoteDataUrl, setDoctorNoteDataUrl] = useState('')
  const [reason, setReason] = useState('')
  const [requestValidationError, setRequestValidationError] = useState('')

  function changeStartDate(nextStartDate: string) {
    setStartDate((previousStartDate) => {
      const previousDefaultEndDate = addDays(previousStartDate, 1)
      setEndDate((currentEndDate) =>
        currentEndDate === previousDefaultEndDate || currentEndDate < nextStartDate ? nextStartDate : currentEndDate,
      )
      return nextStartDate
    })
  }

  function handleDoctorNote(file: File | undefined) {
    if (!file) {
      setDoctorNoteName('')
      setDoctorNoteDataUrl('')
      return
    }

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setDoctorNoteName(file.name)
      setDoctorNoteDataUrl(typeof reader.result === 'string' ? reader.result : '')
    })
    reader.readAsDataURL(file)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedMinutes = parseDecimalInput(minutes)
    const parsedBreakMinutes = parseDecimalInput(proposedBreakMinutes)
    if ((type === 'overtime_payout' || type === 'overtime_time_off') && (parsedMinutes === undefined || parsedMinutes < 0)) {
      setRequestValidationError(t.numericFieldsRequired)
      return
    }
    if (type === 'time_correction' && (parsedBreakMinutes === undefined || parsedBreakMinutes < 0)) {
      setRequestValidationError(t.numericFieldsRequired)
      return
    }

    setRequestValidationError('')
    const requestMinutes = type === 'overtime_payout' || type === 'overtime_time_off' ? parsedMinutes : undefined
    const body =
      type === 'time_correction'
        ? { type, correctionDate, proposedStartTime, proposedEndTime, proposedBreakMinutes: parsedBreakMinutes, reason }
        : { type, startDate, endDate, minutes: requestMinutes, reason, doctorNoteName, doctorNoteDataUrl }
    onCreate(body)
    setReason('')
    setDoctorNoteName('')
    setDoctorNoteDataUrl('')
  }

  return (
    <section className="panel request-form-panel">
      <div className="panel-title">
        <BriefcaseBusiness size={18} />
        <h2>{t.newRequest}</h2>
      </div>
      <form className="stacked-form" onSubmit={submit}>
        <label>
          {t.type}
          <select value={type} onChange={(event) => setType(event.target.value as RequestType)}>
            <option value="vacation">{t.vacation}</option>
            <option value="overtime_payout">{t.overtimePayout}</option>
            <option value="overtime_time_off">{t.overtimeTimeOff}</option>
            <option value="time_correction">{t.timeCorrection}</option>
            <option value="sick_leave">{t.sickLeave}</option>
          </select>
        </label>

        {type === 'time_correction' ? (
          <div className="form-grid">
            <label>
              {t.date}
              <input value={correctionDate} onChange={(event) => setCorrectionDate(event.target.value)} type="date" />
            </label>
            <label>
              {t.start}
              <input value={proposedStartTime} onChange={(event) => setProposedStartTime(event.target.value)} type="time" />
            </label>
            <label>
              {t.end}
              <input value={proposedEndTime} onChange={(event) => setProposedEndTime(event.target.value)} type="time" />
            </label>
            <label>
              {t.breakMinutes}
              <input
                value={proposedBreakMinutes}
                min={0}
                onChange={(event) => setProposedBreakMinutes(event.target.value)}
                type="number"
              />
            </label>
          </div>
        ) : (
          <div className="form-grid">
            <label>
              {t.startDate}
              <input value={startDate} onChange={(event) => changeStartDate(event.target.value)} type="date" />
            </label>
            <label>
              {t.endDate}
              <input value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} type="date" />
            </label>
            {type !== 'vacation' && type !== 'sick_leave' && (
              <label>
                {t.minutes}
                <input value={minutes} min={0} onChange={(event) => setMinutes(event.target.value)} type="number" />
              </label>
            )}
          </div>
        )}

        {type === 'sick_leave' && (
          <label>
            {t.doctorNote}
            <input accept=".pdf,image/*" type="file" onChange={(event) => handleDoctorNote(event.target.files?.[0])} />
            {doctorNoteName && <small>{doctorNoteName}</small>}
          </label>
        )}

        <label>
          {t.reason}
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} />
          </label>
          {requestValidationError && <p className="form-error inline-form-error">{requestValidationError}</p>}
          <button disabled={loading} className="primary-button" type="submit">
          <Check size={18} />
          {t.submitRequest}
        </button>
      </form>
    </section>
  )
}

function RequestRow({
  request,
  users,
  isAdmin,
  highlighted,
  loading,
  t,
  onDecision,
}: {
  request: RequestItem
  users: User[]
  isAdmin: boolean
  highlighted: boolean
  loading: boolean
  t: T
  onDecision: (requestId: string, decision: 'approved' | 'rejected') => void
}) {
  const user = users.find((candidate) => candidate.id === request.userId)
  return (
    <article className={classNames('request-row', highlighted && 'highlighted')}>
      <div>
        <span className={classNames('status-chip', request.status)}>{t[request.status]}</span>
        <h3>{requestLabel(request.type, t)}</h3>
        <p>
          {displayUserName(user)}
          {request.startDate && request.endDate ? `, ${request.startDate} to ${request.endDate}` : ''}
          {request.correctionDate ? `, ${request.correctionDate}` : ''}
        </p>
        {request.minutes ? <small>{formatDecimalHours(request.minutes)} {t.hours}</small> : null}
        {request.doctorNoteDataUrl && (
          <a className="doctor-note-link" href={request.doctorNoteDataUrl} download={request.doctorNoteName ?? 'doctor-note'} target="_blank" rel="noreferrer">
            {t.doctorNoteAttached}: {request.doctorNoteName ?? t.downloadDoctorNote}
          </a>
        )}
        {request.reason && <small>{request.reason}</small>}
      </div>
      {isAdmin && request.status === 'pending' && (
        <div className="row-actions">
          <button disabled={loading} className="icon-button approve" title="Approve" type="button" onClick={() => onDecision(request.id, 'approved')}>
            <Check size={18} />
          </button>
          <button disabled={loading} className="icon-button reject" title="Reject" type="button" onClick={() => onDecision(request.id, 'rejected')}>
            <X size={18} />
          </button>
        </div>
      )}
    </article>
  )
}

function AdminUsersView({
  state,
  loading,
  t,
  onUpdateUser,
  onRemoveUser,
  onInviteUser,
  onCancelInvite,
  onImportCsv,
  onUndoApproval,
  onExportCsv,
}: {
  state: StatePayload
  loading: boolean
  t: T
  onUpdateUser: (userId: string, body: Record<string, unknown>) => void
  onRemoveUser: (userId: string) => void
  onInviteUser: (body: Record<string, unknown>) => void
  onCancelInvite: (invitationId: string) => void
  onImportCsv: (body: Record<string, unknown>) => void
  onUndoApproval: (requestId: string) => void
  onExportCsv: (userId: string, period: TimeExportPeriod, date: string) => void
}) {
  const summaryByUser = new Map(state.summaries.map((summary) => [summary.userId, summary]))
  const admins = state.users.filter((user) => user.role === 'admin')
  const selectableUsers = state.users
  const employees = state.users.filter((user) => user.role === 'employee')
  const [selectedUserId, setSelectedUserId] = useState(() => employees[0]?.id ?? selectableUsers[0]?.id ?? '')
  const selectedUser = selectableUsers.find((user) => user.id === selectedUserId) ?? employees[0] ?? selectableUsers[0]

  useEffect(() => {
    if (selectableUsers.some((user) => user.id === selectedUserId)) {
      return
    }
    setSelectedUserId(employees[0]?.id ?? selectableUsers[0]?.id ?? '')
  }, [employees, selectableUsers, selectedUserId])

  return (
    <div className="admin-users-layout">
      <section className="panel admin-users-panel">
        <div className="panel-title">
          <Settings size={18} />
          <h2>{t.employeeSettings}</h2>
        </div>
        <div className="employee-selector-bar">
          <label>
            {t.selectEmployee}
            <select value={selectedUser?.id ?? ''} onChange={(event) => setSelectedUserId(event.target.value)}>
              {selectableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {displayUserName(user)} · {user.role === 'admin' ? t.admin : t.employee}
                </option>
              ))}
            </select>
          </label>
          {selectedUser && (
            <div className="selected-employee-card">
              <span>{t.selectedEmployee}</span>
              <strong>{displayUserName(selectedUser)}</strong>
              <small>{selectedUser.email}</small>
            </div>
          )}
        </div>
        {selectedUser ? (
          <EmployeeDetailPanel
            user={selectedUser}
            admins={admins}
            loading={loading}
            summary={summaryByUser.get(selectedUser.id)}
            t={t}
            onUpdate={onUpdateUser}
            onRemove={onRemoveUser}
            onExportCsv={onExportCsv}
          />
        ) : (
          <p className="muted admin-empty-state">{t.noEmployeeSelected}</p>
        )}
      </section>

      <div className="admin-side-stack">
        <InviteUserPanel
          state={state}
          admins={admins}
          loading={loading}
          t={t}
          onInviteUser={onInviteUser}
          onCancelInvite={onCancelInvite}
        />
        <TimeExportPanel
          users={state.users}
          selectedUserId={selectedUser?.id ?? state.currentUser.id}
          loading={loading}
          t={t}
          onExportCsv={onExportCsv}
        />
        <ImportCsvPanel state={state} selectedUserId={selectedUser?.id} loading={loading} t={t} onImportCsv={onImportCsv} />
        <ApprovedActionsPanel state={state} selectedUserId={selectedUser?.id} loading={loading} t={t} onUndoApproval={onUndoApproval} />
      </div>
    </div>
  )
}

function InviteUserPanel({
  state,
  admins,
  loading,
  t,
  onInviteUser,
  onCancelInvite,
}: {
  state: StatePayload
  admins: User[]
  loading: boolean
  t: T
  onInviteUser: (body: Record<string, unknown>) => void
  onCancelInvite: (invitationId: string) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [expectedWeeklyHours, setExpectedWeeklyHours] = useState('40')
  const [yearlyVacationDays, setYearlyVacationDays] = useState('30')
  const [targetRemainingVacationDays, setTargetRemainingVacationDays] = useState('30')
  const [targetBalanceHours, setTargetBalanceHours] = useState('0')
  const [responsibleAdminUserId, setResponsibleAdminUserId] = useState(admins[0]?.id ?? '')
  const [confirmInvite, setConfirmInvite] = useState(false)
  const [confirmCancelInvite, setConfirmCancelInvite] = useState<UserInvitation | null>(null)
  const [inviteValidationError, setInviteValidationError] = useState('')
  const [inviteDraft, setInviteDraft] = useState<Record<string, unknown> | null>(null)
  const pendingInvites = state.userInvitations
    .filter((invitation) => !invitation.acceptedAt)
    .slice(0, 5)
  const acceptedInvites = state.userInvitations.filter((invitation) => invitation.acceptedAt).slice(0, 3)

  useEffect(() => {
    if (!responsibleAdminUserId && admins[0]?.id) {
      setResponsibleAdminUserId(admins[0].id)
    }
  }, [admins, responsibleAdminUserId])

  function resetForm() {
    setName('')
    setEmail('')
    setRole('employee')
    setExpectedWeeklyHours('40')
    setYearlyVacationDays('30')
    setTargetRemainingVacationDays('30')
    setTargetBalanceHours('0')
    setResponsibleAdminUserId(admins[0]?.id ?? '')
    setInviteValidationError('')
    setInviteDraft(null)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedWeeklyHours = parseDecimalInput(expectedWeeklyHours)
    const parsedVacationDays = parseDecimalInput(yearlyVacationDays)
    const parsedRemainingVacationDays = parseDecimalInput(targetRemainingVacationDays)
    const parsedBalanceHours = parseDecimalInput(targetBalanceHours)

    if (
      parsedWeeklyHours === undefined ||
      parsedVacationDays === undefined ||
      parsedRemainingVacationDays === undefined ||
      parsedBalanceHours === undefined
    ) {
      setInviteValidationError(t.numericFieldsRequired)
      return
    }
    if (parsedWeeklyHours <= 0) {
      setInviteValidationError(t.weeklyHoursRequired)
      return
    }
    if (parsedVacationDays < 0) {
      setInviteValidationError(t.numericFieldsRequired)
      return
    }

    setInviteValidationError('')
    setInviteDraft({
      name,
      email,
      role,
      expectedWeeklyHours: parsedWeeklyHours,
      yearlyVacationDays: parsedVacationDays,
      targetRemainingVacationDays: parsedRemainingVacationDays,
      targetBalanceHours: parsedBalanceHours,
      responsibleAdminUserId,
    })
    setConfirmInvite(true)
  }

  return (
    <section className="panel invite-user-panel">
      <div className="panel-title">
        <UserPlus size={18} />
        <h2>{t.inviteNewUser}</h2>
      </div>
      <form className="invite-user-form" onSubmit={submit}>
        <label>
          {t.name}
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          {t.email}
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          {t.userRole}
          <select value={role} onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'employee')}>
            <option value="employee">{t.employee}</option>
            <option value="admin">{t.admin}</option>
          </select>
        </label>
        <div className="invite-section-label">{t.startingTerms}</div>
        <label>
          {t.weeklyHours}
          <input
            value={expectedWeeklyHours}
            min={1}
            step={0.5}
            type="number"
            onChange={(event) => setExpectedWeeklyHours(event.target.value)}
          />
        </label>
        <label>
          {t.vacationDays}
          <input
            value={yearlyVacationDays}
            min={0}
            step={0.5}
            type="number"
            onChange={(event) => setYearlyVacationDays(event.target.value)}
          />
        </label>
        <div className="invite-section-label">{t.initialBalances}</div>
        <label>
          {t.currentVacationRemainingDays}
          <input
            value={targetRemainingVacationDays}
            step={0.5}
            type="number"
            onChange={(event) => setTargetRemainingVacationDays(event.target.value)}
          />
        </label>
        <label>
          {t.currentBalanceHours}
          <input
            value={targetBalanceHours}
            step={0.25}
            type="number"
            onChange={(event) => setTargetBalanceHours(event.target.value)}
          />
        </label>
        {role === 'employee' && (
          <label>
            {t.responsibleAdmin}
            <select value={responsibleAdminUserId} onChange={(event) => setResponsibleAdminUserId(event.target.value)}>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {displayUserName(admin)}
                </option>
              ))}
            </select>
          </label>
        )}
        {inviteValidationError && <p className="form-error inline-form-error">{inviteValidationError}</p>}
        <button
          disabled={loading || name.trim().length < 2 || !email.includes('@')}
          className="primary-button"
          type="submit"
        >
          <UserPlus size={16} />
          {t.sendInvite}
        </button>
      </form>
      <InviteList
        title={t.pendingInvites}
        emptyText={t.noPendingInvites}
        invitations={pendingInvites}
        users={state.users}
        loading={loading}
        cancelLabel={t.cancelInvite}
        onCancelInvite={setConfirmCancelInvite}
      />
      {acceptedInvites.length > 0 && <InviteList title={t.acceptedInvites} emptyText="" invitations={acceptedInvites} users={state.users} />}
      {confirmInvite && (
        <ConfirmDialog
          title={t.confirmInviteTitle}
          body={t.confirmInviteBody}
          confirmLabel={t.sendInvite}
          cancelLabel={t.cancel}
          loading={loading}
          onCancel={() => setConfirmInvite(false)}
          onConfirm={() => {
            setConfirmInvite(false)
            if (inviteDraft) {
              onInviteUser(inviteDraft)
              resetForm()
            }
          }}
        />
      )}
      {confirmCancelInvite && (
        <ConfirmDialog
          title={t.confirmCancelInviteTitle}
          body={`${t.confirmCancelInviteBody} ${confirmCancelInvite.email}`}
          confirmLabel={t.cancelInvite}
          cancelLabel={t.cancel}
          loading={loading}
          onCancel={() => setConfirmCancelInvite(null)}
          onConfirm={() => {
            const invitationId = confirmCancelInvite.id
            setConfirmCancelInvite(null)
            onCancelInvite(invitationId)
          }}
        />
      )}
    </section>
  )
}

function InviteList({
  title,
  emptyText,
  invitations,
  users,
  loading = false,
  cancelLabel,
  onCancelInvite,
}: {
  title: string
  emptyText: string
  invitations: UserInvitation[]
  users: User[]
  loading?: boolean
  cancelLabel?: string
  onCancelInvite?: (invitation: UserInvitation) => void
}) {
  const userById = new Map(users.map((user) => [user.id, user]))
  return (
    <div className="invite-list">
      <h3>{title}</h3>
      {invitations.length === 0 && emptyText && <p className="muted">{emptyText}</p>}
      {invitations.map((invitation) => {
        const user = userById.get(invitation.userId)
        return (
          <article key={invitation.id} className="invite-row">
            <div>
              <strong>{displayUserName(user) || invitation.email}</strong>
              <small>{invitation.email}</small>
              <small>
                {invitation.acceptedAt
                  ? new Date(invitation.acceptedAt).toLocaleString()
                  : new Date(invitation.expiresAt).toLocaleString()}
              </small>
            </div>
            {!invitation.acceptedAt && onCancelInvite && cancelLabel && (
              <button disabled={loading} className="secondary-button" type="button" onClick={() => onCancelInvite(invitation)}>
                <X size={16} />
                {cancelLabel}
              </button>
            )}
          </article>
        )
      })}
    </div>
  )
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  const rightSet = new Set(right)
  return left.every((item) => rightSet.has(item))
}

function GroupAdminPanel({
  state,
  loading,
  t,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
}: {
  state: StatePayload
  loading: boolean
  t: T
  onCreateGroup: (body: Record<string, unknown>) => void
  onUpdateGroup: (id: string, body: Record<string, unknown>) => void
  onDeleteGroup: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [memberUserIds, setMemberUserIds] = useState<string[]>([])

  function submit(event: FormEvent) {
    event.preventDefault()
    onCreateGroup({ name, memberUserIds })
    setName('')
    setMemberUserIds([])
  }

  return (
    <section className="panel group-admin-panel">
      <div className="panel-title">
        <Users size={18} />
        <h2>{t.groups}</h2>
      </div>
      <form className="group-form" onSubmit={submit}>
        <label>
          {t.newGroup}
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.groupName} />
        </label>
        <GroupMemberChecks
          users={state.users}
          memberUserIds={memberUserIds}
          onToggle={(userId) => setMemberUserIds((current) => toggleId(current, userId))}
        />
        <button disabled={loading || name.trim().length === 0} className="primary-button" type="submit">
          <UserPlus size={16} />
          {t.createGroup}
        </button>
      </form>
      <div className="group-list">
        {state.calendarGroups.map((group) => (
          <GroupRow
            key={group.id}
            group={group}
            users={state.users}
            loading={loading}
            t={t}
            onUpdate={onUpdateGroup}
            onDelete={onDeleteGroup}
          />
        ))}
      </div>
    </section>
  )
}

function GroupMemberChecks({
  users,
  memberUserIds,
  disabled = false,
  onToggle,
}: {
  users: User[]
  memberUserIds: string[]
  disabled?: boolean
  onToggle: (userId: string) => void
}) {
  return (
    <div className="group-member-list">
      {users.map((user) => (
        <label key={user.id} className="check-row">
          <input
            checked={memberUserIds.includes(user.id)}
            disabled={disabled}
            type="checkbox"
            onChange={() => onToggle(user.id)}
          />
          <span>
            {displayUserName(user)}
            <small>{user.email}</small>
          </span>
        </label>
      ))}
    </div>
  )
}

function GroupRow({
  group,
  users,
  loading,
  t,
  onUpdate,
  onDelete,
}: {
  group: CalendarGroup
  users: User[]
  loading: boolean
  t: T
  onUpdate: (id: string, body: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState(group.name)
  const [memberUserIds, setMemberUserIds] = useState(group.memberUserIds)
  const [isEditing, setIsEditing] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isDirty = name !== group.name || !sameIds(memberUserIds, group.memberUserIds)
  const memberUsers = users.filter((user) => group.memberUserIds.includes(user.id))

  useEffect(() => {
    setName(group.name)
    setMemberUserIds(group.memberUserIds)
    setIsEditing(false)
  }, [group.id, group.memberUserIds, group.name])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (isEditing && isDirty) {
      setConfirmSave(true)
    }
  }

  function startEdit() {
    setName(group.name)
    setMemberUserIds(group.memberUserIds)
    setIsEditing(true)
  }

  function cancelEdit() {
    setName(group.name)
    setMemberUserIds(group.memberUserIds)
    setIsEditing(false)
  }

  return (
    <form className={classNames('group-row', isEditing && 'group-row-editing')} onSubmit={submit}>
      <div className="group-row-header">
        {isEditing ? (
          <label>
            {t.groupName}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        ) : (
          <div className="group-summary">
            <strong>{group.name}</strong>
            <small>
              {memberUsers.length} {t.groupMembers.toLowerCase()}
            </small>
          </div>
        )}
        <div className="group-actions">
          {isEditing ? (
            <>
              <button disabled={loading || name.trim().length === 0 || !isDirty} className="secondary-button" type="submit">
                <Check size={16} />
                {t.saveGroup}
              </button>
              <button disabled={loading} className="secondary-button" type="button" onClick={cancelEdit}>
                <X size={16} />
                {t.cancel}
              </button>
            </>
          ) : (
            <>
              <button disabled={loading} className="secondary-button" type="button" onClick={startEdit}>
                <Pencil size={16} />
                {t.editGroup}
              </button>
              <button
                disabled={loading}
                className="icon-button reject"
                title={t.deleteGroup}
                type="button"
                onClick={() => setConfirmDelete(true)}
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      {isEditing ? (
        <>
          <span className="group-members-label">{t.groupMembers}</span>
          <GroupMemberChecks
            users={users}
            memberUserIds={memberUserIds}
            onToggle={(userId) => setMemberUserIds((current) => toggleId(current, userId))}
          />
        </>
      ) : (
        <div className="group-member-summary">
          {memberUsers.length === 0 && <span className="member-chip muted-chip">{t.noneYet}</span>}
          {memberUsers.map((user) => (
            <span key={user.id} className="member-chip">
              {displayUserName(user)}
            </span>
          ))}
        </div>
      )}
      {confirmSave && (
        <ConfirmDialog
          title={t.confirmGroupChangeTitle}
          body={t.confirmGroupChangeBody}
          confirmLabel={t.saveGroup}
          cancelLabel={t.cancel}
          loading={loading}
          onCancel={() => setConfirmSave(false)}
          onConfirm={() => {
            setConfirmSave(false)
            setIsEditing(false)
            onUpdate(group.id, { name: name.trim(), memberUserIds })
          }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={t.confirmDeleteGroupTitle}
          body={t.confirmDeleteGroupBody}
          confirmLabel={t.deleteGroup}
          cancelLabel={t.cancel}
          loading={loading}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            onDelete(group.id)
          }}
        />
      )}
    </form>
  )
}

function EmployeeDetailPanel({
  user,
  admins,
  loading,
  summary,
  t,
  onUpdate,
  onRemove,
  onExportCsv,
}: {
  user: User
  admins: User[]
  loading: boolean
  summary?: UserSummary
  t: T
  onUpdate: (userId: string, body: Record<string, unknown>) => void
  onRemove: (userId: string) => void
  onExportCsv: (userId: string, period: TimeExportPeriod, date: string) => void | Promise<void>
}) {
  const currentTerm = currentEmploymentTerm(user)
  const currentWeeklyHours = currentTerm.expectedWeeklyMinutes / 60
  const currentYearlyVacationDays = currentTerm.yearlyVacationDays
  const terms = employmentTermsFor(user)
  const currentRemainingVacationDays = summary?.vacation.remainingDays ?? currentYearlyVacationDays + user.vacationAdjustmentDays
  const currentBalanceHours = (summary?.year.plusMinusMinutes ?? 0) / 60
  const responsibleAdmin = admins.find((admin) => admin.id === user.responsibleAdminUserId)
  const [termsEditMode, setTermsEditMode] = useState(false)
  const [adjustmentsEditMode, setAdjustmentsEditMode] = useState(false)
  const [adminEditMode, setAdminEditMode] = useState(false)
  const [roleEditMode, setRoleEditMode] = useState(false)
  const [confirmRemoveUser, setConfirmRemoveUser] = useState(false)
  const [exportBeforeRemove, setExportBeforeRemove] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    body: string
    confirmLabel: string
    onConfirm: () => void
  } | null>(null)
  const [employeeValidationError, setEmployeeValidationError] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(() => toDateKey(new Date()))
  const [expectedWeeklyHours, setExpectedWeeklyHours] = useState(numberInputValue(currentWeeklyHours))
  const [yearlyVacationDays, setYearlyVacationDays] = useState(numberInputValue(currentYearlyVacationDays))
  const [targetRemainingVacationDays, setTargetRemainingVacationDays] = useState(
    numberInputValue(currentRemainingVacationDays),
  )
  const [targetBalanceHours, setTargetBalanceHours] = useState(numberInputValue(currentBalanceHours))
  const [responsibleAdminUserId, setResponsibleAdminUserId] = useState(user.responsibleAdminUserId ?? '')
  const [role, setRole] = useState<Role>(user.role)

  useEffect(() => {
    setEffectiveFrom(toDateKey(new Date()))
    setExpectedWeeklyHours(numberInputValue(currentWeeklyHours))
    setYearlyVacationDays(numberInputValue(currentYearlyVacationDays))
    setTargetRemainingVacationDays(numberInputValue(currentRemainingVacationDays))
    setTargetBalanceHours(numberInputValue(currentBalanceHours))
    setResponsibleAdminUserId(user.responsibleAdminUserId ?? '')
    setRole(user.role)
    setTermsEditMode(false)
    setAdjustmentsEditMode(false)
    setAdminEditMode(false)
    setRoleEditMode(false)
    setConfirmRemoveUser(false)
    setExportBeforeRemove(true)
    setEmployeeValidationError('')
  }, [
    currentBalanceHours,
    currentRemainingVacationDays,
    currentWeeklyHours,
    currentYearlyVacationDays,
    user.id,
    user.responsibleAdminUserId,
    user.role,
  ])

  return (
    <div className="employee-detail">
      <div className="employee-profile-row">
        <div>
          <span>{t.currentSettings}</span>
          <h3>{displayUserName(user)}</h3>
          <small>{user.email}</small>
        </div>
        <div className="employee-profile-metrics">
          <EmployeeSettingValue label={t.currentRole} value={user.role === 'admin' ? t.admin : t.employee} />
          <EmployeeSettingValue label={t.weeklyHours} value={`${formatShownNumber(currentWeeklyHours)} h`} />
          <EmployeeSettingValue label={t.vacationDays} value={formatShownNumber(currentYearlyVacationDays)} />
          <EmployeeSettingValue label={t.currentBalanceHours} value={`${formatShownNumber(currentBalanceHours)} h`} />
        </div>
      </div>

      <div className="employee-detail-grid">
        <section className="employee-settings-section">
          <div className="employee-section-header">
            <h3>{t.permissions}</h3>
            <button disabled={loading} className="secondary-button" type="button" onClick={() => setRoleEditMode((value) => !value)}>
              {roleEditMode ? <X size={16} /> : <Pencil size={16} />}
              {roleEditMode ? t.cancel : t.editPermissions}
            </button>
          </div>
          <EmployeeSettingValue label={t.currentRole} value={user.role === 'admin' ? t.admin : t.employee} />
          {roleEditMode && (
            <form
              className="employee-edit-form role-edit-form"
              onSubmit={(event) => {
                event.preventDefault()
                setConfirmAction({
                  title: t.confirmRoleTitle,
                  body: t.confirmRoleBody,
                  confirmLabel: t.saveImportantChange,
                  onConfirm: () => {
                    setRoleEditMode(false)
                    onUpdate(user.id, {
                      role,
                      responsibleAdminUserId: role === 'employee' ? responsibleAdminUserId : '',
                    })
                  },
                })
              }}
            >
              <label>
                {t.userRole}
                <select value={role} onChange={(event) => setRole(event.target.value === 'admin' ? 'admin' : 'employee')}>
                  <option value="employee">{t.employee}</option>
                  <option value="admin">{t.admin}</option>
                </select>
              </label>
              {role === 'employee' && (
                <label>
                  {t.responsibleAdmin}
                  <select value={responsibleAdminUserId} onChange={(event) => setResponsibleAdminUserId(event.target.value)}>
                    <option value="">{t.allAdminsFallback}</option>
                    {admins
                      .filter((admin) => admin.id !== user.id)
                      .map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {displayUserName(admin)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <button disabled={loading || role === user.role} className="primary-button" type="submit">
                <Check size={16} />
                {t.saveImportantChange}
              </button>
            </form>
          )}
        </section>

        <section className="employee-settings-section">
          <div className="employee-section-header">
            <div>
              <h3>{t.employmentTerms}</h3>
              <small>{t.effectiveFrom}: {currentTerm.effectiveFrom}</small>
            </div>
            <button disabled={loading} className="secondary-button" type="button" onClick={() => setTermsEditMode((value) => !value)}>
              {termsEditMode ? <X size={16} /> : <Pencil size={16} />}
              {termsEditMode ? t.cancel : t.editTerms}
            </button>
          </div>
          <div className="term-history">
            <strong>{t.currentTerms}</strong>
            {terms
              .slice()
              .reverse()
              .map((term) => (
                <div key={term.id} className="term-row">
                  <span>{t.appliesSince} {term.effectiveFrom}</span>
                  <strong>{formatDecimalHours(term.expectedWeeklyMinutes)} h / {formatShownNumber(term.yearlyVacationDays)} {t.vacationDays}</strong>
                </div>
              ))}
          </div>
          {termsEditMode && (
            <form
              className="employee-edit-form"
              onSubmit={(event) => {
                event.preventDefault()
                const parsedWeeklyHours = parseDecimalInput(expectedWeeklyHours)
                const parsedVacationDays = parseDecimalInput(yearlyVacationDays)
                if (parsedWeeklyHours === undefined || parsedVacationDays === undefined || parsedVacationDays < 0) {
                  setEmployeeValidationError(t.numericFieldsRequired)
                  return
                }
                if (parsedWeeklyHours <= 0) {
                  setEmployeeValidationError(t.weeklyHoursRequired)
                  return
                }
                setEmployeeValidationError('')
                setConfirmAction({
                  title: t.confirmEmploymentTermTitle,
                  body: t.confirmEmploymentTermBody,
                  confirmLabel: t.saveImportantChange,
                  onConfirm: () => {
                    setTermsEditMode(false)
                    onUpdate(user.id, {
                      effectiveFrom,
                      expectedWeeklyHours: parsedWeeklyHours,
                      yearlyVacationDays: parsedVacationDays,
                    })
                  },
                })
              }}
            >
              <label>
                {t.effectiveFrom}
                <input
                  value={effectiveFrom}
                  type="date"
                  onChange={(event) => {
                    const nextDate = event.target.value || toDateKey(new Date())
                    const activeTerm = termForDate(user, nextDate)
                    setEffectiveFrom(nextDate)
                    setExpectedWeeklyHours(numberInputValue(activeTerm.expectedWeeklyMinutes / 60))
                    setYearlyVacationDays(numberInputValue(activeTerm.yearlyVacationDays))
                  }}
                />
              </label>
              <label>
                {t.weeklyHours}
                <input
                  value={expectedWeeklyHours}
                  min={1}
                  step={0.5}
                  onChange={(event) => setExpectedWeeklyHours(event.target.value)}
                  type="number"
                />
              </label>
              <label>
                {t.vacationDays}
                <input
                  value={yearlyVacationDays}
                  min={0}
                  step={0.5}
                  onChange={(event) => setYearlyVacationDays(event.target.value)}
                  type="number"
                />
              </label>
              {employeeValidationError && <p className="form-error inline-form-error">{employeeValidationError}</p>}
              <button disabled={loading} className="primary-button" type="submit">
                <Check size={16} />
                {t.saveImportantChange}
              </button>
            </form>
          )}
        </section>

        <section className="employee-settings-section">
          <div className="employee-section-header">
            <h3>{t.currentBalanceHours}</h3>
            <button disabled={loading} className="secondary-button" type="button" onClick={() => setAdjustmentsEditMode((value) => !value)}>
              {adjustmentsEditMode ? <X size={16} /> : <Pencil size={16} />}
              {adjustmentsEditMode ? t.cancel : t.editAdjustments}
            </button>
          </div>
          <div className="employee-values-grid">
            <EmployeeSettingValue label={t.currentVacationRemainingDays} value={formatShownNumber(currentRemainingVacationDays)} />
            <EmployeeSettingValue label={t.currentBalanceHours} value={`${formatShownNumber(currentBalanceHours)} h`} />
          </div>
          {adjustmentsEditMode && (
            <form
              className="employee-edit-form"
              onSubmit={(event) => {
                event.preventDefault()
                const parsedRemainingVacationDays = parseDecimalInput(targetRemainingVacationDays)
                const parsedBalanceHours = parseDecimalInput(targetBalanceHours)
                if (parsedRemainingVacationDays === undefined || parsedBalanceHours === undefined) {
                  setEmployeeValidationError(t.numericFieldsRequired)
                  return
                }
                setEmployeeValidationError('')
                setConfirmAction({
                  title: t.confirmAdjustmentTitle,
                  body: t.confirmAdjustmentBody,
                  confirmLabel: t.saveImportantChange,
                  onConfirm: () => {
                    setAdjustmentsEditMode(false)
                    onUpdate(user.id, {
                      targetRemainingVacationDays: parsedRemainingVacationDays,
                      targetBalanceHours: parsedBalanceHours,
                    })
                  },
                })
              }}
            >
              <label>
                {t.currentVacationRemainingDays}
                <input
                  value={targetRemainingVacationDays}
                  step={0.5}
                  onChange={(event) => setTargetRemainingVacationDays(event.target.value)}
                  type="number"
                />
              </label>
              <label>
                {t.currentBalanceHours}
                <input
                  value={targetBalanceHours}
                  step={0.25}
                  onChange={(event) => setTargetBalanceHours(event.target.value)}
                  type="number"
                />
              </label>
              {employeeValidationError && <p className="form-error inline-form-error">{employeeValidationError}</p>}
              <button disabled={loading} className="primary-button" type="submit">
                <Check size={16} />
                {t.saveImportantChange}
              </button>
            </form>
          )}
        </section>

        {user.role === 'employee' && (
          <section className="employee-settings-section">
            <div className="employee-section-header">
              <h3>{t.responsibleAdmin}</h3>
              <button disabled={loading} className="secondary-button" type="button" onClick={() => setAdminEditMode((value) => !value)}>
                {adminEditMode ? <X size={16} /> : <Pencil size={16} />}
                {adminEditMode ? t.cancel : t.editResponsibleAdmin}
              </button>
            </div>
            <EmployeeSettingValue label={t.responsibleAdmin} value={responsibleAdmin ? displayUserName(responsibleAdmin) : t.allAdminsFallback} />
            {adminEditMode && (
              <form
                className="employee-edit-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  setConfirmAction({
                    title: t.confirmResponsibleAdminTitle,
                    body: t.confirmResponsibleAdminBody,
                    confirmLabel: t.saveImportantChange,
                    onConfirm: () => {
                      setAdminEditMode(false)
                      onUpdate(user.id, { responsibleAdminUserId })
                    },
                  })
                }}
              >
                <label>
                  {t.responsibleAdmin}
                  <select value={responsibleAdminUserId} onChange={(event) => setResponsibleAdminUserId(event.target.value)}>
                    <option value="">{t.allAdminsFallback}</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {displayUserName(admin)}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={loading} className="primary-button" type="submit">
                  <Check size={16} />
                  {t.saveImportantChange}
                </button>
              </form>
            )}
          </section>
        )}

        <section className="employee-settings-section danger-section">
          <div className="employee-section-header">
            <div>
              <h3>{t.removeUserDangerTitle}</h3>
              <small>{t.confirmRemoveUserBody}</small>
            </div>
            <button disabled={loading} className="secondary-button danger-button" type="button" onClick={() => setConfirmRemoveUser(true)}>
              <Trash2 size={16} />
              {t.removeUser}
            </button>
          </div>
        </section>
      </div>
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          body={confirmAction.body}
          confirmLabel={confirmAction.confirmLabel}
          cancelLabel={t.cancel}
          loading={loading}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const action = confirmAction.onConfirm
            setConfirmAction(null)
            action()
          }}
        />
      )}
      {confirmRemoveUser && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-user-dialog-title">
            <h2 id="remove-user-dialog-title">{t.confirmRemoveUserTitle}</h2>
            <p>{t.confirmRemoveUserBody}</p>
            <label className="modal-checkbox">
              <input
                checked={exportBeforeRemove}
                type="checkbox"
                onChange={(event) => setExportBeforeRemove(event.target.checked)}
              />
              {t.exportBeforeRemove}
            </label>
            <div className="modal-actions">
              <button disabled={loading} className="secondary-button" type="button" onClick={() => setConfirmRemoveUser(false)}>
                {t.cancel}
              </button>
              <button
                disabled={loading}
                className="primary-button danger-button"
                type="button"
                onClick={async () => {
                  setConfirmRemoveUser(false)
                  if (exportBeforeRemove) {
                    await onExportCsv(user.id, 'all', toDateKey(new Date()))
                  }
                  onRemove(user.id)
                }}
              >
                <Trash2 size={16} />
                {exportBeforeRemove ? t.removeUser : t.removeWithoutExport}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EmployeeSettingValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="employee-setting-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ApprovedActionsPanel({
  state,
  selectedUserId,
  loading,
  t,
  onUndoApproval,
}: {
  state: StatePayload
  selectedUserId?: string
  loading: boolean
  t: T
  onUndoApproval: (requestId: string) => void
}) {
  const [confirmUndoRequest, setConfirmUndoRequest] = useState<RequestItem | null>(null)
  const userById = new Map(state.users.map((user) => [user.id, user]))
  const selectedUser = selectedUserId ? userById.get(selectedUserId) : undefined
  const approvedRequests = state.requests
    .filter((request) => request.userId === selectedUserId && request.status === 'approved')
    .sort((left, right) => (right.decidedAt ?? right.createdAt).localeCompare(left.decidedAt ?? left.createdAt))

  return (
    <section className="panel approved-actions-panel">
      <div className="panel-title">
        <RotateCcw size={18} />
        <h2>{t.approvedActions}</h2>
      </div>
      <div className="approved-actions-content">
        {selectedUser && <div className="selected-side-user"><span>{t.employee}</span><strong>{displayUserName(selectedUser)}</strong></div>}
        <div className="approved-action-list">
          {approvedRequests.length === 0 && <p className="muted">{t.noApprovedActions}</p>}
          {approvedRequests.map((request) => (
            <article key={request.id} className="approved-action-row">
              <div>
                <span className="status-chip approved">{t.approved}</span>
                <strong>{requestLabel(request.type, t)}</strong>
                <small>{requestDateDetail(request)}</small>
                {request.decidedAt && (
                  <small>
                    {t.approvedAt}: {new Date(request.decidedAt).toLocaleString()}
                  </small>
                )}
                {request.decidedBy && (
                  <small>
                    {t.approvedBy}: {displayUserName(userById.get(request.decidedBy))}
                  </small>
                )}
              </div>
              <button disabled={loading} className="secondary-button" type="button" onClick={() => setConfirmUndoRequest(request)}>
                <RotateCcw size={16} />
                {t.undoApproval}
              </button>
            </article>
          ))}
        </div>
      </div>
      {confirmUndoRequest && (
        <ConfirmDialog
          title={t.confirmUndoApprovalTitle}
          body={`${t.confirmUndoApprovalBody}${selectedUser ? ` ${displayUserName(selectedUser)}.` : ''}`}
          confirmLabel={t.undoApproval}
          cancelLabel={t.cancel}
          loading={loading}
          onCancel={() => setConfirmUndoRequest(null)}
          onConfirm={() => {
            const requestId = confirmUndoRequest.id
            setConfirmUndoRequest(null)
            onUndoApproval(requestId)
          }}
        />
      )}
    </section>
  )
}

function ImportCsvPanel({
  state,
  selectedUserId,
  loading,
  t,
  onImportCsv,
}: {
  state: StatePayload
  selectedUserId?: string
  loading: boolean
  t: T
  onImportCsv: (body: Record<string, unknown>) => void
}) {
  const employees = state.users.filter((user) => user.role === 'employee')
  const [userId, setUserId] = useState(employees[0]?.id ?? state.users[0]?.id ?? '')
  const [fileName, setFileName] = useState('zeitguru-export.csv')
  const [csv, setCsv] = useState('')
  const activeUserId = selectedUserId ?? userId
  const selectedUser = state.users.find((user) => user.id === activeUserId)

  useEffect(() => {
    if (selectedUserId) {
      setUserId(selectedUserId)
    }
  }, [selectedUserId])

  function submit(event: FormEvent) {
    event.preventDefault()
    onImportCsv({ userId: activeUserId, fileName, csv })
  }

  return (
    <section className="panel import-panel">
      <div className="panel-title">
        <Upload size={18} />
        <h2>{t.csvImport}</h2>
      </div>
      <form className="stacked-form" onSubmit={submit}>
        {selectedUser ? (
          <div className="selected-side-user">
            <span>{t.employee}</span>
            <strong>{displayUserName(selectedUser)}</strong>
          </div>
        ) : (
          <label>
            {t.employee}
            <select value={userId} onChange={(event) => setUserId(event.target.value)}>
              {employees.map((user) => (
                <option key={user.id} value={user.id}>
                  {displayUserName(user)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t.fileName}
          <input value={fileName} onChange={(event) => setFileName(event.target.value)} />
        </label>
        <label>
          {t.csvContent}
          <textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder="Datum;Beginn;Ende;Pause;Notiz"
            rows={7}
          />
        </label>
        <button disabled={loading || !activeUserId || csv.trim().length === 0} className="primary-button" type="submit">
          <Upload size={16} />
          {t.importCsv}
        </button>
      </form>
      <div className="import-list">
        <h3>{t.recentImports}</h3>
        {state.importBatches.length === 0 && <p className="muted">{t.noImports}</p>}
        {state.importBatches.slice(0, 4).map((batch) => (
          <article key={batch.id} className="import-row">
            <strong>{batch.fileName}</strong>
            <small>
              {batch.importedRows} {t.imported}, {batch.skippedRows} {t.skipped}
            </small>
            {batch.errors.slice(0, 2).map((error) => (
              <small key={error}>{error}</small>
            ))}
          </article>
        ))}
      </div>
    </section>
  )
}

function SettingsView({
  state,
  loading,
  t,
  onCreateBackup,
  onUpdateMailServer,
  onTestMailServer,
  onDeleteMailServer,
  onUpdateLicense,
  onDeleteLicense,
}: {
  state: StatePayload
  loading: boolean
  t: T
  onCreateBackup: () => void
  onUpdateMailServer: (body: Record<string, unknown>) => void
  onTestMailServer: () => void
  onDeleteMailServer: () => void
  onUpdateLicense: (body: Record<string, unknown>) => void
  onDeleteLicense: () => void
}) {
  return (
    <div className="settings-layout">
      <LicensePanel
        licenseState={state.licenseState}
        loading={loading}
        t={t}
        onUpdate={onUpdateLicense}
        onDelete={onDeleteLicense}
      />
      <MailServerPanel
        settings={state.mailServerSettings}
        loading={loading}
        t={t}
        onUpdate={onUpdateMailServer}
        onTest={onTestMailServer}
        onDelete={onDeleteMailServer}
      />
      <BackupPanel state={state} loading={loading} t={t} onCreateBackup={onCreateBackup} />
    </div>
  )
}

function LicensePanel({
  licenseState,
  loading,
  t,
  onUpdate,
  onDelete,
}: {
  licenseState?: LicenseState
  loading: boolean
  t: T
  onUpdate: (body: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [licenseKey, setLicenseKey] = useState('')
  const [validationError, setValidationError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setValidationError('')
  }, [licenseState])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (licenseKey.trim().length === 0) {
      setValidationError(t.licenseKeyRequired)
      return
    }

    setValidationError('')
    onUpdate({ licenseKey })
    setLicenseKey('')
  }

  const details = licenseState?.details

  return (
    <section className="panel license-panel">
      <div className="panel-title">
        <ShieldCheck size={18} />
        <h2>{t.license}</h2>
      </div>

      {licenseState ? (
        <div
          className={classNames(
            'license-status-card',
            licenseState.status === 'community' || licenseState.status === 'licensed' ? 'valid' : 'warning',
          )}
        >
          <div>
            <span>{t.licenseStatus}</span>
            <strong>{licenseStatusLabel(licenseState, t)}</strong>
          </div>
          <p>{licenseState.message}</p>
        </div>
      ) : (
        <p className="mail-server-note">{t.noLicenseConfigured}</p>
      )}

      {licenseState && (
        <div className="license-status-grid">
          <div>
            <span>{t.activeUsers}</span>
            <strong>{formatShownNumber(licenseState.activeUsers)}</strong>
          </div>
          <div>
            <span>{t.activeUserLimit}</span>
            <strong>{formatShownNumber(licenseState.effectiveUserLimit)}</strong>
          </div>
          <div>
            <span>{t.freeUserLimit}</span>
            <strong>{formatShownNumber(licenseState.freeUserLimit)}</strong>
          </div>
        </div>
      )}

      {details && (
        <div className="license-details">
          <span>{t.holder}</span>
          <strong>{details.holderName}</strong>
          <span>{t.contact}</span>
          <strong>{details.contactEmail}</strong>
          <span>{t.plan}</span>
          <strong>{licensePlanLabel(details.plan, t)}</strong>
          <span>{t.issuedAt}</span>
          <strong>{dateOnlyLabel(details.issuedAt)}</strong>
          {details.validUntil && (
            <>
              <span>{t.validUntil}</span>
              <strong>{dateOnlyLabel(details.validUntil)}</strong>
            </>
          )}
        </div>
      )}

      {!licenseState?.licenseConfigured && <p className="mail-server-note">{t.noLicenseConfigured}</p>}

      <form className="stacked-form" onSubmit={submit}>
        <label>
          {t.licenseKey}
          <textarea
            value={licenseKey}
            className="license-key-input"
            onChange={(event) => setLicenseKey(event.target.value)}
            placeholder={t.licenseKeyPlaceholder}
            rows={4}
            spellCheck={false}
          />
        </label>
        {validationError && <p className="form-error inline-form-error">{validationError}</p>}
        <div className="mail-server-actions">
          <button disabled={loading || licenseKey.trim().length === 0} className="primary-button" type="submit">
            <Check size={16} />
            {t.saveLicense}
          </button>
          <button
            disabled={loading || !licenseState?.licenseConfigured}
            className="secondary-button danger-button"
            type="button"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={16} />
            {t.deleteLicense}
          </button>
        </div>
      </form>

      {confirmDelete && (
        <ConfirmDialog
          title={t.confirmDeleteLicenseTitle}
          body={t.confirmDeleteLicenseBody}
          confirmLabel={t.deleteLicense}
          cancelLabel={t.cancel}
          loading={loading}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            onDelete()
          }}
        />
      )}
    </section>
  )
}

function MailServerPanel({
  settings,
  loading,
  t,
  onUpdate,
  onTest,
  onDelete,
}: {
  settings?: MailServerSettings
  loading: boolean
  t: T
  onUpdate: (body: Record<string, unknown>) => void
  onTest: () => void
  onDelete: () => void
}) {
  const [host, setHost] = useState(settings?.host ?? '')
  const [port, setPort] = useState(String(settings?.port ?? 587))
  const [secure, setSecure] = useState(Boolean(settings?.secure))
  const [user, setUser] = useState(settings?.user ?? '')
  const [password, setPassword] = useState('')
  const [fromAddress, setFromAddress] = useState(settings?.fromAddress ?? '')
  const [validationError, setValidationError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setHost(settings?.host ?? '')
    setPort(String(settings?.port ?? 587))
    setSecure(Boolean(settings?.secure))
    setUser(settings?.user ?? '')
    setPassword('')
    setFromAddress(settings?.fromAddress ?? '')
    setValidationError('')
  }, [settings])

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedPort = Number(port)
    if (!host.trim() || !fromAddress.trim() || !Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setValidationError(t.numericFieldsRequired)
      return
    }

    setValidationError('')
    onUpdate({
      host,
      port: parsedPort,
      secure,
      user,
      password,
      fromAddress,
    })
    setPassword('')
  }

  return (
    <section className="panel mail-server-panel">
      <div className="panel-title">
        <Mail size={18} />
        <h2>{t.mailServer}</h2>
      </div>
      {!settings && <p className="mail-server-note">{t.noMailServer}</p>}
      <form className="stacked-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            {t.smtpHost}
            <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="smtp.example.com" />
          </label>
          <label>
            {t.smtpPort}
            <input value={port} min={1} max={65535} step={1} type="number" onChange={(event) => setPort(event.target.value)} />
          </label>
          <label>
            {t.smtpUser}
            <input value={user} onChange={(event) => setUser(event.target.value)} autoComplete="username" />
          </label>
          <label>
            {t.smtpPassword}
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={settings?.passwordConfigured ? t.passwordPlaceholder : ''}
              type="password"
              autoComplete="new-password"
            />
            {settings?.passwordConfigured && <small className="field-note">{t.passwordSaved}</small>}
          </label>
        </div>
        <label>
          {t.smtpFrom}
          <input value={fromAddress} onChange={(event) => setFromAddress(event.target.value)} placeholder="Arbeitszeitbüro <time@example.com>" />
        </label>
        <label className="toggle-row">
          <input checked={secure} type="checkbox" onChange={(event) => setSecure(event.target.checked)} />
          <span>{t.smtpSecure}</span>
        </label>
        {validationError && <p className="form-error inline-form-error">{validationError}</p>}
        <div className="mail-server-actions">
          <button disabled={loading || host.trim().length === 0 || fromAddress.trim().length === 0} className="primary-button" type="submit">
            <Check size={16} />
            {t.saveMailServer}
          </button>
          <button disabled={loading || !settings} className="secondary-button" type="button" onClick={onTest}>
            <Send size={16} />
            {t.testMailServer}
          </button>
          <button disabled={loading || !settings} className="secondary-button danger-button" type="button" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} />
            {t.deleteMailServer}
          </button>
        </div>
      </form>
      {confirmDelete && (
        <ConfirmDialog
          title={t.confirmDeleteMailServerTitle}
          body={t.confirmDeleteMailServerBody}
          confirmLabel={t.deleteMailServer}
          cancelLabel={t.cancel}
          loading={loading}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            onDelete()
          }}
        />
      )}
    </section>
  )
}

function BackupPanel({
  state,
  loading,
  t,
  onCreateBackup,
}: {
  state: StatePayload
  loading: boolean
  t: T
  onCreateBackup: () => void
}) {
  return (
    <section className="panel backup-panel">
      <div className="panel-title">
        <Database size={18} />
        <h2>{t.backup}</h2>
      </div>
      <div className="backup-details">
        <span>{t.dataFile}</span>
        <code>{state.backup.dataFile}</code>
        <span>{t.backupFolder}</span>
        <code>{state.backup.backupDir}</code>
        <span>{t.lastBackup}</span>
        <code>{state.backup.lastWeeklyBackup ?? t.noneYet}</code>
      </div>
      <button disabled={loading} className="secondary-button backup-button" type="button" onClick={onCreateBackup}>
        <Database size={16} />
        {t.createBackup}
      </button>
    </section>
  )
}

function HolidayAdmin({
  state,
  loading,
  language,
  t,
  onLoadHolidayTemplateOptions,
  onUpdateHolidaySettings,
  onHolidayOverride,
  onUpdateOverride,
  onDeleteOverride,
}: {
  state: StatePayload
  loading: boolean
  language: Language
  t: T
  onLoadHolidayTemplateOptions: (settings: Partial<HolidaySettings>) => Promise<HolidayTemplateOptions>
  onUpdateHolidaySettings: (body: Record<string, unknown>) => void
  onHolidayOverride: (body: Record<string, unknown>) => void
  onUpdateOverride: (id: string, body: Record<string, unknown>) => void
  onDeleteOverride: (id: string) => void
}) {
  const [date, setDate] = useState(toDateKey(new Date()))
  const [name, setName] = useState('')
  const [type, setType] = useState<HolidayOverrideType>('custom')
  const [freePercent, setFreePercent] = useState('100')
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null)
  const [isEditingHoliday, setIsEditingHoliday] = useState(false)
  const [holidayValidationError, setHolidayValidationError] = useState('')
  const [templateCountry, setTemplateCountry] = useState(state.holidaySettings.country)
  const [templateState, setTemplateState] = useState(state.holidaySettings.state ?? '')
  const [templateRegion, setTemplateRegion] = useState(state.holidaySettings.region ?? '')
  const [templateLanguage, setTemplateLanguage] = useState(state.holidaySettings.language)
  const [templateOptions, setTemplateOptions] = useState(state.holidayTemplateOptions)
  const [templateValidationError, setTemplateValidationError] = useState('')
  const sortedHolidays = useMemo(() => [...state.holidays].sort((left, right) => left.date.localeCompare(right.date)), [state.holidays])

  useEffect(() => {
    setTemplateCountry(state.holidaySettings.country)
    setTemplateState(state.holidaySettings.state ?? '')
    setTemplateRegion(state.holidaySettings.region ?? '')
    setTemplateLanguage(state.holidaySettings.language)
    setTemplateOptions(state.holidayTemplateOptions)
    setTemplateValidationError('')
  }, [state.holidaySettings, state.holidayTemplateOptions])

  useEffect(() => {
    let active = true

    onLoadHolidayTemplateOptions({
      country: templateCountry,
      state: templateState || undefined,
      region: templateRegion || undefined,
      language: templateLanguage,
    })
      .then((options) => {
        if (!active) {
          return
        }
        setTemplateOptions(options)
        if (templateState && !options.states.some((option) => option.code === templateState)) {
          setTemplateState('')
          setTemplateRegion('')
        } else if (templateRegion && !options.regions.some((option) => option.code === templateRegion)) {
          setTemplateRegion('')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setTemplateValidationError(error instanceof Error ? error.message : 'Failed to load holiday templates')
        }
      })

    return () => {
      active = false
    }
  }, [onLoadHolidayTemplateOptions, templateCountry, templateLanguage, templateRegion, templateState])

  function startHolidayEdit(holiday: Holiday) {
    const override = state.holidayOverrides.find((item) => item.id === holiday.id)
    setDate(holiday.date)
    setName(holidayDisplayName(holiday, language))
    setType('custom')
    setFreePercent(numberInputValue(holiday.freePercent))
    setEditingOverrideId(override?.id ?? null)
    setIsEditingHoliday(true)
    setHolidayValidationError('')
  }

  function startOverrideEdit(overrideId: string) {
    const override = state.holidayOverrides.find((item) => item.id === overrideId)
    if (!override) {
      return
    }

    setDate(override.date)
    setName(override.name)
    setType(override.type)
    setFreePercent(numberInputValue(override.freePercent))
    setEditingOverrideId(override.id)
    setIsEditingHoliday(true)
    setHolidayValidationError('')
  }

  function cancelEdit() {
    setDate(toDateKey(new Date()))
    setName('')
    setType('custom')
    setFreePercent('100')
    setEditingOverrideId(null)
    setIsEditingHoliday(false)
    setHolidayValidationError('')
  }

  function submitTemplate(event: FormEvent) {
    event.preventDefault()
    if (!templateCountry) {
      setTemplateValidationError(t.holidayCountry)
      return
    }

    setTemplateValidationError('')
    onUpdateHolidaySettings({
      country: templateCountry,
      state: templateState || undefined,
      region: templateRegion || undefined,
      language: templateLanguage,
    })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedFreePercent = parseDecimalInput(freePercent)
    if (parsedFreePercent === undefined || parsedFreePercent < 0 || parsedFreePercent > 100) {
      setHolidayValidationError(t.numericFieldsRequired)
      return
    }
    const body = { date, name: name || t.manualHoliday, type, freePercent: parsedFreePercent }
    if (editingOverrideId) {
      onUpdateOverride(editingOverrideId, body)
    } else {
      onHolidayOverride(body)
    }
    setName('')
    setFreePercent('100')
    setEditingOverrideId(null)
    setIsEditingHoliday(false)
    setHolidayValidationError('')
  }

  return (
    <section className="panel holiday-admin-panel">
      <div className="panel-title">
        <CalendarDays size={18} />
        <h2>{t.holidayTemplates}</h2>
      </div>
      <form className="holiday-template-form" onSubmit={submitTemplate}>
        <label>
          {t.holidayCountry}
          <select
            value={templateCountry}
            onChange={(event) => {
              setTemplateCountry(event.target.value)
              setTemplateState('')
              setTemplateRegion('')
            }}
          >
            {templateOptions.countries.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.holidayState}
          <select
            value={templateState}
            disabled={templateOptions.states.length === 0}
            onChange={(event) => {
              setTemplateState(event.target.value)
              setTemplateRegion('')
            }}
          >
            <option value="">{t.noHolidayState}</option>
            {templateOptions.states.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.holidayRegion}
          <select
            value={templateRegion}
            disabled={templateOptions.regions.length === 0}
            onChange={(event) => setTemplateRegion(event.target.value)}
          >
            <option value="">{t.noHolidayRegion}</option>
            {templateOptions.regions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.holidayTemplateLanguage}
          <select value={templateLanguage} onChange={(event) => setTemplateLanguage(event.target.value)}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </label>
        <button disabled={loading || !templateCountry} className="primary-button" type="submit">
          <Check size={16} />
          {t.saveHolidayTemplate}
        </button>
        {templateValidationError && <p className="form-error inline-form-error">{templateValidationError}</p>}
        <p className="muted holiday-template-note">{t.manualHolidayHint}</p>
      </form>
      <form className="holiday-form" onSubmit={submit}>
        <label>
          {t.date}
          <input value={date} onChange={(event) => setDate(event.target.value)} type="date" />
        </label>
        <label>
          {t.holidayName}
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          {t.action}
          <select value={type} onChange={(event) => setType(event.target.value as HolidayOverrideType)}>
            <option value="custom">{t.addHoliday}</option>
            <option value="disabled">{t.disableHoliday}</option>
          </select>
        </label>
        <label>
          {t.holidayFreePercent}
          <input
            value={freePercent}
            min={0}
            max={100}
            step={5}
            onChange={(event) => setFreePercent(event.target.value)}
            type="number"
          />
        </label>
        <div className="holiday-form-actions">
          <button disabled={loading} className="primary-button" type="submit">
            <Check size={16} />
            {isEditingHoliday ? t.save : t.apply}
          </button>
          {isEditingHoliday && (
            <button disabled={loading} className="secondary-button" type="button" onClick={cancelEdit}>
              <X size={16} />
              {t.cancelEdit}
            </button>
          )}
        </div>
        {holidayValidationError && <p className="form-error inline-form-error">{holidayValidationError}</p>}
      </form>
      <h3 className="override-list-title">{t.templatePublicHolidays}</h3>
      <div className="holiday-list">
        {sortedHolidays.slice(0, 18).map((holiday) => (
          <button
            key={`${holiday.id}-${holiday.date}`}
            className={classNames('holiday-item', holiday.source === 'custom' && 'custom')}
            title={t.editHoliday}
            type="button"
            onClick={() => startHolidayEdit(holiday)}
          >
            <span>
              {holiday.date} {holidayDisplayLabel(holiday, language)}
            </span>
            <Pencil size={14} />
          </button>
        ))}
      </div>
      <h3 className="override-list-title">{t.manualHolidayChanges}</h3>
      <div className="override-list">
        {state.holidayOverrides.length === 0 && <p className="muted">{t.noHolidayOverrides}</p>}
        {state.holidayOverrides.map((override) => (
          <article key={override.id} className="override-row">
            <span>
              {override.date} {override.name}
              <small>
                {override.type === 'custom' ? t.addHoliday : t.disableHoliday}
                {override.type === 'custom' ? `, ${formatShownNumber(override.freePercent)}%` : ''}
              </small>
            </span>
            <div className="row-actions">
              <button className="icon-button" title={t.editHoliday} type="button" onClick={() => startOverrideEdit(override.id)}>
                <Pencil size={16} />
              </button>
              <button className="icon-button" title={t.removeHolidayChange} type="button" onClick={() => onDeleteOverride(override.id)}>
                <X size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default App
