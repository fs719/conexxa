import { timingSafeEqual } from 'crypto'
import { admin, finishToken, hashCode, isEdu, normEmail } from '@/lib/server'
import { schoolDomain } from '@/lib/school'
import { schoolStatus } from '@/lib/gate'
import { openIfReady } from '@/lib/launch'

const bad = (error: string, status = 400) => Response.json({ error }, { status })
const GENDERS = ['Male', 'Female', 'Non-Binary', 'Prefer Not to Say']

// Step 2 of joining: the emailed code is checked, then the person goes on the list. No password, no account yet.
export const maxDuration = 300 // launch emails go out after the response and can take a while

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normEmail(body.email)
  const code = String(body.code || '').trim()
  const name = String(body.name || '').trim().slice(0, 30)
  const gender = String(body.gender || '')
  if (!isEdu(email) || !email.endsWith('.edu')) return bad('Please use your school (.edu) email.')
  if (email.split('@')[0].includes('+')) return bad('Please use your regular school email, without a + in it.')
  if (!name) return bad('Please enter your first name.')
  if (!GENDERS.includes(gender)) return bad('Please pick one of the options.')
  if (body.adult !== true) return bad('You must be 18 or older to join.')

  const db = admin()
  const { data: row } = await db.from('email_codes').select('*').eq('email', email).eq('purpose', 'waitlist').maybeSingle()
  if (!row || new Date(row.expires_at) < new Date()) return bad('Code expired. Request a new one.')
  if (row.attempts >= 5) {
    await db.from('email_codes').delete().eq('email', email).eq('purpose', 'waitlist')
    return bad('Too many attempts. Request a new code.')
  }
  // Count this guess first, and only one of several simultaneous guesses can claim each attempt number.
  const { data: claimed } = await db.from('email_codes').update({ attempts: row.attempts + 1 })
    .eq('email', email).eq('purpose', 'waitlist').eq('attempts', row.attempts).select('attempts')
  if (!claimed?.length) return bad('Too many tries at once. Wait a moment and try again.', 429)
  const a = Buffer.from(hashCode(code, email, 'waitlist')), b = Buffer.from(row.code_hash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return bad('Invalid code. Please try again.')
  await db.from('email_codes').delete().eq('email', email).eq('purpose', 'waitlist')

  const domain = schoolDomain(email)
  await db.from('schools').upsert({ domain }, { onConflict: 'domain', ignoreDuplicates: true })

  const { data: existing } = await db.from('waitlist').select('has_account,removed').eq('email', email).maybeSingle()
  if (existing?.has_account) {
    const st = await schoolStatus(db, domain)
    return Response.json({ ok: true, hasAccount: true, school: st })
  }
  const { error } = await db.from('waitlist').upsert(
    { email, school_domain: domain, first_name: name, gender, removed: false, ...(existing?.removed ? { launch_emailed_at: null } : {}) },
    { onConflict: 'email' },
  )
  if (error) return bad('Could not save. Try again.', 500)

  await openIfReady(db, domain)
  const st = await schoolStatus(db, domain)
  // Joined after the school was already open: they go straight to the finish screen, so no launch email is owed.
  if (st.live) await db.from('waitlist').update({ launch_emailed_at: new Date().toISOString() }).eq('email', email).is('launch_emailed_at', null)
  // If the school is already open, the person goes straight to the finish screen.
  return Response.json({ ok: true, school: st, ...(st.live ? { finish: finishToken(email) } : {}) })
}
