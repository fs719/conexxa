import Link from 'next/link'
import LandingActions from '@/components/LandingActions'
import { admin, weeklyCrushes } from '@/lib/server'
import { leaderboard } from '@/lib/gate'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const crush = (await searchParams).from === 'crush'
  let week = 0
  let board: Awaited<ReturnType<typeof leaderboard>> = []
  try { const db = admin(); week = await weeklyCrushes(db); board = await leaderboard(db, 5) } catch {}
  return (
    <main className="min-h-dvh bg-ink text-white flex flex-col px-6">
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-center py-16">
        <img src="/brand/conexxa-wordmark.png" alt="Conexxa" className="h-7 w-auto mb-10" />
        {crush ? (
          <>
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.02]">Someone has a crush on you.</h1>
            <p className="text-mute text-lg mt-6 leading-snug">
              Join the list. When your school opens, you see a few faces and pick. If you pick them, you both find out. If you don't, they never know.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.02]">Match first.<br />Then talk.</h1>
            <p className="text-lg mt-6 leading-snug">
              Send a <span className="font-semibold text-flame">secret crush</span> to someone at your school. They only find out it's you if they pick you back.
            </p>
            <p className="text-mute text-lg mt-4 leading-snug">
              Your school opens when 70 students join. We email you the day it does.
            </p>
          </>
        )}
        <LandingActions />
        {board.length > 0 && (
          <div className="mt-8 space-y-2">
            <p className="text-sm text-mute">Which school opens first</p>
            {board.map((b, i) => (
              <div key={b.name + i} className="flex items-center justify-between rounded-xl bg-panel border border-line px-4 py-3 text-sm">
                <span><span className="text-mute mr-3">{i + 1}</span>{b.name}</span>
                <span className={b.live ? 'text-ok' : 'text-mute'}>{b.live ? 'Open' : `${b.count} of ${b.goal}`}</span>
              </div>
            ))}
          </div>
        )}
        {week >= 10 && <p className="text-sm text-ok mt-6">{week} secret crushes sent this week by verified students</p>}
        <p className="text-sm text-mute mt-3">For college students. You'll verify with your school email.</p>
        <p className="text-sm text-mute mt-2">No public feed. No posts. A crush only ever points at one person.</p>
      </div>
      <footer className="w-full max-w-md mx-auto py-6 text-xs text-mute flex gap-5">
        <Link href="/terms" className="hover:text-white">Terms</Link>
        <Link href="/privacy" className="hover:text-white">Privacy</Link>
      </footer>
    </main>
  )
}
