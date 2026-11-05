import { randomInt } from 'crypto'
import { admin, findUserId, hashCode, isEdu, normEmail, sendCodeEmail } from '@/lib/server'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normEmail(body.email)
  const purpose = body.purpose === 'reset' ? 'reset' : body.purpose === 'waitlist' ? 'waitlist' : 'signup'
  if (!isEdu(email) || (purpose === 'waitlist' && !email.endsWith('.edu'))) return Response.json({ error: 'Please use your school (.edu) email.' }, { status: 400 })
  if (purpose === 'waitlist' && email.split('@')[0].includes('+')) return Response.json({ error: 'Please use your regular school email, without a + in it.' }, { status: 400 })

  const db = admin()
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db.from('email_codes').select('*', { count: 'exact', head: true }).gte('created_at', since)
  if ((count ?? 0) > 150)
    return Response.json({ error: 'We are very busy right now. Please try again in a bit.' }, { status: 429 })

  const { data: existing } = await db
    .from('email_codes').select('created_at').eq('email', email).eq('purpose', purpose).maybeSingle()
  if (existing && Date.now() - new Date(existing.created_at).getTime() < 45_000)
    return Response.json({ error: 'Please wait a few seconds before requesting another code.' }, { status: 429 })

  if (purpose === 'reset') {
    if (!(await findUserId(email))) return Response.json({ ok: true }) // don't reveal which emails exist
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await db.from('email_codes').upsert({
    email, purpose,
    code_hash: hashCode(code, email, purpose),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
  })
  try {
    await sendCodeEmail(email, code, purpose)
  } catch (e) {
    console.error(e)
    return Response.json({ error: 'Could not send the email. Try again shortly.' }, { status: 502 })
  }
  return Response.json({ ok: true })
}
