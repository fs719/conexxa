import { admin, findUserId, normEmail, tokenOk } from '@/lib/server'
import { schoolDomain } from '@/lib/school'
import { isLive } from '@/lib/gate'

const bad = (error: string, status = 400) => Response.json({ error }, { status })
const WANTS = ['Male', 'Female', 'everyone']

const ageOn = (birthdate: string) => {
  const b = new Date(birthdate + 'T00:00:00Z')
  if (isNaN(b.getTime())) return -1
  const n = new Date()
  let a = n.getUTCFullYear() - b.getUTCFullYear()
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--
  return a
}

// GET: what the finish screen needs (first name, school) if the link is good.
export async function GET(req: Request) {
  const u = new URL(req.url)
  const email = normEmail(u.searchParams.get('e'))
  if (!email || !tokenOk('finish', email, u.searchParams.get('t'))) return bad('This link is not valid.', 403)
  const db = admin()
  const { data: w } = await db.from('waitlist').select('first_name,has_account,removed,school_domain').eq('email', email).maybeSingle()
  if (!w) return bad('We could not find you on the list.', 404)
  if (w.removed) return bad('You took yourself off the list. Join again to continue.', 410)
  return Response.json({ name: w.first_name, hasAccount: w.has_account, live: await isLive(db, w.school_domain) })
}

// POST: the one finish screen. Creates the account and the profile. The photo is added afterwards by the signed-in browser.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normEmail(body.email)
  if (!email || !tokenOk('finish', email, body.token)) return bad('This link is not valid.', 403)
  const password = String(body.password || '')
  const interested = String(body.interested_in || '')
  const age = ageOn(String(body.birthdate || ''))
  if (password.length < 6) return bad('Password must be at least 6 characters.')
  if (!WANTS.includes(interested)) return bad('Please choose who you want to see.')
  if (age < 18) return bad('You must be 18 or older to use Conexxa.')
  if (body.agreed !== true) return bad('Please agree to the Terms of Use and Privacy Policy.')

  const db = admin()
  const { data: w } = await db.from('waitlist').select('first_name,gender,has_account,removed,school_domain').eq('email', email).maybeSingle()
  if (!w) return bad('We could not find you on the list.', 404)
  if (w.removed) return bad('You took yourself off the list. Join again to continue.', 410)
  if (w.has_account) return bad('You already have an account. Log in instead.', 409)
  if (schoolDomain(email) !== w.school_domain || !(await isLive(db, w.school_domain)))
    return bad('Your school is not open yet. We will email you the moment it is.', 403)

  // Someone who signed up under the old flow may already have a login with no profile. Adopt it instead of refusing.
  let uid: string | null = null, madeNow = false
  const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (created?.user) { uid = created.user.id; madeNow = true }
  else if (/already|registered|exists/i.test(error?.message || '')) {
    const old = await findUserId(email)
    const { data: has } = old ? await db.from('profiles').select('id').eq('id', old).maybeSingle() : { data: null }
    if (!old || has) return bad('An account with this email already exists. Log in instead.', 409)
    const { error: ue } = await db.auth.admin.updateUserById(old, { password })
    if (ue) return bad(ue.message, 500)
    uid = old
  } else return bad(error?.message || 'Could not create your account.', 500)
  const { error: pe } = await db.from('profiles').insert({
    id: uid, name: w.first_name, gender: w.gender, interested_in: interested,
    intent: 'serious', age, edu_email: email,
  })
  if (pe) {
    if (madeNow) await db.auth.admin.deleteUser(uid!)
    return bad('Could not save your profile. Try again.', 500)
  }
  await db.from('waitlist').update({ has_account: true }).eq('email', email)
  return Response.json({ ok: true })
}
