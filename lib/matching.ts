import { admin } from '@/lib/server'
import { CASUAL, SERIOUS } from '@/lib/icebreakers'

type DB = ReturnType<typeof admin>

// Record a like without relying on a unique constraint existing on the swipes table.
export async function setLike(db: DB, swiper: string, swiped: string) {
  const { data: ex } = await db.from('swipes').select('swiper_id').eq('swiper_id', swiper).eq('swiped_id', swiped).limit(1)
  if (ex?.length) {
    await db.from('swipes').update({ direction: 'like' }).eq('swiper_id', swiper).eq('swiped_id', swiped)
    return
  }
  await db.from('swipes').insert({ swiper_id: swiper, swiped_id: swiped, direction: 'like' })
}

// Creates any missing matches for mutual likes involving this user (skips blocked pairs).
export async function backfillMatches(db: DB, userId: string) {
  const { data: mine } = await db.from('swipes').select('swiped_id').eq('swiper_id', userId).eq('direction', 'like')
  const likedIds = (mine || []).map(r => r.swiped_id)
  if (!likedIds.length) return 0
  const { data: back } = await db.from('swipes').select('swiper_id').eq('swiped_id', userId).eq('direction', 'like').in('swiper_id', likedIds)
  const { data: bl } = await db.from('blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
  const hidden = new Set((bl || []).map(b => (b.blocker_id === userId ? b.blocked_id : b.blocker_id)))
  const mutual = [...new Set((back || []).map(r => r.swiper_id))].filter(id => !hidden.has(id))

  const { data: me } = await db.from('profiles').select('intent').eq('id', userId).maybeSingle()
  const pool = me?.intent === 'serious' ? SERIOUS : CASUAL
  let created = 0
  for (const other of mutual) {
    const { data: ex } = await db.from('matches').select('id')
      .or(`and(user1_id.eq.${userId},user2_id.eq.${other}),and(user1_id.eq.${other},user2_id.eq.${userId})`).limit(1)
    if (ex?.length) continue
    const { error } = await db.from('matches').insert({
      user1_id: userId, user2_id: other,
      icebreaker_prompt: pool[Math.floor(Math.random() * pool.length)].q,
      expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    })
    if (!error) created++
  }
  return created
}


// Who crushed on whom, for people you are matched with. 'theirs' = they sent you a secret crush, 'mine' = you sent them one.
// Only ever reported for people you already matched with, so a crush is never revealed before a mutual like.
export async function crushRoles(db: any, userId: string, myEmail: string, otherIds: string[]): Promise<Record<string, 'theirs' | 'mine'>> {
  const out: Record<string, 'theirs' | 'mine'> = {}
  if (!otherIds.length) return out
  const { data: theirs } = await db.from('crushes').select('sender_id').eq('target_email', myEmail).in('sender_id', otherIds)
  for (const r of theirs || []) out[r.sender_id] = 'theirs'
  const { data: sent } = await db.from('crushes').select('target_email').eq('sender_id', userId)
  const emails = (sent || []).map((r: any) => r.target_email)
  if (emails.length) {
    const { data: ps } = await db.from('profiles').select('id').in('edu_email', emails).in('id', otherIds)
    for (const p of ps || []) if (!out[p.id]) out[p.id] = 'mine'
  }
  return out
}
