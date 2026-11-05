'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import WaitlistStatus from '@/components/WaitlistStatus'

// For anyone logged in whose school has not opened yet.
export default function Waiting() {
  const router = useRouter()
  const [s, setS] = useState<{ name: string; count: number; goal: number } | null>(null)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const r = await fetch('/api/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!r.ok) return
      const d = await r.json()
      if (d.school.live) { router.replace('/dashboard'); return }
      setS(d.school)
    })()
  }, [])
  if (!s) return <main className="min-h-dvh bg-ink flex items-center justify-center text-mute">Loading...</main>
  return (
    <main className="min-h-dvh bg-ink text-white flex justify-center p-4">
      <div className="w-full max-w-md py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Almost there</h1>
          <p className="text-mute">Everything in Conexxa opens at once when {s.name} reaches {s.goal}. We'll email you.</p>
        </div>
        <WaitlistStatus name={s.name} count={s.count} goal={s.goal} />
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="w-full text-mute hover:text-white py-2">Sign out</button>
      </div>
    </main>
  )
}
