import { admin, isEdu, normEmail, sendCrushEmail } from '@/lib/server'
import { crushRoles } from '@/lib/matching'
import { mySchool, profileOf } from '@/lib/gate'
import { schoolDomain } from '@/lib/school'

const MAX_CRUSHES = 3
const WEEK_MS = 7 * 86400_000
const recent = (rows: { created_at: string }[] | null) => (rows || []).filter(r => Date.now() - new Date(r.created_at).getTime() < WEEK_MS).length
const DAILY_EMAIL_CAP = 40

async function who(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user }, error } = await db.auth.getUser(token)
  return { db, user, why: error?.message }
}

// GET: your sent crushes with status.  GET ?inbox=1: people who put your email in (ids only, you never learn which crush is whose).
export async function GET(req: Request) {
  const { db, user } = await who(req)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const inbox = new URL(req.url).searchParams.get('inbox')

  if (new URL(req.url).searchParams.get('matches')) {
    const { data: ms } = await db.from('matches').select('user1_id,user2_id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    const others = [...new Set((ms || []).map((m: any) => (m.user1_id === user.id ? m.user2_id : m.user1_id)))]
    return Response.json({ roles: await crushRoles(db, user.id, normEmail(user.email), others) })
  }

  if (inbox) {
    // Only whether something is waiting. Who sent it is never sent to the browser; the grid is the only way to find out.
    const { count } = await db.from('crushes').select('id', { count: 'exact', head: true }).eq('target_email', normEmail(user.email)).is('revealed_at', null)
    return Response.json({ waiting: (count ?? 0) > 0 })
  }

  const { data: mine } = await db.from('crushes').select('id,target_email,created_at').eq('sender_id', user.id).order('created_at', { ascending: false })
  const out = []
  for (const c of mine || []) {
    const { data: p } = await db.from('profiles').select('id').eq('edu_email', c.target_email).maybeSingle()
    let status: 'sent' | 'matched' = 'sent'
    if (p) {
      const { data: m } = await db.from('matches').select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${p.id}),and(user1_id.eq.${p.id},user2_id.eq.${user.id})`).limit(1)
      if (m?.length) status = 'matched'
    }
    out.push({ id: c.id, email: c.target_email, status })
  }
  return Response.json({ crushes: out, left: Math.max(0, MAX_CRUSHES - recent(mine)) })
}

export async function POST(req: Request) {
  const { db, user } = await who(req)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const email = normEmail(body.email)

  if (!isEdu(email)) return Response.json({ error: 'Use their college email (ends in .edu).' }, { status: 400 })
  if (email === normEmail(user.email)) return Response.json({ error: "That's your own email." }, { status: 400 })
  if (!(await profileOf(db, user.id))) return Response.json({ error: 'Finish joining first.' }, { status: 403 })
  const school = await mySchool(db, user.email)
  if (!school.live) return Response.json({ error: 'Your school opens when enough students have joined.' }, { status: 403 })
  if (schoolDomain(email) !== school.domain) return Response.json({ error: 'Use a classmate\'s email from your own school.' }, { status: 400 })

  const { data: mine } = await db.from('crushes').select('target_email,created_at').eq('sender_id', user.id)
  if (recent(mine as any) >= MAX_CRUSHES) return Response.json({ error: `You can send ${MAX_CRUSHES} secret crushes a week. Come back soon.` }, { status: 400 })
  if ((mine || []).some(c => c.target_email === email)) return Response.json({ error: 'You already added them.' }, { status: 400 })

  // Save the crush first (the unique row stops a double send), then check the weekly cap again so parallel requests cannot beat it.
  const { data: row, error } = await db.from('crushes').insert({ sender_id: user.id, target_email: email, emailed: false }).select('id').single()
  if (error || !row) return Response.json({ error: 'You already added them.' }, { status: 400 })
  const { data: after } = await db.from('crushes').select('created_at').eq('sender_id', user.id)
  if (recent(after as any) > MAX_CRUSHES) {
    await db.from('crushes').delete().eq('id', row.id)
    return Response.json({ error: `You can send ${MAX_CRUSHES} secret crushes a week. Come back soon.` }, { status: 400 })
  }

  // The crush is only a row. It becomes a like only if the person it points at picks the sender on the grid.
  const { data: target } = await db.from('profiles').select('id').eq('edu_email', email).maybeSingle()
  if (!target) {
    const { data: opted } = await db.from('crush_optout').select('email').eq('email', email).maybeSingle()
    const { data: off } = await db.from('waitlist').select('removed').eq('email', email).eq('removed', true).maybeSingle()
    const { data: prior } = await db.from('crushes').select('id').eq('target_email', email).eq('emailed', true).limit(1)
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()
    const { count } = await db.from('crushes').select('id', { count: 'exact', head: true }).eq('emailed', true).gte('created_at', since)
    if (!opted && !off && !prior?.length && (count || 0) < DAILY_EMAIL_CAP) {
      try { await sendCrushEmail(email); await db.from('crushes').update({ emailed: true }).eq('id', row.id) } catch {}
    }
  }
  return Response.json({ ok: true })
}
