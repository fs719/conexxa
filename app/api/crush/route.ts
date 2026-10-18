import { admin, isEdu, normEmail, sendCrushEmail } from '@/lib/server'
import { setLike, backfillMatches, crushRoles } from '@/lib/matching'

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
    const email = normEmail(user.email)
    const { data: rows } = await db.from('crushes').select('sender_id').eq('target_email', email)
    const { data: bl } = await db.from('blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
    const hidden = new Set((bl || []).map(b => (b.blocker_id === user.id ? b.blocked_id : b.blocker_id)))
    const ids = [...new Set((rows || []).map(r => r.sender_id))].filter(id => id !== user.id && !hidden.has(id))
    // A crush is a stored like: make it real so a like back creates the match.
    for (const id of ids) await setLike(db, id, user.id)
    await backfillMatches(db, user.id)
    return Response.json({ ids })
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

  const { data: mine } = await db.from('crushes').select('target_email,created_at').eq('sender_id', user.id)
  if (recent(mine as any) >= MAX_CRUSHES) return Response.json({ error: `You can send ${MAX_CRUSHES} secret crushes a week. Come back soon.` }, { status: 400 })
  if ((mine || []).some(c => c.target_email === email)) return Response.json({ error: 'You already added them.' }, { status: 400 })

  const { data: target } = await db.from('profiles').select('id').eq('edu_email', email).maybeSingle()
  let emailed = false
  if (!target) {
    const { data: opted } = await db.from('crush_optout').select('email').eq('email', email).maybeSingle()
    const { data: prior } = await db.from('crushes').select('id').eq('target_email', email).eq('emailed', true).limit(1)
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()
    const { count } = await db.from('crushes').select('id', { count: 'exact', head: true }).eq('emailed', true).gte('created_at', since)
    if (!opted && !prior?.length && (count || 0) < DAILY_EMAIL_CAP) {
      try { await sendCrushEmail(email); emailed = true } catch {}
    }
  }

  const { error } = await db.from('crushes').insert({ sender_id: user.id, target_email: email, emailed })
  if (error) return Response.json({ error: 'Could not save. Try again.' }, { status: 500 })

  if (target && target.id !== user.id) {
    // They already have an account: store the like now. A like back makes the match.
    await setLike(db, user.id, target.id)
    await backfillMatches(db, user.id)
  }
  return Response.json({ ok: true })
}
