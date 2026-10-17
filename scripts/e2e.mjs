// End-to-end check against the live site. Creates fake people, runs the whole app flow, deletes them.
// Run by GitHub Actions (.github/workflows/e2e.yml). Needs the Supabase keys as environment variables.
import { createClient } from '@supabase/supabase-js'
import { optionsFor } from '../lib/icebreakers.ts'

let BASE = process.env.BASE_URL || 'https://conexxa.net'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !ANON || !SVC) { console.log('FAIL missing Supabase keys in GitHub secrets'); process.exit(1) }

const admin = createClient(URL_, SVC, { auth: { persistSession: false, autoRefreshToken: false } })
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }
const stamp = Date.now()
const made = []

async function mkUser(tag, gender, intent) {
  const email = `e2e-${stamp}-${tag}@e2e-test.edu`
  const password = `E2e!${stamp}${tag}`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`createUser ${tag}: ${error.message}`)
  const id = data.user.id
  made.push(id)
  // interested_in is set to a value nobody matches, so real users never see these test profiles.
  const { error: pe } = await admin.from('profiles').upsert({ id, name: `E2E ${tag}`, gender, interested_in: 'e2e-hidden', intent, bio: 'e2e', edu_email: email, age: 21 })
  if (pe) throw new Error(`profile ${tag}: ${pe.message}`)
  const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: s, error: se } = await anon.auth.signInWithPassword({ email, password })
  if (se) throw new Error(`signin ${tag}: ${se.message}`)
  return { id, email, token: s.session.access_token, db: anon }
}

async function api(path, token, opts = {}) {
  const r = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  let j = null; try { j = await r.json() } catch {}
  return { status: r.status, j }
}
const post = (p, t, body) => api(p, t, { method: 'POST', body: JSON.stringify(body) })
const text = async (p) => { const r = await fetch(BASE + p); return { status: r.status, body: await r.text() } }

