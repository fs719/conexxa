import { admin } from '@/lib/server'

// Quietly ends a match: deletes it and its data, and hides both people from each other.
// The other person is not notified; the match simply disappears.
export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const matchId = String(body.matchId || '')
  const { data: m } = await db.from('matches').select('id,user1_id,user2_id').eq('id', matchId).maybeSingle()
  if (!m || (m.user1_id !== user.id && m.user2_id !== user.id))
    return Response.json({ error: 'Match not found.' }, { status: 404 })
  const other = m.user1_id === user.id ? m.user2_id : m.user1_id

  await db.from('messages').delete().eq('match_id', matchId)
  await db.from('match_rounds').delete().eq('match_id', matchId)
  await db.from('contact_exchange').delete().eq('match_id', matchId)
  const { error } = await db.from('matches').delete().eq('id', matchId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await db.from('blocks').insert({ blocker_id: user.id, blocked_id: other })
  return Response.json({ ok: true })
}
