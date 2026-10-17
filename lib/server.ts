import { createClient } from '@supabase/supabase-js'
import { createHash, createHmac } from 'crypto'

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

export const hashCode = (code: string, email: string, purpose: string) =>
  createHash('sha256')
    .update(`${code}|${email}|${purpose}|${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
    .digest('hex')

export const normEmail = (e: unknown) => String(e || '').trim().toLowerCase()
export const isEdu = (e: string) =>
  /^[^\s@]+@[^\s@]+\.edu$/.test(e) ||
  /^[^\s@]+\+conexxatest@gmail\.com$/.test(e) // TEMP test backdoor, remove before wide launch

// Plain text, no links, code in the subject: the format that reaches .edu inboxes.
export async function sendCodeEmail(to: string, code: string, purpose: string) {
  const what = purpose === 'reset' ? 'reset your password' : 'confirm your account'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Conexxa <verify@conexxa.net>',
      to: [to],
      subject: `${code} is your Conexxa code`,
      text: `Your Conexxa code is ${code}\n\nUse it to ${what}. It expires in 10 minutes. If you didn't ask for this, ignore this email.`,
    }),
  })
  if (!res.ok) throw new Error(`resend ${res.status} ${await res.text()}`)
}

// Find an auth user id by email (works even if the profile row was never saved).
export async function findUserId(email: string): Promise<string | null> {
  const db = admin()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data) return null
    const u = data.users.find(x => (x.email || '').toLowerCase() === email)
    if (u) return u.id
    if (data.users.length < 1000) return null
  }
  return null
}

// Signed token so an opt-out link can only be made by us.
export const optoutToken = (email: string) =>
  createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || '').update(`optout|${email}`).digest('hex').slice(0, 32)

export async function sendCrushEmail(to: string) {
  const link = `https://conexxa.net/api/crush/optout?e=${encodeURIComponent(to)}&t=${optoutToken(to)}`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Conexxa <verify@conexxa.net>',
      to: [to],
      subject: 'Someone at your school has a crush on you',
      text: `Someone at your school has a crush on you.\n\nThey put your email into Conexxa, a way to meet people on campus. We will never say who it is. If you join and like them back, you both find out. If you don't, nobody ever knows.\n\nTake a look: https://conexxa.net/?from=crush\n\nYou will only get this email once. To make sure you never get one like it again: ${link}`,
    }),
  })
  if (!res.ok) throw new Error(`resend ${res.status} ${await res.text()}`)
}


// Secret crushes sent in the last 7 days. If a school domain is given, only crushes sent by people at that school.
export async function weeklyCrushes(db: ReturnType<typeof admin>, domain?: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data } = await db.from('crushes').select('sender_id').gte('created_at', since).limit(10000)
  const ids = [...new Set((data || []).map((r: any) => r.sender_id))]
  if (!domain) return (data || []).length
  if (!ids.length) return 0
  const { data: ps } = await db.from('profiles').select('id').in('id', ids).eq('school_domain', domain)
  const mine = new Set((ps || []).map((r: any) => r.id))
  return (data || []).filter((r: any) => mine.has(r.sender_id)).length
}
