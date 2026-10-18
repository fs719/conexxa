import { admin } from '@/lib/server'

// People you have fully swapped contact with (both opted in). One-sided opt-ins are never reported.
export async function GET(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const { data: ms } = await db.from('matches').select('id,user1_id,user2_id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
  const byId = new Map((ms || []).map((m: any) => [m.id, m.user1_id === user.id ? m.user2_id : m.user1_id]))
  if (!byId.size) return Response.json({ swapped: [], asked: [] })
  const { data: rows } = await db.from('contact_exchange').select('*').in('match_id', [...byId.keys()])
  const swapped = (rows || []).filter((r: any) => r.user1_value && r.user2_value).map((r: any) => byId.get(r.match_id))
  // Matches where they opted in and you have not yet (a nudge for you, never their contact).
  const asked = (rows || []).filter((r: any) => {
    const m = (ms || []).find((x: any) => x.id === r.match_id)
    if (!m) return false
    const mine = m.user1_id === user.id ? r.user1_value : r.user2_value
    const theirs = m.user1_id === user.id ? r.user2_value : r.user1_value
    return theirs && !mine
  }).map((r: any) => r.match_id)
  return Response.json({ swapped, asked })
}
