import { admin, normEmail } from '@/lib/server'
import { backfillMatches, crushRoles, setLike, setSkip } from '@/lib/matching'
import { mySchool } from '@/lib/gate'
import { schoolDomain } from '@/lib/school'

const GRID_SIZE = 10
const MAX_PICKS = 3
const MIN_GRID = 6 // fewer faces than this and the sender would be obvious, so the reveal waits

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
// The grid is saved: refreshing shows the same faces, and a new crush swaps one decoy for the new sender instead of reshuffling.
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

  const { data: sp } = await db.from('profiles').select('id,gender,school_domain').in('id', senderIds)
  const senders = (sp || []).filter((p: { school_domain: string }) => schoolDomain(p.school_domain) === school.domain)
  if (!senders.length) return Response.json({ grid: null, reason: 'none' })

  const { data: saved } = await db.from('crush_grids').select('*').eq('user_id', user.id).maybeSingle()
  const open = saved && !saved.done_at ? saved : null

  if (open) {
    // Same grid. If a new sender of the same gender has arrived, they replace one decoy; nothing else moves.
    const fresh = senders.filter((s: { id: string }) => !open.sender_ids.includes(s.id))
    if (fresh.length && open.sender_ids.length < MAX_PICKS) {
      const add = fresh.filter((s: { gender: string }) => s.gender === (senders.find((x: { id: string }) => open.sender_ids.includes(x.id)) || fresh[0]).gender).slice(0, MAX_PICKS - open.sender_ids.length)
      const decoys = shuffle((open.ids as string[]).filter(id => !open.sender_ids.includes(id)))
      if (add.length && decoys.length >= add.length) {
        const drop = new Set(decoys.slice(0, add.length))
        const ids = shuffle([...(open.ids as string[]).filter(id => !drop.has(id)), ...add.map((a: { id: string }) => a.id)])
        await db.from('crush_grids').update({ ids, sender_ids: [...open.sender_ids, ...add.map((a: { id: string }) => a.id)] }).eq('user_id', user.id)
        return Response.json({ grid: await cards(db, ids), max: MAX_PICKS })
      }
    }
    return Response.json({ grid: await cards(db, open.ids), max: MAX_PICKS })
  }

  // A new grid. Decoys are only ever the sender's gender, so nobody stands out. If there are not enough, the reveal waits.
  const gender = senders[0].gender
  const shown = senders.filter((s: { gender: string }) => s.gender === gender).slice(0, MAX_PICKS)
  const { data: pool } = await db.from('profiles').select('id,gender,hidden,school_domain,name')
    .or(`school_domain.eq.${school.domain},school_domain.like.*.${school.domain}`).limit(1000)
  const taken = new Set<string>([user.id, ...senderIds, ...blocked])
  const decoys = shuffle((pool || []).filter((p: { id: string; gender: string; hidden: boolean; name: string }) => p.name && p.gender === gender && !p.hidden && !taken.has(p.id)))
    .slice(0, GRID_SIZE - shown.length).map((p: { id: string }) => p.id)
  const ids = shuffle([...shown.map((s: { id: string }) => s.id), ...decoys])
  if (ids.length < MIN_GRID) return Response.json({ grid: null, reason: 'waiting' })

  const row = { user_id: user.id, ids, sender_ids: shown.map((s: { id: string }) => s.id), created_at: new Date().toISOString(), done_at: null }
  if (!saved) await db.from('crush_grids').upsert(row, { onConflict: 'user_id', ignoreDuplicates: true })
  else await db.from('crush_grids').update(row).eq('user_id', user.id)
  // Read back, so two requests at the same moment still end up showing the same faces.
  const { data: now } = await db.from('crush_grids').select('ids').eq('user_id', user.id).maybeSingle()
  return Response.json({ grid: await cards(db, now?.ids || ids), max: MAX_PICKS })
}

// POST { picks: [ids] }: up to 3 taps. A match happens only if the sender is among them. Other taps change nothing.
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
    if (picks.includes(s)) { await setLike(db, s, user.id); await setLike(db, user.id, s) } // the crush was their like; the tap is yours
    else await setSkip(db, user.id, s) // passed: they will not show up in Discover either
  }
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
