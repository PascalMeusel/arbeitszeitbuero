import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function readArg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const outDir = readArg('--out-dir')
const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

if (outDir) {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'license-public.pem'), publicKey)
  writeFileSync(join(outDir, 'license-private.pem'), privateKey, { mode: 0o600 })
  console.log(`Wrote ${join(outDir, 'license-public.pem')}`)
  console.log(`Wrote ${join(outDir, 'license-private.pem')}`)
} else {
  console.log('LICENSE_PUBLIC_KEY=')
  console.log(publicKey)
  console.log('LICENSE_PRIVATE_KEY=')
  console.log(privateKey)
}
