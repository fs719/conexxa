'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// "Get on the list" for visitors. "Log in" shows only when a school is open (F, 2026-11-27: "there shouldn't be an
// option to sign in... It's only a QR code"), and "Open Conexxa" for someone already logged in.
export default function LandingActions({ join = '/signup', showLogin = false }: { join?: string; showLogin?: boolean }) {
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email || null)).catch(() => {}) }, [])

  if (email) return (
    <div className="mt-10 space-y-3">
      <Link href="/dashboard" className="block text-center btn-flame py-4 rounded-full font-semibold text-lg">Open Conexxa</Link>
      <p className="text-sm text-mute text-center break-words">
        Logged in as {email}.{' '}
        <button onClick={async () => { await supabase.auth.signOut(); setEmail(null) }} className="underline hover:text-white">Not you? Log out</button>
      </p>
    </div>
  )
  return (
    <div className="mt-10 space-y-3">
      <Link href={join} className="block text-center btn-flame py-4 rounded-full font-semibold text-lg">Get on the list</Link>
      {showLogin && <p className="text-sm text-mute text-center">Your school is open? <Link href="/login" className="underline hover:text-white">Log in</Link></p>}
    </div>
  )
}
