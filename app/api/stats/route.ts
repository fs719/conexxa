import { admin } from '@/lib/server'

const OWNERS = ['fs719@georgetown.edu']

// Owner-only numbers, computed from existing tables.
export async function GET(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user || !OWNERS.includes((user.email || '').toLowerCase())) return Response.json({ error: 'No.' }, { status: 403 })

  const n = async (q: PromiseLike<{ count: number | null }>) => (await q).count || 0
  const head = { count: 'exact' as const, head: true }
  const [likes, swipes, matches, unlocked, messages, crushes, rounds, swaps] = await Promise.all([
    n(db.from('swipes').select('*', head).eq('direction', 'like')),
    n(db.from('swipes').select('*', head)),
    n(db.from('matches').select('*', head)),
    n(db.from('matches').select('*', head).eq('chat_unlocked', true)),
    n(db.from('messages').select('*', head)),
    n(db.from('crushes').select('*', head)),
    n(db.from('match_rounds').select('*', head).not('user1_answers', 'is', null).not('user2_answers', 'is', null)),
    n(db.from('contact_exchange').select('*', head).not('user1_value', 'is', null).not('user2_value', 'is', null)),
  ])

  const { data: ps } = await db.from('profiles').select('edu_email,gender,intent,photo_url').limit(10000)
  const people = ps || []
  const count = (f: (p: any) => string) => people.reduce((a: Record<string, number>, p: any) => { const k = f(p); a[k] = (a[k] || 0) + 1; return a }, {})
  return Response.json({
    people: people.length,
    withPhoto: people.filter((p: any) => p.photo_url).length,
    schools: count((p: any) => (p.edu_email || '').split('@')[1] || 'unknown'),
    gender: count((p: any) => p.gender || 'unknown'),
    intent: count((p: any) => p.intent || 'unknown'),
    swipes, likes, matches, unlocked, messages, crushes, rounds, swaps,
  })
}
