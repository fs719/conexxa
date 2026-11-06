// Diagnostic: does the CI copy of the service key sign links the same way the live site does? Prints results only, never the key.
import { createHmac } from 'node:crypto'
const raw = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
console.log('key length', raw.length, 'has whitespace at ends', raw !== raw.trim())
const email = 'keycheck@e2e-wait.edu'
const variants = { raw, trimmed: raw.trim(), newline: raw.trim() + '\n', space: raw.trim() + ' ' }
for (const [name, k] of Object.entries(variants)) {
  const t = createHmac('sha256', k).update(`remove|${email}`).digest('hex').slice(0, 32)
  const r = await fetch(`https://conexxa.net/api/waitlist/remove?e=${encodeURIComponent(email)}&t=${t}`)
  const body = await r.text()
  console.log(name, r.status, body.includes('Remove me') ? 'LINK ACCEPTED' : 'link refused')
}
