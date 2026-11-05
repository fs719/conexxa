import { admin } from '@/lib/server'
import { sendPendingLaunchEmails } from '@/lib/launch'

// Owner-only. Re-sends any launch emails that failed, or opens a school by hand. Needs ADMIN_SECRET; without it this route does nothing.
// POST { domain: "psu.edu", open?: true }  with  Authorization: Bearer <ADMIN_SECRET>
export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Not found', { status: 404 })
  const body = await req.json().catch(() => ({}))
  const domain = String(body.domain || '').toLowerCase()
  if (!domain) return Response.json({ error: 'domain required' }, { status: 400 })
  const db = admin()
  if (body.open) await db.from('schools').upsert({ domain, live_at: new Date().toISOString() }, { onConflict: 'domain' })
  const { data: s } = await db.from('schools').select('live_at').eq('domain', domain).maybeSingle()
  if (!s?.live_at) return Response.json({ error: 'school is not live' }, { status: 409 })
  return Response.json(await sendPendingLaunchEmails(db, domain))
}
