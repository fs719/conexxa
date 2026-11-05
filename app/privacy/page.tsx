import Link from 'next/link'

export default function Privacy() {
  return (
    <main className="min-h-dvh bg-ink text-white p-6">
      <div className="max-w-2xl mx-auto space-y-4 text-white/80">
        <Link href="/" className="text-mute hover:text-white">← Back</Link>
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="text-sm text-mute">Last updated November 2026</p>
        <h2 className="text-xl font-semibold text-white pt-2">What we collect</h2>
        <p>Before your school opens, when you join the list we keep your .edu email, first name, gender, and that you confirmed you are 18 or older. Nothing is shown to anyone at that stage. When your school opens and you finish, we also keep your birthdate (used to check you are 18+, and stored as your age), who you want to see, a bio and an optional photo. We also store your swipes, matches, icebreaker answers, messages, and any reports or blocks. If you send or receive a secret crush, we keep the email address it was sent to.</p>
        <h2 className="text-xl font-semibold text-white pt-2">The list and your school opening</h2>
        <p>Your school opens when enough students have joined. Until then you are only on a list, with no profile. We email you once when it opens. Every email has a link to take you off the list. The school names and counts on the leaderboard are public; individual names are not.</p>
        <h2 className="text-xl font-semibold text-white pt-2">Who sees it</h2>
        <p>Other students at your school see your first name, photo, bio and school once you are live. Who you want to see is only used to pick the people you see; nobody else sees it. They never see your email or birthdate. You can hide yourself at any time in Settings. Messages are visible only to you and the person you are chatting with.</p>
        <h2 className="text-xl font-semibold text-white pt-2">How we use it</h2>
        <p>To run the service: verify you, show you to other people, make matches, and keep the community safe. We do not sell your data.</p>
        <h2 className="text-xl font-semibold text-white pt-2">Services we use</h2>
        <p>Your data is stored with Supabase, the site is hosted on Vercel, and emails are sent through Resend.</p>
        <h2 className="text-xl font-semibold text-white pt-2">Deleting your data</h2>
        <p>You can delete your account and data at any time in Settings. Reports about other users may be kept for safety.</p>
      </div>
    </main>
  )
}
