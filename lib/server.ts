import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

export const hashCode = (code: string, email: string, purpose: string) =>
  createHash('sha256')
    .update(`${code}|${email}|${purpose}|${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
    .digest('hex')

export const normEmail = (e: unknown) => String(e || '').trim().toLowerCase()
export const isEdu = (e: string) => /^[^\s@]+@[^\s@]+\.edu$/.test(e)

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
