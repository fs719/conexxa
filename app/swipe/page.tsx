'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { schoolFrom } from '@/lib/school'

type Profile = { id: string; name: string; age?: number; intent?: string; bio?: string; photo_url?: string; gender?: string; interested_in?: string; edu_email?: string }
const domain = (e?: string) => (e || '').split('@')[1]?.toLowerCase() || ''
const wants = (interest: string | null | undefined, gender: string | null | undefined) =>
  !interest || interest === 'everyone' || interest === gender

export default function Swipe() {
  const router = useRouter()
  const [pool, setPool] = useState<Profile[]>([])
  const [seen, setSeen] = useState<string[]>([])
  const [show, setShow] = useState<string>('everyone')
  const [admirers, setAdmirers] = useState<string[]>([])
  const [needPhoto, setNeedPhoto] = useState(false)
  const [upBusy, setUpBusy] = useState(false)
  const [upErr, setUpErr] = useState('')
  const uid = useRef('')
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<any>(null)
  const [match, setMatch] = useState<{ id: string; other: Profile } | null>(null)
  const [dx, setDx] = useState(0)
  const [fly, setFly] = useState<0 | 1 | -1>(0)
  const start = useRef<number | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: myProfile } = await supabase.from('profiles').select('name, photo_url, intent, gender, interested_in, edu_email').eq('id', user.id).single()
      if (!myProfile?.name) { router.push('/signup'); return }
      setMe(myProfile)
      if (!myProfile.photo_url) { setNeedPhoto(true); setLoading(false); return }
      setShow(myProfile.interested_in || 'everyone')
      uid.current = user.id

      const { data: swipedData } = await supabase.from('swipes').select('swiped_id').eq('swiper_id', user.id)
      const { data: blockedData } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id)
      let blockedByIds: string[] = []
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const r = await fetch('/api/blocked-by', { headers: { Authorization: `Bearer ${session?.access_token}` } })
        blockedByIds = (await r.json()).ids || []
      } catch {}

      const excluded = [...new Set([
        ...(swipedData?.map((s: any) => s.swiped_id) || []),
        ...(blockedData?.map((b: any) => b.blocked_id) || []),
        ...blockedByIds,
      ])]

      let query = supabase.from('profiles').select('*').neq('id', user.id)
      if (excluded.length > 0) query = query.not('id', 'in', `(${excluded.join(',')})`)
      const { data } = await query

      let boost: string[] = []
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const r = await fetch('/api/crush?inbox=1', { headers: { Authorization: `Bearer ${session?.access_token}` } })
        boost = (await r.json()).ids || []
      } catch {}
      setAdmirers(boost)
      const mine = domain(myProfile.edu_email)
      const list = (data || []).filter((p: any) => p.name && p.intent && wants(p.interested_in, myProfile.gender))
      // Your school first, then everyone else. Each group is shuffled.
      const shuffle = (a: any[]) => a.sort(() => Math.random() - 0.5)
      const admirerCards = list.filter((p: any) => boost.includes(p.id))
      const other = list.filter((p: any) => !boost.includes(p.id))
      const same = shuffle(other.filter((p: any) => mine && domain(p.edu_email) === mine))
      const rest = shuffle(other.filter((p: any) => !(mine && domain(p.edu_email) === mine)))
      const ordered = [...same, ...rest]
      // Hide admirers among the first 10 cards at random spots so the order never gives them away.
      for (const c of admirerCards) ordered.splice(Math.min(ordered.length, 2 + Math.floor(Math.random() * 8)), 0, c)
      setPool(ordered)
      setLoading(false)
    }
    init()
  }, [])

  const profiles = pool.filter(p => !seen.includes(p.id) && wants(show, p.gender))
  const next = (id: string) => setSeen(s => [...s, id])

  const choose = async (v: string) => {
    setShow(v)
    if (uid.current) await supabase.from('profiles').update({ interested_in: v }).eq('id', uid.current)
  }

  const know = async () => {
    const p = profiles[0]
    if (!p || busy.current) return
    next(p.id)
    await supabase.from('blocks').insert({ blocker_id: uid.current, blocked_id: p.id })
  }

  const addPhoto = async (f: File | undefined) => {
    if (!f || !uid.current) return
    setUpBusy(true); setUpErr('')
    const ext = f.name.split('.').pop()
    const path = `${uid.current}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, f, { upsert: true })
    if (error) { setUpErr('Upload failed. Use a jpg, png or webp under 5MB.'); setUpBusy(false); return }
    const url = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
    await supabase.from('profiles').update({ photo_url: url }).eq('id', uid.current)
    window.location.reload()
  }

  const commit = async (direction: 'like' | 'skip') => {
    const profile = profiles[0]
    if (!profile || busy.current) return
    busy.current = true
    setFly(direction === 'like' ? 1 : -1)
    const { data: { session } } = await supabase.auth.getSession()
    const req = fetch('/api/swipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ swipedId: profile.id, direction }),
    }).then(r => r.json()).catch(() => ({}))
    await new Promise(r => setTimeout(r, 220))
    const data = await req
    setFly(0); setDx(0)
    busy.current = false
    if (data.matched) { setMatch({ id: data.id, other: profile }); return }
    next(profile.id)
  }

  const onDown = (e: React.PointerEvent) => { start.current = e.clientX; (e.target as Element).setPointerCapture?.(e.pointerId) }
  const onMove = (e: React.PointerEvent) => { if (start.current !== null) setDx(e.clientX - start.current) }
  const onUp = () => {
    if (start.current === null) return
    start.current = null
    if (dx > 110) commit('like')
    else if (dx < -110) commit('skip')
    else setDx(0)
  }

  if (needPhoto) return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <h1 className="text-3xl font-bold">Add a photo to start</h1>
        <p className="text-mute">Everyone here is real. A photo is how people know that.</p>
        <label className="block btn-flame py-4 rounded-full font-semibold text-lg cursor-pointer">
          {upBusy ? 'Uploading...' : 'Choose a photo'}
          <input type="file" accept="image/*" className="hidden" disabled={upBusy} onChange={e => addPhoto(e.target.files?.[0])} />
        </label>
        {upErr && <p className="text-flame text-sm">{upErr}</p>}
      </div>
    </main>
  )

  if (loading) return <main className="min-h-dvh bg-ink flex items-center justify-center text-mute">Finding people near you...</main>

  if (match) return (
    <main className="min-h-dvh bg-ink text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-8">
        <h1 className="pop text-5xl font-extrabold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg,#ff4d6d,#ff8a5b)' }}>It's a match</h1>
        <div className="flex justify-center items-center">
          {[me, match.other].map((p: any, i) => (
            <div key={i} className={`w-32 h-32 rounded-full overflow-hidden border-4 border-ink bg-raised flex items-center justify-center text-5xl ${i ? '-ml-6' : ''}`}>
              {p?.photo_url ? <img src={p.photo_url} alt="" className={`w-full h-full object-cover ${i && p.intent !== 'serious' ? 'unblur' : ''}`} /> : (p?.name || '?')[0].toUpperCase()}
            </div>
          ))}
        </div>
        <p className="text-mute">You and {match.other.name} liked each other. Answer one question together to open the chat. You have 24 hours.</p>
        <div className="space-y-3">
          <button onClick={() => router.push(`/icebreaker/${match.id}`)} className="w-full btn-flame py-4 rounded-full font-semibold text-lg">Answer the question</button>
          <button onClick={() => { next(match.other.id); setMatch(null) }} className="w-full text-mute hover:text-white py-2">Keep swiping</button>
        </div>
      </div>
    </main>
  )

  const profile = profiles[0]
  const mystery = profile?.intent !== 'serious'

  if (!profile) return (
    <main className="min-h-dvh bg-ink text-white pb-24">
      <div className="max-w-md mx-auto px-4 pt-4"><Switch show={show} choose={choose} /></div>
      {admirers.some(id => !seen.includes(id)) && (
        <p className="max-w-md mx-auto mt-3 mx-4 text-center text-sm rounded-xl px-3 py-2 bg-panel border border-line">Someone here has a crush on you. Switch to Both to find out who.</p>
      )}
      <div className="max-w-md mx-auto px-6 pt-24 text-center space-y-5">
        <h1 className="text-3xl font-bold">You're all caught up</h1>
        <p className="text-mute">New people join every day. Invite a friend and you'll both see more profiles.</p>
        <InviteButton />
        <div><Link href="/crush" className="inline-block mt-1 px-8 py-3 rounded-full font-semibold bg-panel border border-line hover:border-white/40">Send a secret crush</Link></div>
      </div>
      <BottomNav />
    </main>
  )

  const rot = fly ? fly * 18 : dx / 14
  const x = fly ? fly * 520 : dx

  return (
    <main className="min-h-dvh bg-ink text-white pb-24 overflow-hidden">
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <h1 className="text-2xl font-bold">Conexxa</h1>
          <div className="flex items-center gap-4">
            <Link href="/crush" className="text-sm font-medium px-3 py-1 rounded-full bg-panel border border-line hover:border-white/40">Secret crush</Link>
            <Link href={`/report?userId=${profile.id}`} className="text-sm text-mute hover:text-white">Report</Link>
          </div>
        </div>
        {admirers.some(id => !seen.includes(id)) && (
          <p className="mb-3 text-center text-sm rounded-xl px-3 py-2 bg-panel border border-line">Someone here has a crush on you. Keep swiping to find out who.</p>
        )}
        <div className="mb-3"><Switch show={show} choose={choose} /></div>

        <div
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ transform: `translateX(${x}px) rotate(${rot}deg)`, transition: start.current === null ? 'transform .22s ease' : 'none', touchAction: 'pan-y' }}
          className="relative rounded-[28px] overflow-hidden bg-panel select-none cursor-grab active:cursor-grabbing"
        >
          <div className="aspect-[3/4] w-full bg-raised flex items-center justify-center">
            {profile.photo_url
              ? <img src={profile.photo_url} alt={mystery ? '' : profile.name} draggable={false} className={`w-full h-full object-cover pointer-events-none ${mystery ? 'blur-2xl scale-125' : ''}`} />
              : <span className="text-8xl font-display text-mute">{profile.name[0].toUpperCase()}</span>}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 pt-24 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold">{mystery ? 'Mystery' : profile.name}</h2>
              {profile.age ? <span className="text-xl text-white/80">{profile.age}</span> : null}
            </div>
            <span className="inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full bg-white/15 backdrop-blur">
              {profile.intent === 'serious' ? 'Looking for something serious' : 'Keeping it casual'}
            </span>
            {schoolFrom(profile.edu_email) && <span className="inline-block mt-1 ml-2 text-xs font-medium px-2.5 py-1 rounded-full bg-white/15 backdrop-blur">✓ {schoolFrom(profile.edu_email)}</span>}
            {profile.bio && <p className="mt-3 text-white/90 leading-snug">{profile.bio}</p>}
          </div>
          <button onPointerDown={e => e.stopPropagation()} onClick={know}
            className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1.5 rounded-full bg-black/45 backdrop-blur text-white/90 hover:bg-black/65">I know them</button>
          <div style={{ opacity: Math.min(Math.max(dx, 0) / 100, 1) }} className="absolute top-6 left-6 border-4 border-ok text-ok rounded-xl px-3 py-1 text-2xl font-extrabold -rotate-12">LIKE</div>
          <div style={{ opacity: Math.min(Math.max(-dx, 0) / 100, 1) }} className="absolute top-6 right-6 border-4 border-white/70 text-white/70 rounded-xl px-3 py-1 text-2xl font-extrabold rotate-12">PASS</div>
        </div>

        <div className="flex justify-center gap-6 mt-5">
          <button aria-label="Pass" onClick={() => commit('skip')} className="w-16 h-16 rounded-full bg-panel border border-line text-2xl text-mute hover:text-white hover:border-white/40 transition active:scale-95">✕</button>
          <button aria-label="Like" onClick={() => commit('like')} className="w-20 h-16 rounded-full btn-flame text-2xl shadow-lg shadow-flame/20">♥</button>
        </div>
      </div>
      <BottomNav />
    </main>
  )
}

function Switch({ show, choose }: { show: string; choose: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-panel border border-line text-sm">
      {[['Male', 'Guys'], ['Female', 'Girls'], ['everyone', 'Both']].map(([v, l]) => (
        <button key={v} onClick={() => choose(v)}
          className={`py-2 rounded-full transition ${show === v ? 'btn-flame font-semibold' : 'text-mute hover:text-white'}`}>{l}</button>
      ))}
    </div>
  )
}

function InviteButton() {
  const [copied, setCopied] = useState(false)
  const go = async () => {
    const url = 'https://conexxa.net', text = 'Join me on Conexxa. Meet someone from your campus.'
    try {
      if (navigator.share) { await navigator.share({ title: 'Conexxa', text, url }); return }
      await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return <button onClick={go} className="btn-flame px-8 py-3 rounded-full font-semibold">{copied ? 'Link copied' : 'Invite a friend'}</button>
}
