import nodemailer from 'nodemailer'
import type { Database, StoredUser } from './store.ts'
import { adminUsers, nowIso } from './store.ts'
import { randomUUID } from 'node:crypto'

interface ResolvedSmtpSettings {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

function smtpSettings(database: Database): ResolvedSmtpSettings | undefined {
  const saved = database.mailServerSettings
  if (saved?.host && saved.fromAddress) {
    return {
      host: saved.host,
      port: saved.port,
      secure: saved.secure,
      user: saved.user,
      pass: saved.password,
      from: saved.fromAddress,
    }
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    return undefined
  }

  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM,
  }
}

async function smtpTransport(settings: ResolvedSmtpSettings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.user
      ? {
          user: settings.user,
          pass: settings.pass,
        }
      : undefined,
  })
}

export function mailServerConfigured(database: Database) {
  return Boolean(smtpSettings(database))
}

export async function sendEmail(database: Database, recipients: Array<Pick<StoredUser, 'email'>>, subject: string, text: string) {
  const recipientEmails = [...new Set(recipients.map((user) => user.email).filter(Boolean))]
  if (recipientEmails.length === 0) {
    return
  }

  const settings = smtpSettings(database)
  const outboxItem = {
    id: randomUUID(),
    to: recipientEmails,
    subject,
    text,
    status: settings ? 'queued' : 'console',
    createdAt: nowIso(),
  } as const

  database.emailOutbox.unshift(outboxItem)

  if (!settings) {
    console.info(`[mail:fallback] ${subject}\nTo: ${recipientEmails.join(', ')}\n${text}`)
    return
  }

  const transport = await smtpTransport(settings)
  await transport.sendMail({
    from: settings.from,
    to: recipientEmails,
    subject,
    text,
  })

  const stored = database.emailOutbox.find((item) => item.id === outboxItem.id)
  if (stored) {
    stored.status = 'sent'
  }
}

export async function sendAdminEmail(database: Database, subject: string, text: string) {
  await sendEmail(database, adminUsers(database), subject, text)
}
