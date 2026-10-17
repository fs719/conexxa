import { admin, weeklyCrushes } from '@/lib/server'

// Weekly secret-crush count for the caller's school (falls back to all schools). Only shown once it is big enough to be real.
export async function GET(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const { data: me } = await db.from('profiles').select('school_domain').eq('id', user.id).maybeSingle()
  const school = me?.school_domain ? await weeklyCrushes(db, me.school_domain) : 0
  if (school >= 10) return Response.json({ n: school, scope: 'school' })
  const all = await weeklyCrushes(db)
  return Response.json(all >= 10 ? { n: all, scope: 'all' } : { n: 0, scope: 'none' })
}
