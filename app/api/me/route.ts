import { admin } from '@/lib/server'
import { mySchool } from '@/lib/gate'

// Where the signed-in person should land: school status, plus whether a secret crush is waiting for them.
export async function GET(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const school = await mySchool(db, user.email)
  let pending = false
  if (school.live) {
    const { count } = await db.from('crushes').select('id', { count: 'exact', head: true })
      .eq('target_email', (user.email || '').toLowerCase()).is('revealed_at', null)
    pending = (count ?? 0) > 0
  }
  return Response.json({ school: { name: school.name, count: school.count, goal: school.goal, live: school.live }, pending })
}
