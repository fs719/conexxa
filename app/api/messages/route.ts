import { admin } from '@/lib/server'

async function authed(req: Request, matchId: string) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return { error: Response.json({ error: 'Not signed in.' }, { status: 401 }) }
  const { data: m } = await db.from('matches').select('id,user1_id,user2_id,chat_unlocked').eq('id', matchId).maybeSingle()
  if (!m || (m.user1_id !== user.id && m.user2_id !== user.id))
    return { error: Response.json({ error: 'Chat not found.' }, { status: 404 }) }
  if (!m.chat_unlocked) return { error: Response.json({ error: 'Chat is not unlocked yet.' }, { status: 403 }) }
  return { db, user }
}

export async function GET(req: Request) {
  const matchId = new URL(req.url).searchParams.get('matchId') || ''
  const a = await authed(req, matchId)
  if (a.error) return a.error
  const { data } = await a.db!.from('messages').select('*').eq('match_id', matchId)
    .order('created_at', { ascending: true }).limit(500)
  return Response.json({ messages: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const matchId = String(body.matchId || '')
  const content = String(body.content || '').trim().slice(0, 1000)
  if (!content) return Response.json({ error: 'Message is empty.' }, { status: 400 })
  const a = await authed(req, matchId)
  if (a.error) return a.error
  const { data, error } = await a.db!.from('messages')
    .insert({ match_id: matchId, sender_id: a.user!.id, content }).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ message: data })
}
