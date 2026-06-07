'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function Chat() {
  const router = useRouter()
  const { id } = useParams()
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userId, setUserId] = useState<string>('')
  const [match, setMatch] = useState<any>(null)
  const [otherProfile, setOtherProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .eq('id', id)
        .single()

      setMatch(matchData)

      const otherId = matchData.user1_id === user.id ? matchData.user2_id : matchData.user1_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, photo_url')
        .eq('id', otherId)
        .single()

      setOtherProfile(profile)

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', id)
        .order('created_at', { ascending: true })

      setMessages(msgs || [])
      setLoading(false)
    }
    init()

    const channel = supabase
      .channel(`chat:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${id}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    await supabase.from('messages').insert({
      match_id: id,
      sender_id: userId,
      content: newMessage.trim(),
    })
    setNewMessage('')
  }

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <p>Loading chat...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-gray-800">
        <button onClick={() => router.push('/matches')} className="text-gray-400 hover:text-white">←</button>
        <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
          {otherProfile?.photo_url ? (
            <img src={otherProfile.photo_url} className="w-full h-full object-cover rounded-full" />
          ) : '👤'}
        </div>
        <h1 className="font-bold">{otherProfile?.name || 'Unknown'}</h1>
      </div>

      {match?.user1_answer && match?.user2_answer && (
        <div className="bg-gray-900 p-3 text-sm text-gray-400 border-b border-gray-800">
          <p className="font-semibold text-white mb-1">Icebreaker: {match.icebreaker_prompt}</p>
          <p>You: {match.user1_id === userId ? match.user1_answer : match.user2_answer}</p>
          <p>Them: {match.user1_id === userId ? match.user2_answer : match.user1_answer}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 mt-10">No messages yet. Say hello!</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-4 py-2 rounded-2xl ${msg.sender_id === userId ? 'bg-rose-500' : 'bg-gray-800'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-gray-800 flex gap-3">
        <input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-white"
        />
        <button onClick={sendMessage}
          className="bg-rose-500 hover:bg-rose-600 px-6 py-2 rounded-full font-semibold transition">
          Send
        </button>
      </div>
    </main>
  )
}