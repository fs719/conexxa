'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// The home screen is Discover: fewer taps between opening the app and swiping.
export default function Dashboard() {
  const router = useRouter()
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()
      router.replace(prof?.name ? '/swipe' : '/signup')
    })()
  }, [])
  return <main className="min-h-dvh bg-ink flex items-center justify-center text-mute">Loading...</main>
}
