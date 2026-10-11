import { admin } from '@/lib/server'

// Returns ids of people who blocked the caller, so they can be hidden from swipe.
export async function GET(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ ids: [] }, { status: 401 })
  const { data } = await db.from('blocks').select('blocker_id').eq('blocked_id', user.id)
  return Response.json({ ids: (data || []).map(b => b.blocker_id) })
}
