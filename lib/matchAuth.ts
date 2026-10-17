import { admin } from '@/lib/server'

// Verifies the caller belongs to an unlocked match. Returns the service client and which side they are.
export async function authedMatch(req: Request, matchId: string) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return { error: Response.json({ error: 'Not signed in.' }, { status: 401 }) }
  const { data: m } = await db.from('matches').select('id,user1_id,user2_id,chat_unlocked').eq('id', matchId).maybeSingle()
  if (!m || (m.user1_id !== user.id && m.user2_id !== user.id))
    return { error: Response.json({ error: 'Match not found.' }, { status: 404 }) }
  if (!m.chat_unlocked) return { error: Response.json({ error: 'Chat is not unlocked yet.' }, { status: 403 }) }
  const me = m.user1_id === user.id ? 'user1' : 'user2'
  const them = me === 'user1' ? 'user2' : 'user1'
  return { db, user, me, them } as { db: ReturnType<typeof admin>; user: { id: string }; me: 'user1' | 'user2'; them: 'user1' | 'user2'; error?: undefined }
}
