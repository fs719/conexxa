'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Sends each person to the right first screen: waiting room, their secret crush, the "Who's yours?" screen (brand new), or Discover.
function Go() {
  const router = useRouter()
  const welcome = useSearchParams().get('welcome')
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('name').eq('id', session.user.id).maybeSingle()
      if (!prof?.name) { router.replace('/'); return }
      const r = await fetch('/api/me', { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null)
      const me = r?.ok ? await r.json() : null
      if (me && !me.school.live) router.replace('/waiting')
      else if (me?.pending) router.replace('/crush/reveal')
      else router.replace(welcome ? '/crush?welcome=1' : '/swipe')
    })()
  }, [])
  return <main className="min-h-dvh bg-ink flex items-center justify-center text-mute">Loading...</main>
}

export default function Dashboard() { return <Suspense fallback={null}><Go /></Suspense> }
