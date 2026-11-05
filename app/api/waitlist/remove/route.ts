import { admin, normEmail, tokenOk } from '@/lib/server'

const page = (inner: string) => new Response(
  `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#120e17;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px"><div>${inner}</div>`,
  { headers: { 'content-type': 'text/html' } },
)

// The link in the email opens a confirm button first, so email scanners that open links cannot remove anyone by accident.
export async function GET(req: Request) {
  const u = new URL(req.url)
  const email = normEmail(u.searchParams.get('e'))
  const t = u.searchParams.get('t') || ''
  if (!email || !tokenOk('remove', email, t)) return page('<p>This link is not valid.</p>')
  const safe = email.replace(/[<>&"]/g, '')
  return page(`<p>Take ${safe} off the Conexxa list?</p><form method="post" action="/api/waitlist/remove"><input type="hidden" name="e" value="${encodeURIComponent(email)}"><input type="hidden" name="t" value="${t.replace(/[^a-f0-9]/g, '')}"><button style="margin-top:16px;padding:12px 28px;border-radius:999px;border:0;background:#ff4d6d;color:#fff;font-size:16px">Remove me</button></form>`)
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const email = normEmail(decodeURIComponent(String(form?.get('e') || '')))
  const t = String(form?.get('t') || '')
  if (!email || !tokenOk('remove', email, t)) return page('<p>This link is not valid.</p>')
  await admin().from('waitlist').update({ removed: true }).eq('email', email)
  return page('<p>Done. You are off the list and we will not email you again.</p>')
}
