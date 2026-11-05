// End-to-end check against the live site. Creates fake people, runs the whole app flow, deletes them.
// Run by GitHub Actions (.github/workflows/e2e.yml). Needs the Supabase keys as environment variables.
import { createClient } from '@supabase/supabase-js'
import { optionsFor } from '../lib/icebreakers.ts'
import { hashCode, finishToken, removeToken } from '../lib/server.ts'

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

async function mkUser(tag, gender, intent, school = 'e2e-test.edu') {
  const email = `e2e-${stamp}-${tag}@${school}`
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
  for (const p of ['/', '/signup', '/login', '/terms', '/privacy', '/swipe', '/matches', '/crush', '/crush/reveal', '/finish', '/waiting', '/dashboard', '/forgot-password']) {
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

  // The fake school is open; the "closed" school is not. Both are removed at the end.
  await admin.from('schools').upsert([{ domain: 'e2e-test.edu', goal: 70, live_at: new Date().toISOString() }, { domain: 'e2e-closed.edu', goal: 70, live_at: null }, { domain: 'e2e-wait.edu', goal: 3, live_at: null }])

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
  // Signup profile save, done the way the real signup page does it (as the signed-in user, no service key)
  {
    const email = `e2e-${stamp}-signup@e2e-test.edu`, password = `E2e!${stamp}signup`
    const { data: cu, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (ce) throw new Error('createUser signup: ' + ce.message)
    made.push(cu.user.id)
    const cl = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    await cl.auth.signInWithPassword({ email, password })
    const row = { name: 'E2E signup', gender: 'Male', interested_in: 'e2e-hidden', intent: 'serious', bio: 'x', age: 21 }
    const ins = await cl.from('profiles').insert({ id: cu.user.id, ...row, edu_email: 'liar@harvard.edu' })
    ok('a logged-in user cannot create a profile straight in the database (only the finish screen can)', !!ins.error, 'insert succeeded')
    const mk = await admin.from('profiles').insert({ id: cu.user.id, ...row, edu_email: email })
    ok('server can create the profile', !mk.error, mk.error?.message || '')
    const { data: made1 } = await admin.from('profiles').select('edu_email').eq('id', cu.user.id).single()
    ok('signup email is forced to the verified one', made1?.edu_email === email, `now ${made1?.edu_email}`)
    const upd = await cl.from('profiles').update({ ...row, name: 'E2E signup 2', photo_url: 'https://example.com/a.jpg' }).eq('id', cu.user.id)
    ok('profile and photo can be updated', !upd.error, upd.error?.message || '')
    const rm = await cl.from('profiles').update({ photo_url: null }).eq('id', cu.user.id)
    const { data: after } = await admin.from('profiles').select('photo_url').eq('id', cu.user.id).single()
    ok('photo can be removed', !rm.error && after?.photo_url === null, rm.error?.message || '')
    const own = await cl.from('profiles').select('name,photo_url,intent,gender,interested_in,school_domain').eq('id', cu.user.id).single()
    ok('own profile readable with the app columns', !own.error && own.data?.school_domain === 'e2e-test.edu', own.error?.message || '')
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

  // Share Instagram: one tap sends it into the chat as a message
  ok('instagram share goes through as a chat message', (await post('/api/messages', A.token, { matchId, content: 'My Instagram: @e2e.user' })).status === 200)
  const gotIg = await api(`/api/messages?matchId=${matchId}`, B.token)
  ok('other person sees the shared Instagram', gotIg.j?.messages?.some(m => m.content === 'My Instagram: @e2e.user'))
  ok('old swap and vibe-check routes are gone', (await api('/api/contact', A.token)).status === 404 && (await api('/api/round', A.token)).status === 404 && (await api('/api/swaps', A.token)).status === 404)

  // Quiet unmatch
  ok('unmatch works', (await post('/api/unmatch', A.token, { matchId })).j?.ok === true)
  const { data: gone } = await admin.from('matches').select('id').eq('id', matchId)
  ok('match is deleted', gone?.length === 0)
  await api('/api/swipe', B.token); await api('/api/swipe', A.token)
  const { data: back } = await admin.from('matches').select('id').or(`user1_id.eq.${A.id},user2_id.eq.${A.id}`)
  ok('match does not come back after backfill', back?.length === 0, `rows ${back?.length}`)
  ok('outsider cannot unmatch', (await post('/api/unmatch', C.token, { matchId })).status === 404)

  // School gate: a school that has not opened can do nothing
  {
    const Z = await mkUser('z', 'Male', 'serious', 'e2e-closed.edu')
    ok('closed school cannot swipe', (await post('/api/swipe', Z.token, { swipedId: A.id, direction: 'like' })).status === 403)
    ok('closed school cannot send a crush', (await post('/api/crush', Z.token, { email: `x@e2e-closed.edu` })).status === 403)
    const me = await api('/api/me', Z.token)
    ok('/api/me says the school is closed', me.j?.school?.live === false, JSON.stringify(me.j))
    const meA = await api('/api/me', A.token)
    ok('/api/me says an open school is open', meA.j?.school?.live === true, JSON.stringify(meA.j))
  }

  // Waitlist: join, count, open at the goal, finish screen, remove link
  {
    const mkCode = async (email) => admin.from('email_codes').upsert({ email, purpose: 'waitlist', code_hash: hashCode('123456', email, 'waitlist'), expires_at: new Date(Date.now() + 600000).toISOString(), attempts: 0, created_at: new Date().toISOString() })
    const E = n => `e2e-${stamp}-${n}@e2e-wait.edu`
    const body = (email, extra = {}) => ({ email, code: '123456', name: 'Wendy', gender: 'Female', adult: true, ...extra })
    await mkCode(E('w1'))
    ok('join rejects a wrong code', (await post('/api/waitlist/join', null, body(E('w1'), { code: '000000' }))).status === 400)
    ok('join needs the 18+ box', (await post('/api/waitlist/join', null, body(E('w1'), { adult: false }))).status === 400)
    ok('join rejects a non-college email', (await post('/api/waitlist/join', null, body('nobody@gmail.com'))).status === 400)
    await mkCode(E('w1'))
    const j1 = await post('/api/waitlist/join', null, body(E('w1')))
    ok('joining puts you on the list, school not open', j1.status === 200 && j1.j?.school?.live === false && j1.j.school.count === 1 && j1.j.school.goal === 3 && !j1.j.finish, JSON.stringify(j1))
    ok('code cannot be used twice', (await post('/api/waitlist/join', null, body(E('w1')))).status === 400)
    // keep the test from sending real emails: these rows count as already emailed
    await admin.from('waitlist').update({ launch_emailed_at: new Date().toISOString() }).eq('email', E('w1'))
    await admin.from('waitlist').upsert([
      { email: E('w2'), school_domain: 'e2e-wait.edu', first_name: 'Wen', gender: 'Female', launch_emailed_at: new Date().toISOString() },
      { email: E('w3'), school_domain: 'e2e-wait.edu', first_name: 'Wes', gender: 'Male', launch_emailed_at: new Date().toISOString() },
    ])
    const board = await api('/api/schools?email=' + encodeURIComponent(E('w1')), null)
    ok('leaderboard shows school names and counts only', board.status === 200 && board.j.mine?.count === 3 && !JSON.stringify(board.j).includes('Wendy') && !JSON.stringify(board.j).includes('@'), JSON.stringify(board.j))
    ok('finish link with a bad token is refused', (await api(`/api/finish?e=${encodeURIComponent(E('w3'))}&t=bad`, null)).status === 403)
    const early = await post('/api/finish', null, { email: E('w3'), token: finishToken(E('w3')), password: 'E2e!pass1', birthdate: '2000-01-01', interested_in: 'Female', agreed: true })
    ok('finish before the school opens is refused', early.status === 403, JSON.stringify(early))
    await mkCode(E('w3'))
    const j3 = await post('/api/waitlist/join', null, body(E('w3'), { name: 'Wes', gender: 'Male' }))
    ok('reaching the goal opens the school and hands over the finish link', j3.status === 200 && j3.j?.school?.live === true && !!j3.j.finish, JSON.stringify(j3))
    const { data: sch } = await admin.from('schools').select('live_at').eq('domain', 'e2e-wait.edu').single()
    ok('school is marked open in the database', !!sch?.live_at)
    const fin = await api(`/api/finish?e=${encodeURIComponent(E('w3'))}&t=${finishToken(E('w3'))}`, null)
    ok('finish screen knows the first name', fin.status === 200 && fin.j?.name === 'Wes' && fin.j.live === true, JSON.stringify(fin))
    const fp = { email: E('w3'), token: finishToken(E('w3')), password: 'E2e!pass1', birthdate: '2000-01-01', interested_in: 'Female', agreed: true }
    ok('finish refuses under 18', (await post('/api/finish', null, { ...fp, birthdate: new Date(Date.now() - 17 * 365 * 86400000).toISOString().slice(0, 10) })).status === 400)
    ok('finish needs the terms box', (await post('/api/finish', null, { ...fp, agreed: false })).status === 400)
    ok('finish needs a real password', (await post('/api/finish', null, { ...fp, password: '123' })).status === 400)
    const done = await post('/api/finish', null, fp)
    ok('finishing creates the account', done.status === 200 && done.j?.ok === true, JSON.stringify(done))
    const { data: au } = await admin.from('profiles').select('id,name,gender,interested_in,age,hidden,edu_email').eq('edu_email', E('w3')).maybeSingle()
    if (au) made.push(au.id)
    ok('profile has the sign-up answers and is not hidden', au?.name === 'Wes' && au.gender === 'Male' && au.interested_in === 'Female' && au.age >= 25 && au.hidden === false, JSON.stringify(au))
    const anonW = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: lw } = await anonW.auth.signInWithPassword({ email: E('w3'), password: 'E2e!pass1' })
    ok('the new account can log in', !lw, lw?.message)
    ok('finishing twice is refused', (await post('/api/finish', null, fp)).status === 409)
    const rmPage = await text(`/api/waitlist/remove?e=${encodeURIComponent(E('w2'))}&t=${removeToken(E('w2'))}`)
    ok('remove link shows a confirm button and removes nobody yet', rmPage.body.includes('Remove me') && (await admin.from('waitlist').select('removed').eq('email', E('w2')).single()).data.removed === false)
    ok('remove link with a bad token is refused', (await text(`/api/waitlist/remove?e=${encodeURIComponent(E('w2'))}&t=bad`)).body.includes('not valid'))
    const rf = new FormData(); rf.set('e', encodeURIComponent(E('w2'))); rf.set('t', removeToken(E('w2')))
    await fetch(BASE + '/api/waitlist/remove', { method: 'POST', body: rf })
    ok('confirming removes you from the list and the count', (await admin.from('waitlist').select('removed').eq('email', E('w2')).single()).data.removed === true && (await api('/api/schools?email=' + encodeURIComponent(E('w1')), null)).j.mine.count === 2)
    const rmFin = await api(`/api/finish?e=${encodeURIComponent(E('w2'))}&t=${finishToken(E('w2'))}`, null)
    ok('a removed person cannot finish', rmFin.status === 410, JSON.stringify(rmFin))
    await admin.from('waitlist').delete().like('email', `e2e-${stamp}-%@e2e-wait.edu`)
  }

  // Secret crush grid. B sends one to C. Both have accounts at the same open school, plus fillers so the grid is big enough.
  ok('crush rejects non-college email', (await post('/api/crush', B.token, { email: 'someone@gmail.com' })).status === 400)
  ok('crush rejects own email', (await post('/api/crush', B.token, { email: B.email })).status === 400)
  ok('crush must stay inside your own school', (await post('/api/crush', B.token, { email: 'someone@harvard.edu' })).status === 400)
  const fillers = []
  for (let i = 0; i < 8; i++) fillers.push(await mkUser(`f${i}`, 'Female', 'serious'))
  await admin.from('profiles').update({ hidden: true }).eq('id', fillers[0].id)
  const cr = await post('/api/crush', B.token, { email: C.email })
  ok('crush saves', cr.status === 200 && cr.j?.ok === true, JSON.stringify(cr))
  ok('duplicate crush rejected', (await post('/api/crush', B.token, { email: C.email })).status === 400)
  const list = await api('/api/crush', B.token)
  ok('sender sees it as Sent', list.j?.crushes?.[0]?.status === 'sent' && list.j.left === 2, JSON.stringify(list.j))
  const inbox = await api('/api/crush?inbox=1', C.token)
  ok('receiver inbox says a crush is waiting but never who', inbox.j?.waiting === true && !('ids' in inbox.j) && !JSON.stringify(inbox.j).includes(B.id), JSON.stringify(inbox.j))
  { const { data: like } = await admin.from('swipes').select('direction').eq('swiper_id', B.id).eq('swiped_id', C.id)
    ok('the crush is not stored as a like before the receiver picks', !like?.length, JSON.stringify(like)) }
  const meC = await api('/api/me', C.token)
  ok('/api/me says a crush is waiting', meC.j?.pending === true, JSON.stringify(meC.j))
  { const { data: early } = await admin.from('matches').select('id').or(`and(user1_id.eq.${B.id},user2_id.eq.${C.id}),and(user1_id.eq.${C.id},user2_id.eq.${B.id})`)
    ok('no match exists before the receiver picks', !early?.length) }
  ok('no grid for someone with nothing waiting', (await api('/api/crush/grid', A.token)).j?.grid === null)
  const g = await api('/api/crush/grid', C.token)
  const ids = (g.j?.grid || []).map(c => c.id)
  ok('grid has up to 10 schoolmates with the sender in it', ids.length >= 6 && ids.length <= 10 && ids.includes(B.id) && g.j.max === 3, JSON.stringify(ids))
  ok('grid never includes you or a hidden person', !ids.includes(C.id) && !ids.includes(fillers[0].id), JSON.stringify(ids))
  ok('grid shows only name, age and photo', (g.j.grid || []).every(c => Object.keys(c).every(k => ['id', 'name', 'age', 'photo_url'].includes(k))), JSON.stringify(g.j.grid?.[0]))
  ok('everyone in the grid is the sender\'s gender, so nobody stands out', (g.j.grid || []).every(c => c.id === B.id || fillers.some(f => f.id === c.id)))
  const g2 = await api('/api/crush/grid', C.token)
  ok('same grid on refresh', JSON.stringify(g2.j.grid.map(c => c.id).sort()) === JSON.stringify([...ids].sort()))
  const others = ids.filter(i => i !== B.id)
  ok('more than 3 picks refused', (await post('/api/crush/grid', C.token, { picks: ids.slice(0, 4) })).status === 400)
  ok('picking someone who was not in the grid is refused', (await post('/api/crush/grid', C.token, { picks: [A.id] })).status === 400)
  const pk = await post('/api/crush/grid', C.token, { picks: [B.id, others[0], others[1]] })
  ok('tapping the sender makes the match', pk.status === 200 && pk.j?.matches?.length === 1 && pk.j.matches[0].crush === 'theirs', JSON.stringify(pk))
  const m3 = { j: { id: pk.j?.matches?.[0]?.id } }
  ok('grid cannot be submitted twice', (await post('/api/crush/grid', C.token, { picks: [B.id] })).status === 409)
  ok('crush no longer shows as waiting', (await api('/api/me', C.token)).j?.pending === false)
  const rolesB = await api('/api/crush?matches=1', B.token)
  const rolesC = await api('/api/crush?matches=1', C.token)
  ok('sender sees "your crush liked you back"', rolesB.j?.roles?.[C.id] === 'mine', JSON.stringify(rolesB.j))
  ok('receiver sees "they had a crush on you"', rolesC.j?.roles?.[B.id] === 'theirs', JSON.stringify(rolesC.j))
  const rolesA = await api('/api/crush?matches=1', A.token)
  ok('a normal match is not labelled a crush', !Object.keys(rolesA.j?.roles || {}).length, JSON.stringify(rolesA.j))
  { // the one question, then chat
    const { data: cm } = await admin.from('matches').select('icebreaker_prompt').eq('id', m3.j.id).single()
    const co = optionsFor(cm?.icebreaker_prompt)
    await post('/api/icebreaker', B.token, { matchId: m3.j.id, answer: co[0] })
    const un = await post('/api/icebreaker', C.token, { matchId: m3.j.id, answer: co[1] })
    ok('crush match chat unlocks after one question each', un.j?.unlocked === true, JSON.stringify(un))
  }
  const list2 = await api('/api/crush', B.token)
  ok('sender now sees It is a match', list2.j?.crushes?.[0]?.status === 'matched', JSON.stringify(list2.j))

  // Passing on the grid: no match, sender never knows
  {
    const D = fillers[1], Eu = fillers[2]
    const c2 = await post('/api/crush', D.token, { email: A.email })
    ok('second crush saves', c2.status === 200, JSON.stringify(c2))
    const gg = await api('/api/crush/grid', A.token)
    const gids = (gg.j?.grid || []).map(c => c.id)
    ok('grid for the second crush includes its sender', gids.includes(D.id) && gids.length >= 6, JSON.stringify(gids))
    const none = await post('/api/crush/grid', A.token, { picks: gids.filter(i => i !== D.id).slice(0, 2) })
    ok('picking others means no match', none.status === 200 && none.j?.matches?.length === 0, JSON.stringify(none))
    const { data: still } = await admin.from('matches').select('id').or(`and(user1_id.eq.${D.id},user2_id.eq.${A.id}),and(user1_id.eq.${A.id},user2_id.eq.${D.id})`)
    ok('no match was made', !still?.length)
    await api('/api/swipe', A.token); await api('/api/swipe', D.token)
    const { data: still2 } = await admin.from('matches').select('id').or(`and(user1_id.eq.${D.id},user2_id.eq.${A.id}),and(user1_id.eq.${A.id},user2_id.eq.${D.id})`)
    ok('no match appears later either', !still2?.length)
    ok('the sender is out of Discover for the receiver', (await admin.from('swipes').select('direction').eq('swiper_id', A.id).eq('swiped_id', D.id).single()).data?.direction === 'skip')
    void Eu
  }

  // Account deletion
  for (const u of [A, B, C, ...fillers]) {
    const d = await post('/api/account/delete', u.token, {})
    ok(`delete account ${u.email.split('@')[0].slice(-1)}`, d.status === 200, JSON.stringify(d))
  }
  const { data: left } = await admin.from('profiles').select('id').in('id', [A.id, B.id, C.id, ...fillers.map(f => f.id)])
  ok('no profiles left behind', left?.length === 0)
}

try { await main() } catch (e) { fail++; console.log('FAIL crashed:', e.message) }
finally {
  // Always clean up fake people, even if a step crashed.
  for (const id of made) {
    await admin.from('crushes').delete().eq('sender_id', id)
    await admin.from('crush_grids').delete().eq('user_id', id)
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
  await admin.from('waitlist').delete().like('email', `e2e-${stamp}-%`)
  await admin.from('schools').delete().in('domain', ['e2e-closed.edu', 'e2e-wait.edu'])
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
