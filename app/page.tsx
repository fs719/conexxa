import Link from 'next/link'
import LandingActions from '@/components/LandingActions'
import { admin, weeklyCrushes } from '@/lib/server'
import { leaderboard, schoolStatus, type SchoolStatus } from '@/lib/gate'
import { posterFor } from '@/lib/posters'

export const dynamic = 'force-dynamic'

// The home page, and the page every campus poster's QR code opens (conexxa.net/?s=gu1). No how-it-works text
// (F, 2026-11-20: "no need to tell them how it works"), no "Log in" unless a school is open.
export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams
  const crush = params.from === 'crush'
  const poster = posterFor(params.s)
  let week = 0
  let board: SchoolStatus[] = []
  let mine: SchoolStatus | null = null
  try {
    const db = admin()
    if (poster) mine = await schoolStatus(db, poster.domain)
    else { week = await weeklyCrushes(db); board = await leaderboard(db, 5) }
  } catch {}
  const anyOpen = poster ? !!mine?.live : board.some(b => b.live)

  return (
    <main className="min-h-dvh bg-ink text-white flex flex-col px-6">
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-center py-16">
        <img src="/brand/conexxa-wordmark.png" alt="Conexxa" className="h-7 w-auto mb-10" />
        {poster ? (
          <>
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.02]">{poster.line}</h1>
            <div className="mt-8 rounded-2xl bg-panel border border-line p-5 space-y-3">
              {mine && <>
                <p className="text-4xl font-extrabold">{mine.count} <span className="text-mute text-2xl font-semibold">of {mine.goal}</span></p>
                <div className="h-2 rounded-full bg-raised overflow-hidden"><div className="h-full btn-flame" style={{ width: `${Math.min(100, (mine.count / mine.goal) * 100)}%` }} /></div>
              </>}
              <p className="text-mute">{mine?.live ? `${poster.school} is open.` : `Goes live at ${poster.school} at ${mine?.goal ?? 70} sign-ups.`}</p>
            </div>
          </>
        ) : crush ? (
          <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.02]">Someone has a crush on you.</h1>
        ) : (
          <>
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.02]">Match first.<br />Then talk.</h1>
            <p className="text-mute text-lg mt-6 leading-snug">Your school goes live at 70 sign-ups.</p>
          </>
        )}
        <LandingActions join={poster ? `/signup?s=${poster.code}` : '/signup'} showLogin={anyOpen} />
        {!poster && board.length > 0 && (
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
        {!poster && week >= 10 && <p className="text-sm text-ok mt-6">{week} secret crushes sent this week by verified students</p>}
        <p className="text-sm text-mute mt-6">College students, 18+.{poster ? ` Not affiliated with ${poster.legal}.` : ''}</p>
      </div>
      <footer className="w-full max-w-md mx-auto py-6 text-xs text-mute flex gap-5">
        <Link href="/terms" className="hover:text-white">Terms</Link>
        <Link href="/privacy" className="hover:text-white">Privacy</Link>
      </footer>
    </main>
  )
}
