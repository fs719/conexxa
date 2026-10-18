import { authedMatch } from '@/lib/matchAuth'
import { ROUNDS, pickQuestions } from '@/lib/rounds'

async function status(a: any, matchId: string) {
  const { data } = await a.db.from('match_rounds').select('*').eq('match_id', matchId)
  const byLevel: Record<number, any> = {}
  for (const r of data || []) byLevel[r.level] = r
  const out = ROUNDS.map(r => {
    const row = byLevel[r.level]
    const mine = row?.[`${a.me}_answers`] || null
    const theirs = row?.[`${a.them}_answers`] || null
    const prevDone = r.level === 1 || (() => {
      const p = byLevel[r.level - 1]
      return !!(p?.user1_answers && p?.user2_answers)
    })()
    return {
      level: r.level, unlocked: prevDone,
      iDone: !!mine, theyDone: !!theirs,
      // answers are only revealed once both have answered
      both: mine && theirs ? { mine, theirs } : null,
    }
  })
  return Response.json({ rounds: out })
}

export async function GET(req: Request) {
  const matchId = new URL(req.url).searchParams.get('matchId') || ''
  const a = await authedMatch(req, matchId)
  if (a.error) return a.error
  return status(a, matchId)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const matchId = String(body.matchId || '')
  const level = Number(body.level)
  const answers = body.answers
  const a = await authedMatch(req, matchId)
  if (a.error) return a.error

  const base = ROUNDS.find(r => r.level === level)
  const round = base && { ...base, qs: pickQuestions(matchId) }
  if (!round || !Array.isArray(answers) || answers.length !== round.qs.length ||
      !answers.every((x: any, i: number) => Number.isInteger(x) && x >= 0 && x < round.qs[i].options.length))
    return Response.json({ error: 'Invalid answers.' }, { status: 400 })

  if (level > 1) {
    const { data: prev } = await a.db.from('match_rounds').select('user1_answers,user2_answers').eq('match_id', matchId).eq('level', level - 1).maybeSingle()
    if (!prev?.user1_answers || !prev?.user2_answers)
      return Response.json({ error: 'Finish the previous round together first.' }, { status: 403 })
  }
  const { data: row } = await a.db.from('match_rounds').select('*').eq('match_id', matchId).eq('level', level).maybeSingle()
  if (row?.[`${a.me}_answers`]) return Response.json({ error: 'You already answered this round.' }, { status: 409 })

  // Update only my column so two people answering at the same moment never overwrite each other.
  const col = `${a.me}_answers`
  let error: { message: string } | null = null
  if (row) {
    error = (await a.db.from('match_rounds').update({ [col]: answers }).eq('match_id', matchId).eq('level', level)).error
  } else {
    const ins = await a.db.from('match_rounds').insert({ match_id: matchId, level, [col]: answers })
    error = ins.error ? (await a.db.from('match_rounds').update({ [col]: answers }).eq('match_id', matchId).eq('level', level)).error : null
  }
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return status(a, matchId)
}
