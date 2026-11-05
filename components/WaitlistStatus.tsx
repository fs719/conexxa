'use client'
import { useEffect, useState } from 'react'

type Row = { name: string; count: number; goal: number; live: boolean }

// "X of 70" for your school, the school leaderboard, and a Tell a friend button. School names and counts only.
export default function WaitlistStatus({ name, count, goal }: { name: string; count: number; goal: number }) {
  const [board, setBoard] = useState<Row[]>([])
  const [copied, setCopied] = useState(false)
  useEffect(() => { fetch('/api/schools').then(r => r.json()).then(d => setBoard(d.board || [])).catch(() => {}) }, [])
  const left = Math.max(0, goal - count)
  const share = async () => {
    const url = 'https://conexxa.net', text = `Conexxa opens at ${name} when ${goal} of us join. Get on the list.`
    try {
      if (navigator.share) { await navigator.share({ title: 'Conexxa', text, url }); return }
      await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch {}
  }
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-panel border border-line p-5 space-y-3">
        <p className="text-4xl font-extrabold">{count} <span className="text-mute text-2xl font-semibold">of {goal}</span></p>
        <div className="h-2 rounded-full bg-raised overflow-hidden"><div className="h-full btn-flame" style={{ width: `${Math.min(100, (count / goal) * 100)}%` }} /></div>
        <p className="text-mute">{left > 0 ? `${left} more ${name} students and it opens.` : `${name} is open.`}</p>
      </div>
      <button onClick={share} className="w-full btn-flame py-3 rounded-full font-semibold">{copied ? 'Link copied' : 'Tell a friend'}</button>
      {board.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-mute">Which school opens first</p>
          {board.map((b, i) => (
            <div key={b.name + i} className="flex items-center justify-between rounded-xl bg-panel border border-line px-4 py-3">
              <span><span className="text-mute mr-3">{i + 1}</span>{b.name}</span>
              <span className={b.live ? 'text-ok' : 'text-mute'}>{b.live ? 'Open' : `${b.count} of ${b.goal}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
