'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { parseTs } from '@/lib/time'

const Icon = ({ d }: { d: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)

const TABS = [
  { href: '/swipe', label: 'Discover', d: 'M12 21s-7-4.6-9.3-9.1C1 8.5 3 5 6.4 5c2 0 3.6 1.1 5.6 3.4C14 6.1 15.600 5 17.600 5 21 5 23 8.500 21.300 11.900 19 16.400 12 21 12 21z' },
  { href: '/matches', label: 'Matches', d: 'M21 12a8 8 0 0 1-11.600 7.100L4 20l1-4.600A8 8 0 1 1 21 12z' },
  { href: '/settings', label: 'Profile', d: 'M20 21v-1.500a4.500 4.500 0 0 0-4.500-4.500h-7A4.500 4.500 0 0 0 4 19.500V21M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
]

export default function BottomNav() {
  const path = usePathname()
  const [count, setCount] = useState(0)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('matches').select('chat_unlocked,expires_at,user1_id,user1_answer,user2_answer')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      const waiting = (data || []).filter((m: any) => {
        const mine = m.user1_id === user.id ? m.user1_answer : m.user2_answer
        return !m.chat_unlocked && !mine && parseTs(m.expires_at) > new Date()
      })
      let asked = 0
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const r = await fetch('/api/swaps', { headers: { Authorization: `Bearer ${session?.access_token}` } })
        if (r.ok) asked = ((await r.json()).asked || []).filter((mid: string) => { try { return localStorage.getItem(`conexxa_hush_${mid}`) !== '1' } catch { return true } }).length
      } catch {}
      setCount(waiting.length + asked)
    })()
  }, [path])

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-line bg-ink/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-md mx-auto grid grid-cols-3">
        {TABS.map(t => {
          const active = path === t.href
          return (
            <Link key={t.href} href={t.href} className={`relative flex flex-col items-center gap-1 py-3 text-xs font-medium transition ${active ? 'text-white' : 'text-mute hover:text-white'}`}>
              <span className="relative"><Icon d={t.d} />
                {t.href === '/matches' && count > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full btn-flame text-[11px] leading-[18px] text-center font-bold">{count}</span>
                )}
              </span>
              {t.label}
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full btn-flame" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
