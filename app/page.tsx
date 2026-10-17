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
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.02]">Match first.<br />Then talk.</h1>
            <p className="text-mute text-lg mt-6 leading-snug">
              Like someone. If they like you back, you both answer one question and the chat opens.
            </p>
            <p className="text-lg mt-4 leading-snug">
              Or send a <span className="font-semibold text-flame">secret crush</span> to anyone at your school. They only find out it's you if they like you back.
            </p>
          </>
        )}
        <div className="mt-10 space-y-3">
          <Link href="/signup" className="block text-center btn-flame py-4 rounded-full font-semibold text-lg">Create account</Link>
          <Link href="/login" className="block text-center py-4 rounded-full font-semibold text-lg border border-line hover:border-white/30 transition">Log in</Link>
        </div>
        {week >= 10 && <p className="text-sm text-ok mt-6">{week} secret crushes sent this week by verified students</p>}
        <p className="text-sm text-mute mt-3">For college students. You'll verify with your .edu email.</p>
        <p className="text-sm text-mute mt-2">No public feed. No posts. A crush only ever points at one person.</p>
      </div>
      <footer className="w-full max-w-md mx-auto py-6 text-xs text-mute flex gap-5">
        <Link href="/terms" className="hover:text-white">Terms</Link>
        <Link href="/privacy" className="hover:text-white">Privacy</Link>
      </footer>
    </main>
  )
}
