'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ReportForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reportedId = searchParams.get('userId')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleReport = async () => {
    if (!reason.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_id: reportedId,
      reason,
    })
    setSubmitted(true)
    setLoading(false)
  }

  const handleBlock = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase.from('blocks').insert({
      blocker_id: user.id,
      blocked_id: reportedId,
    })
    router.push('/swipe')
  }

  if (submitted) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold">Report Submitted</h1>
        <p className="text-gray-400">Thank you. We'll review this report shortly.</p>
        <button onClick={() => router.push('/swipe')}
          className="bg-rose-500 hover:bg-rose-600 px-8 py-3 rounded-full font-semibold transition">
          Back to Swiping
        </button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">← Back</button>
          <h1 className="text-2xl font-bold">Report User</h1>
        </div>

        <div className="space-y-3">
          {['Inappropriate behavior', 'Fake profile', 'Harassment', 'Spam', 'Other'].map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`w-full py-3 px-4 rounded-xl border text-left transition ${reason === r ? 'bg-rose-500 border-rose-500' : 'border-gray-700 hover:border-rose-500'}`}>
              {r}
            </button>
          ))}
        </div>

        <button onClick={handleReport} disabled={!reason || loading}
          className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 py-3 rounded-full font-semibold transition">
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>

        <button onClick={handleBlock} disabled={loading}
          className="w-full border border-red-500 text-red-500 hover:bg-red-500 hover:text-white py-3 rounded-full font-semibold transition">
          Block This User
        </button>
      </div>
    </main>
  )
}

export default function Report() {
  return (
    <Suspense>
      <ReportForm />
    </Suspense>
  )
}