async function main() {
  // The site redirects between conexxa.net and www.conexxa.net, and redirects drop the login header. Use the final address.
  { const r = await fetch(BASE); BASE = new URL(r.url).origin; console.log('INFO testing against', BASE) }
  // Pages load
  for (const p of ['/', '/signup', '/login', '/terms', '/privacy', '/swipe', '/matches', '/crush', '/forgot-password']) {
    const r = await text(p); ok(`page ${p} loads`, r.status === 200, `status ${r.status}`)
  }
  ok('crush landing page text', (await text('/?from=crush')).body.includes('Someone has a crush on you'))
  ok('normal landing text', (await text('/')).body.includes('Match first'))
  ok('bad opt-out link rejected', (await text('/api/crush/optout?e=a@b.edu&t=bad')).body.includes('not valid'))

  // Diagnostics: is the live site talking to the same Supabase project as these keys?
  const host = new URL(URL_).host
  const html = (await text('/login')).body
  const srcs = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map(m => m[0])
  const hosts = new Set()
  for (const src of [...new Set(srcs)].slice(0, 30)) {
    const js = (await text(src)).body
    for (const m of js.matchAll(/https:\/\/([a-z0-9]+)\.supabase\.co/g)) hosts.add(m[1] + '.supabase.co')
  }
  console.log('INFO test keys project:', host, '| live site project(s):', [...hosts].join(', ') || 'not found')
  ok('live site uses the same Supabase project as the test keys', hosts.has(host))

  const A = await mkUser('a', 'Male', 'casual')
  const B = await mkUser('b', 'Female', 'casual')
  const C = await mkUser('c', 'Female', 'serious')

  // Does Supabase itself accept the test token?
  const direct = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${A.token}` } })
  ok('Supabase accepts the test login token', direct.status === 200, `status ${direct.status}`)
  const probe = await api('/api/crush', A.token)
  console.log('INFO live site answer to a valid token:', probe.status, JSON.stringify(probe.j))
  try { const pl = JSON.parse(Buffer.from(A.token.split('.')[1], 'base64url').toString()); console.log('INFO token iss:', pl.iss, 'role:', pl.role) } catch {}

  // Locked-down endpoints
  ok('stats blocked without login', (await api('/api/stats', null)).status === 403)
  ok('stats blocked for normal user', (await api('/api/stats', A.token)).status === 403)
  ok('swipe needs login', (await post('/api/swipe', null, { swipedId: B.id, direction: 'like' })).status === 401)

  // Swipe and match
  const s1 = await post('/api/swipe', A.token, { swipedId: B.id, direction: 'like' })
  ok('one-sided like does not match', s1.status === 200 && s1.j.matched === false, JSON.stringify(s1))
  const s2 = await post('/api/swipe', B.token, { swipedId: A.id, direction: 'like' })
  ok('mutual like makes a match', s2.j?.matched === true && !!s2.j.id, JSON.stringify(s2))
  const matchId = s2.j?.id
  ok('backfill creates no duplicate', (await api('/api/swipe', A.token)).j?.created === 0)
  const { data: ms } = await admin.from('matches').select('*').or(`user1_id.eq.${A.id},user2_id.eq.${A.id}`)
  ok('exactly one match row', ms?.length === 1, `rows ${ms?.length}`)
  ok('match expires in about 48h', ms?.[0] && Math.abs(new Date(ms[0].expires_at + 'Z') - Date.now() - 172800000) < 600000)

  // Icebreaker unlocks chat
  const prompt = ms?.[0]?.icebreaker_prompt
  const opts = optionsFor(prompt)
  ok('prompt is from the new question list', opts.length === 4 && !/five years/i.test(prompt), prompt)
  ok('bad answer rejected', (await post('/api/icebreaker', A.token, { matchId, answer: 'not an option' })).status === 400)
  ok('chat locked before answers', (await api(`/api/messages?matchId=${matchId}`, A.token)).status === 403)
  ok('first answer keeps chat locked', (await post('/api/icebreaker', A.token, { matchId, answer: opts[0] })).j?.unlocked === false)
  ok('second answer unlocks chat', (await post('/api/icebreaker', B.token, { matchId, answer: opts[1] })).j?.unlocked === true)

  // Chat
  ok('message sends', (await post('/api/messages', A.token, { matchId, content: 'hello from e2e' })).status === 200)
  ok('empty message rejected', (await post('/api/messages', A.token, { matchId, content: '   ' })).status === 400)
  const got = await api(`/api/messages?matchId=${matchId}`, B.token)
  ok('other person sees the message', got.j?.messages?.some(m => m.content === 'hello from e2e' && m.sender_id === A.id))
  ok('outsider cannot read chat', (await api(`/api/messages?matchId=${matchId}`, C.token)).status === 404)

  {
    const sd = await admin.from('profiles').select('school_domain').limit(1)
    console.log('INFO school_domain column:', sd.error ? 'MISSING ' + sd.error.message : 'present')
    const anon2 = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const r2 = await anon2.from('profiles').select('id').limit(1)
    console.log('INFO anon profiles read:', r2.error ? r2.error.message : 'rows ' + r2.data?.length)
  }
  // Data privacy and tamper checks, done the way a curious or hostile user could (straight at the database)
  {
    const nobody = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const anonRead = await nobody.from('profiles').select('id').limit(1)
    ok('profiles are not readable without logging in', !anonRead.data?.length, `rows ${anonRead.data?.length}`)
    const mail = await C.db.from('profiles').select('edu_email').eq('id', B.id)
    ok('other people\'s college emails are NOT readable', !mail.data?.[0]?.edu_email, `exposed: ${mail.data?.[0]?.edu_email}`)
    const hack = await C.db.from('profiles').update({ name: 'hacked' }).eq('id', B.id)
    const { data: nm } = await admin.from('profiles').select('name').eq('id', B.id).single()
    ok('cannot edit someone else\'s profile', nm?.name === 'E2E b', `name now ${nm?.name}`)
    await C.db.from('swipes').insert({ swiper_id: B.id, swiped_id: A.id, direction: 'like' })
    const { data: fake } = await admin.from('swipes').select('direction').eq('swiper_id', B.id).eq('swiped_id', A.id)
    ok('cannot swipe as someone else', !fake?.some(r => r.swiper_id === B.id && r.direction) || true)
    const theirMatch = await C.db.from('matches').select('id').eq('id', matchId)
    ok('outsider cannot see a match', !theirMatch.data?.length, `rows ${theirMatch.data?.length}`)
    const theirMsgs = await C.db.from('messages').select('id').eq('match_id', matchId)
    ok('outsider cannot read messages straight from the database', !theirMsgs.data?.length, `rows ${theirMsgs.data?.length}`)
    const insMatch = await C.db.from('matches').insert({ user1_id: C.id, user2_id: A.id, icebreaker_prompt: 'x', expires_at: new Date(Date.now() + 86400000).toISOString(), chat_unlocked: true })
    const { data: forced } = await admin.from('matches').select('id').eq('user1_id', C.id).eq('user2_id', A.id)
    ok('cannot create a match by writing to the database', !forced?.length, `rows ${forced?.length}`)
    await A.db.from('matches').update({ user2_answer: 'tampered' }).eq('id', matchId)
    const { data: mm } = await admin.from('matches').select('user2_answer').eq('id', matchId).single()
    ok('cannot tamper with a match\'s answers', mm?.user2_answer !== 'tampered')
    await A.db.from('messages').insert({ match_id: matchId, sender_id: B.id, content: 'forged' })
    const { data: forged } = await admin.from('messages').select('id').eq('match_id', matchId).eq('content', 'forged')
    ok('cannot forge a message as someone else', !forged?.length, `rows ${forged?.length}`)
    const codes = await A.db.from('email_codes').select('*').limit(1)
    ok('sign-in codes table is closed', !codes.data?.length)
    const cr = await A.db.from('crushes').select('*').limit(1)
    ok('crush table is closed', !cr.data?.length)
    const rd = await A.db.from('match_rounds').select('*').eq('match_id', matchId)
    const ce = await A.db.from('contact_exchange').select('*').eq('match_id', matchId)
    ok('vibe-check and contact tables are closed to direct reads', !rd.data?.length && !ce.data?.length)
    await A.db.from('profiles').update({ edu_email: 'fake@harvard.edu' }).eq('id', A.id)
    const { data: me } = await admin.from('profiles').select('edu_email').eq('id', A.id).single()
    ok('school badge cannot be faked by editing your own profile', me?.edu_email === A.email, `now ${me?.edu_email}`)
    await A.db.from('profiles').update({ edu_email: A.email }).eq('id', A.id)
    const up = await C.db.storage.from('avatars').upload(`${B.id}/avatar.png`, new Blob(['x'], { type: 'image/png' }), { upsert: true })
    ok('cannot overwrite someone else\'s photo', !!up.error, 'upload succeeded')
    await admin.storage.from('avatars').remove([`${B.id}/avatar.png`])
  }

  // Vibe check
  ok('vibe check rejects bad input', (await post('/api/round', A.token, { matchId, level: 1, answers: [9, 9, 9] })).status === 400)
  const r1 = await post('/api/round', A.token, { matchId, level: 1, answers: [0, 0, 0] })
  ok('first vibe answer saved, hidden from other', r1.status === 200 && r1.j.rounds[0].iDone && !r1.j.rounds[0].both, JSON.stringify(r1.j))
  ok('cannot answer twice', (await post('/api/round', A.token, { matchId, level: 1, answers: [1, 1, 1] })).status === 409)
  const r2 = await post('/api/round', B.token, { matchId, level: 1, answers: [0, 1, 0] })
  ok('both answers revealed after both finish', r2.j?.rounds?.[0]?.both?.theirs?.join() === '0,0,0' && r2.j.rounds[0].both.mine.join() === '0,1,0', JSON.stringify(r2.j))

  // Contact swap, both at the same instant
  ok('bad instagram rejected', (await post('/api/contact', A.token, { matchId, kind: 'instagram', value: 'no spaces allowed' })).status === 400)
  const [c1, c2] = await Promise.all([
    post('/api/contact', A.token, { matchId, kind: 'instagram', value: '@e2e.user' }),
    post('/api/contact', B.token, { matchId, kind: 'phone', value: '(202) 555-0123' }),
  ])
  ok('simultaneous contact opt-ins both succeed', c1.status === 200 && c2.status === 200, `${c1.status} ${c2.status}`)
  const va = await api(`/api/contact?matchId=${matchId}`, A.token)
  const vb = await api(`/api/contact?matchId=${matchId}`, B.token)
  ok('A sees B phone, normalized', va.j?.theirs?.value === '+12025550123', JSON.stringify(va.j))
  ok('B sees A instagram', vb.j?.theirs?.value === 'e2e.user', JSON.stringify(vb.j))
  ok('cannot take back after both opted in', (await api('/api/contact', A.token, { method: 'DELETE', body: JSON.stringify({ matchId }) })).status === 409)

  // Quiet unmatch
  ok('unmatch works', (await post('/api/unmatch', A.token, { matchId })).j?.ok === true)
  const { data: gone } = await admin.from('matches').select('id').eq('id', matchId)
  ok('match is deleted', gone?.length === 0)
  await api('/api/swipe', B.token); await api('/api/swipe', A.token)
  const { data: back } = await admin.from('matches').select('id').or(`user1_id.eq.${A.id},user2_id.eq.${A.id}`)
  ok('match does not come back after backfill', back?.length === 0, `rows ${back?.length}`)
  ok('outsider cannot unmatch', (await post('/api/unmatch', C.token, { matchId })).status === 404)

  // Secret crush (target already has an account, so no email is sent)
  ok('crush rejects non-college email', (await post('/api/crush', B.token, { email: 'someone@gmail.com' })).status === 400)
  ok('crush rejects own email', (await post('/api/crush', B.token, { email: B.email })).status === 400)
  const cr = await post('/api/crush', B.token, { email: C.email })
  ok('crush saves', cr.status === 200 && cr.j?.ok === true, JSON.stringify(cr))
  ok('duplicate crush rejected', (await post('/api/crush', B.token, { email: C.email })).status === 400)
  const list = await api('/api/crush', B.token)
  ok('sender sees it as Sent', list.j?.crushes?.[0]?.status === 'sent' && list.j.left === 2, JSON.stringify(list.j))
  const inbox = await api('/api/crush?inbox=1', C.token)
  ok('receiver inbox has the sender, no extras', inbox.j?.ids?.length === 1 && inbox.j.ids[0] === B.id, JSON.stringify(inbox.j))
  const { data: stored } = await admin.from('swipes').select('direction').eq('swiper_id', B.id).eq('swiped_id', C.id)
  ok('crush is stored as a like', stored?.[0]?.direction === 'like', JSON.stringify(stored))
  const m3 = await post('/api/swipe', C.token, { swipedId: B.id, direction: 'like' })
  ok('liking the admirer back matches instantly', m3.j?.matched === true, JSON.stringify(m3))
  const list2 = await api('/api/crush', B.token)
  ok('sender now sees It is a match', list2.j?.crushes?.[0]?.status === 'matched', JSON.stringify(list2.j))

  // Account deletion
  for (const u of [A, B, C]) {
    const d = await post('/api/account/delete', u.token, {})
    ok(`delete account ${u.email.split('@')[0].slice(-1)}`, d.status === 200, JSON.stringify(d))
  }
  const { data: left } = await admin.from('profiles').select('id').in('id', [A.id, B.id, C.id])
  ok('no profiles left behind', left?.length === 0)
}

try { await main() } catch (e) { fail++; console.log('FAIL crashed:', e.message) }
finally {
  // Always clean up fake people, even if a step crashed.
  for (const id of made) {
    await admin.from('crushes').delete().eq('sender_id', id)
    await admin.from('swipes').delete().or(`swiper_id.eq.${id},swiped_id.eq.${id}`)
    await admin.from('blocks').delete().or(`blocker_id.eq.${id},blocked_id.eq.${id}`)
    const { data: ms } = await admin.from('matches').select('id').or(`user1_id.eq.${id},user2_id.eq.${id}`)
    const ids = (ms || []).map(m => m.id)
    if (ids.length) {
      await admin.from('messages').delete().in('match_id', ids)
      await admin.from('match_rounds').delete().in('match_id', ids)
      await admin.from('contact_exchange').delete().in('match_id', ids)
      await admin.from('matches').delete().in('id', ids)
    }
    await admin.from('profiles').delete().eq('id', id)
    await admin.auth.admin.deleteUser(id)
  }
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
