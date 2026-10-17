import Link from 'next/link'
import { admin, weeklyCrushes } from '@/lib/server'

export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const crush = (await searchParams).from === 'crush'
  let week = 0
  try { week = await weeklyCrushes(admin()) } catch {}
  return (
    <main className="min-h-dvh bg-ink text-white flex flex-col px-6">
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-center py-16">
        <p className="font-display text-xl font-bold mb-10">Conexxa</p>
        {crush ? (
          <>
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.02]">Someone has a crush on you.</h1>
            <p className="text-mute text-lg mt-6 leading-snug">
              Join, then swipe. If you like them back, you both find out. If you don't, they never know it was you who passed.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.02]">Got a crush?<br />Tell them. Secretly.</h1>
            <p className="text-mute text-lg mt-6 leading-snug">
              Send a secret crush to anyone at your school. They never know it's you unless they like you back. Then one question opens the chat.
            </p>
          </>
        )}
        <div className="mt-10 space-y-3">
          <Link href="/signup" className="block text-center btn-flame py-4 rounded-full font-semibold text-lg">Create account</Link>
          <Link href="/login" className="block text-center py-4 rounded-full font-semibold text-lg border border-line hover:border-white/30 transition">Log in</Link>
        </div>
        {week >= 10 && <p className="text-sm text-ok mt-6">{week} secret crushes sent this week</p>}
        <p className="text-sm text-mute mt-3">For college students. You'll verify with your .edu email.</p>
      </div>
      <footer className="w-full max-w-md mx-auto py-6 text-xs text-mute flex gap-5">
        <Link href="/terms" className="hover:text-white">Terms</Link>
        <Link href="/privacy" className="hover:text-white">Privacy</Link>
      </footer>
    </main>
  )
}
