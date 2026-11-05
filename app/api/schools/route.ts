import { admin } from '@/lib/server'
import { leaderboard, schoolStatus } from '@/lib/gate'
import { schoolDomain } from '@/lib/school'

// Public. School names and counts only. ?email=x@school.edu also returns that one school.
export async function GET(req: Request) {
  const db = admin()
  const email = new URL(req.url).searchParams.get('email')
  const board = await leaderboard(db, 10)
  const mine = email && email.includes('@') ? await schoolStatus(db, schoolDomain(email)) : null
  return Response.json({ board: board.map(({ name, count, goal, live }) => ({ name, count, goal, live })), mine })
}
