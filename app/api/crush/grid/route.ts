import { admin, normEmail } from '@/lib/server'
import { backfillMatches, crushRoles, setLike } from '@/lib/matching'
import { mySchool } from '@/lib/gate'
import { schoolDomain } from '@/lib/school'

const GRID_SIZE = 10
const MAX_PICKS = 3
const MIN_GRID = 6 // fewer faces than this and the one who sent it would be obvious, so the reveal waits

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

async function who(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  return { db, user }
}

const cards = async (db: ReturnType<typeof admin>, ids: string[]) => {
  const { data } = await db.from('profiles').select('id,name,age,photo_url').in('id', ids)
  const by = new Map((data || []).map((p: any) => [p.id, p]))
  return ids.map(id => by.get(id)).filter(Boolean)
}

// GET: the grid for someone with a secret crush waiting. Up to 10 schoolmates, the sender among them. Same grid on every refresh.
export async function GET(req: Request) {
  const { db, user } = await who(req)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const email = normEmail(user.email)
  const school = await mySchool(db, email)
  if (!school.live) return Response.json({ grid: null, reason: 'closed' })

  const { data: rows } = await db.from('crushes').select('sender_id').eq('target_email', email).is('revealed_at', null)
  const { data: bl } = await db.from('blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
  const blocked = new Set((bl || []).map(b => (b.blocker_id === user.id ? b.blocked_id : b.blocker_id)))
  const senderIds = [...new Set((rows || []).map(r => r.sender_id))].filter(id => id !== user.id && !blocked.has(id))
  if (!senderIds.length) return Response.json({ grid: null, reason: 'none' })

  // Senders who still have a visible profile at this school.
  const { data: sp } = await db.from('profiles').select('id,gender,hidden,school_domain').in('id', senderIds)
  const senders = (sp || []).filter((p: any) => !p.hidden && schoolDomain(p.school_domain) === school.domain)
  if (!senders.length) return Response.json({ grid: null, reason: 'none' })

  const { data: saved } = await db.from('crush_grids').select('*').eq('user_id', user.id).maybeSingle()
  const sameSenders = saved && !saved.done_at && saved.sender_ids.length === senders.length && senders.every((s: any) => saved.sender_ids.includes(s.id))
  if (sameSenders) return Response.json({ grid: await cards(db, saved.ids), max: MAX_PICKS })

  // Fillers are the same gender as the sender, so nobody stands out as the odd one in the grid.
  const sendersShown = senders.slice(0, MAX_PICKS)
  const gender = sendersShown[0].gender
  const { data: pool } = await db.from('profiles').select('id,gender,hidden,school_domain,name')
    .or(`school_domain.eq.${school.domain},school_domain.like.%.${school.domain}`).limit(5000)
  const taken = new Set<string>([user.id, ...senderIds, ...blocked])
  const open = (pool || []).filter((p: any) => p.name && !p.hidden && !taken.has(p.id))
  const same = shuffle(open.filter((p: any) => p.gender === gender))
  const other = shuffle(open.filter((p: any) => p.gender !== gender))
  const fillers = [...same, ...other].slice(0, GRID_SIZE - sendersShown.length).map((p: any) => p.id)
  const ids = shuffle([...sendersShown.map((s: any) => s.id), ...fillers])
  if (ids.length < MIN_GRID) return Response.json({ grid: null, reason: 'waiting' })

  await db.from('crush_grids').upsert({ user_id: user.id, ids, sender_ids: sendersShown.map((s: any) => s.id), created_at: new Date().toISOString(), done_at: null })
  return Response.json({ grid: await cards(db, ids), max: MAX_PICKS })
}

// POST { picks: [ids] }: up to 3 taps. A match happens only if you tapped the sender.
export async function POST(req: Request) {
  const { db, user } = await who(req)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const picks: string[] = [...new Set((Array.isArray(body.picks) ? body.picks : []).map(String))] as string[]
  const { data: g } = await db.from('crush_grids').select('*').eq('user_id', user.id).maybeSingle()
  if (!g || g.done_at) return Response.json({ error: 'Nothing to pick from right now.' }, { status: 409 })
  if (picks.length > MAX_PICKS) return Response.json({ error: `Pick up to ${MAX_PICKS}.` }, { status: 400 })
  if (picks.some(id => !g.ids.includes(id))) return Response.json({ error: 'Those people were not in your grid.' }, { status: 400 })

  const senders: string[] = g.sender_ids
  for (const s of senders) {
    if (picks.includes(s)) await setLike(db, s, user.id) // the crush itself is their like
    else await db.from('swipes').upsert({ swiper_id: user.id, swiped_id: s, direction: 'skip' }, { onConflict: 'swiper_id,swiped_id' })
  }
  for (const id of picks) await setLike(db, user.id, id)
  const now = new Date().toISOString()
  await db.from('crushes').update({ revealed_at: now }).eq('target_email', normEmail(user.email)).in('sender_id', senders).is('revealed_at', null)
  await db.from('crush_grids').update({ done_at: now }).eq('user_id', user.id)
  await backfillMatches(db, user.id)

  const pickedSenders = senders.filter(s => picks.includes(s))
  const matches: { id: string; name: string; photo_url: string | null; crush: string | null }[] = []
  if (pickedSenders.length) {
    const roles = await crushRoles(db, user.id, normEmail(user.email), pickedSenders)
    for (const s of pickedSenders) {
      const { data: m } = await db.from('matches').select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${s}),and(user1_id.eq.${s},user2_id.eq.${user.id})`).limit(1)
      if (!m?.length) continue
      const { data: p } = await db.from('profiles').select('name,photo_url').eq('id', s).maybeSingle()
      matches.push({ id: m[0].id, name: p?.name || 'Match', photo_url: p?.photo_url || null, crush: roles[s] || 'theirs' })
    }
  }
  return Response.json({ ok: true, matches })
}
