import { timingSafeEqual } from 'crypto'
import { admin, hashCode, normEmail } from '@/lib/server'

const bad = (error: string, status = 400) => Response.json({ error }, { status })

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normEmail(body.email)
  const purpose = body.purpose === 'reset' ? 'reset' : 'signup'
  const code = String(body.code || '').trim()
  const password = String(body.password || '')
  if (password.length < 6) return bad('Password must be at least 6 characters.')

  const db = admin()
  const { data: row } = await db
    .from('email_codes').select('*').eq('email', email).eq('purpose', purpose).maybeSingle()
  if (!row || new Date(row.expires_at) < new Date()) return bad('Code expired. Request a new one.')
  if (row.attempts >= 5) {
    await db.from('email_codes').delete().eq('email', email).eq('purpose', purpose)
    return bad('Too many attempts. Request a new code.')
  }

  const a = Buffer.from(hashCode(code, email, purpose))
  const b = Buffer.from(row.code_hash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.from('email_codes').update({ attempts: row.attempts + 1 }).eq('email', email).eq('purpose', purpose)
    return bad('Invalid code. Please try again.')
  }
  await db.from('email_codes').delete().eq('email', email).eq('purpose', purpose)

  if (purpose === 'signup') {
    const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) return bad(/already|registered|exists/i.test(error.message)
      ? 'An account with this email already exists. Log in instead.' : error.message)
  } else {
    const { data: p } = await db.from('profiles').select('id').eq('edu_email', email).maybeSingle()
    if (!p) return bad('Account not found.')
    const { error } = await db.auth.admin.updateUserById(p.id, { password })
    if (error) return bad(error.message)
  }
  return Response.json({ ok: true })
}
