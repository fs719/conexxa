import { admin, normEmail, optoutToken } from '@/lib/server'

const page = (inner: string) => new Response(
  `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#120e17;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px"><div>${inner}</div>`,
  { headers: { 'content-type': 'text/html' } },
)

// The link in a crush email opens a confirm button first, so email scanners that open links cannot opt anyone out by accident.
export async function GET(req: Request) {
  const u = new URL(req.url)
  const email = normEmail(u.searchParams.get('e'))
  const t = u.searchParams.get('t') || ''
  if (!email || t !== optoutToken(email)) return page('<p>This link is not valid.</p>')
  return page(`<p>Stop emails like this from Conexxa?</p><form method="post" action="/api/crush/optout"><input type="hidden" name="e" value="${encodeURIComponent(email)}"><input type="hidden" name="t" value="${t.replace(/[^a-f0-9]/g, '')}"><button style="margin-top:16px;padding:12px 28px;border-radius:999px;border:0;background:#ff4d6d;color:#fff;font-size:16px">Yes, stop them</button></form>`)
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const email = normEmail(decodeURIComponent(String(form?.get('e') || '')))
  const t = String(form?.get('t') || '')
  if (!email || t !== optoutToken(email)) return page('<p>This link is not valid.</p>')
  await admin().from('crush_optout').upsert({ email })
  return page('<p>Done. You will not get emails like this from Conexxa again.</p>')
}
