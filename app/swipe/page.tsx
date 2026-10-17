'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const ICEBREAKERS_CASUAL = [
  "What's the weirdest thing you've ever Googled?",
  "Pineapple on pizza: Yes or no?",
  "What's your go-to karaoke song?",
  "Would you rather fight 100 duck-sized horses or one horse-sized duck?",
  "What's your guilty pleasure TV show or movie?",
]

const ICEBREAKERS_SERIOUS = [
  "What's the one thing you're most passionate about in life?",
  "What's a lesson you learned the hard way?",
  "What's your dream for the next five years?",
  "What's the best piece of advice you've ever received?",
  "Describe your perfect day in a sentence.",
]

export default function Swipe() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<any[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')
  const [userIntent, setUserIntent] = useState<string>('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('intent, gender, interested_in')
        .eq('id', user.id)
        .single()

      if (myProfile) setUserIntent(myProfile.intent)

        const { data: swipedData } = await supabase
        .from('swipes')
        .select('swiped_id')
        .eq('swiper_id', user.id)

      const { data: blockedData } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id)

      let blockedByIds: string[] = []
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const r = await fetch('/api/blocked-by', { headers: { Authorization: `Bearer ${session?.access_token}` } })
        blockedByIds = (await r.json()).ids || []
      } catch {}

      const swipedIds = swipedData?.map((s: any) => s.swiped_id) || []
      const blockedIds = blockedData?.map((b: any) => b.blocked_id) || []
      const excludedIds = [...new Set([...swipedIds, ...blockedIds, ...blockedByIds])]

      let query = supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)

      if (excludedIds.length > 0) {
        query = query.not('id', 'in', `(${excludedIds.join(',')})`)
      }

      const { data: profilesData } = await query

      const wants = (interest: string | null, gender: string | null) =>
        !interest || interest === 'everyone' || interest === gender
      const filtered = (profilesData || []).filter((p: any) =>
        p.name && p.intent &&
        wants(myProfile?.interested_in, p.gender) &&
        wants(p.interested_in, myProfile?.gender))

      setProfiles(filtered)
      setLoading(false)
    }
    init()
  }, [])

  const handleSwipe = async (direction: 'like' | 'skip') => {
    const profile = profiles[current]
    if (!profile) return
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch('/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ swipedId: profile.id, direction }),
      })
      const data = await res.json()
      if (data.matched) { router.push('/matches'); return }
    } catch {}
    setCurrent(prev => prev + 1)
  }

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <p>Loading profiles...</p>
    </main>
  )

  if (current >= profiles.length) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <h1 className="text-2xl font-bold">You've seen everyone!</h1>
        <p className="text-gray-400">Check back later for new profiles.</p>
        <button onClick={() => router.push('/dashboard')}
          className="bg-rose-500 hover:bg-rose-600 px-8 py-3 rounded-full font-semibold transition">
          Back to Dashboard
        </button>
      </div>
    </main>
  )

  const profile = profiles[current]

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-between items-center">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white">← Back</button>
          <h1 className="text-xl font-bold">Conexxa</h1>
          <div className="text-gray-400">{current + 1}/{profiles.length}</div>
        </div>

        <div className="bg-gray-900 rounded-3xl p-6 space-y-4">
          <div className="w-full h-48 bg-gray-800 rounded-2xl flex items-center justify-center text-6xl">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt={profile.name} className="w-full h-full object-cover rounded-2xl" />
            ) : '👤'}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{profile.name || 'Anonymous'}</h2>
            <p className="text-gray-400">{profile.intent === 'serious' ? '💍 Serious' : '💫 Casual'}</p>
          </div>
          {profile.bio && <p className="text-gray-300">{profile.bio}</p>}
          {profile.interests?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((i: string) => (
                <span key={i} className="bg-gray-800 px-3 py-1 rounded-full text-sm">#{i}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end mb-1">
  <button onClick={() => router.push(`/report?userId=${profile.id}`)}
    className="text-gray-600 hover:text-gray-400 text-sm transition">
    Report
  </button>
</div>
<div className="flex gap-4">
          <button onClick={() => handleSwipe('skip')}
            className="flex-1 bg-gray-900 hover:bg-gray-800 py-4 rounded-2xl text-2xl transition">
            ✕
          </button>
          <button onClick={() => handleSwipe('like')}
            className="flex-1 bg-rose-500 hover:bg-rose-600 py-4 rounded-2xl text-2xl transition">
            ♥
          </button>
        </div>
      </div>
    </main>
  )
}