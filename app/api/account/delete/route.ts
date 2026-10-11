import { admin } from '@/lib/server'

export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  const db = admin()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const id = user.id

  const { data: ms } = await db.from('matches').select('id').or(`user1_id.eq.${id},user2_id.eq.${id}`)
  const matchIds = (ms || []).map(m => m.id)
  if (matchIds.length) await db.from('messages').delete().in('match_id', matchIds)
  await db.from('matches').delete().or(`user1_id.eq.${id},user2_id.eq.${id}`)
  await db.from('swipes').delete().or(`swiper_id.eq.${id},swiped_id.eq.${id}`)
  await db.from('blocks').delete().or(`blocker_id.eq.${id},blocked_id.eq.${id}`)
  await db.from('profiles').delete().eq('id', id)

  const { data: files } = await db.storage.from('avatars').list(id)
  if (files?.length) await db.storage.from('avatars').remove(files.map(f => `${id}/${f.name}`))

  const { error } = await db.auth.admin.deleteUser(id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
