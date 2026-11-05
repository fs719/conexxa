import { admin } from '@/lib/server'
import { DEFAULT_GOAL, schoolDomain, schoolFrom } from '@/lib/school'

type DB = ReturnType<typeof admin>

export type SchoolStatus = { domain: string; name: string; count: number; goal: number; live: boolean }

// Make sure a school row exists, then report where it stands.
export async function schoolStatus(db: DB, domainRaw: string): Promise<SchoolStatus> {
  const domain = schoolDomain(domainRaw)
  const { data: s } = await db.from('schools').select('goal,live_at').eq('domain', domain).maybeSingle()
  const { count } = await db.from('waitlist').select('email', { count: 'exact', head: true }).eq('school_domain', domain).eq('removed', false)
  return { domain, name: schoolFrom(domain) || domain, count: count ?? 0, goal: s?.goal ?? DEFAULT_GOAL, live: !!s?.live_at }
}

export const isLive = async (db: DB, domainRaw: string) => (await schoolStatus(db, domainRaw)).live

// The signed-in user's school, from their login email.
export async function mySchool(db: DB, email: string | undefined | null) {
  return schoolStatus(db, schoolDomain(email || ''))
}

// Top schools by sign-ups, for the leaderboard. Names and counts only. One count per school, so nothing is cut off at a row limit.
export async function leaderboard(db: DB, limit = 10): Promise<SchoolStatus[]> {
  const { data: schools } = await db.from('schools').select('domain,goal,live_at')
  const out: SchoolStatus[] = []
  for (const s of schools || []) {
    const { count } = await db.from('waitlist').select('email', { count: 'exact', head: true }).eq('school_domain', s.domain).eq('removed', false)
    if ((count ?? 0) > 0) out.push({ domain: s.domain, name: schoolFrom(s.domain) || s.domain, count: count ?? 0, goal: s.goal, live: !!s.live_at })
  }
  return out.sort((a, b) => b.count - a.count).slice(0, limit)
}

// A person only counts once they have a finished profile. A bare login (for example from the old sign-up) can do nothing.
export async function profileOf(db: DB, userId: string) {
  const { data } = await db.from('profiles').select('id,name,gender,interested_in,school_domain,hidden').eq('id', userId).maybeSingle()
  return data && data.name ? data : null
}

// Same rule Discover has always used: a profile is shown to you if its owner wants to see your gender.
export const wants = (interest: string | null | undefined, gender: string | null | undefined) =>
  !interest || interest === 'everyone' || interest === gender
