import { after } from 'next/server'
import { admin, finishToken, removeToken } from '@/lib/server'
import { schoolFrom } from '@/lib/school'

type DB = ReturnType<typeof admin>

// Opens a school the moment it reaches its goal. Safe to call many times: only the first call flips it.
export async function openIfReady(db: DB, domain: string): Promise<boolean> {
  const { data: s } = await db.from('schools').select('goal,live_at').eq('domain', domain).maybeSingle()
  if (!s || s.live_at) return false
  const { count } = await db.from('waitlist').select('email', { count: 'exact', head: true }).eq('school_domain', domain).eq('removed', false)
  if ((count ?? 0) < s.goal) return false
  const { data: flipped } = await db.from('schools').update({ live_at: new Date().toISOString() }).eq('domain', domain).is('live_at', null).select('domain')
  if (!flipped?.length) return false // someone else opened it first
  // The school is open as soon as it flips. The emails go out after the response, so a big list never holds up the last person to join.
  const send = () => sendPendingLaunchEmails(db, domain).catch(e => console.error('launch send', e))
  try { after(send) } catch { await send() }
  return true
}

const launchBody = (email: string, hasAccount: boolean, school: string) => {
  const remove = `https://conexxa.net/api/waitlist/remove?e=${encodeURIComponent(email)}&t=${removeToken(email)}`
  if (hasAccount)
    return `${school} is live on Conexxa.\n\nLog in and you're in: https://conexxa.net/login\n\nTo leave the list: ${remove}`
  return `${school} is live on Conexxa.\n\nOne screen left: set a password, add a photo if you want, and pick who you want to see. Then you're live.\n\nFinish here: https://conexxa.net/finish?e=${encodeURIComponent(email)}&t=${finishToken(email)}\n\nNot interested? Take me off the list: ${remove}`
}

// Sends the "your school is live" email to everyone on the list who has not had it yet. Retry-safe.
// Each batch is claimed first (marked as emailed) so two runs at once can never send the same person two emails; a failed batch is un-claimed.
export async function sendPendingLaunchEmails(db: DB, domain: string): Promise<{ sent: number; failed: number }> {
  const school = schoolFrom(domain) || domain
  let sent = 0, failed = 0
  for (let round = 0; round < 200; round++) {
    const { data: rows } = await db.from('waitlist').select('email,has_account')
      .eq('school_domain', domain).eq('removed', false).is('launch_emailed_at', null).limit(100)
    if (!rows?.length) break
    const emails = rows.map((r: { email: string }) => r.email)
    const { data: claimed } = await db.from('waitlist').update({ launch_emailed_at: new Date().toISOString() })
      .in('email', emails).is('launch_emailed_at', null).select('email,has_account')
    if (!claimed?.length) continue
    const body = claimed.map((r: { email: string; has_account: boolean }) => ({
      from: 'Conexxa <verify@conexxa.net>',
      to: [r.email],
      subject: `${school} is live on Conexxa`,
      text: launchBody(r.email, r.has_account, school),
    }))
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`resend ${res.status} ${await res.text()}`)
      sent += claimed.length
    } catch (e) {
      console.error('launch email batch failed', e)
      await db.from('waitlist').update({ launch_emailed_at: null }).in('email', claimed.map((r: { email: string }) => r.email))
      failed += claimed.length
      break // stop here; the admin retry picks up the rest
    }
    await new Promise(r => setTimeout(r, 700))
  }
  return { sent, failed }
}
