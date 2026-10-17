import { admin } from '@/lib/server'
import { CASUAL, SERIOUS } from '@/lib/icebreakers'
import { backfillMatches } from '@/lib/matching'

// Records a swipe and, on a mutual like, creates the match. Runs with the service
// role so it can see the other person's swipe (row-level security hides it from the client).
export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const swipedId = String(body.swipedId || '')
  const direction = body.direction === 'like' ? 'like' : 'skip'
  if (!swipedId || swipedId === user.id) return Response.json({ error: 'Bad request.' }, { status: 400 })

  const { error: swipeErr } = await db.from('swipes').upsert(
    { swiper_id: user.id, swiped_id: swipedId, direction },
    { onConflict: 'swiper_id,swiped_id' },
  )
  if (swipeErr) {
    const { error: insErr } = await db.from('swipes').insert({ swiper_id: user.id, swiped_id: swipedId, direction })
    if (insErr && !/duplicate|unique/i.test(insErr.message)) return Response.json({ error: insErr.message }, { status: 500 })
  }
  if (direction !== 'like') return Response.json({ matched: false })

  const { data: theirs } = await db.from('swipes').select('id').eq('swiper_id', swipedId).eq('swiped_id', user.id).eq('direction', 'like').limit(1)
  if (!theirs?.length) return Response.json({ matched: false })
  const { data: blk } = await db.from('blocks').select('blocker_id')
    .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${swipedId}),and(blocker_id.eq.${swipedId},blocked_id.eq.${user.id})`).limit(1)
  if (blk?.length) return Response.json({ matched: false })

  const { data: existing } = await db.from('matches').select('id')
    .or(`and(user1_id.eq.${user.id},user2_id.eq.${swipedId}),and(user1_id.eq.${swipedId},user2_id.eq.${user.id})`).limit(1)
  if (existing?.length) return Response.json({ matched: true, id: existing[0].id })

  const { data: me } = await db.from('profiles').select('intent').eq('id', user.id).maybeSingle()
  const pool = me?.intent === 'serious' ? SERIOUS : CASUAL
  const { data: created, error: mErr } = await db.from('matches').insert({
    user1_id: user.id,
    user2_id: swipedId,
    icebreaker_prompt: pool[Math.floor(Math.random() * pool.length)].q,
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  }).select('id').single()
  if (mErr) return Response.json({ error: mErr.message }, { status: 500 })
  return Response.json({ matched: true, id: created.id })
}

// Creates any missing matches for mutual likes involving the caller (catches older swipes).
export async function GET(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  return Response.json({ created: await backfillMatches(db, user.id) })
}
