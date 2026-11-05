import { admin } from '@/lib/server'
import { DEFAULT_GOAL, schoolDomain, schoolFrom } from '@/lib/school'

type DB = ReturnType<typeof admin>

export type SchoolStatus = { domain: string; name: string; count: number; goal: number; live: boolean }

// Make sure a school row exists, then report where it stands.
export async function schoolStatus(db: DB, domainRaw: string): Promise<SchoolStatus> {
  const domain = schoolDomain(domainRaw)
  await db.from('schools').upsert({ domain }, { onConflict: 'domain', ignoreDuplicates: true })
  const { data: s } = await db.from('schools').select('goal,live_at').eq('domain', domain).maybeSingle()
  const { count } = await db.from('waitlist').select('email', { count: 'exact', head: true }).eq('school_domain', domain).eq('removed', false)
  return { domain, name: schoolFrom(domain) || domain, count: count ?? 0, goal: s?.goal ?? DEFAULT_GOAL, live: !!s?.live_at }
}

export const isLive = async (db: DB, domainRaw: string) => (await schoolStatus(db, domainRaw)).live

// The signed-in user's school, from their login email.
export async function mySchool(db: DB, email: string | undefined | null) {
  return schoolStatus(db, schoolDomain(email || ''))
}

// Top schools by sign-ups, for the leaderboard. Names and counts only.
export async function leaderboard(db: DB, limit = 10): Promise<SchoolStatus[]> {
  const { data: rows } = await db.from('waitlist').select('school_domain').eq('removed', false).limit(50000)
  const counts = new Map<string, number>()
  for (const r of rows || []) counts.set(r.school_domain, (counts.get(r.school_domain) || 0) + 1)
  const { data: schools } = await db.from('schools').select('domain,goal,live_at')
  const info = new Map((schools || []).map((s: any) => [s.domain, s]))
  return [...counts.entries()]
    .map(([domain, count]) => {
      const s: any = info.get(domain)
      return { domain, name: schoolFrom(domain) || domain, count, goal: s?.goal ?? DEFAULT_GOAL, live: !!s?.live_at }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
