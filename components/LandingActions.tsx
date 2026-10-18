'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Sign-up buttons for visitors, "Open Conexxa" for someone who is already logged in (with a way to switch accounts).
export default function LandingActions() {
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email || null)).catch(() => {}) }, [])

  if (email) return (
    <div className="mt-10 space-y-3">
      <Link href="/swipe" className="block text-center btn-flame py-4 rounded-full font-semibold text-lg">Open Conexxa</Link>
      <p className="text-sm text-mute text-center break-words">
        Logged in as {email}.{' '}
        <button onClick={async () => { await supabase.auth.signOut(); setEmail(null) }} className="underline hover:text-white">Not you? Log out</button>
      </p>
    </div>
  )
  return (
    <div className="mt-10 space-y-3">
      <Link href="/signup" className="block text-center btn-flame py-4 rounded-full font-semibold text-lg">Create account</Link>
      <Link href="/login" className="block text-center py-4 rounded-full font-semibold text-lg border border-line hover:border-white/30 transition">Log in</Link>
    </div>
  )
}
