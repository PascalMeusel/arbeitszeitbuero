import { randomUUID, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'

function readArg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }

  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
    .join(',')}}`
}

function requiredArg(name) {
  const value = readArg(name)
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

const privateKeyPath = readArg('--private-key')
const privateKey = privateKeyPath ? readFileSync(privateKeyPath, 'utf8') : process.env.LICENSE_PRIVATE_KEY?.replace(/\\n/g, '\n')
if (!privateKey) {
  throw new Error('Provide --private-key path or LICENSE_PRIVATE_KEY.')
}

const plan = readArg('--plan') ?? 'paid'
if (plan !== 'paid' && plan !== 'free_grant') {
  throw new Error('--plan must be paid or free_grant')
}

const activeUserLimit = Number(requiredArg('--limit'))
if (!Number.isInteger(activeUserLimit) || activeUserLimit < 1) {
  throw new Error('--limit must be a positive integer')
}

const payload = {
  version: 1,
  licenseId: readArg('--id') ?? randomUUID(),
  holderName: requiredArg('--holder'),
  contactEmail: requiredArg('--email'),
  plan,
  activeUserLimit,
  issuedAt: readArg('--issued-at') ?? new Date().toISOString(),
}

const validUntil = readArg('--valid-until')
if (validUntil) {
  payload.validUntil = validUntil
}

const notes = readArg('--notes')
if (notes) {
  payload.notes = notes
}

const signature = sign(null, Buffer.from(canonicalJson(payload), 'utf8'), privateKey).toString('base64url')
const envelope = { payload, signature }
const licenseKey = `NRWTT-${Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url')}`

console.log(JSON.stringify({ licenseKey, payload }, null, 2))
