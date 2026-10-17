import { authedMatch } from '@/lib/matchAuth'

const KINDS = ['phone', 'instagram', 'snapchat']

function clean(kind: string, raw: string): string | null {
  const v = raw.trim()
  if (kind === 'phone') {
    const d = v.replace(/\D/g, '')
    if (d.length === 10) return `+1${d}`
    if (d.length === 11 && d.startsWith('1')) return `+${d}`
    if (d.length >= 11 && d.length <= 15) return `+${d}`
    return null
  }
  const h = v.replace(/^@/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : null
}

async function view(a: any, matchId: string) {
  const { data: row } = await a.db.from('contact_exchange').select('*').eq('match_id', matchId).maybeSingle()
  const myValue = row?.[`${a.me}_value`] || null
  const theirValue = row?.[`${a.them}_value`] || null
  return Response.json({
    mine: myValue ? { kind: row[`${a.me}_kind`], value: myValue } : null,
    // their contact is only returned when both people opted in
    theirs: myValue && theirValue ? { kind: row[`${a.them}_kind`], value: theirValue } : null,
  })
}

export async function GET(req: Request) {
  const matchId = new URL(req.url).searchParams.get('matchId') || ''
  const a = await authedMatch(req, matchId)
  if (a.error) return a.error
  return view(a, matchId)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const matchId = String(body.matchId || '')
  const kind = String(body.kind || '')
  const a = await authedMatch(req, matchId)
  if (a.error) return a.error
  if (!KINDS.includes(kind)) return Response.json({ error: 'Pick phone, Instagram, or Snapchat.' }, { status: 400 })
  const value = clean(kind, String(body.value || ''))
  if (!value) return Response.json({ error: kind === 'phone' ? 'Enter a valid phone number.' : 'Enter a valid username.' }, { status: 400 })
  const { data: row } = await a.db.from('contact_exchange').select('*').eq('match_id', matchId).maybeSingle()
  // Write only my columns so simultaneous opt-ins never overwrite each other.
  const mine = { [`${a.me}_kind`]: kind, [`${a.me}_value`]: value }
  let error: { message: string } | null = null
  if (row) {
    error = (await a.db.from('contact_exchange').update(mine).eq('match_id', matchId)).error
  } else {
    const ins = await a.db.from('contact_exchange').insert({ match_id: matchId, ...mine })
    error = ins.error ? (await a.db.from('contact_exchange').update(mine).eq('match_id', matchId)).error : null
  }
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return view(a, matchId)
}

// Take back your opt-in, only possible until the other person has also opted in.
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}))
  const matchId = String(body.matchId || '')
  const a = await authedMatch(req, matchId)
  if (a.error) return a.error
  const { data: row } = await a.db.from('contact_exchange').select('*').eq('match_id', matchId).maybeSingle()
  if (row?.[`${a.them}_value`]) return Response.json({ error: 'Already shared with each other.' }, { status: 409 })
  await a.db.from('contact_exchange').update({ [`${a.me}_kind`]: null, [`${a.me}_value`]: null }).eq('match_id', matchId)
  return view(a, matchId)
}
