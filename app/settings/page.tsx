'use client'
import PhotoPicker from '@/components/PhotoPicker'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

export default function Settings() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState({ name: '', bio: '', interested_in: 'everyone', photo_url: '' })
  const [hidden, setHidden] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('name,bio,interested_in,photo_url,hidden').eq('id', user.id).single()
      if (data) setHidden(!!data.hidden)
      if (data) setForm({ name: data.name || '', bio: data.bio || '', interested_in: data.interested_in || 'everyone', photo_url: data.photo_url || '' })
      setLoading(false)
    })()
  }, [])

  const save = async () => {
    if (!form.name.trim()) { setMsg('Name is required.'); return }
    setSaving(true); setMsg('')
    let photo_url = form.photo_url
    if (photo) {
      const ext = photo.name.split('.').pop()
      const path = `${userId}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, photo, { upsert: true })
      if (error) { setMsg('Photo upload failed. Use a jpg, png or webp under 5MB.'); setSaving(false); return }
      photo_url = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
    }
    const { error } = await supabase.from('profiles').update({
      name: form.name.trim(), bio: form.bio, interested_in: form.interested_in, photo_url: photo_url || null,
    }).eq('id', userId)
    setSaving(false)
    if (error) { setMsg('Could not save. Try again.'); return }
    setForm(f => ({ ...f, photo_url })); setPhoto(null); setMsg('Saved.')
  }

  const [copied, setCopied] = useState(false)
  const invite = async () => {
    const url = 'https://conexxa.net', text = 'Got a crush on someone at school? Send it secretly on Conexxa.'
    try {
      if (navigator.share) { await navigator.share({ title: 'Conexxa', text, url }); return }
      await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const deleteAccount = async () => {
    if (!confirm('Delete your account and all your data? This cannot be undone.')) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` } })
    if (!res.ok) { setMsg('Could not delete account. Try again.'); return }
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <main className="min-h-dvh bg-ink text-white flex items-center justify-center"><p>Loading...</p></main>

  const pill = (active: boolean) => `py-3 rounded-xl border transition ${active ? 'btn-flame border-transparent' : 'border-line hover:border-white/40'}`

  return (
    <main className="min-h-dvh bg-ink text-white p-6 pb-28">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Profile</h1>
        </div>
        <button onClick={async () => { const next = !hidden; setHidden(next); const { error } = await supabase.from('profiles').update({ hidden: next }).eq('id', userId); if (error) { setHidden(!next); setMsg('Could not update. Try again.') } }}
          className={`w-full text-left rounded-2xl border p-4 transition ${hidden ? 'border-white/40 bg-raised' : 'border-line bg-panel'}`}>
          <span className="font-semibold">{hidden ? 'You are hidden. Tap to go live again' : 'Hide me'}</span>
          <span className="block text-sm text-mute mt-1">{hidden ? 'Nobody at your school can see you in Discover or in a crush grid.' : 'Pause your profile any time. Nobody sees you until you turn it back on.'}</span>
        </button>
        <PhotoPicker file={photo} url={form.photo_url} onFile={setPhoto} onRemove={() => { setPhoto(null); setForm(f => ({ ...f, photo_url: '' })) }} />
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name"
          className="w-full bg-panel border border-line rounded-xl p-3 text-white" />
        <textarea value={form.bio} maxLength={200} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Bio"
          className="w-full bg-panel border border-line rounded-xl p-3 text-white h-28 resize-none" />
        <p className="text-mute text-sm">Show me</p>
        <div className="grid grid-cols-3 gap-3">
          {[['Male', 'Men'], ['Female', 'Women'], ['everyone', 'Everyone']].map(([v, l]) => (
            <button key={v} onClick={() => setForm({ ...form, interested_in: v })} className={pill(form.interested_in === v)}>{l}</button>
          ))}
        </div>
        {msg && <p className={msg === 'Saved.' ? 'text-green-400' : 'text-flame'}>{msg}</p>}
        <button disabled={saving} onClick={save} className="w-full btn-flame py-3 rounded-full font-semibold transition">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={invite} className="w-full border border-line hover:border-white/30 py-3 rounded-full font-semibold transition">{copied ? 'Link copied' : 'Invite friends'}</button>
        <button onClick={signOut} className="w-full text-mute hover:text-white py-2">Sign out</button>
        <button onClick={deleteAccount} className="w-full text-red-400 hover:text-red-300 text-sm pt-4">Delete my account</button>
      </div>
      <BottomNav />
    </main>
  )
}
