import { admin, normEmail } from '@/lib/server'
import { backfillMatches, setLike } from '@/lib/matching'
import { mySchool, profileOf, wants } from '@/lib/gate'
import { schoolDomain } from '@/lib/school'

const GRID_SIZE = 10
const MAX_PICKS = 3
const MIN_GRID = 6 // fewer faces than this and the sender would be obvious, so the reveal waits

type P = { id: string; gender: string; hidden: boolean; name: string; interested_in?: string | null; school_domain: string }
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

async function who(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  return { db, user }
}

const cards = async (db: ReturnType<typeof admin>, ids: string[]) => {
  const { data } = await db.from('profiles').select('id,name,age,photo_url').in('id', ids)
  const by = new Map((data || []).map((p: { id: string }) => [p.id, p]))
  return ids.map(id => by.get(id)).filter(Boolean)
}

// GET: the grid for someone with a secret crush waiting. Up to 10 schoolmates of the sender's gender, the sender among them.
// The sender is treated exactly like a decoy: same filters, same fields. The grid is saved and never changes while it is open;
// a crush that arrives later gets its own grid once this one is done. Blocks never change what is shown (they only stop a match).
export async function GET(req: Request) {
  const { db, user } = await who(req)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const email = normEmail(user.email)
  const school = await mySchool(db, email)
  if (!school.live) return Response.json({ grid: null, reason: 'closed' })
  const me = await profileOf(db, user.id)
  if (!me) return Response.json({ grid: null, reason: 'none' })

  const { data: saved } = await db.from('crush_grids').select('*').eq('user_id', user.id).maybeSingle()
  if (saved && !saved.done_at) return Response.json({ grid: await cards(db, saved.ids), max: MAX_PICKS })

  const { data: rows } = await db.from('crushes').select('sender_id').eq('target_email', email).is('revealed_at', null)
  const senderIds = [...new Set((rows || []).map(r => r.sender_id))].filter(id => id !== user.id)
  if (!senderIds.length) return Response.json({ grid: null, reason: 'none' })

  // Senders who are visible at this school. A hidden sender waits, exactly as a decoy who is hidden is left out.
  const { data: sp } = await db.from('profiles').select('id,gender,hidden,name,interested_in,school_domain').in('id', senderIds)
  const senders = (sp || []).filter((p: P) => p.name && !p.hidden && wants(p.interested_in, me.gender) && schoolDomain(p.school_domain) === school.domain)
  if (!senders.length) return Response.json({ grid: null, reason: 'none' })

  const { data: pool } = await db.from('profiles').select('id,gender,hidden,name,interested_in,school_domain')
    .or(`school_domain.eq.${school.domain},school_domain.like.*.${school.domain}`).limit(1000)
  const taken = new Set<string>([user.id, ...senderIds])
  const eligible = (pool || []).filter((p: P) => p.name && !p.hidden && !taken.has(p.id) && wants(p.interested_in, me.gender))

  // Pick the gender group (the one with the most senders first) that can fill a grid.
  const genders = [...new Set(senders.map((s: P) => s.gender))]
    .sort((a, b) => senders.filter((s: P) => s.gender === b).length - senders.filter((s: P) => s.gender === a).length)
  for (const g of genders) {
    const shown = senders.filter((s: P) => s.gender === g).slice(0, MAX_PICKS)
    const decoys = shuffle(eligible.filter((p: P) => p.gender === g)).slice(0, GRID_SIZE - shown.length).map((p: P) => p.id)
    const ids = shuffle([...shown.map((s: P) => s.id), ...decoys])
    if (ids.length < MIN_GRID) continue
    const row = { user_id: user.id, ids, sender_ids: shown.map((s: P) => s.id), created_at: new Date().toISOString(), done_at: null }
    if (!saved) await db.from('crush_grids').upsert(row, { onConflict: 'user_id', ignoreDuplicates: true })
    else await db.from('crush_grids').update(row).eq('user_id', user.id)
    // Read back, so two requests at the same moment still end up showing the same faces.
    const { data: now } = await db.from('crush_grids').select('ids').eq('user_id', user.id).maybeSingle()
    return Response.json({ grid: await cards(db, now?.ids || ids), max: MAX_PICKS })
  }
  return Response.json({ grid: null, reason: 'waiting' })
}

// POST { picks: [ids] }: up to 3 taps. A match happens only if the sender is among them. Other taps, and passing, change nothing.
export async function POST(req: Request) {
  const { db, user } = await who(req)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  if (!(await profileOf(db, user.id))) return Response.json({ error: 'Finish joining first.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const picks: string[] = [...new Set((Array.isArray(body.picks) ? body.picks : []).map(String))] as string[]
  const { data: g } = await db.from('crush_grids').select('*').eq('user_id', user.id).maybeSingle()
  if (!g || g.done_at) return Response.json({ error: 'Nothing to pick from right now.' }, { status: 409 })
  if (picks.length > MAX_PICKS) return Response.json({ error: `Pick up to ${MAX_PICKS}.` }, { status: 400 })
  if (picks.some(id => !g.ids.includes(id))) return Response.json({ error: 'Those people were not in your grid.' }, { status: 400 })

  // Claim the grid first, so two taps at once cannot both go through.
  const now = new Date().toISOString()
  const { data: claimed } = await db.from('crush_grids').update({ done_at: now }).eq('user_id', user.id).is('done_at', null).select('user_id')
  if (!claimed?.length) return Response.json({ error: 'Nothing to pick from right now.' }, { status: 409 })

  const senders: string[] = g.sender_ids
  const pickedSenders = senders.filter(s => picks.includes(s))
  for (const s of pickedSenders) { await setLike(db, s, user.id); await setLike(db, user.id, s) } // their crush was their like; your tap is yours
  await db.from('crushes').update({ revealed_at: now }).eq('target_email', normEmail(user.email)).in('sender_id', senders).is('revealed_at', null)
  await backfillMatches(db, user.id)

  const matches: { id: string; name: string; photo_url: string | null; crush: string | null }[] = []
  for (const s of pickedSenders) {
    const pair = `and(user1_id.eq.${user.id},user2_id.eq.${s}),and(user1_id.eq.${s},user2_id.eq.${user.id})`
    const { data: m } = await db.from('matches').select('id').or(pair).limit(1)
    if (!m?.length) continue // blocked, so no match
    await db.from('matches').update({ crush_sender: s }).or(pair).is('crush_sender', null)
    const { data: p } = await db.from('profiles').select('name,photo_url').eq('id', s).maybeSingle()
    matches.push({ id: m[0].id, name: p?.name || 'Match', photo_url: p?.photo_url || null, crush: 'theirs' })
  }
  return Response.json({ ok: true, matches })
}
