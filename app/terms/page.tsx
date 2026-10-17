import Link from 'next/link'

export default function Terms() {
  return (
    <main className="min-h-dvh bg-ink text-white p-6">
      <div className="max-w-2xl mx-auto space-y-4 text-white/80">
        <Link href="/" className="text-mute hover:text-white">← Back</Link>
        <h1 className="text-3xl font-bold text-white">Terms of Use</h1>
        <p className="text-sm text-mute">Last updated October 2026</p>
        <h2 className="text-xl font-semibold text-white pt-2">Who can use Conexxa</h2>
        <p>You must be at least 18 and have a working .edu email address. You must give true information about yourself and use only your own account.</p>
        <h2 className="text-xl font-semibold text-white pt-2">How to behave</h2>
        <p>Be respectful. Do not harass, threaten, impersonate, spam, or share anyone's private information or images without consent. Do not post sexual or violent content, or anything illegal. Do not use Conexxa to sell things or recruit.</p>
        <h2 className="text-xl font-semibold text-white pt-2">Reports and removal</h2>
        <p>You can report or block any user. We may remove content or suspend accounts that break these rules, without notice.</p>
        <h2 className="text-xl font-semibold text-white pt-2">Your safety</h2>
        <p>We cannot verify everything people say about themselves. Be careful when meeting someone new: meet in public, tell a friend, and trust your instincts.</p>
        <h2 className="text-xl font-semibold text-white pt-2">No guarantees</h2>
        <p>Conexxa is provided as is, with no promise that it will always work or that you will find a match. To the extent the law allows, we are not liable for what other users do or for losses from using the service.</p>
        <h2 className="text-xl font-semibold text-white pt-2">Ending your account</h2>
        <p>You can delete your account at any time in Settings. We may update these terms, and continuing to use Conexxa means you accept the changes.</p>
        <p>Questions: contact the Conexxa team at the email shown on conexxa.net.</p>
      </div>
    </main>
  )
}
