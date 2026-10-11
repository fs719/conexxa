import Link from 'next/link'

export default function Privacy() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto space-y-4 text-gray-300">
        <Link href="/" className="text-gray-500 hover:text-white">← Back</Link>
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="text-sm text-gray-500">Last updated October 2026</p>
        <h2 className="text-xl font-semibold text-white pt-2">What we collect</h2>
        <p>Your .edu email, birthdate (used to check you are 18+, and stored as your age), name, gender, who you want to see, what you are looking for, bio, and optional photo. We also store your swipes, matches, icebreaker answers, messages, and any reports or blocks.</p>
        <h2 className="text-xl font-semibold text-white pt-2">Who sees it</h2>
        <p>Other Conexxa users see your name, photo, bio, and what you are looking for. They never see your email or birthdate. Messages are visible only to you and the person you are chatting with.</p>
        <h2 className="text-xl font-semibold text-white pt-2">How we use it</h2>
        <p>To run the service: verify you, show you to other people, make matches, and keep the community safe. We do not sell your data.</p>
        <h2 className="text-xl font-semibold text-white pt-2">Services we use</h2>
        <p>Your data is stored with Supabase, the site is hosted on Vercel, and verification emails are sent through Resend.</p>
        <h2 className="text-xl font-semibold text-white pt-2">Deleting your data</h2>
        <p>You can delete your account and data at any time in Settings. Reports about other users may be kept for safety.</p>
      </div>
    </main>
  )
}
