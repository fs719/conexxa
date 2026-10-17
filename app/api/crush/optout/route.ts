import { admin, normEmail, optoutToken } from '@/lib/server'

// One-click opt-out from crush emails. Link carries a signed token.
export async function GET(req: Request) {
  const u = new URL(req.url)
  const email = normEmail(u.searchParams.get('e'))
  const ok = email && u.searchParams.get('t') === optoutToken(email)
  if (ok) await admin().from('crush_optout').upsert({ email })
  const msg = ok ? 'Done. You will not get emails like this from Conexxa again.' : 'This link is not valid.'
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#120e17;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px"><p>${msg}</p>`, { headers: { 'content-type': 'text/html' } })
}
