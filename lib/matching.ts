import { admin } from '@/lib/server'
import { pickQuestion } from '@/lib/icebreakers'

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

  let created = 0
  for (const other of mutual) {
    const { data: ex } = await db.from('matches').select('id')
      .or(`and(user1_id.eq.${userId},user2_id.eq.${other}),and(user1_id.eq.${other},user2_id.eq.${userId})`).limit(1)
    if (ex?.length) continue
    const { error } = await db.from('matches').insert({
      user1_id: userId, user2_id: other,
      icebreaker_prompt: pickQuestion(),
      expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    })
    if (!error) created++
  }
  return created
}


// Who crushed on whom, for matches the crush grid made. 'theirs' = they sent you a secret crush, 'mine' = you sent them one.
// Read from a mark the grid puts on the match itself, so a match made any other way is never labelled a crush.
export async function crushRoles(db: DB, userId: string, _myEmail: string, otherIds: string[]): Promise<Record<string, 'theirs' | 'mine'>> {
  const out: Record<string, 'theirs' | 'mine'> = {}
  if (!otherIds.length) return out
  const { data: ms } = await db.from('matches').select('user1_id,user2_id,crush_sender')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`).not('crush_sender', 'is', null)
  for (const m of ms || []) {
    const other = m.user1_id === userId ? m.user2_id : m.user1_id
    if (!otherIds.includes(other)) continue
    out[other] = m.crush_sender === userId ? 'mine' : 'theirs'
  }
  return out
}
