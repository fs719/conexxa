import { admin } from '@/lib/server'
import { mySchool, profileOf, wants } from '@/lib/gate'
import { schoolDomain } from '@/lib/school'

// The Discover deck, built on the server so other students' preferences and hidden flags never reach the browser.
// Your own school only, nobody hidden, nobody you have already swiped or blocked, and only people who want to see your gender.
export async function GET(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const school = await mySchool(db, user.email)
  if (!school.live) return Response.json({ error: 'Your school is not open yet.', closed: true }, { status: 403 })
  const me = await profileOf(db, user.id)
  if (!me) return Response.json({ error: 'Finish joining first.' }, { status: 403 })

  const { data: swiped } = await db.from('swipes').select('swiped_id').eq('swiper_id', user.id).limit(5000)
  const { data: bl } = await db.from('blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
  const out = new Set<string>([user.id, ...(swiped || []).map(s => s.swiped_id), ...(bl || []).map(b => (b.blocker_id === user.id ? b.blocked_id : b.blocker_id))])

  const { data } = await db.from('profiles').select('id,name,age,bio,photo_url,gender,interested_in,hidden,school_domain')
    .or(`school_domain.eq.${school.domain},school_domain.like.*.${school.domain}`).limit(1000)
  const people = (data || [])
    .filter(p => p.name && !p.hidden && !out.has(p.id) && schoolDomain(p.school_domain) === school.domain && wants(p.interested_in, me.gender))
    .map(({ id, name, age, bio, photo_url, gender, school_domain }) => ({ id, name, age, bio, photo_url, gender, school_domain }))
    .sort(() => Math.random() - 0.5)
  return Response.json({ people, me: { interested_in: me.interested_in || 'everyone' } })
}
