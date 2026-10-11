'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Settings() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState({ name: '', bio: '', intent: 'casual', interested_in: 'everyone', photo_url: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('name,bio,intent,interested_in,photo_url').eq('id', user.id).single()
      if (data) setForm({ name: data.name || '', bio: data.bio || '', intent: data.intent || 'casual', interested_in: data.interested_in || 'everyone', photo_url: data.photo_url || '' })
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
      name: form.name.trim(), bio: form.bio, intent: form.intent, interested_in: form.interested_in, photo_url,
    }).eq('id', userId)
    setSaving(false)
    if (error) { setMsg('Could not save. Try again.'); return }
    setForm(f => ({ ...f, photo_url })); setPhoto(null); setMsg('Saved.')
  }

  const deleteAccount = async () => {
    if (!confirm('Delete your account and all your data? This cannot be undone.')) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` } })
    if (!res.ok) { setMsg('Could not delete account. Try again.'); return }
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <main className="min-h-screen bg-black text-white flex items-center justify-center"><p>Loading...</p></main>

  const pill = (active: boolean) => `py-3 rounded-xl border transition ${active ? 'bg-rose-500 border-rose-500' : 'border-gray-700 hover:border-rose-500'}`

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white">← Back</button>
          <h1 className="text-2xl font-bold">Edit Profile</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center text-3xl overflow-hidden">
            {photo ? <img src={URL.createObjectURL(photo)} className="w-full h-full object-cover" />
              : form.photo_url ? <img src={form.photo_url} className="w-full h-full object-cover" /> : '👤'}
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPhoto(e.target.files?.[0] || null)} className="text-gray-400 text-sm" />
        </div>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white" />
        <textarea value={form.bio} maxLength={200} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Bio"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white h-28 resize-none" />
        <p className="text-gray-400 text-sm">Looking for</p>
        <div className="grid grid-cols-2 gap-3">
          {[['casual', 'Casual'], ['serious', 'Serious']].map(([v, l]) => (
            <button key={v} onClick={() => setForm({ ...form, intent: v })} className={pill(form.intent === v)}>{l}</button>
          ))}
        </div>
        <p className="text-gray-400 text-sm">Show me</p>
        <div className="grid grid-cols-3 gap-3">
          {[['Male', 'Men'], ['Female', 'Women'], ['everyone', 'Everyone']].map(([v, l]) => (
            <button key={v} onClick={() => setForm({ ...form, interested_in: v })} className={pill(form.interested_in === v)}>{l}</button>
          ))}
        </div>
        {msg && <p className={msg === 'Saved.' ? 'text-green-400' : 'text-red-500'}>{msg}</p>}
        <button disabled={saving} onClick={save} className="w-full bg-rose-500 hover:bg-rose-600 py-3 rounded-full font-semibold transition">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={deleteAccount} className="w-full text-red-400 hover:text-red-300 text-sm pt-4">Delete my account</button>
      </div>
    </main>
  )
}
