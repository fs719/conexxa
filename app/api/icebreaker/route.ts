import { admin } from '@/lib/server'
import { optionsFor } from '@/lib/icebreakers'

// Saves an icebreaker answer; unlocks chat once both people have answered.
export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const matchId = String(body.matchId || '')
  const answer = String(body.answer || '')

  const { data: m } = await db.from('matches').select('*').eq('id', matchId).maybeSingle()
  if (!m || (m.user1_id !== user.id && m.user2_id !== user.id))
    return Response.json({ error: 'Match not found.' }, { status: 404 })
  if (m.chat_unlocked) return Response.json({ unlocked: true })

  const exp = String(m.expires_at)
  if (new Date(/(Z|[+-]\d\d:?\d\d)$/.test(exp) ? exp : exp + 'Z') < new Date())
    return Response.json({ error: 'This match expired.' }, { status: 410 })
  if (!optionsFor(m.icebreaker_prompt).includes(answer))
    return Response.json({ error: 'Pick one of the options.' }, { status: 400 })

  const mine = m.user1_id === user.id ? 'user1_answer' : 'user2_answer'
  const theirs = m.user1_id === user.id ? 'user2_answer' : 'user1_answer'
  if (!m[mine]) {
    const { error } = await db.from('matches').update({ [mine]: answer }).eq('id', matchId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }
  const { data: fresh } = await db.from('matches').select('user1_answer,user2_answer').eq('id', matchId).single()
  if (fresh?.user1_answer && fresh?.user2_answer) {
    await db.from('matches').update({ chat_unlocked: true }).eq('id', matchId)
    return Response.json({ unlocked: true })
  }
  void theirs
  return Response.json({ unlocked: false })
}
